export type KnowledgeChunkInput = {
  content: string
  metadata: Record<string, unknown>
}

const DEFAULT_CHUNK_SIZE = 1600
const DEFAULT_OVERLAP = 200

function estimateTokenCount(text: string) {
  return Math.ceil(text.length / 4)
}

export function splitTextIntoChunks(
  text: string,
  options: {
    chunkSize?: number
    overlap?: number
  } = {}
): KnowledgeChunkInput[] {
  const chunkSize = options.chunkSize ?? DEFAULT_CHUNK_SIZE
  const overlap = options.overlap ?? DEFAULT_OVERLAP

  const cleanText = text.trim()

  if (!cleanText) {
    return []
  }

  const chunks: KnowledgeChunkInput[] = []
  let start = 0
  let index = 0

  while (start < cleanText.length) {
    const end = Math.min(start + chunkSize, cleanText.length)
    const content = cleanText.slice(start, end).trim()

    if (content) {
      chunks.push({
        content,
        metadata: {
          chunkIndex: index,
          start,
          end,
          estimatedTokens: estimateTokenCount(content)
        }
      })
    }

    if (end >= cleanText.length) {
      break
    }

    start = Math.max(0, end - overlap)
    index += 1
  }

  return chunks
}
