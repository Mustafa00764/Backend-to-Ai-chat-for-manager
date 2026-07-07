import { AppApiError } from '@/lib/api/api-error'
import { prisma } from '@/lib/db/prisma'
import { env } from '@/lib/env'
import {
  createQwenEmbeddings,
  createQwenQueryEmbedding
} from '@/server/knowledge/qwen-embedding-service'

type ChunkForEmbedding = {
  id: string
  text: string
}

export type KnowledgeSearchResult = {
  id: string
  conversationId: string
  text: string
  chunkType: string
  chunkIndex: number
  score: number
  sourceId: string | null
  channel: string | null
  rawText: string | null
}

function vectorToSqlLiteral(vector: number[]) {
  return `[${vector.join(',')}]`
}

function assertEmbeddingDimension(vector: number[]) {
  if (vector.length !== env.QWEN_EMBEDDING_DIMENSIONS) {
    throw new AppApiError(
      500,
      `Неверный размер embedding: ${vector.length}. Ожидалось ${env.QWEN_EMBEDDING_DIMENSIONS}`
    )
  }
}

export async function ensureKnowledgeVectorSchema() {
  await prisma.$executeRawUnsafe(`CREATE EXTENSION IF NOT EXISTS vector`)

  await prisma.$executeRawUnsafe(`
    ALTER TABLE "KnowledgeChunk"
    ADD COLUMN IF NOT EXISTS "embedding" vector(${env.QWEN_EMBEDDING_DIMENSIONS})
  `)

  await prisma.$executeRawUnsafe(`
    ALTER TABLE "KnowledgeChunk"
    ADD COLUMN IF NOT EXISTS "embeddingModel" TEXT
  `)

  await prisma.$executeRawUnsafe(`
    ALTER TABLE "KnowledgeChunk"
    ADD COLUMN IF NOT EXISTS "embeddedAt" TIMESTAMP(3)
  `)

  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "KnowledgeChunk_embedding_cosine_idx"
    ON "KnowledgeChunk"
    USING ivfflat ("embedding" vector_cosine_ops)
    WITH (lists = 100)
  `)
}

export async function listChunksWithoutEmbedding(limit = 10) {
  await ensureKnowledgeVectorSchema()

  const safeLimit = Math.min(Math.max(limit, 1), 10)

  return prisma.$queryRawUnsafe<ChunkForEmbedding[]>(`
    SELECT
      "id",
      "text"
    FROM "KnowledgeChunk"
    WHERE "embedding" IS NULL
    ORDER BY "id" ASC
    LIMIT ${safeLimit}
  `)
}

export async function updateChunkEmbedding({
  chunkId,
  embedding,
  model
}: {
  chunkId: string
  embedding: number[]
  model: string
}) {
  assertEmbeddingDimension(embedding)

  await ensureKnowledgeVectorSchema()

  const vectorLiteral = vectorToSqlLiteral(embedding)

  await prisma.$executeRawUnsafe(
    `
      UPDATE "KnowledgeChunk"
      SET
        "embedding" = $1::vector,
        "embeddingModel" = $2,
        "embeddedAt" = NOW()
      WHERE "id" = $3
    `,
    vectorLiteral,
    model,
    chunkId
  )
}

export async function embedKnowledgeChunks(limit = 10) {
  await ensureKnowledgeVectorSchema()

  const chunks = await listChunksWithoutEmbedding(limit)

  if (chunks.length === 0) {
    return {
      processed: 0,
      message: 'Нет chunks без embeddings'
    }
  }

  const embeddingResult = await createQwenEmbeddings(
    chunks.map(chunk => chunk.text)
  )

  for (const [index, chunk] of chunks.entries()) {
    const embedding = embeddingResult.embeddings[index]

    await updateChunkEmbedding({
      chunkId: chunk.id,
      embedding,
      model: embeddingResult.model
    })
  }

  return {
    processed: chunks.length,
    model: embeddingResult.model,
    usage: embeddingResult.usage
  }
}

export async function countKnowledgeChunksEmbeddingStats() {
  await ensureKnowledgeVectorSchema()

  const rows = await prisma.$queryRawUnsafe<
    Array<{
      total: bigint
      embedded: bigint
      notEmbedded: bigint
    }>
  >(`
    SELECT
      COUNT(*)::bigint AS "total",
      COUNT("embedding")::bigint AS "embedded",
      (COUNT(*) - COUNT("embedding"))::bigint AS "notEmbedded"
    FROM "KnowledgeChunk"
  `)

  const row = rows[0]

  return {
    total: Number(row?.total ?? 0),
    embedded: Number(row?.embedded ?? 0),
    notEmbedded: Number(row?.notEmbedded ?? 0)
  }
}

export async function searchKnowledgeByText({
  query,
  limit = 5
}: {
  query: string
  limit?: number
}) {
  await ensureKnowledgeVectorSchema()

  const cleanQuery = query.trim()

  if (!cleanQuery) {
    throw new AppApiError(400, 'Пустой поисковый запрос')
  }

  const safeLimit = Math.min(Math.max(limit, 1), 20)
  const queryEmbedding = await createQwenQueryEmbedding(cleanQuery)

  assertEmbeddingDimension(queryEmbedding)

  const vectorLiteral = vectorToSqlLiteral(queryEmbedding)

  return prisma.$queryRawUnsafe<KnowledgeSearchResult[]>(
    `
      SELECT
        chunk."id",
        chunk."conversationId",
        chunk."text",
        chunk."chunkType"::text AS "chunkType",
        COALESCE((chunk."metadata"->>'chunkIndex')::int, 0) AS "chunkIndex",
        (1 - (chunk."embedding" <=> $1::vector))::float AS "score",
        conversation."sourceId",
        conversation."channel"::text AS "channel",
        conversation."rawText"
      FROM "KnowledgeChunk" chunk
      LEFT JOIN "KnowledgeConversation" conversation
        ON conversation."id" = chunk."conversationId"
      WHERE chunk."embedding" IS NOT NULL
      ORDER BY chunk."embedding" <=> $1::vector
      LIMIT $2
    `,
    vectorLiteral,
    safeLimit
  )
}
