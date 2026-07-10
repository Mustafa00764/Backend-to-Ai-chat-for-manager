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
Если информации недостаточно, прямо скажи, что нужно уточнить.
[10/07/26 18:36] Максим: МЕТОДИЧКА ОТ 11.12.2024

Почему именно с нами работают многие компании!?!
Сырье. Отечественный металл+ английский клей = даёт двойное качество!
Гибкость-наше всё! 
Преимущество:
Катаем от 0,3мм до 2 мм (от 0,7 нестандарт) толщины и УРА! Оцинковку тоже/ Склейка без затрат. Если целый лист то затраты составляют 200 000
Толщина наполнения от 5мм до 280мм свыше тоже, делаем но это уже нестандарт. 100 000
Z-Loock замок для стеновых панелей
Покрытия не ограничено нестандарт стандарт плоть до принтеке (под дерево, кирпич ну очень красиво), текстурированное покрытие- шагрень, а также стандартный каталог RAl и RR
Нестандартные и стандартные панели как аккустические, арочные + 100 000, ПИР, ПУР, Сэндвич-панели комбинированные, угловые +90%, противопожарные, бункеров, перекрытий, СИП панели и двухслойные панели.
Любая плотность наполнителя
Срочная поставка
Прокатка от 1штуки (нет минимального объема)
Можем произвести с соединителями (это обычно производители не предлагают потом на месте мучаются с болгаркой и некрасивый рез получается)
Ширину стеновых панелей от 100мм до 1500мм (стандарт 1200). Без доп платы.
Доборные элементы любой сложности до 3м но длиной по 1.25 будет дешевле и быстрее.
Делаем Фальцевые сэндвич-панели делаем. Экономия сравня с обычными на 18,5%. Ширина 1185мм у обычных сэндвичей 1000мм.
Просчет чертежей любой сложности. Юра Луцин
+7 911 513-20-13 Артем. +7 921 565-12-32. Александр-просчитывает полностью чертежи и какая доборка в каком количестве(с чертежами) +7 952 208 65 75.  oborotovo@gmail.com
Если нет чертежника и нужно приехать на объект, приедем
Показ производства 
Низкие цены
Оплата 30 на 70 или 10% фиксация до 2 месяцев
Находимся 18 км от города. Недорогая доставка или самовывоз
Предоставляем прайс дилерам и клиентам
Консультация с 8 до 21 (без внимания не останетесь)
Все соответствующие сертификаты имеются

Сэндвич-Панели из мин ваты
 
Верхняя металлическая обкладка
Клей
Ламели (Ламели эта мин вата нарезанная на куски). Нарезается и переворачивается на бок (слои должны быть вертикальны иначе отслаиваться будут).  
Задняя обкладка


Аккустические (Шумоотражающие
)панели тоже делаем
состоят из двух листов оцинкованной тонколистовой рулонной стали, защищенных полимерным покрытием (один из которых с перфорацией), и проложенным между ними слоем теплоизоляционного наполнителя.
Основные преимущества
Отсутствие лишней нагрузки на фундамент
Высокие звукопоглощающие характеристики
Устойчивость к атмосферным осадкам, химическим реагентам, благодаря антикоррозийного и полимерного покрытия
Возможность применения в любой местности, независимо от климатической зоны
Низкая стоимость
Длительный гарантийный срок эксплуатации
Экологическая безопасность, отсутствие реакции на агрессивные химически воздействия
Эстетический внешний вид, не требуют дополнительной отделки
Кроме того
Небольшой удельный вес
Быстрота и легкость монтажа
Огнестойкость и эстетический внешний вид сэндвич-панелей позволяет возвести конструкцию, продуманную до мелочей
 
Перфорированный металлический лист
Мембрана звукопоглощающая
клей (https://selem.ru/index.php?%25D0%259F%25D1%2580%25D0%25BE%25D0%25B4%25D1%2583%25D0%25BA%25D1%2586%25D0%25B8%25D1%258F/%25D0%25A2%25D0%25B5%25D1%2585%25D0%25BD%25D0%25B8%25D1%2587%25D0%25B5%25D1%2581%25D0%25BA%25D0%25B0%25D1%258F-%25D0%25B8%25D0%25BD%25D1%2584%25D0%25BE%25D1%2580%25D0%25BC%25D0%25B0%25D1%2586%25D0%25B8%25D1%258F-(%25D0%259A%25D0%25BE%25D0%25BD%25D1%2581%25D1%2582%25D1%2580%25D1%2583%25D0%25BA%25D1%2582%25D0%25B8%25D0%25B2)/%25D0%2594%25D0%25B2%25D1%2583%25D1%2585%25D0%25BA%25D0%25BE%25D0%25BC%25D0%25BF%25D0%25BE%25D0%25BD%25D0%25B5%25D0%25BD%25D1%2582%25D0%25BD%25D1%258B%25D0%25B9-%25D0%25BA%25D0%25BB%25D0%25B5%25D0%25B9)
Звукопоглощающий наполнитель (минеральная вата плотность 115 +-10)
Оцинкованная тонколистовая сталь (https://selem.ru/index.php?%25D0%259F%25D1%2580%25D0%25BE%25D0%25B4%25D1%2583%25D0%25BA%25D1%2586%25D0%25B8%25D1%258F/%25D0%25A2%25D0%25B5%25D1%2585%25D0%25BD%25D0%25B8%25D1%2587%25D0%25B5%25D1%2581%25D0%25BA%25D0%25B0%25D1%258F-%25D0%25B8%25D0%25BD%25D1%2584%25D0%25BE%25D1%2580%25D0%25BC%25D0%25B0%25D1%2586%25D0%25B8%25D1%258F-(%25D0%259A%25D0%25BE%25D0%25BD%25D1%2581%25D1%2582%25D1%2580%25D1%2583%25D0%25BA%25D1%2582%25D0%25B8%25D0%25B2)/%25D0%259E%25D0%25B1%25D0%25BB%25D0%25B8%25D1%2586%25D0%25BE%25D0%25B2%25D0%25BA%25D0%25B0-%25D1%2581%25D0%25B5%25D0%25BD%25D0%25B4%25D0%25B2%25D0%25B8%25D1%2587-%25D0%25BF%25D0%25B0%25D0%25BD%25D0%25B5%25D0%25BB%25D0%25B5%25D0%25B9) с полимерным покрытием, толщиной 0,5мм


Шумоотражающие (без перфорации) Качественные и недорогие панели, которые позволяют быстро и надёжно оградить участок рядом с дорогой от шума. В качестве наполнителя используется пенополистирол – экологичный и влагостойкий материал. Основные области применения: шумозащитные заборы для частных участков и коттеджных посёлков ограждения автодорог средней загруженности (до 4-х полос) 

Шумопоглощающие (с перфорацией на лицевой стороне) Высокоэффективные панели с индексом изоляции шума до 39 децибел. В качестве наполнителя используется минеральная вата от ведущих производителей, обладающая высокими звукоизолирующими характеристиками и стойкостью к воздействию агрессивных сред. Основные области применения: оживлённые автомагистрали и путепроводы железнодорожные пути временные ограждения для стройплощадо
[10/07/26 18:36] Максим: Прозрачные Панели изготавливаются на основе прочного акрилового оргстекла (ПММА), обладающего высокой проницаемостью света (до 92%). Основные области применения: ограждения большой протяжённости или высоты в составе с другими панелями по решению архитектора

Пенополиуретан ПУР (PUR) и полиизоцианурат ПИР (PIR) – это два родственных класса полимеров, имеющих закрытоячеистую структуру. Панели делаем себестоимость у нас на 20% дешевле чем у конкурентов. Плиты PIR и PUR обладают разными противопожарными свойствами. Пенополиизоцианурат (PIR) обладает пониженной горючестью. Температура эксплуатации PIR доходит до 140 °C, тогда как PUR можно использовать только при температурах ниже 100 °C. Это означает, что в случае пожара плиты PIR дают пользователю немного больше времени для реагирования и тушения пожара, а в крайних случаях - для эвакуации. Но это не все. На плите PIR образуется обугленное покрытие, которое задерживает дальнейшее распространение огня. В случае пожара плита PIR дольше сохраняет свои структурные свойства, поэтому она намного безопаснее, особенно при использовании в конструкции крыши. PUR обычно получает класс огнестойкости, равный EI 15, а PIR - EI 30. В основном по этой причине плиты PIR начали заменять плиты PUR. Они как пенопласт легкие и быстро производятся. 
 
Отличие МИН ваты от Пенаполистирола 
Мин вата не горит до 1000 градусов коэффициент теплопроводимости до 0,42 единиц. Минус не влагоустойчив и срок службы до 10 лет
Пенаполистирол легкий (меньше нагрузка для конструкции) водоустойкий. Минус горючий 
ПИР на 60% лучше чем мин вата а остальное почти одинаковое с мин ватой. Равняется толщина ПИР 120мм к мин вате 200мм. ПИР лучше использовать для той среды там где влага присутствует  (холодильная камера, грузавики с холодильником и т п). Поэтому рекомендуем для клиентов посчитать оба варианта. ПИР иногда получается дешевле чем мин вата. 
Котигория придел огнестойкости у ПИР и ПУР Г3 Г4 (горючисть)


3 вида обклаки есть а остальные все как нестандарт идет:

7 каёмок
 





Микроволна
 




1 вид профилирования металлической обшивки внешней стороны кровельных сэндвич - панелей:
Кровельный глубокий профиль
 

Еще есть канавка через 100мм 

Фальцевые Сэндвич-панели:


 



 


 
 

 
Рабочая ширина 1,18м
Экономия на доставке - вместо 5 машин - 3 машины
Можем сделать любую толщину металла от 0,35 до 1,2
ПРИМЕР ФАСОННЫХ ЭЛЕМЕНТОВ (также есть тех. каталог)

 

Если кровельная панель стыкуется по длине, то предлагать металл внахлёст.
Пример, как это выглядит:
 

 

 
 
 
Расчет сэндвич-панели
По ссылке можно перевести м2 на м. Обратите внимание все в метрах. Пишите через 0
https://www.center-pss.ru/math/kub.htm
Клей стоит 375 руб за м2 и на м2 уходит тоже 350 грамм. То есть если 100м2 то 100*0,350=35кг и 35кг*375руб=131250. Если хорошо попросите, то Руслан клейщик сделает скидку до 350руб
Если у юджина заказываете, то попросите сделать жесткую упаковку. Если поставщик не наносит пленку, то ее можно заказать у руфкомплекта

Для ускорение процесса и качество нужно соблюсти следующие условия:
[10/07/26 18:36] Максим: При заказе мин ваты уточнить у начальника производство в наличии мин ваты 110 плотности. Если есть то нужно этот поддон забронировать для замков и учесть его в вордовском файле
Желательно всегда заказывать 150мм толщину, так работа ускорится
Обязательно металл нужно заказывать с пленкой, если поставщик не наносит пленку, то отдельно у руфкомплекта нужно заказать
При расчете сырья не забывайте учесть стоимость доставки. Доставка клея стоит 2000. Доставку Мим ваты обычно включена в стоимость. Пол машины может привезти только Денис(диллер деферо). Металл лучше заказывать у стил икса с доставкой. С юджина доставка 6000.
Расчитывайте расход и обвес поставщика от 3 до 5 метров. Поэтому чуть больше заказывайте.
Когда у логиста заказываете машину скажите ему, что можно только заказывать машины с боковой закгрузкой. Обе стороны должны открываться.
Всегда перед запуском уточните есть ли мин вата или клей на производстве
Рулоны не должны быть 5тонн
Рулоны белые заказывать рулонами
Мин. 0,6 можно меньне нестандарт + время. максимальная длина панелей 9 метров. Свыше нестандарт
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
