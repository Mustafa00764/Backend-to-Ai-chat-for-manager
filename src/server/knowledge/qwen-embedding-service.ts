import OpenAI from 'openai'
import { AppApiError } from '@/lib/api/api-error'
import { env } from '@/lib/env'
import { getAiRuntimeSettings } from '@/server/settings/ai-settings-service'

const MAX_EMBEDDING_BATCH_SIZE = 10

type EmbeddingResult = {
  embeddings: number[][]
  model: string
  usage: unknown
}

function getQwenEmbeddingApiKey() {
  const apiKey = env.QWEN_EMBEDDING_API_KEY || env.QWEN_API_KEY

  if (!apiKey) {
    throw new AppApiError(
      500,
      'QWEN_EMBEDDING_API_KEY или QWEN_API_KEY не указан в .env'
    )
  }

  return apiKey
}

function getQwenEmbeddingClient() {
  return new OpenAI({
    apiKey: getQwenEmbeddingApiKey(),
    baseURL: env.QWEN_EMBEDDING_BASE_URL
  })
}

function normalizeTexts(texts: string[]) {
  return texts.map(text => text.trim()).filter(text => text.length > 0)
}

function makeMockEmbedding(text: string) {
  const vector = new Array(env.QWEN_EMBEDDING_DIMENSIONS).fill(0) as number[]

  for (let index = 0; index < text.length; index += 1) {
    const charCode = text.charCodeAt(index)
    const vectorIndex = index % env.QWEN_EMBEDDING_DIMENSIONS

    vector[vectorIndex] += ((charCode % 97) + 1) / 100
  }

  const norm =
    Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0)) || 1

  return vector.map(value => Number((value / norm).toFixed(8)))
}

function createMockEmbeddings(texts: string[]): EmbeddingResult {
  return {
    embeddings: texts.map(makeMockEmbedding),
    model: 'mock-embedding',
    usage: null
  }
}

export async function createQwenEmbeddings(
  texts: string[]
): Promise<EmbeddingResult> {
  const settings = await getAiRuntimeSettings()
  const cleanTexts = normalizeTexts(texts)

  if (cleanTexts.length === 0) {
    throw new AppApiError(400, 'Нет текста для embedding')
  }

  if (cleanTexts.length > MAX_EMBEDDING_BATCH_SIZE) {
    throw new AppApiError(
      400,
      `За один запрос можно отправить максимум ${MAX_EMBEDDING_BATCH_SIZE} текстов`
    )
  }

  if (settings.embeddingMockMode) {
    return createMockEmbeddings(cleanTexts)
  }

  const client = getQwenEmbeddingClient()

  try {
    const response = await client.embeddings.create({
      model: settings.embeddingModel,
      input: cleanTexts,
      dimensions: env.QWEN_EMBEDDING_DIMENSIONS
    })

    const embeddings = response.data
      .sort((a, b) => a.index - b.index)
      .map(item => item.embedding)

    if (embeddings.length !== cleanTexts.length) {
      throw new AppApiError(502, 'Qwen вернул неверное количество embeddings')
    }

    for (const embedding of embeddings) {
      if (embedding.length !== env.QWEN_EMBEDDING_DIMENSIONS) {
        throw new AppApiError(
          502,
          `Qwen вернул vector(${embedding.length}), ожидался vector(${env.QWEN_EMBEDDING_DIMENSIONS})`
        )
      }
    }

    return {
      embeddings,
      model: response.model || settings.embeddingModel,
      usage: response.usage ?? null
    }
  } catch (error) {
    if (error instanceof AppApiError) {
      throw error
    }

    const message =
      error instanceof Error ? error.message : 'Ошибка Qwen embeddings'

    throw new AppApiError(
      502,
      `${message}. Если это 400 Access denied, включи embedding mock mode в /admin/ai.`
    )
  }
}

export async function createQwenQueryEmbedding(text: string) {
  const result = await createQwenEmbeddings([text])

  return result.embeddings[0]
}
