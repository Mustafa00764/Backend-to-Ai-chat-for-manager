import {
  ConversationChannel,
  ImportStatus,
  KnowledgeChunkType,
  KnowledgeConversationStatus,
  KnowledgeSourceType,
  Prisma,
  SenderRole
} from '@/generated/prisma/client'
import { AppApiError } from '@/lib/api/api-error'
import { prisma } from '@/lib/db/prisma'
import { uploadUserFile } from '@/server/files/file-service'
import { splitTextIntoChunks } from '@/server/knowledge/knowledge-chunker'
import { parseKnowledgeFile } from '@/server/knowledge/knowledge-parser'

function pickEnumValue<T extends Record<string, string>>(
  enumObject: T,
  preferred: string[]
): T[keyof T] {
  for (const key of preferred) {
    const value = enumObject[key as keyof T]

    if (value) {
      return value
    }
  }

  const first = Object.values(enumObject)[0]

  if (!first) {
    throw new Error('Enum пустой')
  }

  return first as T[keyof T]
}

function mapSenderRole(value: string): SenderRole {
  const normalized = value.trim().toUpperCase()

  if (normalized.includes('MANAGER') || normalized.includes('МЕНЕДЖЕР')) {
    return pickEnumValue(SenderRole, ['MANAGER', 'OPERATOR', 'USER'])
  }

  if (
    normalized.includes('CUSTOMER') ||
    normalized.includes('CLIENT') ||
    normalized.includes('КЛИЕНТ') ||
    normalized.includes('ПОКУПАТЕЛЬ')
  ) {
    return pickEnumValue(SenderRole, ['CUSTOMER', 'CLIENT', 'USER'])
  }

  if (normalized.includes('ASSISTANT')) {
    return pickEnumValue(SenderRole, ['ASSISTANT', 'SYSTEM', 'USER'])
  }

  return pickEnumValue(SenderRole, ['UNKNOWN', 'USER', 'CUSTOMER'])
}

function normalizeTitle(value: string | null | undefined, fallback: string) {
  const trimmed = value?.trim()

  if (!trimmed) {
    return fallback
  }

  return trimmed
}

function makeSourceType(channel?: string): KnowledgeSourceType {
  const normalized = channel?.trim().toUpperCase()

  if (
    normalized === 'CHAT' ||
    normalized === 'WHATSAPP' ||
    normalized === 'TELEGRAM'
  ) {
    return pickEnumValue(KnowledgeSourceType, [
      'CLIENT_CHAT',
      'CALL_TEXT',
      'DOCUMENT_TEXT',
      'MANUAL'
    ])
  }

  if (normalized === 'PHONE' || normalized === 'CALL') {
    return pickEnumValue(KnowledgeSourceType, [
      'CALL_TEXT',
      'CLIENT_CHAT',
      'DOCUMENT_TEXT',
      'MANUAL'
    ])
  }

  return pickEnumValue(KnowledgeSourceType, [
    'CALL_TEXT',
    'CLIENT_CHAT',
    'DOCUMENT_TEXT',
    'MANUAL'
  ])
}

function makeImportStatus(): ImportStatus {
  return pickEnumValue(ImportStatus, [
    'COMPLETED',
    'READY',
    'DONE',
    'SUCCESS',
    'PROCESSING',
    'DRAFT'
  ])
}

function makeConversationStatus(): KnowledgeConversationStatus {
  return pickEnumValue(KnowledgeConversationStatus, [
    'READY',
    'INDEXED',
    'PROCESSING',
    'DRAFT'
  ])
}

function makeChunkType(): KnowledgeChunkType {
  return pickEnumValue(KnowledgeChunkType, [
    'DIALOG_FRAGMENT',
    'FULL_CONVERSATION',
    'PRODUCT_CONSULTATION',
    'CLIENT_QUESTION',
    'MANAGER_ANSWER'
  ])
}

function makeChannel(value: string | null | undefined): ConversationChannel {
  const normalized = value?.trim().toUpperCase()

  if (normalized && normalized in ConversationChannel) {
    return ConversationChannel[normalized as keyof typeof ConversationChannel]
  }

  return pickEnumValue(ConversationChannel, [
    'OTHER',
    'PHONE',
    'CALL',
    'CHAT',
    'WHATSAPP',
    'TELEGRAM'
  ])
}

export async function importKnowledgeFile({
  actorId,
  file,
  title,
  channel
}: {
  actorId: string
  file: File
  title?: string
  channel?: string
}) {
  if (file.size <= 0) {
    throw new AppApiError(400, 'Файл пустой')
  }

  const fileName = file.name || 'knowledge-import.txt'
  const content = await file.text()

  const parsedConversations = parseKnowledgeFile({
    fileName,
    content
  })

  if (parsedConversations.length === 0) {
    throw new AppApiError(400, 'Не удалось найти разговоры в файле')
  }

  const uploadedFile = await uploadUserFile({
    userId: actorId,
    file,
    source: 'knowledge_import'
  })

  const sourceType = makeSourceType(channel)

  const result = await prisma.$transaction(async tx => {
    const source = await tx.knowledgeSource.create({
      data: {
        title: normalizeTitle(title, fileName),
        description: [
          `Импортированный файл: ${fileName}`,
          `File ID: ${uploadedFile.id}`,
          `S3 Key: ${uploadedFile.s3Key}`
        ].join('\n'),
        sourceType,
        uploadedById: actorId,
        status: makeImportStatus(),
        totalItems: parsedConversations.length,
        processedItems: parsedConversations.length,
        failedItems: 0
      }
    })

    let messagesCount = 0
    let chunksCount = 0

    for (const [
      conversationIndex,
      parsedConversation
    ] of parsedConversations.entries()) {
      const conversation = await tx.knowledgeConversation.create({
        data: {
          sourceId: source.id,
          sourceType,
          externalId:
            parsedConversation.externalId ||
            `conversation-${conversationIndex + 1}`,
          channel: makeChannel(channel),
          status: makeConversationStatus(),
          rawText: parsedConversation.rawText
        }
      })

      if (parsedConversation.messages.length > 0) {
        await tx.knowledgeMessage.createMany({
          data: parsedConversation.messages.map((message, messageIndex) => ({
            conversationId: conversation.id,
            senderRole: mapSenderRole(message.senderRole),
            senderName: message.senderName || null,
            text: message.content,
            sentAt: message.sentAt ? new Date(message.sentAt) : null,
            orderIndex: messageIndex
          }))
        })

        messagesCount += parsedConversation.messages.length
      }

      const chunks = splitTextIntoChunks(parsedConversation.rawText)

      if (chunks.length > 0) {
        await tx.knowledgeChunk.createMany({
          data: chunks.map((chunk, chunkIndex) => ({
            conversationId: conversation.id,
            chunkType: makeChunkType(),
            text: chunk.content,
            metadata: {
              ...chunk.metadata,
              chunkIndex,
              tokenCount: Number(chunk.metadata.estimatedTokens || 0)
            } as Prisma.InputJsonObject
          }))
        })

        chunksCount += chunks.length
      }
    }

    return {
      source,
      stats: {
        conversationsCount: parsedConversations.length,
        messagesCount,
        chunksCount
      }
    }
  })

  return {
    source: result.source,
    uploadedFile,
    stats: result.stats
  }
}

export async function listKnowledgeSources() {
  const sources = await prisma.knowledgeSource.findMany({
    orderBy: {
      createdAt: 'desc'
    },
    take: 100,
    include: {
      _count: {
        select: {
          conversations: true
        }
      }
    }
  })

  const sourcesWithChunks = await Promise.all(
    sources.map(async source => {
      const conversations = await prisma.knowledgeConversation.findMany({
        where: {
          sourceId: source.id
        },
        select: {
          id: true
        }
      })

      const conversationIds = conversations.map(conversation => conversation.id)

      const chunksCount =
        conversationIds.length > 0
          ? await prisma.knowledgeChunk.count({
              where: {
                conversationId: {
                  in: conversationIds
                }
              }
            })
          : 0

      return {
        ...source,
        _count: {
          conversations: source._count.conversations,
          chunks: chunksCount
        }
      }
    })
  )

  return sourcesWithChunks
}
