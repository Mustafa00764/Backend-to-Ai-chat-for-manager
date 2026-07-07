import {
  KnowledgeSearchResult,
  searchKnowledgeByText
} from '@/server/knowledge/knowledge-vector-store'
import { getAiRuntimeSettings } from '@/server/settings/ai-settings-service'

export type KnowledgeRagContext = {
  enabled: boolean
  query: string
  chunks: KnowledgeSearchResult[]
  contextText: string
}

function cleanText(value: string) {
  return value.replace(/\s+/g, ' ').trim()
}

function formatChunkForPrompt(chunk: KnowledgeSearchResult, index: number) {
  const text = cleanText(chunk.text)

  return [
    `Источник ${index + 1}:`,
    `Тип: ${chunk.chunkType}`,
    `Канал: ${chunk.channel || 'UNKNOWN'}`,
    `Score: ${chunk.score.toFixed(4)}`,
    `Текст: ${text}`
  ].join('\n')
}

export function formatRagContextForPrompt(chunks: KnowledgeSearchResult[]) {
  if (chunks.length === 0) {
    return ''
  }

  return chunks.map(formatChunkForPrompt).join('\n\n---\n\n')
}

export async function buildKnowledgeRagContext({
  query,
  limit
}: {
  query: string
  limit?: number
}): Promise<KnowledgeRagContext> {
  const settings = await getAiRuntimeSettings()
  const cleanQuery = query.trim()

  if (!settings.ragEnabled || !cleanQuery) {
    return {
      enabled: settings.ragEnabled,
      query: cleanQuery,
      chunks: [],
      contextText: ''
    }
  }

  try {
    const results = await searchKnowledgeByText({
      query: cleanQuery,
      limit: limit ?? settings.ragMaxChunks
    })

    const chunks = results.filter(
      result => result.score >= settings.ragMinScore
    )

    return {
      enabled: true,
      query: cleanQuery,
      chunks,
      contextText: formatRagContextForPrompt(chunks)
    }
  } catch (error) {
    console.error('RAG search error:', error)

    return {
      enabled: true,
      query: cleanQuery,
      chunks: [],
      contextText: ''
    }
  }
}

export function buildRagSystemInstruction(contextText: string) {
  if (!contextText) {
    return ''
  }

  return [
    'Ниже есть фрагменты из базы знаний компании.',
    'Используй их как справочный контекст для ответа.',
    'Не выдумывай факты, которых нет в контексте или в сообщении пользователя.',
    'Если контекст не подходит к вопросу, не упоминай его напрямую.',
    '',
    'КОНТЕКСТ БАЗЫ ЗНАНИЙ:',
    contextText
  ].join('\n')
}
