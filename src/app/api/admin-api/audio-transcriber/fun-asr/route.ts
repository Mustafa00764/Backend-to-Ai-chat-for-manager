import { spawn } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { mkdir, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { NextResponse } from 'next/server'

import { AppApiError, handleApiError } from '@/lib/api/api-error'
import { requireAdmin } from '@/lib/auth/current-user'

export const runtime = 'nodejs'

const MAX_AUDIO_FILE_SIZE_MB = Number(
  process.env.FUN_ASR_MAX_AUDIO_FILE_SIZE_MB || '500'
)

const REQUEST_TIMEOUT_MS = Number(
  process.env.FUN_ASR_REQUEST_TIMEOUT_MS || String(60 * 60 * 1000)
)

const AUDIO_EXTENSIONS = new Set([
  '.mp3',
  '.wav',
  '.m4a',
  '.aac',
  '.ogg',
  '.opus',
  '.flac',
  '.webm',
  '.mp4'
])

type PythonResult = {
  ok: boolean
  text?: string
  error?: string
  taskId?: string
  requestId?: string | null
  traceback?: string
}

function getFileExtension(fileName: string) {
  const dotIndex = fileName.lastIndexOf('.')

  if (dotIndex === -1) return ''

  return fileName.slice(dotIndex).toLowerCase()
}

function assertAudioFile(file: File) {
  const extension = getFileExtension(file.name)

  const isAudio =
    file.type.startsWith('audio/') ||
    file.type === 'video/mp4' ||
    AUDIO_EXTENSIONS.has(extension)

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

function normalizeBaseApiUrl(value: string) {
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
      'Для Fun-ASR diarization нельзя использовать /compatible-mode/v1. Укажи base URL вида https://WORKSPACE_ID.ap-southeast-1.maas.aliyuncs.com/api/v1'
    )
  }

  const apiV1Index = url.pathname.indexOf('/api/v1')

  if (apiV1Index !== -1) {
    const basePath = url.pathname.slice(0, apiV1Index + '/api/v1'.length)
    return `${url.origin}${basePath}`
  }

  return `${url.origin}/api/v1`
}

function getPythonCommand() {
  return process.env.PYTHON_BIN || 'python3'
}

function getScriptPath() {
  return path.join(process.cwd(), 'scripts', 'fun_asr_transcribe.py')
}

async function saveTempAudioFile(file: File) {
  const tempDir = path.join(process.cwd(), '.tmp', 'fun-asr-audio')
  const extension = getFileExtension(file.name) || '.audio'
  const filePath = path.join(tempDir, `${randomUUID()}${extension}`)

  await mkdir(tempDir, {
    recursive: true
  })

  const buffer = Buffer.from(await file.arrayBuffer())

  await writeFile(filePath, buffer)

  return filePath
}

function parsePythonResult(stdout: string) {
  const lines = stdout
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean)

  const lastLine = lines.at(-1) || ''

  try {
    return JSON.parse(lastLine) as PythonResult
  } catch {
    return null
  }
}

function runPythonTranscription(payload: Record<string, unknown>) {
  return new Promise<PythonResult>((resolve, reject) => {
    const child = spawn(getPythonCommand(), [getScriptPath()], {
      cwd: process.cwd(),
      env: {
        ...process.env
      }
    })

    let stdout = ''
    let stderr = ''

    const timeout = setTimeout(() => {
      child.kill('SIGKILL')
      reject(new AppApiError(408, 'Fun-ASR слишком долго обрабатывал аудио'))
    }, REQUEST_TIMEOUT_MS)

    child.stdout.on('data', chunk => {
      stdout += chunk.toString()
    })

    child.stderr.on('data', chunk => {
      stderr += chunk.toString()
    })

    child.on('error', error => {
      clearTimeout(timeout)
      reject(error)
    })

    child.on('close', code => {
      clearTimeout(timeout)

      const result = parsePythonResult(stdout)

      if (!result) {
        reject(
          new AppApiError(
            500,
            stderr || stdout || 'Python не вернул корректный JSON'
          )
        )
        return
      }

      if (code !== 0 || !result.ok) {
        reject(
          new AppApiError(
            500,
            result.error || stderr || 'Fun-ASR не смог распознать аудио'
          )
        )
        return
      }

      resolve(result)
    })

    child.stdin.write(JSON.stringify(payload))
    child.stdin.end()
  })
}

export async function POST(request: Request) {
  let tempFilePath: string | null = null

  try {
    await requireAdmin(request)

    const formData = await request.formData()

    const file = formData.get('file')
    const apiKey = String(formData.get('apiKey') || '').trim()
    const apiUrl = normalizeBaseApiUrl(String(formData.get('apiUrl') || ''))
    const model = String(formData.get('model') || 'fun-asr').trim()
    const languageHint = String(formData.get('languageHint') || 'ru').trim()

    const diarizationEnabled =
      String(formData.get('diarizationEnabled') || '').toLowerCase() === 'true'

    const speakerCount = String(formData.get('speakerCount') || '2').trim()
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

    tempFilePath = await saveTempAudioFile(file)

    const result = await runPythonTranscription({
      apiKey,
      baseApiUrl: apiUrl,
      filePath: tempFilePath,
      model,
      languageHint,
      diarizationEnabled,
      speakerCount,
      speaker0Role,
      speaker1Role
    })

    return NextResponse.json({
      fileName: file.name,
      sizeBytes: file.size,
      model,
      text: result.text || '',
      requestId: result.requestId || null,
      taskId: result.taskId || null
    })
  } catch (error) {
    return handleApiError(error)
  } finally {
    if (tempFilePath) {
      await rm(tempFilePath, {
        force: true
      })
    }
  }
}
