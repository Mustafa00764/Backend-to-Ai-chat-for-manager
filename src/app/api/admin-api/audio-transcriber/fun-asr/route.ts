import { NextResponse } from 'next/server'

import { AppApiError, handleApiError } from '@/lib/api/api-error'
import { requireAdmin } from '@/lib/auth/current-user'

export const runtime = 'nodejs'

const DEFAULT_MODEL = 'fun-asr-flash-2026-06-15'

const MAX_AUDIO_FILE_SIZE_MB = Number(
  process.env.FUN_ASR_MAX_AUDIO_FILE_SIZE_MB || '25'
)

const REQUEST_TIMEOUT_MS = Number(
  process.env.FUN_ASR_REQUEST_TIMEOUT_MS || String(15 * 60 * 1000)
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

type FunAsrSentence = {
  text?: string
  speaker_id?: string | number
  speakerId?: string | number
  begin_time?: number
  end_time?: number
  beginTime?: number
  endTime?: number
}

type FunAsrResponse = {
  output?: {
    text?: string
    sentence?: unknown
    sentences?: unknown
  }
  usage?: unknown
  request_id?: string
  code?: string
  message?: string
}

function getFileExtension(fileName: string) {
  const dotIndex = fileName.lastIndexOf('.')

  if (dotIndex === -1) {
    return ''
  }

  return fileName.slice(dotIndex + 1).toLowerCase()
}

function getAudioFormat(fileName: string, fallbackFormat: string) {
  const cleanFallback = fallbackFormat.trim().toLowerCase()

  if (cleanFallback) {
    return cleanFallback
  }

  const extension = getFileExtension(fileName)

  if (extension === 'm4a') return 'mp4'
  if (extension === 'webm') return 'opus'

  return extension || 'mp3'
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
      `Файл слишком большой. Максимум: ${MAX_AUDIO_FILE_SIZE_MB} MB`
    )
  }
}

function normalizeApiUrl(value: string) {
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

  if (url.pathname.includes('/compatible-mode')) {
    throw new AppApiError(
      400,
      'Для Fun-ASR нельзя использовать /compatible-mode/v1. Нужен endpoint /api/v1/services/aigc/multimodal-generation/generation'
    )
  }

  if (url.pathname === '/' || url.pathname === '') {
    return `${cleanValue}/api/v1/services/aigc/multimodal-generation/generation`
  }

  return cleanValue
}

async function fileToDataUri(file: File) {
  const mimeType = getMimeType(file)
  const buffer = Buffer.from(await file.arrayBuffer())
  const base64 = buffer.toString('base64')

  return `data:${mimeType};base64,${base64}`
}

function createMessages(params: { dataUri: string; context: string }) {
  const messages: Array<{
    role: 'user'
    content: Array<Record<string, unknown>>
  }> = []

  const context = params.context.trim().slice(0, 400)

  if (context) {
    messages.push({
      role: 'user',
      content: [
        {
          type: 'input_text',
          text: context
        }
      ]
    })
  }

  messages.push({
    role: 'user',
    content: [
      {
        type: 'input_audio',
        input_audio: {
          data: params.dataUri
        }
      }
    ]
  })

  return messages
}

function toBoolean(value: FormDataEntryValue | null) {
  return String(value || '').toLowerCase() === 'true'
}

function toPositiveNumber(value: string) {
  const number = Number(value)

  if (!Number.isFinite(number) || number <= 0) {
    return null
  }

  return Math.floor(number)
}

function isSentenceArray(value: unknown): value is FunAsrSentence[] {
  return Array.isArray(value)
}

function getSpeakerId(sentence: FunAsrSentence) {
  const speakerId = sentence.speaker_id ?? sentence.speakerId

  if (speakerId === null || speakerId === undefined || speakerId === '') {
    return null
  }

  return String(speakerId)
}

function formatSentencesWithSpeakers(params: {
  sentences: FunAsrSentence[]
  speaker0Role: string
  speaker1Role: string
}) {
  const speakerRoleMap: Record<string, string> = {
    '0': params.speaker0Role || 'Speaker 0',
    '1': params.speaker1Role || 'Speaker 1'
  }

  const lines: string[] = []

  for (const sentence of params.sentences) {
    const text = String(sentence.text || '').trim()

    if (!text) {
      continue
    }

    const speakerId = getSpeakerId(sentence)

    if (!speakerId) {
      lines.push(text)
      continue
    }

    const role = speakerRoleMap[speakerId] || `Speaker ${speakerId}`

    lines.push(`${role}: ${text}`)
  }

  return lines.join('\n').trim()
}

function extractTranscript(params: {
  json: FunAsrResponse
  speaker0Role: string
  speaker1Role: string
}) {
  const rawSentences =
    params.json.output?.sentence ?? params.json.output?.sentences

  if (isSentenceArray(rawSentences) && rawSentences.length > 0) {
    const sentenceText = formatSentencesWithSpeakers({
      sentences: rawSentences,
      speaker0Role: params.speaker0Role,
      speaker1Role: params.speaker1Role
    })

    if (sentenceText) {
      return sentenceText
    }
  }

  const text = params.json.output?.text?.trim()

  if (!text) {
    throw new AppApiError(
      502,
      params.json.message || 'Fun-ASR не вернул текст расшифровки'
    )
  }

  return text
}

async function callFunAsr(params: {
  apiUrl: string
  apiKey: string
  model: string
  file: File
  format: string
  sampleRate: string
  context: string
  diarizationEnabled: boolean
  speakerCount: number | null
  speaker0Role: string
  speaker1Role: string
}) {
  const controller = new AbortController()

  const timeout = setTimeout(() => {
    controller.abort()
  }, REQUEST_TIMEOUT_MS)

  try {
    const dataUri = await fileToDataUri(params.file)

    const parameters: Record<string, unknown> = {
      format: params.format
    }

    if (params.sampleRate.trim()) {
      parameters.sample_rate = params.sampleRate.trim()
    }

    if (params.diarizationEnabled) {
      parameters.diarization_enabled = true

      if (params.speakerCount) {
        parameters.speaker_count = params.speakerCount
      }
    }

    const response = await fetch(params.apiUrl, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${params.apiKey}`,
        'Content-Type': 'application/json',
        'X-DashScope-SSE': 'disable'
      },
      body: JSON.stringify({
        model: params.model,
        input: {
          messages: createMessages({
            dataUri,
            context: params.context
          })
        },
        parameters
      })
    })

    const rawText = await response.text()

    let json: FunAsrResponse | null = null

    try {
      json = JSON.parse(rawText) as FunAsrResponse
    } catch {
      json = null
    }

    if (!response.ok) {
      throw new AppApiError(
        response.status,
        json?.message ||
          rawText ||
          `Ошибка Fun-ASR: ${response.status} ${response.statusText}`
      )
    }

    if (!json) {
      throw new AppApiError(502, 'Fun-ASR вернул пустой ответ')
    }

    const text = extractTranscript({
      json,
      speaker0Role: params.speaker0Role,
      speaker1Role: params.speaker1Role
    })

    return {
      text,
      usage: json.usage ?? null,
      requestId: json.request_id ?? null,
      raw: json
    }
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new AppApiError(408, 'Fun-ASR слишком долго обрабатывал аудио')
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
    const apiUrl = normalizeApiUrl(String(formData.get('apiUrl') || ''))
    const model = String(formData.get('model') || DEFAULT_MODEL).trim()
    const sampleRate = String(formData.get('sampleRate') || '').trim()
    const context = String(formData.get('context') || '').trim()

    const diarizationEnabled = toBoolean(formData.get('diarizationEnabled'))
    const speakerCount = toPositiveNumber(
      String(formData.get('speakerCount') || '')
    )
    const speaker0Role = String(
      formData.get('speaker0Role') || 'Менеджер'
    ).trim()
    const speaker1Role = String(formData.get('speaker1Role') || 'Клиент').trim()

    if (!apiKey) {
      throw new AppApiError(400, 'QWEN_API_KEY не передан')
    }

    if (!model) {
      throw new AppApiError(400, 'Модель не передана')
    }

    if (!(file instanceof File)) {
      throw new AppApiError(400, 'Аудиофайл не передан')
    }

    assertAudioFile(file)

    const format = getAudioFormat(
      file.name,
      String(formData.get('format') || '')
    )

    const result = await callFunAsr({
      apiUrl,
      apiKey,
      model,
      file,
      format,
      sampleRate,
      context,
      diarizationEnabled,
      speakerCount,
      speaker0Role,
      speaker1Role
    })

    return NextResponse.json({
      fileName: file.name,
      sizeBytes: file.size,
      model,
      format,
      text: result.text,
      usage: result.usage,
      requestId: result.requestId
    })
  } catch (error) {
    return handleApiError(error)
  }
}
