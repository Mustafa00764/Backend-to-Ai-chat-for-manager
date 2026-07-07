import { NextResponse } from 'next/server'
import { AppApiError, handleApiError } from '@/lib/api/api-error'
import { requireAdmin } from '@/lib/auth/current-user'
import { importKnowledgeFile } from '@/server/knowledge/knowledge-import-service'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  try {
    const currentUser = await requireAdmin(request)
    const formData = await request.formData()

    const file = formData.get('file')
    const title = String(formData.get('title') || '')
    const channel = String(formData.get('channel') || 'OTHER')

    if (!(file instanceof File)) {
      throw new AppApiError(400, 'Файл не передан')
    }

    const result = await importKnowledgeFile({
      actorId: currentUser.id,
      file,
      title,
      channel
    })

    return NextResponse.json(
      {
        source: {
          ...result.source,
          type: result.source.sourceType,
          file: null,
          createdAt: result.source.createdAt.toISOString(),
          updatedAt: result.source.updatedAt.toISOString()
        },
        uploadedFile: result.uploadedFile,
        stats: result.stats
      },
      {
        status: 201
      }
    )
  } catch (error) {
    return handleApiError(error)
  }
}
