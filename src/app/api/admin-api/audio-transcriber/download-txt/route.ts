import { NextResponse } from 'next/server'

import { AppApiError, handleApiError } from '@/lib/api/api-error'
import { requireAdmin } from '@/lib/auth/current-user'

export const runtime = 'nodejs'

type RequestBody = {
  fileName?: string
  text?: string
}

function sanitizeFileName(fileName: string) {
  const cleanName = fileName
    .replace(/[<>:"/\\|?*\u0000-\u001F]/g, '_')
    .replace(/\s+/g, ' ')
    .trim()

  return cleanName || 'transcript.txt'
}

function ensureTxtExtension(fileName: string) {
  const cleanName = sanitizeFileName(fileName)

  if (cleanName.toLowerCase().endsWith('.txt')) {
    return cleanName
  }

  const dotIndex = cleanName.lastIndexOf('.')

  if (dotIndex === -1) {
    return `${cleanName}.txt`
  }

  return `${cleanName.slice(0, dotIndex)}.txt`
}

export async function POST(request: Request) {
  try {
    await requireAdmin(request)

    const body = (await request.json().catch(() => null)) as RequestBody | null

    const text = String(body?.text || '').trim()
    const fileName = ensureTxtExtension(String(body?.fileName || 'transcript.txt'))

    if (!text) {
      throw new AppApiError(400, 'Нет текста для скачивания')
    }

    return new NextResponse(text, {
      status: 200,
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(
          fileName
        )}`,
        'Cache-Control': 'no-store'
      }
    })
  } catch (error) {
    return handleApiError(error)
  }
}