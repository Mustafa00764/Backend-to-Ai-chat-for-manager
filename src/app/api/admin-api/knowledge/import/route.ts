import { NextResponse } from 'next/server'
import * as mammoth from 'mammoth'
import { extractText, getDocumentProxy } from 'unpdf'
import * as XLSX from 'xlsx'

import { AppApiError, handleApiError } from '@/lib/api/api-error'
import { requireAdmin } from '@/lib/auth/current-user'
import { importKnowledgeFile } from '@/server/knowledge/knowledge-import-service'

export const runtime = 'nodejs'

const SPREADSHEET_EXTENSIONS = new Set(['.xlsx', '.xls', '.csv'])
const PDF_EXTENSIONS = new Set(['.pdf'])
const DOCX_EXTENSIONS = new Set(['.docx'])

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
  return mimeTypes.has(file.type.toLowerCase())
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

    const textParts = [`# Документ: ${file.name}`, result.value]

    if (warnings.length > 0) {
      console.warn('DOCX IMPORT WARNINGS:', {
        fileName: file.name,
        warnings
      })
    }

    return createTextFile(
      file,
      textParts.join('\n\n'),
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
  try {
    const currentUser = await requireAdmin(request)
    const formData = await request.formData()

    const file = formData.get('file')
    const title = String(formData.get('title') || '')
    const channel = String(formData.get('channel') || 'OTHER')

    if (!(file instanceof File)) {
      throw new AppApiError(400, 'Файл не передан')
    }

    const fileForImport = await convertSupportedFileToTextFile(file)

    const result = await importKnowledgeFile({
      actorId: currentUser.id,
      file: fileForImport,
      title: title || file.name,
      channel
    })

    return NextResponse.json(serializeSource(result), {
      status: 201
    })
  } catch (error) {
    return handleApiError(error)
  }
}
