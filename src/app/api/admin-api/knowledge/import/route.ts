import { NextResponse } from 'next/server'
import * as mammoth from 'mammoth'
import { extractText, getDocumentProxy } from 'unpdf'
import * as XLSX from 'xlsx'

import { AppApiError, handleApiError } from '@/lib/api/api-error'
import { requireAdmin } from '@/lib/auth/current-user'
import { importKnowledgeFile } from '@/server/knowledge/knowledge-import-service'
import { deleteObjectFromS3, downloadS3FileToBuffer, getS3ObjectMetadata } from '@/lib/storage/s3-client'


export const runtime = 'nodejs'

const MAX_UPLOAD_BYTES = 50 * 1024 * 1024

const SPREADSHEET_EXTENSIONS = new Set(['.xlsx', '.xls', '.csv'])

const PDF_EXTENSIONS = new Set(['.pdf'])
const DOCX_EXTENSIONS = new Set(['.docx'])

const ALLOWED_EXTENSIONS = new Set([
  '.txt',
  '.jsonl',
  ...SPREADSHEET_EXTENSIONS,
  ...PDF_EXTENSIONS,
  ...DOCX_EXTENSIONS
])

const SPREADSHEET_MIME_TYPES = new Set([
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
  'text/csv',
  'application/csv'
])

const PDF_MIME_TYPES = new Set(['application/pdf'])

const DOCX_MIME_TYPES = new Set([
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
])

const MIME_BY_EXTENSION: Record<string, string> = {
  '.txt': 'text/plain',
  '.jsonl': 'application/jsonl',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.xls': 'application/vnd.ms-excel',
  '.csv': 'text/csv',
  '.pdf': 'application/pdf',
  '.docx':
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
}

type DirectImportRequest = {
  s3Key?: unknown
  fileName?: unknown
  contentType?: unknown
  title?: unknown
  channel?: unknown
}

type ImportPayload = {
  file: File
  title: string
  channel: string
  temporaryS3Key: string | null
}

function getFileExtension(fileName: string) {
  const dotIndex = fileName.lastIndexOf('.')

  if (dotIndex === -1) {
    return ''
  }

  return fileName.slice(dotIndex).toLowerCase()
}

function hasSupportedExtension(file: File, extensions: ReadonlySet<string>) {
  return extensions.has(getFileExtension(file.name))
}

function hasSupportedMimeType(file: File, mimeTypes: ReadonlySet<string>) {
  return mimeTypes.has(file.type.split(';')[0].trim().toLowerCase())
}

function isSpreadsheetFile(file: File) {
  return (
    hasSupportedExtension(file, SPREADSHEET_EXTENSIONS) ||
    hasSupportedMimeType(file, SPREADSHEET_MIME_TYPES)
  )
}

function isPdfFile(file: File) {
  return (
    hasSupportedExtension(file, PDF_EXTENSIONS) ||
    hasSupportedMimeType(file, PDF_MIME_TYPES)
  )
}

function isDocxFile(file: File) {
  return (
    hasSupportedExtension(file, DOCX_EXTENSIONS) ||
    hasSupportedMimeType(file, DOCX_MIME_TYPES)
  )
}

function cleanCellValue(value: unknown) {
  if (value === null || value === undefined) {
    return ''
  }

  return String(value).replace(/\s+/g, ' ').trim()
}

function normalizeExtractedText(value: string) {
  return value
    .replace(/\u0000/g, '')
    .replace(/\r\n?/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n[ \t]+/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function createTextFileName(fileName: string) {
  const extension = getFileExtension(fileName)

  if (!extension) {
    return `${fileName}.txt`
  }

  return `${fileName.slice(0, -extension.length)}.txt`
}

function createTextFile(
  sourceFile: File,
  rawText: string,
  emptyFileMessage: string
) {
  const text = normalizeExtractedText(rawText)

  if (!text) {
    throw new AppApiError(400, emptyFileMessage)
  }

  return new File([text], createTextFileName(sourceFile.name), {
    type: 'text/plain'
  })
}

function createRowText(headers: string[], row: unknown[], rowIndex: number) {
  const values = row.map(cleanCellValue)
  const hasHeader = headers.some(Boolean)

  if (!values.some(Boolean)) {
    return ''
  }

  if (!hasHeader) {
    return values.filter(Boolean).join(' | ')
  }

  const pairs = values
    .map((value, index) => {
      if (!value) {
        return ''
      }

      const header = headers[index]?.trim()

      if (!header) {
        return value
      }

      return `${header}: ${value}`
    })
    .filter(Boolean)

  if (pairs.length === 0) {
    return ''
  }

  return `Строка ${rowIndex}: ${pairs.join(' | ')}`
}

async function convertSpreadsheetToTextFile(file: File) {
  let workbook: XLSX.WorkBook

  try {
    const arrayBuffer = await file.arrayBuffer()

    workbook = XLSX.read(arrayBuffer, {
      type: 'array',
      cellDates: true,
      cellText: false,
      cellNF: false
    })
  } catch {
    throw new AppApiError(
      400,
      'Не удалось прочитать Excel/CSV файл. Проверьте формат и целостность файла'
    )
  }

  const textParts: string[] = []

  for (const sheetName of workbook.SheetNames) {
    const worksheet = workbook.Sheets[sheetName]

    if (!worksheet) {
      continue
    }

    const rows = XLSX.utils.sheet_to_json<unknown[]>(worksheet, {
      header: 1,
      raw: false,
      defval: '',
      blankrows: false
    })

    if (rows.length === 0) {
      continue
    }

    const headers = rows[0].map(cleanCellValue)

    textParts.push(`# Лист: ${sheetName}`)

    if (rows.length === 1) {
      const firstRowText = createRowText([], rows[0], 1)

      if (firstRowText) {
        textParts.push(firstRowText)
      }
    } else {
      for (let index = 1; index < rows.length; index += 1) {
        const rowText = createRowText(headers, rows[index], index + 1)

        if (rowText) {
          textParts.push(rowText)
        }
      }
    }

    textParts.push('')
  }

  return createTextFile(
    file,
    textParts.join('\n'),
    'Excel/CSV файл пустой или не содержит текста'
  )
}

async function convertPdfToTextFile(file: File) {
  let pdf: Awaited<ReturnType<typeof getDocumentProxy>> | null = null

  try {
    const arrayBuffer = await file.arrayBuffer()

    pdf = await getDocumentProxy(new Uint8Array(arrayBuffer))

    const result = await extractText(pdf)
    const textParts: string[] = [`# Документ: ${file.name}`]

    result.text.forEach((pageText, pageIndex) => {
      const cleanPageText = normalizeExtractedText(pageText)

      if (!cleanPageText) {
        return
      }

      textParts.push(`# Страница ${pageIndex + 1}`, cleanPageText)
    })

    return createTextFile(
      file,
      textParts.join('\n\n'),
      'В PDF не найден текст. Возможно, это сканированный документ — для него требуется OCR'
    )
  } catch (error) {
    if (error instanceof AppApiError) {
      throw error
    }

    throw new AppApiError(
      400,
      'Не удалось прочитать PDF. Проверьте, что файл не повреждён и не защищён паролем'
    )
  } finally {
    if (pdf) {
      await pdf.destroy().catch(() => undefined)
    }
  }
}

async function convertDocxToTextFile(file: File) {
  try {
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    const result = await mammoth.extractRawText({
      buffer
    })

    const warnings = result.messages
      .filter(message => message.type === 'warning')
      .map(message => message.message)
      .filter(Boolean)

    if (warnings.length > 0) {
      console.warn('DOCX IMPORT WARNINGS:', {
        fileName: file.name,
        warnings
      })
    }

    return createTextFile(
      file,
      [`# Документ: ${file.name}`, result.value].join('\n\n'),
      'DOCX файл пустой или не содержит доступного текста'
    )
  } catch (error) {
    if (error instanceof AppApiError) {
      throw error
    }

    throw new AppApiError(
      400,
      'Не удалось прочитать DOCX. Проверьте, что файл не повреждён и имеет формат .docx'
    )
  }
}

async function convertSupportedFileToTextFile(file: File) {
  if (isSpreadsheetFile(file)) {
    return convertSpreadsheetToTextFile(file)
  }

  if (isPdfFile(file)) {
    return convertPdfToTextFile(file)
  }

  if (isDocxFile(file)) {
    return convertDocxToTextFile(file)
  }

  return file
}

function resolveContentType(
  fileName: string,
  requestedContentType: string,
  storedContentType: string
) {
  const normalizedStored = storedContentType.split(';')[0].trim().toLowerCase()

  if (normalizedStored) {
    return normalizedStored
  }

  const normalizedRequested = requestedContentType
    .split(';')[0]
    .trim()
    .toLowerCase()

  if (normalizedRequested) {
    return normalizedRequested
  }

  return (
    MIME_BY_EXTENSION[getFileExtension(fileName)] || 'application/octet-stream'
  )
}

function validateFileName(fileName: string) {
  const extension = getFileExtension(fileName)

  if (!ALLOWED_EXTENSIONS.has(extension)) {
    throw new AppApiError(
      400,
      'Разрешены TXT, JSONL, XLSX, XLS, CSV, PDF и DOCX'
    )
  }
}

async function readDirectImportPayload(
  request: Request,
  actorId: string
): Promise<ImportPayload> {
  const body = (await request.json()) as DirectImportRequest

  const s3Key = typeof body.s3Key === 'string' ? body.s3Key.trim() : ''

  const fileName = typeof body.fileName === 'string' ? body.fileName.trim() : ''

  const requestedContentType =
    typeof body.contentType === 'string' ? body.contentType : ''

  const title = typeof body.title === 'string' ? body.title.trim() : ''

  const channel =
    typeof body.channel === 'string' ? body.channel.trim() : 'OTHER'

  if (!s3Key) {
    throw new AppApiError(400, 's3Key не передан')
  }

  const expectedPrefix = `knowledge/temp/${actorId}/`

  if (!s3Key.startsWith(expectedPrefix)) {
    throw new AppApiError(403, 'Недопустимый ключ временного файла')
  }

  if (!fileName) {
    throw new AppApiError(400, 'Имя файла не передано')
  }

  validateFileName(fileName)

  const metadata = await getS3ObjectMetadata({
    key: s3Key
  })

  if (
    metadata.contentLength <= 0 ||
    metadata.contentLength > MAX_UPLOAD_BYTES
  ) {
    throw new AppApiError(
      413,
      `Максимальный размер документа: ${MAX_UPLOAD_BYTES / 1024 / 1024} МБ`
    )
  }

  const contentType = resolveContentType(
    fileName,
    requestedContentType,
    metadata.contentType
  )

  const buffer = await downloadS3FileToBuffer({
    key: s3Key
  })

  if (buffer.length === 0) {
    throw new AppApiError(400, 'Загруженный файл пустой')
  }

  return {
    file: new File([buffer], fileName, {
      type: contentType
    }),
    title: title || fileName,
    channel: channel || 'OTHER',
    temporaryS3Key: s3Key
  }
}

async function readLegacyMultipartPayload(
  request: Request
): Promise<ImportPayload> {
  const formData = await request.formData()
  const file = formData.get('file')
  const title = String(formData.get('title') || '')
  const channel = String(formData.get('channel') || 'OTHER')

  if (!(file instanceof File)) {
    throw new AppApiError(400, 'Файл не передан')
  }

  validateFileName(file.name)

  return {
    file,
    title: title || file.name,
    channel,
    temporaryS3Key: null
  }
}

async function readImportPayload(request: Request, actorId: string) {
  const contentType = request.headers.get('content-type') || ''

  if (contentType.toLowerCase().includes('application/json')) {
    return readDirectImportPayload(request, actorId)
  }

  return readLegacyMultipartPayload(request)
}

function serializeSource(
  result: Awaited<ReturnType<typeof importKnowledgeFile>>
) {
  return {
    source: {
      ...result.source,
      type: result.source.sourceType,
      file: null,
      createdAt: result.source.createdAt.toISOString(),
      updatedAt: result.source.updatedAt.toISOString()
    },
    uploadedFile: result.uploadedFile,
    stats: result.stats
  }
}

export async function POST(request: Request) {
  let temporaryS3Key: string | null = null

  try {
    const currentUser = await requireAdmin(request)

    const payload = await readImportPayload(request, currentUser.id)

    temporaryS3Key = payload.temporaryS3Key

    const fileForImport = await convertSupportedFileToTextFile(payload.file)

    const result = await importKnowledgeFile({
      actorId: currentUser.id,
      file: fileForImport,
      title: payload.title,
      channel: payload.channel
    })

    return NextResponse.json(serializeSource(result), {
      status: 201
    })
  } catch (error) {
    return handleApiError(error)
  } finally {
    if (temporaryS3Key) {
      await deleteObjectFromS3(temporaryS3Key).catch(error => {
        console.error('Не удалось удалить временный файл из S3:', {
          key: temporaryS3Key,
          error
        })
      })
    }
  }
}
