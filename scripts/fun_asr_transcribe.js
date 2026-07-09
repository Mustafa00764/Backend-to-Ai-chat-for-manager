#!/usr/bin/env node

const DEFAULT_MODEL = 'fun-asr'
const DEFAULT_POLL_INTERVAL_MS = 3000
const DEFAULT_TIMEOUT_MS = 60 * 60 * 1000

function printJson(data, exitCode = 0) {
  process.stdout.write(`${JSON.stringify(data)}\n`)
  process.exit(exitCode)
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function readStdin() {
  return new Promise((resolve, reject) => {
    let data = ''

    process.stdin.setEncoding('utf8')

    process.stdin.on('data', chunk => {
      data += chunk
    })

    process.stdin.on('end', () => {
      resolve(data)
    })

    process.stdin.on('error', reject)
  })
}

function normalizeBaseApiUrl(value) {
  const cleanValue = String(value || '').trim().replace(/\/+$/, '')

  if (!cleanValue) {
    throw new Error('baseApiUrl не передан')
  }

  const url = new URL(cleanValue)

  if (url.protocol !== 'https:') {
    throw new Error('baseApiUrl должен начинаться с https://')
  }

  if (url.pathname.includes('/compatible-mode')) {
    throw new Error(
      'Для Fun-ASR async нельзя использовать /compatible-mode/v1. Нужен base URL вида https://WORKSPACE_ID.ap-southeast-1.maas.aliyuncs.com/api/v1'
    )
  }

  const apiV1Index = url.pathname.indexOf('/api/v1')

  if (apiV1Index !== -1) {
    const basePath = url.pathname.slice(0, apiV1Index + '/api/v1'.length)
    return `${url.origin}${basePath}`
  }

  return `${url.origin}/api/v1`
}

function makeSubmitUrl(baseApiUrl) {
  return `${baseApiUrl}/services/audio/asr/transcription`
}

function makeTaskUrl(baseApiUrl, taskId) {
  return `${baseApiUrl}/tasks/${encodeURIComponent(taskId)}`
}

async function fetchJson(url, options = {}) {
  const response = await fetch(url, options)
  const rawText = await response.text()

  let json = null

  try {
    json = JSON.parse(rawText)
  } catch {
    json = null
  }

  if (!response.ok) {
    const message =
      json?.message ||
      json?.error?.message ||
      rawText ||
      `${response.status} ${response.statusText}`

    throw new Error(message)
  }

  return json
}

function getTaskId(submitJson) {
  return submitJson?.output?.task_id || submitJson?.task_id || null
}

function getTaskStatus(taskJson) {
  return taskJson?.output?.task_status || taskJson?.task_status || null
}

function getTaskResults(taskJson) {
  return taskJson?.output?.results || taskJson?.results || []
}

function getSpeakerId(sentence) {
  const value = sentence?.speaker_id ?? sentence?.speakerId

  if (value === null || value === undefined || value === '') {
    return null
  }

  return String(value)
}

function getSentenceText(sentence) {
  return String(sentence?.text || '').trim()
}

function formatTranscriptText(transcriptionJson, options) {
  const speakerRoles = {
    '0': options.speaker0Role || 'Менеджер',
    '1': options.speaker1Role || 'Клиент'
  }

  const transcripts =
    transcriptionJson?.transcripts ||
    transcriptionJson?.output?.transcripts ||
    transcriptionJson?.results?.[0]?.transcripts ||
    []

  const lines = []

  for (const transcript of transcripts) {
    const sentences = transcript?.sentences || []

    if (sentences.length > 0) {
      for (const sentence of sentences) {
        const text = getSentenceText(sentence)

        if (!text) {
          continue
        }

        const speakerId = getSpeakerId(sentence)

        if (!speakerId) {
          lines.push(text)
          continue
        }

        const role = speakerRoles[speakerId] || `Speaker ${speakerId}`

        lines.push(`${role}: ${text}`)
      }

      continue
    }

    const fallbackText = String(transcript?.text || '').trim()

    if (fallbackText) {
      lines.push(fallbackText)
    }
  }

  const finalText = lines.join('\n').trim()

  if (finalText) {
    return finalText
  }

  const fallback =
    String(transcriptionJson?.text || '').trim() ||
    String(transcriptionJson?.output?.text || '').trim()

  return fallback
}

async function submitTask(params) {
  const parameters = {
    channel_id: [0]
  }

  if (params.languageHint) {
    parameters.language_hints = [params.languageHint]
  }

  if (params.diarizationEnabled) {
    parameters.diarization_enabled = true
  }

  if (params.speakerCount) {
    parameters.speaker_count = Number(params.speakerCount)
  }

  const body = {
    model: params.model || DEFAULT_MODEL,
    input: {
      file_urls: [params.fileUrl]
    },
    parameters
  }

  return fetchJson(makeSubmitUrl(params.baseApiUrl), {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${params.apiKey}`,
      'Content-Type': 'application/json',
      'X-DashScope-Async': 'enable'
    },
    body: JSON.stringify(body)
  })
}

async function waitTask(params) {
  const startedAt = Date.now()

  while (true) {
    if (Date.now() - startedAt > params.timeoutMs) {
      throw new Error('Fun-ASR слишком долго обрабатывал аудио')
    }

    const taskJson = await fetchJson(makeTaskUrl(params.baseApiUrl, params.taskId), {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${params.apiKey}`
      }
    })

    const status = getTaskStatus(taskJson)

    if (status === 'SUCCEEDED') {
      return taskJson
    }

    if (status === 'FAILED' || status === 'CANCELED') {
      throw new Error(`Fun-ASR task failed: ${status}`)
    }

    await sleep(params.pollIntervalMs)
  }
}

async function downloadTranscriptionJson(url) {
  return fetchJson(url, {
    method: 'GET'
  })
}

async function main() {
  try {
    const rawInput = await readStdin()
    const payload = JSON.parse(rawInput)

    const apiKey = String(payload.apiKey || '').trim()
    const baseApiUrl = normalizeBaseApiUrl(payload.baseApiUrl)
    const fileUrl = String(payload.fileUrl || '').trim()

    if (!apiKey) {
      throw new Error('apiKey не передан')
    }

    if (!fileUrl) {
      throw new Error('fileUrl не передан. Для Fun-ASR async нужен публичный URL аудиофайла')
    }

    const params = {
      apiKey,
      baseApiUrl,
      fileUrl,
      model: String(payload.model || DEFAULT_MODEL).trim(),
      languageHint: String(payload.languageHint || 'ru').trim(),
      diarizationEnabled: Boolean(payload.diarizationEnabled),
      speakerCount: payload.speakerCount || 2,
      speaker0Role: String(payload.speaker0Role || 'Менеджер').trim(),
      speaker1Role: String(payload.speaker1Role || 'Клиент').trim(),
      pollIntervalMs: Number(payload.pollIntervalMs || DEFAULT_POLL_INTERVAL_MS),
      timeoutMs: Number(payload.timeoutMs || DEFAULT_TIMEOUT_MS)
    }

    const submitJson = await submitTask(params)
    const taskId = getTaskId(submitJson)

    if (!taskId) {
      throw new Error(`Fun-ASR не вернул task_id: ${JSON.stringify(submitJson)}`)
    }

    const taskJson = await waitTask({
      apiKey,
      baseApiUrl,
      taskId,
      pollIntervalMs: params.pollIntervalMs,
      timeoutMs: params.timeoutMs
    })

    const results = getTaskResults(taskJson)
    const firstResult = results[0]

    if (!firstResult) {
      throw new Error(`Fun-ASR не вернул results: ${JSON.stringify(taskJson)}`)
    }

    if (firstResult.subtask_status && firstResult.subtask_status !== 'SUCCEEDED') {
      throw new Error(firstResult.message || `Subtask failed: ${firstResult.subtask_status}`)
    }

    const transcriptionUrl = firstResult.transcription_url

    if (!transcriptionUrl) {
      throw new Error(`Fun-ASR не вернул transcription_url: ${JSON.stringify(firstResult)}`)
    }

    const transcriptionJson = await downloadTranscriptionJson(transcriptionUrl)

    const text = formatTranscriptText(transcriptionJson, {
      speaker0Role: params.speaker0Role,
      speaker1Role: params.speaker1Role
    })

    if (!text) {
      throw new Error('Fun-ASR вернул пустой текст')
    }

    printJson({
      ok: true,
      text,
      taskId,
      requestId: taskJson.request_id || submitJson.request_id || null
    })
  } catch (error) {
    printJson(
      {
        ok: false,
        error: error instanceof Error ? error.message : String(error)
      },
      1
    )
  }
}

main()