import { randomUUID } from 'node:crypto'
import { extname } from 'node:path'
import { FileType, type File as DbFile } from '@/generated/prisma/client'
import { AppApiError } from '@/lib/api/api-error'
import { prisma } from '@/lib/db/prisma'
import {
  createSignedDownloadUrl,
  uploadBufferToS3
} from '@/lib/storage/s3-client'

const MAX_FILE_SIZE_BYTES = 100 * 1024 * 1024 * 1024

export function fileToDto(file: DbFile) {
  return {
    ...file,
    sizeBytes: Number(file.sizeBytes),
    createdAt: file.createdAt.toISOString(),
    updatedAt: file.updatedAt.toISOString()
  }
}

function normalizeSource(source: string) {
  const trimmed = source.trim().toLowerCase()

  if (!trimmed) {
    return 'mobile'
  }

  return trimmed.replace(/[^a-z0-9_-]/g, '_').slice(0, 50)
}

function inferFileType(mimeType: string, source: string): FileType {
  const normalizedSource = normalizeSource(source)

  if (
    normalizedSource === 'avatar' ||
    normalizedSource === 'profile_avatar' ||
    normalizedSource === 'profile'
  ) {
    return FileType.AVATAR
  }

  if (
    normalizedSource === 'knowledge' ||
    normalizedSource === 'knowledge_import' ||
    normalizedSource === 'import'
  ) {
    return FileType.KNOWLEDGE_IMPORT
  }

  if (mimeType.startsWith('image/')) {
    return FileType.IMAGE_ATTACHMENT
  }

  if (mimeType.startsWith('audio/')) {
    return FileType.AUDIO_ATTACHMENT
  }

  if (mimeType.startsWith('video/')) {
    return FileType.VIDEO_ATTACHMENT
  }

  if (
    mimeType.includes('pdf') ||
    mimeType.includes('text') ||
    mimeType.includes('document') ||
    mimeType.includes('spreadsheet') ||
    mimeType.includes('presentation') ||
    mimeType.includes('csv') ||
    mimeType.includes('json')
  ) {
    return FileType.DOCUMENT_ATTACHMENT
  }

  return FileType.CHAT_ATTACHMENT
}

function getSafeExtension(fileName: string) {
  const extension = extname(fileName).toLowerCase()

  if (!extension) {
    return ''
  }

  if (!/^\.[a-z0-9]{1,10}$/.test(extension)) {
    return ''
  }

  return extension
}

function makeStorageKey({
  userId,
  fileName,
  fileType,
  source
}: {
  userId: string
  fileName: string
  fileType: FileType
  source: string
}) {
  const date = new Date().toISOString().slice(0, 10)
  const extension = getSafeExtension(fileName)
  const safeSource = normalizeSource(source)

  return [
    'users',
    userId,
    safeSource,
    fileType.toLowerCase(),
    date,
    `${randomUUID()}${extension}`
  ].join('/')
}

export async function listUserFiles(
  userId: string,
  options: {
    fileType?: FileType
  } = {}
) {
  const files = await prisma.file.findMany({
    where: {
      ownerId: userId,
      fileType: options.fileType
    },
    orderBy: {
      createdAt: 'desc'
    }
  })

  return files.map(fileToDto)
}

export async function getUserFile(userId: string, fileId: string) {
  const file = await prisma.file.findFirst({
    where: {
      id: fileId,
      ownerId: userId
    }
  })

  if (!file) {
    throw new AppApiError(404, 'Файл не найден')
  }

  return file
}

export async function uploadUserFile({
  userId,
  file,
  source = 'mobile'
}: {
  userId: string
  file: File
  source?: string
}) {
  if (file.size <= 0) {
    throw new AppApiError(400, 'Файл пустой')
  }

  if (file.size > MAX_FILE_SIZE_BYTES) {
    throw new AppApiError(400, 'Файл слишком большой. Максимум 100 MB')
  }

  const originalName = file.name || 'file'
  const mimeType = file.type || 'application/octet-stream'
  const safeSource = normalizeSource(source)
  const fileType = inferFileType(mimeType, safeSource)
  const extension = getSafeExtension(originalName) || null

  const arrayBuffer = await file.arrayBuffer()
  const buffer = Buffer.from(arrayBuffer)

  const s3Key = makeStorageKey({
    userId,
    fileName: originalName,
    fileType,
    source: safeSource
  })

  const uploaded = await uploadBufferToS3({
    key: s3Key,
    body: buffer,
    contentType: mimeType,
    contentLength: file.size
  })

  const createdFile = await prisma.file.create({
    data: {
      ownerId: userId,
      bucket: uploaded.bucket,
      s3Key: uploaded.key,
      originalName,
      mimeType,
      extension,
      sizeBytes: BigInt(file.size),
      fileType
    }
  })

  return fileToDto(createdFile)
}

export async function createUserFileDownloadUrl(
  userId: string,
  fileId: string
) {
  const file = await getUserFile(userId, fileId)

  const url = await createSignedDownloadUrl({
    key: file.s3Key,
    expiresIn: 60 * 60
  })

  return {
    file: fileToDto(file),
    url,
    expiresIn: 60 * 60
  }
}
