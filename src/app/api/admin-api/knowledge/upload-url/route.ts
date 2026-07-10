import { randomUUID } from 'node:crypto'
import { NextResponse } from 'next/server'

import { AppApiError, handleApiError } from '@/lib/api/api-error'
import { requireAdmin } from '@/lib/auth/current-user'
import { createSignedUploadUrl } from '@/lib/storage/s3-client'

export const runtime = 'nodejs'

const MAX_UPLOAD_BYTES = 50 * 1024 * 1024

const ALLOWED_EXTENSIONS = new Set([
  '.txt',
  '.jsonl',
  '.xlsx',
  '.xls',
  '.csv',
  '.pdf',
  '.docx'
])

const ALLOWED_MIME_TYPES = new Set([
  'text/plain',
  'application/json',
  'application/jsonl',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
  'text/csv',
  'application/csv',
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
])

const MIME_BY_EXTENSION: Record<string, string> = {
  '.txt': 'text/plain',
  '.jsonl': 'application/jsonl',
  '.xlsx':
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.xls': 'application/vnd.ms-excel',
  '.csv': 'text/csv',
  '.pdf': 'application/pdf',
  '.docx':
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
}

type UploadUrlRequest = {
  fileName?: unknown
  contentType?: unknown
  sizeBytes?: unknown
}

function getFileExtension(fileName: string) {
  const dotIndex = fileName.lastIndexOf('.')

  if (dotIndex === -1) {
    return ''
  }

  return fileName.slice(dotIndex).toLowerCase()
}

function sanitizeFileName(fileName: string) {
  const normalized = fileName
    .normalize('NFKC')
    .replace(/[^\p{L}\p{N}._-]+/gu, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')

  return normalized.slice(0, 160) || 'document'
}

function resolveContentType(
  fileName: string,
  requestedContentType: string
) {
  const normalizedContentType = requestedContentType
    .split(';')[0]
    .trim()
    .toLowerCase()

  if (ALLOWED_MIME_TYPES.has(normalizedContentType)) {
    return normalizedContentType
  }

  const extension = getFileExtension(fileName)

  return MIME_BY_EXTENSION[extension] || ''
}

export async function POST(request: Request) {
  try {
    const currentUser = await requireAdmin(request)
    const body = (await request.json()) as UploadUrlRequest

    const fileName =
      typeof body.fileName === 'string'
        ? body.fileName.trim()
        : ''

    const requestedContentType =
      typeof body.contentType === 'string'
        ? body.contentType
        : ''

    const sizeBytes = Number(body.sizeBytes)

    if (!fileName) {
      throw new AppApiError(400, 'Имя файла не передано')
    }

    const extension = getFileExtension(fileName)

    if (!ALLOWED_EXTENSIONS.has(extension)) {
      throw new AppApiError(
        400,
        'Разрешены TXT, JSONL, XLSX, XLS, CSV, PDF и DOCX'
      )
    }

    if (
      !Number.isFinite(sizeBytes) ||
      sizeBytes <= 0
    ) {
      throw new AppApiError(
        400,
        'Размер файла указан неверно'
      )
    }

    if (sizeBytes > MAX_UPLOAD_BYTES) {
      throw new AppApiError(
        413,
        `Максимальный размер документа: ${
          MAX_UPLOAD_BYTES / 1024 / 1024
        } МБ`
      )
    }

    const contentType = resolveContentType(
      fileName,
      requestedContentType
    )

    if (!contentType) {
      throw new AppApiError(
        400,
        'Неподдерживаемый MIME-тип файла'
      )
    }

    const safeFileName = sanitizeFileName(fileName)
    const key =
      `knowledge/temp/${currentUser.id}/` +
      `${randomUUID()}-${safeFileName}`

    const uploadUrl = await createSignedUploadUrl({
      key,
      contentType
    })

    return NextResponse.json({
      uploadUrl,
      key,
      contentType,
      expiresInSeconds: 15 * 60,
      maxSizeBytes: MAX_UPLOAD_BYTES
    })
  } catch (error) {
    return handleApiError(error)
  }
}
