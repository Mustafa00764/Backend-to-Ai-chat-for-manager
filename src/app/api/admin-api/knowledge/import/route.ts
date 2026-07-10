import { NextResponse } from 'next/server'
import * as XLSX from 'xlsx'

import { AppApiError, handleApiError } from '@/lib/api/api-error'
import { requireAdmin } from '@/lib/auth/current-user'
import { importKnowledgeFile } from '@/server/knowledge/knowledge-import-service'

export const runtime = 'nodejs'

const SPREADSHEET_EXTENSIONS = new Set(['.xlsx', '.xls', '.csv', '.pdf', '.docx'])

const SPREADSHEET_MIME_TYPES = new Set([
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
  'text/csv',
  'application/csv'
])

function getFileExtension(fileName: string) {
  const dotIndex = fileName.lastIndexOf('.')

  if (dotIndex === -1) {
    return ''
  }

  return fileName.slice(dotIndex).toLowerCase()
}

function isSpreadsheetFile(file: File) {
  const extension = getFileExtension(file.name)

  if (SPREADSHEET_EXTENSIONS.has(extension)) {
    return true
  }

  return SPREADSHEET_MIME_TYPES.has(file.type)
}

function cleanCellValue(value: unknown) {
  if (value === null || value === undefined) {
    return ''
  }

  return String(value).replace(/\s+/g, ' ').trim()
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
      if (!value) return ''

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
  const arrayBuffer = await file.arrayBuffer()

  const workbook = XLSX.read(arrayBuffer, {
    type: 'array',
    cellDates: true,
    cellText: false,
    cellNF: false
  })

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

    for (let index = 1; index < rows.length; index += 1) {
      const rowText = createRowText(headers, rows[index], index + 1)

      if (rowText) {
        textParts.push(rowText)
      }
    }

    textParts.push('')
  }

  const text = textParts.join('\n').trim()

  if (!text) {
    throw new AppApiError(400, 'Excel/CSV файл пустой или не содержит текста')
  }

  const originalExtension = getFileExtension(file.name)
  const textFileName = file.name.replace(
    new RegExp(`${originalExtension.replace('.', '\\.')}$`, 'i'),
    '.txt'
  )

  return new File([text], textFileName, {
    type: 'text/plain'
  })
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

    const fileForImport = isSpreadsheetFile(file)
      ? await convertSpreadsheetToTextFile(file)
      : file

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
