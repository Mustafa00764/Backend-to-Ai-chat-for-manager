import { AppApiError } from '@/lib/api/api-error'
import { env } from '@/lib/env'

const MAX_DICTATION_AUDIO_BYTES = 10 * 1024 * 1024

type QwenAsrContentItem =
  | {
      type: 'text'
      text: string
    }
  | {
      type: 'input_audio'
      input_audio: {
        data: string
      }
    }

type QwenAsrMessage = {
  role: 'system' | 'user'
  content: QwenAsrContentItem[]
}

type QwenAsrRequestBody = {
  model: string
  messages: QwenAsrMessage[]
  temperature: number
  extra_body: {
    enable_search: boolean
  }
}

type QwenAsrResponse = {
  id?: string
  model?: string
  choices?: Array<{
    message?: {
      content?: string
    }
  }>
  usage?: unknown
  error?: {
    message?: string
    type?: string
    code?: string
  }
}

type TranscribeResult = {
  text: string
  model: string
  usage: unknown
  raw: QwenAsrResponse
}

function getQwenAsrApiKey() {
  const apiKey = env.QWEN_ASR_API_KEY || env.QWEN_API_KEY

  if (!apiKey) {
    throw new AppApiError(
      500,
      'QWEN_ASR_API_KEY или QWEN_API_KEY не указан в .env'
    )
  }

  return apiKey
}

function makeChatCompletionsUrl() {
  return `${env.QWEN_ASR_BASE_URL.replace(/\/$/, '')}/chat/completions`
}

function assertAudioFile(file: File) {
  if (file.size <= 0) {
    throw new AppApiError(400, 'Аудиофайл пустой')
  }

  if (file.size > MAX_DICTATION_AUDIO_BYTES) {
    throw new AppApiError(
      400,
      'Файл слишком большой для диктофона. Максимум 10 MB. Для длинных звонков сделаем отдельный async-import.'
    )
  }

  const mimeType = file.type || ''

  if (!mimeType.startsWith('audio/') && !mimeType.startsWith('video/')) {
    throw new AppApiError(400, 'Нужно передать аудио или видео файл')
  }
}

export async function transcribeAudioFileWithQwen(
  file: File
): Promise<TranscribeResult> {
  assertAudioFile(file)

  const mimeType = file.type || 'audio/mpeg'
  const arrayBuffer = await file.arrayBuffer()
  const base64Audio = Buffer.from(arrayBuffer).toString('base64')
  const dataUri = `data:${mimeType};base64,${base64Audio}`

  const body: QwenAsrRequestBody = {
    model: env.QWEN_ASR_MODEL,
    temperature: 0,
    messages: [
      {
        role: 'system',
        content: [
          {
            type: 'text',
            text: 'Ты сервис распознавания речи. Верни только точную расшифровку аудио без пояснений.'
          }
        ]
      },
      {
        role: 'user',
        content: [
          {
            type: 'input_audio',
            input_audio: {
              data: dataUri
            }
          }
        ]
      }
    ],
    extra_body: {
      enable_search: true
    }
  }

  const response = await fetch(makeChatCompletionsUrl(), {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${getQwenAsrApiKey()}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  })

  const json = (await response
    .json()
    .catch(() => null)) as QwenAsrResponse | null

  if (!response.ok) {
    throw new AppApiError(
      response.status,
      json?.error?.message || 'Ошибка Qwen ASR'
    )
  }

  if (!json) {
    throw new AppApiError(502, 'Qwen ASR вернул пустой ответ')
  }

  const text = json.choices?.[0]?.message?.content?.trim()

  if (!text) {
    throw new AppApiError(502, 'Qwen ASR вернул пустой текст')
  }

  return {
    text,
    model: json.model || env.QWEN_ASR_MODEL,
    usage: json.usage ?? null,
    raw: json
  }
}
