import type {
  ChatCompletionContentPart,
  ChatCompletionMessageParam
} from 'openai/resources/chat/completions'
import {
  ChatMessageRole,
  Prisma,
  ResponseMode
} from '@/generated/prisma/client'
import { getQwenClient } from '@/lib/ai/qwen-client'
import { createQwenImagePartsFromFiles } from '@/lib/ai/qwen-file-parts'
import { AppApiError } from '@/lib/api/api-error'
import { prisma } from '@/lib/db/prisma'
import type { CreateMessageInput } from '@/server/chats/chat-schemas'
import { createChatUserMessage, getUserChat } from '@/server/chats/chat-service'
import {
  buildKnowledgeRagContext,
  buildRagSystemInstruction
} from '@/server/knowledge/knowledge-rag-service'
import { getAiRuntimeSettings } from '@/server/settings/ai-settings-service'

const MAX_HISTORY_MESSAGES = 20
const QWEN_VISION_MODEL = 'qwen3.7-plus'

function getSystemPrompt(responseMode?: ResponseMode | null) {
  const basePrompt = `
Ты AI-ассистент для менеджеров компании.
Отвечай на русском языке, если пользователь не попросил другой язык.
Помогай менеджеру быстро отвечать клиентам, разбирать запросы, формировать понятные ответы и находить следующий шаг.
Пиши ясно, по делу, без лишней воды.
Если информации недостаточно, прямо скажи, что нужно уточнить. Ты должен полностью изучить всю базу знаний знать цены о каждом товаре знать какие товары производят и так далее изучить всё не говорить что в базе нету этого я-то изучи всю бату там всё есть!!!!

`.trim()

  if (responseMode === ResponseMode.ADVANCED) {
    return `
${basePrompt}

Режим ответа: ADVANCED.
Давай более подробный разбор:
- суть запроса клиента
- что можно ответить
- какие уточняющие вопросы задать
- какой следующий шаг предложить
`.trim()
  }

  return `
${basePrompt}

Режим ответа: NORMAL.
Дай короткий, практичный ответ, который менеджер сможет быстро использовать.
`.trim()
}

function mapDbRoleToAiRole(
  role: ChatMessageRole
): 'user' | 'assistant' | 'system' {
  if (role === ChatMessageRole.ASSISTANT) {
    return 'assistant'
  }

  if (role === ChatMessageRole.SYSTEM) {
    return 'system'
  }

  return 'user'
}

function makeChatTitleFromText(text: string) {
  const normalized = text.trim().replace(/\s+/g, ' ')

  if (!normalized) {
    return 'Вложения'
  }

  if (normalized.length <= 60) {
    return normalized
  }

  return `${normalized.slice(0, 60)}...`
}

function makeCompletionUsageJson(
  usage:
    | {
        prompt_tokens?: number
        completion_tokens?: number
        total_tokens?: number
      }
    | null
    | undefined
): Prisma.InputJsonObject | null {
  if (!usage) {
    return null
  }

  return {
    promptTokens: usage.prompt_tokens ?? null,
    completionTokens: usage.completion_tokens ?? null,
    totalTokens: usage.total_tokens ?? null
  }
}

function getAssistantText(content: unknown) {
  if (typeof content === 'string') {
    return content.trim()
  }

  if (Array.isArray(content)) {
    return content
      .map(part => {
        if (typeof part === 'string') return part

        if (
          part &&
          typeof part === 'object' &&
          'text' in part &&
          typeof part.text === 'string'
        ) {
          return part.text
        }

        return ''
      })
      .filter(Boolean)
      .join('\n')
      .trim()
  }

  return ''
}

function normalizeStreamToken(content: unknown) {
  if (typeof content === 'string') {
    return content
  }

  if (Array.isArray(content)) {
    return content
      .map(part => {
        if (typeof part === 'string') return part

        if (
          part &&
          typeof part === 'object' &&
          'text' in part &&
          typeof part.text === 'string'
        ) {
          return part.text
        }

        return ''
      })
      .filter(Boolean)
      .join('')
  }

  return ''
}

function createUserContentForQwen(params: {
  text: string
  imageParts: ChatCompletionContentPart[]
}) {
  const text = params.text.trim()
  const imageParts = params.imageParts

  if (imageParts.length === 0) {
    return text
  }

  return [
    {
      type: 'text',
      text: text || 'Опиши изображение'
    },
    ...imageParts
  ] satisfies ChatCompletionContentPart[]
}

async function prepareAiRequestData(params: {
  userId: string
  chatId: string
  input: CreateMessageInput
  userMessageId: string
  cleanText: string
  responseMode?: ResponseMode
}) {
  const { userId, chatId, input, userMessageId, cleanText, responseMode } =
    params

  const fileIds = input.fileIds ?? []
  const aiSettings = await getAiRuntimeSettings()

  const files =
    fileIds.length > 0
      ? await prisma.file.findMany({
          where: {
            id: {
              in: fileIds
            },
            ownerId: userId
          }
        })
      : []

  const imageParts = await createQwenImagePartsFromFiles(files)
  const hasImages = imageParts.length > 0
  const model = hasImages ? QWEN_VISION_MODEL : aiSettings.chatModel

  const ragQuery = cleanText || files.map(file => file.originalName).join(' ')

  const ragContext = await buildKnowledgeRagContext({
    query: ragQuery || 'Вложения',
    limit: aiSettings.ragMaxChunks
  })

  const ragInstruction = buildRagSystemInstruction(ragContext.contextText)

  const systemPrompt = [getSystemPrompt(responseMode), ragInstruction]
    .filter(Boolean)
    .join('\n\n')

  const recentMessages = await prisma.message.findMany({
    where: {
      chatId,
      id: {
        not: userMessageId
      }
    },
    orderBy: {
      createdAt: 'desc'
    },
    take: MAX_HISTORY_MESSAGES
  })

  const orderedMessages = recentMessages.reverse()

  const historyMessages: ChatCompletionMessageParam[] = orderedMessages.map(
    message => ({
      role: mapDbRoleToAiRole(message.role),
      content: message.content
    })
  )

  const currentUserContent = createUserContentForQwen({
    text: cleanText,
    imageParts: imageParts as ChatCompletionContentPart[]
  })

  const messages: ChatCompletionMessageParam[] = [
    {
      role: 'system',
      content: systemPrompt
    },
    ...historyMessages,
    {
      role: 'user',
      content: currentUserContent
    }
  ]

  return {
    aiSettings,
    files,
    imageParts,
    hasImages,
    model,
    ragContext,
    messages
  }
}

export async function createChatMessageWithAi(
  userId: string,
  chatId: string,
  input: CreateMessageInput
) {
  const cleanText = input.text.trim()
  const fileIds = input.fileIds ?? []

  if (!cleanText && fileIds.length === 0) {
    throw new AppApiError(400, 'Сообщение не может быть пустым')
  }

  const responseMode = input.responseMode as ResponseMode | undefined

  const userMessage = await createChatUserMessage(userId, chatId, {
    ...input,
    text: cleanText || 'Вложения'
  })

  const chat = await getUserChat(userId, chatId)

  const { files, imageParts, hasImages, model, ragContext, messages } =
    await prepareAiRequestData({
      userId,
      chatId,
      input,
      userMessageId: userMessage.id,
      cleanText,
      responseMode
    })

  const qwen = getQwenClient()

  const completion = await qwen.chat.completions.create({
    model,
    messages,
    temperature: responseMode === ResponseMode.ADVANCED ? 0.4 : 0.2
  })

  const assistantText = getAssistantText(
    completion.choices[0]?.message?.content
  )

  if (!assistantText) {
    throw new AppApiError(502, 'Qwen вернул пустой ответ')
  }

  const metadata: Prisma.InputJsonObject = {
    provider: 'qwen',
    completionId: completion.id,
    model,
    hasImages,
    filesCount: files.length,
    imageFilesCount: imageParts.length,
    fileIds,
    usage: makeCompletionUsageJson(completion.usage),
    rag: {
      enabled: ragContext.enabled,
      query: ragContext.query,
      chunksCount: ragContext.chunks.length,
      chunks: ragContext.chunks.map(chunk => ({
        id: chunk.id,
        conversationId: chunk.conversationId,
        chunkType: chunk.chunkType,
        score: chunk.score,
        sourceId: chunk.sourceId,
        channel: chunk.channel
      }))
    }
  }

  const assistantMessage = await prisma.$transaction(async tx => {
    const message = await tx.message.create({
      data: {
        chatId,
        userId,
        role: ChatMessageRole.ASSISTANT,
        content: assistantText,
        responseMode,
        model,
        metadata
      },
      include: {
        attachments: {
          include: {
            file: true
          }
        }
      }
    })

    await tx.chat.update({
      where: {
        id: chatId
      },
      data: {
        title:
          chat.title === 'Новый чат'
            ? makeChatTitleFromText(cleanText || 'Вложения')
            : undefined,
        lastMessageAt: new Date()
      }
    })

    return message
  })

  return {
    userMessage,
    assistantMessage
  }
}

export async function createChatMessageWithAiStream(
  userId: string,
  chatId: string,
  input: CreateMessageInput,
  callbacks: {
    onToken: (token: string) => void
    onDone?: (data: { userMessage: unknown; assistantMessage: unknown }) => void
  }
) {
  const cleanText = input.text.trim()
  const fileIds = input.fileIds ?? []

  if (!cleanText && fileIds.length === 0) {
    throw new AppApiError(400, 'Сообщение не может быть пустым')
  }

  const responseMode = input.responseMode as ResponseMode | undefined

  const userMessage = await createChatUserMessage(userId, chatId, {
    ...input,
    text: cleanText || 'Вложения'
  })

  const chat = await getUserChat(userId, chatId)

  const { files, imageParts, hasImages, model, ragContext, messages } =
    await prepareAiRequestData({
      userId,
      chatId,
      input,
      userMessageId: userMessage.id,
      cleanText,
      responseMode
    })

  const qwen = getQwenClient()

  const stream = await qwen.chat.completions.create({
    model,
    messages,
    temperature: responseMode === ResponseMode.ADVANCED ? 0.4 : 0.2,
    stream: true
  })

  let assistantText = ''
  let completionId: string | null = null

  for await (const chunk of stream) {
    completionId = completionId ?? chunk.id

    const token = normalizeStreamToken(chunk.choices[0]?.delta?.content)

    if (!token) continue

    assistantText += token
    callbacks.onToken(token)
  }

  if (!assistantText.trim()) {
    throw new AppApiError(502, 'Qwen вернул пустой ответ')
  }

  const metadata: Prisma.InputJsonObject = {
    provider: 'qwen',
    completionId,
    model,
    hasImages,
    filesCount: files.length,
    imageFilesCount: imageParts.length,
    fileIds,
    rag: {
      enabled: ragContext.enabled,
      query: ragContext.query,
      chunksCount: ragContext.chunks.length,
      chunks: ragContext.chunks.map(chunk => ({
        id: chunk.id,
        conversationId: chunk.conversationId,
        chunkType: chunk.chunkType,
        score: chunk.score,
        sourceId: chunk.sourceId,
        channel: chunk.channel
      }))
    }
  }

  const assistantMessage = await prisma.$transaction(async tx => {
    const message = await tx.message.create({
      data: {
        chatId,
        userId,
        role: ChatMessageRole.ASSISTANT,
        content: assistantText.trim(),
        responseMode,
        model,
        metadata
      },
      include: {
        attachments: {
          include: {
            file: true
          }
        }
      }
    })

    await tx.chat.update({
      where: {
        id: chatId
      },
      data: {
        title:
          chat.title === 'Новый чат'
            ? makeChatTitleFromText(cleanText || 'Вложения')
            : undefined,
        lastMessageAt: new Date()
      }
    })

    return message
  })

  callbacks.onDone?.({
    userMessage,
    assistantMessage
  })

  return {
    userMessage,
    assistantMessage
  }
}
