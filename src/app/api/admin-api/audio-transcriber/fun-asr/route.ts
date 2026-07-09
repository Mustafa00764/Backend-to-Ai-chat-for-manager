import { NextResponse } from 'next/server'

import { AppApiError, handleApiError } from '@/lib/api/api-error'
import { requireAdmin } from '@/lib/auth/current-user'

export const runtime = 'nodejs'

const DEFAULT_MODEL = 'qwen3-asr-flash'

const MAX_AUDIO_FILE_SIZE_MB = Number(
  process.env.QWEN3_ASR_MAX_AUDIO_FILE_SIZE_MB || '7'
)

const REQUEST_TIMEOUT_MS = Number(
  process.env.QWEN3_ASR_REQUEST_TIMEOUT_MS || String(10 * 60 * 1000)
)

const AUDIO_MIME_BY_EXTENSION: Record<string, string> = {
  mp3: 'audio/mpeg',
  wav: 'audio/wav',
  m4a: 'audio/mp4',
  aac: 'audio/aac',
  ogg: 'audio/ogg',
  opus: 'audio/opus',
  flac: 'audio/flac',
  webm: 'audio/webm',
  mp4: 'video/mp4'
}

type QwenAsrResponse = {
  id?: string
  model?: string
  choices?: Array<{
    message?: {
      content?: string
      annotations?: unknown
    }
  }>
  usage?: unknown
  request_id?: string
  code?: string
  message?: string
  error?: {
    message?: string
  }
}

function getFileExtension(fileName: string) {
  const dotIndex = fileName.lastIndexOf('.')

  if (dotIndex === -1) {
    return ''
  }

  return fileName.slice(dotIndex + 1).toLowerCase()
}

function getMimeType(file: File) {
  if (file.type) {
    return file.type
  }

  const extension = getFileExtension(file.name)

  return AUDIO_MIME_BY_EXTENSION[extension] || 'audio/mpeg'
}

function assertAudioFile(file: File) {
  const mimeType = getMimeType(file)
  const extension = getFileExtension(file.name)

  const isAudio =
    mimeType.startsWith('audio/') ||
    mimeType === 'video/mp4' ||
    extension in AUDIO_MIME_BY_EXTENSION

  if (!isAudio) {
    throw new AppApiError(400, 'Разрешены только аудиофайлы')
  }

  const maxBytes = MAX_AUDIO_FILE_SIZE_MB * 1024 * 1024

  if (file.size > maxBytes) {
    throw new AppApiError(
      413,
      `Файл слишком большой для qwen3-asr-flash. Максимум: ${MAX_AUDIO_FILE_SIZE_MB} MB. Для длинных аудио нужна filetrans/Fun-ASR async.`
    )
  }
}

function normalizeCompatibleBaseUrl(value: string) {
  const cleanValue = value.trim().replace(/\/+$/, '')

  if (!cleanValue) {
    throw new AppApiError(400, 'QWEN_API_URL не передан')
  }

  let url: URL

  try {
    url = new URL(cleanValue)
  } catch {
    throw new AppApiError(400, 'Некорректный QWEN_API_URL')
  }

  if (url.protocol !== 'https:') {
    throw new AppApiError(400, 'QWEN_API_URL должен начинаться с https://')
  }

  if (url.pathname.includes('/compatible-mode/v1/chat/completions')) {
    return cleanValue.replace(/\/chat\/completions$/, '')
  }

  if (url.pathname.includes('/compatible-mode/v1')) {
    return `${url.origin}/compatible-mode/v1`
  }

  return `${url.origin}/compatible-mode/v1`
}

function createChatCompletionsUrl(baseUrl: string) {
  return `${baseUrl}/chat/completions`
}

async function fileToDataUrl(file: File) {
  const mimeType = getMimeType(file)
  const buffer = Buffer.from(await file.arrayBuffer())
  const base64 = buffer.toString('base64')

  return `data:${mimeType};base64,${base64}`
}

function extractText(json: QwenAsrResponse | null) {
  const text = json?.choices?.[0]?.message?.content?.trim()

  if (!text) {
    throw new AppApiError(
      422,
      json?.message ||
        json?.error?.message ||
        'qwen3-asr-flash вернул пустой текст. Проверь, что аудио короче 5 минут, файл не битый и формат поддерживается.'
    )
  }

  return text
}

async function callQwen3Asr(params: {
  apiUrl: string
  apiKey: string
  model: string
  file: File
  language: string
}) {
  const controller = new AbortController()

  const timeout = setTimeout(() => {
    controller.abort()
  }, REQUEST_TIMEOUT_MS)

  try {
    const baseUrl = normalizeCompatibleBaseUrl(params.apiUrl)
    const endpoint = createChatCompletionsUrl(baseUrl)
    const audioDataUrl = await fileToDataUrl(params.file)

    const response = await fetch(endpoint, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${params.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: params.model,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'input_audio',
                input_audio: {
                  data: audioDataUrl
                }
              }
            ]
          }
        ],
        stream: false,
        asr_options: {
          language: params.language || 'ru',
          enable_itn: false
        }
      })
    })

    const rawText = await response.text()

    let json: QwenAsrResponse | null = null

    try {
      json = JSON.parse(rawText) as QwenAsrResponse
    } catch {
      json = null
    }

    if (!response.ok) {
      throw new AppApiError(
        response.status,
        json?.message ||
          json?.error?.message ||
          rawText ||
          `Ошибка qwen3-asr-flash: ${response.status} ${response.statusText}`
      )
    }

    const text = extractText(json)

    return {
      text,
      usage: json?.usage ?? null,
      requestId: json?.id || json?.request_id || null
    }
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new AppApiError(
        408,
        'qwen3-asr-flash слишком долго обрабатывал аудио'
      )
    }

    throw error
  } finally {
    clearTimeout(timeout)
  }
}

export async function POST(request: Request) {
  try {
    await requireAdmin(request)

    const formData = await request.formData()

    const file = formData.get('file')
    const apiKey = String(formData.get('apiKey') || '').trim()
    const apiUrl = String(formData.get('apiUrl') || '').trim()
    const model = String(formData.get('model') || DEFAULT_MODEL).trim()
    const language = String(formData.get('language') || 'ru').trim()

    if (!apiKey) {
      throw new AppApiError(400, 'QWEN_API_KEY не передан')
    }

    if (!apiUrl) {
      throw new AppApiError(400, 'QWEN_API_URL не передан')
    }

    if (!model) {
      throw new AppApiError(400, 'Модель не передана')
    }

    if (!(file instanceof File)) {
      throw new AppApiError(400, 'Аудиофайл не передан')
    }

    assertAudioFile(file)

    const result = await callQwen3Asr({
      apiUrl,
      apiKey,
      model,
      file,
      language
    })

    return NextResponse.json({
      fileName: file.name,
      sizeBytes: file.size,
      model,
      format: getFileExtension(file.name) || null,
      text: result.text,
      usage: result.usage,
      requestId: result.requestId
    })
  } catch (error) {
    return handleApiError(error)
  }
}
