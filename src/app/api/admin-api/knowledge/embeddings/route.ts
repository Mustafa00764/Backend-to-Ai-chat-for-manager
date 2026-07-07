import { NextResponse } from 'next/server'
import { handleApiError } from '@/lib/api/api-error'
import { requireAdmin } from '@/lib/auth/current-user'
import {
  countKnowledgeChunksEmbeddingStats,
  embedKnowledgeChunks
} from '@/server/knowledge/knowledge-vector-store'

export const runtime = 'nodejs'

export async function GET(request: Request) {
  try {
    await requireAdmin(request)

    const stats = await countKnowledgeChunksEmbeddingStats()

    return NextResponse.json({
      stats
    })
  } catch (error) {
    return handleApiError(error)
  }
}

export async function POST(request: Request) {
  try {
    await requireAdmin(request)

    const url = new URL(request.url)
    const limit = Number(url.searchParams.get('limit') || 10)

    const result = await embedKnowledgeChunks(limit)
    const stats = await countKnowledgeChunksEmbeddingStats()

    return NextResponse.json({
      result,
      stats
    })
  } catch (error) {
    return handleApiError(error)
  }
}
