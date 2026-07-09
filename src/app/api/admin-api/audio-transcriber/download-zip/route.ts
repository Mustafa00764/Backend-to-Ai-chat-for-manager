import JSZip from 'jszip'
import { NextResponse } from 'next/server'

import { AppApiError, handleApiError } from '@/lib/api/api-error'
import { requireAdmin } from '@/lib/auth/current-user'

export const runtime = 'nodejs'

type ZipFileItem = {
  fileName: string
  text: string
}

type ZipRequestBody = {
  files?: ZipFileItem[]
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

function createUniqueFileName(
  fileName: string,
  index: number,
  usedNames: Set<string>
) {
  const baseName = ensureTxtExtension(fileName)
  const dotIndex = baseName.lastIndexOf('.')
  const nameWithoutExt =
    dotIndex === -1 ? baseName : baseName.slice(0, dotIndex)

  let candidate = baseName
  let counter = 1

  while (usedNames.has(candidate.toLowerCase())) {
    candidate = `${nameWithoutExt}_${index + 1}_${counter}.txt`
    counter += 1
  }

  usedNames.add(candidate.toLowerCase())

  return candidate
}

export async function POST(request: Request) {
  try {
    await requireAdmin(request)

    const body = (await request
      .json()
      .catch(() => null)) as ZipRequestBody | null
    const files = body?.files ?? []

    if (!Array.isArray(files) || files.length === 0) {
      throw new AppApiError(400, 'Нет TXT файлов для ZIP архива')
    }

    const zip = new JSZip()
    const folder = zip.folder('transcripts')
    const usedNames = new Set<string>()
    let addedCount = 0

    files.forEach((file, index) => {
      const text = String(file.text || '').trim()

      if (!text) return

      const fileName = createUniqueFileName(file.fileName, index, usedNames)

      folder?.file(fileName, text)
      addedCount += 1
    })

    if (addedCount === 0) {
      throw new AppApiError(400, 'Нет непустых TXT файлов для ZIP архива')
    }

    const buffer = await zip.generateAsync({
      type: 'nodebuffer',
      compression: 'DEFLATE',
      compressionOptions: {
        level: 6
      }
    })

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition':
          'attachment; filename="audio_transcripts_txt.zip"',
        'Cache-Control': 'no-store'
      }
    })
  } catch (error) {
    return handleApiError(error)
  }
}
