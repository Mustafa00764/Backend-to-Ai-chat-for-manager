import { NextResponse } from 'next/server'
import { handleApiError } from '@/lib/api/api-error'
import { requireAdmin } from '@/lib/auth/current-user'
import { searchKnowledgeByText } from '@/server/knowledge/knowledge-vector-store'

export const runtime = 'nodejs'

export async function GET(request: Request) {
  try {
    await requireAdmin(request)

    const url = new URL(request.url)
    const query = String(url.searchParams.get('q') || '')
    const limit = Number(url.searchParams.get('limit') || 5)

    const results = await searchKnowledgeByText({
      query,
      limit
    })

    return NextResponse.json({
      results
    })
  } catch (error) {
    return handleApiError(error)
  }
}
