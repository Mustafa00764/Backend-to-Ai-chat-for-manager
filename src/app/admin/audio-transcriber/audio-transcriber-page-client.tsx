'use client'

import {
  CheckCircle2,
  Copy,
  Download,
  FileArchive,
  FileAudio2,
  FolderDown,
  KeyRound,
  Loader2,
  Save,
  Upload,
  XCircle
} from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

type FileStatus = 'queued' | 'processing' | 'success' | 'error'

type TranscribeItem = {
  id: string
  file: File
  status: FileStatus
  progress: number
  text: string
  error?: string
  requestId?: string | null
  taskId?: string | null
}

type SavedSettings = {
  apiKey: string
  apiUrl: string
  model: string
  sampleRate: string
  context: string
  diarizationEnabled: boolean
  speakerCount: string
  speaker0Role: string
  speaker1Role: string
}

type TranscribeResponse = {
  fileName: string
  sizeBytes: number
  model: string
  format?: string
  text: string
  usage?: unknown
  requestId: string | null
  taskId?: string | null
}

type WritableFileStreamLike = {
  write: (data: Blob | string) => Promise<void> | void
  close: () => Promise<void> | void
}

type FileSystemFileHandleLike = {
  createWritable: () => Promise<WritableFileStreamLike>
}

type FileSystemDirectoryHandleLike = {
  getFileHandle: (
    name: string,
    options?: {
      create?: boolean
    }
  ) => Promise<FileSystemFileHandleLike>
}

type WindowWithDirectoryPicker = Window & {
  showDirectoryPicker?: () => Promise<FileSystemDirectoryHandleLike>
}

const STORAGE_KEY = 'fun-asr-audio-transcriber-settings'

const DEFAULT_SETTINGS: SavedSettings = {
  apiKey: '',
  apiUrl:
    'https://ws-3m6rwjs94flv68ph.ap-southeast-1.maas.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation',
  model: 'fun-asr-flash-2026-06-15',
  sampleRate: '',
  context:
    'Это телефонный разговор менеджера с клиентом. Тематика: профнастил, сэндвич-панели, металлочерепица, цена, доставка, сроки, заказ.',
  diarizationEnabled: false,
  speakerCount: '2',
  speaker0Role: 'Менеджер',
  speaker1Role: 'Клиент'
}

const AUDIO_ACCEPT =
  '.mp3,.wav,.m4a,.ogg,.opus,.aac,.flac,.webm,.mp4,audio/*,video/mp4'

const AUDIO_EXTENSIONS = new Set([
  '.mp3',
  '.wav',
  '.m4a',
  '.ogg',
  '.opus',
  '.aac',
  '.flac',
  '.webm',
  '.mp4'
])

function loadSettingsFromStorage() {
  if (typeof window === 'undefined') {
    return DEFAULT_SETTINGS
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)

    if (!raw) {
      return DEFAULT_SETTINGS
    }

    const parsed = JSON.parse(raw) as Partial<SavedSettings>

    return {
      ...DEFAULT_SETTINGS,
      ...parsed
    }
  } catch {
    return DEFAULT_SETTINGS
  }
}

function saveSettingsToStorage(settings: SavedSettings) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
}

function createFileId(file: File) {
  return `${file.name}-${file.size}-${file.lastModified}-${Math.random()
    .toString(36)
    .slice(2)}`
}

function getFileExtension(file: File) {
  const name = file.name.toLowerCase()
  const dotIndex = name.lastIndexOf('.')

  if (dotIndex === -1) {
    return ''
  }

  return name.slice(dotIndex)
}

function isAudioFile(file: File) {
  const extension = getFileExtension(file)

  if (file.type.startsWith('audio/')) return true
  if (file.type === 'video/mp4') return true

  return AUDIO_EXTENSIONS.has(extension)
}

function formatFileSize(bytes?: number | null) {
  if (!bytes) return '—'

  if (bytes < 1024) return `${bytes} B`

  const kb = bytes / 1024

  if (kb < 1024) return `${kb.toFixed(1)} KB`

  const mb = kb / 1024

  if (mb < 1024) return `${mb.toFixed(1)} MB`

  return `${(mb / 1024).toFixed(2)} GB`
}

function getStatusLabel(status: FileStatus) {
  if (status === 'queued') return 'В очереди'
  if (status === 'processing') return 'Обработка'
  if (status === 'success') return 'Готово'

  return 'Ошибка'
}

function getStatusVariant(status: FileStatus) {
  if (status === 'success') return 'default'
  if (status === 'error') return 'destructive'

  return 'secondary'
}

function sanitizeFileName(fileName: string) {
  const cleanName = fileName
    .replace(/[<>:"/\\|?*\u0000-\u001F]/g, '_')
    .replace(/\s+/g, ' ')
    .trim()

  return cleanName || 'transcript.txt'
}

function createBaseTxtFileName(fileName: string) {
  const cleanFileName = sanitizeFileName(fileName)
  const dotIndex = cleanFileName.lastIndexOf('.')

  if (dotIndex === -1) {
    return `${cleanFileName}.txt`
  }

  return `${cleanFileName.slice(0, dotIndex)}.txt`
}

function createUniqueTxtFileName(
  item: TranscribeItem,
  index: number,
  usedNames: Set<string>
) {
  const baseName = createBaseTxtFileName(item.file.name)
  const dotIndex = baseName.lastIndexOf('.')
  const nameWithoutExt =
    dotIndex === -1 ? baseName : baseName.slice(0, dotIndex)

  let candidate = baseName
  let counter = 1

  while (usedNames.has(candidate.toLowerCase())) {
    candidate = `${nameWithoutExt}_${index + 1}_${counter}.txt`
    counter += 1
  }

  usedNames.add(candidate.toLowerCase())

  return candidate
}

function createTxtContent(item: TranscribeItem) {
  return item.text.trim()
}

function getDownloadFileName(response: Response, fallbackFileName: string) {
  const contentDisposition = response.headers.get('Content-Disposition')

  if (!contentDisposition) {
    return fallbackFileName
  }

  const utf8Match = contentDisposition.match(/filename\*=UTF-8''([^;]+)/i)

  if (utf8Match?.[1]) {
    try {
      return decodeURIComponent(utf8Match[1])
    } catch {
      return fallbackFileName
    }
  }

  const normalMatch = contentDisposition.match(/filename="?([^"]+)"?/i)

  if (normalMatch?.[1]) {
    return normalMatch[1]
  }

  return fallbackFileName
}

async function downloadBlobFromResponse(
  response: Response,
  fallbackFileName: string
) {
  const blob = await response.blob()

  if (!response.ok) {
    let message = 'Не удалось скачать файл'

    try {
      const errorText = await blob.text()
      const errorJson = JSON.parse(errorText) as { error?: string }

      if (errorJson.error) {
        message = errorJson.error
      }
    } catch {
      // ignore
    }

    throw new Error(message)
  }

  const fileName = getDownloadFileName(response, fallbackFileName)
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')

  link.href = url
  link.download = fileName
  link.rel = 'noopener'
  link.style.display = 'none'

  document.body.appendChild(link)
  link.click()
  link.remove()

  window.setTimeout(() => {
    URL.revokeObjectURL(url)
  }, 1500)
}

function createRoleContext(settings: SavedSettings) {
  if (!settings.diarizationEnabled) {
    return settings.context.trim()
  }

  return [
    settings.context.trim(),
    `Если возможно, оформи расшифровку по ролям: ${settings.speaker0Role.trim() || 'Менеджер'} и ${settings.speaker1Role.trim() || 'Клиент'}.`
  ]
    .filter(Boolean)
    .join('\n')
}

const TRANSCRIBE_BATCH_SIZE = 50

const BATCH_DELAY_MS = 10000

const RATE_LIMIT_RETRY_DELAYS_MS = [15000, 30000, 60000]

function sleep(ms: number) {
  return new Promise<void>(resolve => {
    window.setTimeout(resolve, ms)
  })
}

function isRateLimitError(message: string) {
  return /rate limit|rate-limit|requests rate limit exceeded|too many requests|429|throttl/i.test(
    message.toLowerCase()
  )
}

function chunkArray<T>(array: T[], size: number) {
  const chunks: T[][] = []

  for (let index = 0; index < array.length; index += size) {
    chunks.push(array.slice(index, index + size))
  }

  return chunks
}

async function transcribeFileWithRetry(params: {
  file: File
  settings: SavedSettings
  onRetry?: (attempt: number, delayMs: number, message: string) => void
}) {
  let lastError: Error | null = null

  for (
    let attempt = 0;
    attempt <= RATE_LIMIT_RETRY_DELAYS_MS.length;
    attempt += 1
  ) {
    try {
      return await transcribeFile({
        file: params.file,
        settings: params.settings
      })
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Не удалось распознать аудио'

      lastError = new Error(message)

      const shouldRetry =
        isRateLimitError(message) && attempt < RATE_LIMIT_RETRY_DELAYS_MS.length

      if (!shouldRetry) {
        throw lastError
      }

      const delayMs = RATE_LIMIT_RETRY_DELAYS_MS[attempt]

      params.onRetry?.(attempt + 1, delayMs, message)

      await sleep(delayMs + Math.floor(Math.random() * 3000))
    }
  }

  throw lastError || new Error('Не удалось распознать аудио')
}

async function transcribeFile(params: { file: File; settings: SavedSettings }) {
  const formData = new FormData()

  formData.append('file', params.file)
  formData.append('apiKey', params.settings.apiKey.trim())
  formData.append('apiUrl', params.settings.apiUrl.trim())
  formData.append('model', params.settings.model.trim())
  formData.append('sampleRate', params.settings.sampleRate.trim())
  formData.append('context', createRoleContext(params.settings))
  formData.append(
    'diarizationEnabled',
    String(params.settings.diarizationEnabled)
  )
  formData.append('speakerCount', params.settings.speakerCount.trim())
  formData.append('speaker0Role', params.settings.speaker0Role.trim())
  formData.append('speaker1Role', params.settings.speaker1Role.trim())

  const response = await fetch('/api/admin-api/audio-transcriber/fun-asr', {
    method: 'POST',
    body: formData
  })

  const json = await response.json().catch(() => null)

  if (!response.ok) {
    const message =
      json &&
      typeof json === 'object' &&
      'error' in json &&
      typeof json.error === 'string'
        ? json.error
        : 'Не удалось распознать аудио'

    throw new Error(message)
  }

  return json as TranscribeResponse
}

export function AudioTranscriberPageClient() {
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const [settings, setSettings] = useState<SavedSettings>(DEFAULT_SETTINGS)
  const [items, setItems] = useState<TranscribeItem[]>([])
  const [isProcessing, setIsProcessing] = useState(false)
  const [isZipCreating, setIsZipCreating] = useState(false)
  const [isFolderSaving, setIsFolderSaving] = useState(false)

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSettings(loadSettingsFromStorage())
    }, 0)

    return () => {
      window.clearTimeout(timer)
    }
  }, [])

  const successCount = items.filter(item => item.status === 'success').length
  const errorCount = items.filter(item => item.status === 'error').length
  const processingCount = items.filter(
    item => item.status === 'processing'
  ).length

  function updateSetting<K extends keyof SavedSettings>(
    key: K,
    value: SavedSettings[K]
  ) {
    setSettings(prev => ({
      ...prev,
      [key]: value
    }))
  }

  function getReadyItems() {
    return items.filter(item => item.status === 'success' && item.text.trim())
  }

  function getReadyFilesPayload() {
    const readyItems = getReadyItems()
    const usedNames = new Set<string>()

    return readyItems.map((item, index) => ({
      fileName: createUniqueTxtFileName(item, index, usedNames),
      text: createTxtContent(item)
    }))
  }

  function handleSaveSettings() {
    saveSettingsToStorage(settings)

    toast.success('Настройки сохранены', {
      description: 'QWEN_API_KEY и параметры Fun-ASR сохранены в браузере'
    })
  }

  function handleFilesChange(event: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? [])

    if (files.length === 0) {
      setItems([])
      return
    }

    const audioFiles = files.filter(isAudioFile)
    const rejectedCount = files.length - audioFiles.length

    if (rejectedCount > 0) {
      toast.error('Некоторые файлы пропущены', {
        description: `Не аудиофайлов: ${rejectedCount}`
      })
    }

    const nextItems: TranscribeItem[] = audioFiles.map(file => ({
      id: createFileId(file),
      file,
      status: 'queued',
      progress: 0,
      text: ''
    }))

    setItems(nextItems)
  }

  function updateItem(
    id: string,
    updater: (item: TranscribeItem) => TranscribeItem
  ) {
    setItems(prev =>
      prev.map(item => {
        if (item.id !== id) return item

        return updater(item)
      })
    )
  }

  function handleClearFiles() {
    if (isProcessing || isZipCreating || isFolderSaving) return

    setItems([])

    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  async function handleCopyText(text: string) {
    try {
      await navigator.clipboard.writeText(text)
      toast.success('Текст скопирован')
    } catch {
      toast.error('Не удалось скопировать текст')
    }
  }

  async function handleDownloadItem(item: TranscribeItem) {
    const text = createTxtContent(item)

    if (!text) {
      toast.error('Нет текста для скачивания')
      return
    }

    const fileName = createBaseTxtFileName(item.file.name)

    try {
      const response = await fetch(
        '/api/admin-api/audio-transcriber/download-txt',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            fileName,
            text
          })
        }
      )

      await downloadBlobFromResponse(response, fileName)

      toast.success('TXT скачан')
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Не удалось скачать TXT'

      toast.error(message)
    }
  }

  async function handleDownloadZip() {
    const files = getReadyFilesPayload()

    if (files.length === 0) {
      toast.error('Нет готовых текстов')
      return
    }

    setIsZipCreating(true)

    try {
      const response = await fetch(
        '/api/admin-api/audio-transcriber/download-zip',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            files
          })
        }
      )

      await downloadBlobFromResponse(response, 'audio_transcripts_txt.zip')

      toast.success('ZIP скачан', {
        description: `TXT файлов внутри архива: ${files.length}`
      })
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Не удалось скачать ZIP'

      toast.error(message)
    } finally {
      setIsZipCreating(false)
    }
  }

  async function handleSaveAllToFolder() {
    const files = getReadyFilesPayload()

    if (files.length === 0) {
      toast.error('Нет готовых текстов')
      return
    }

    const picker = (window as WindowWithDirectoryPicker).showDirectoryPicker

    if (!picker) {
      toast.error('Сохранение в папку не поддерживается этим браузером', {
        description: 'Используй Chrome/Edge или кнопку “Скачать ZIP”.'
      })
      return
    }

    setIsFolderSaving(true)

    try {
      const directoryHandle = await picker()

      for (const file of files) {
        const fileHandle = await directoryHandle.getFileHandle(file.fileName, {
          create: true
        })

        const writable = await fileHandle.createWritable()

        await writable.write(
          new Blob([file.text], {
            type: 'text/plain;charset=utf-8'
          })
        )

        await writable.close()
      }

      toast.success('TXT сохранены в выбранную папку', {
        description: `Файлов: ${files.length}`
      })
    } catch (error) {
      const message =
        error instanceof Error && error.name === 'AbortError'
          ? 'Сохранение отменено'
          : 'Не удалось сохранить файлы в папку'

      toast.error(message)
    } finally {
      setIsFolderSaving(false)
    }
  }
  async function handleStart() {
    if (!settings.apiKey.trim()) {
      toast.error('Введи QWEN_API_KEY')
      return
    }

    if (!settings.apiUrl.trim()) {
      toast.error('Введи QWEN_API_URL')
      return
    }

    if (!settings.model.trim()) {
      toast.error('Введи название модели')
      return
    }

    const itemsToProcess = items.filter(item => item.status !== 'success')

    if (itemsToProcess.length === 0) {
      toast.error('Выбери аудиофайлы')
      return
    }

    saveSettingsToStorage(settings)
    setIsProcessing(true)

    for (const item of itemsToProcess) {
      updateItem(item.id, current => ({
        ...current,
        status: 'queued',
        progress: 0,
        error: undefined,
        text: ''
      }))
    }

    const results: Array<{
      status: 'success' | 'error'
      item: TranscribeItem
      error?: string
    }> = []

    const batches = chunkArray(itemsToProcess, TRANSCRIBE_BATCH_SIZE)

    for (let batchIndex = 0; batchIndex < batches.length; batchIndex += 1) {
      const batch = batches[batchIndex]

      toast.info(`Запущена пачка ${batchIndex + 1} из ${batches.length}`, {
        description: `Файлов в пачке: ${batch.length}`
      })

      for (const item of batch) {
        updateItem(item.id, current => ({
          ...current,
          status: 'processing',
          progress: 20,
          error: undefined
        }))
      }

      const batchResults = await Promise.all(
        batch.map(async item => {
          try {
            updateItem(item.id, current => ({
              ...current,
              progress: 45
            }))

            const result = await transcribeFileWithRetry({
              file: item.file,
              settings,
              onRetry: (attempt, delayMs) => {
                updateItem(item.id, current => ({
                  ...current,
                  status: 'processing',
                  progress: 55,
                  error: `Rate limit. Повтор ${attempt} через ${Math.ceil(
                    delayMs / 1000
                  )} сек.`
                }))
              }
            })

            updateItem(item.id, current => ({
              ...current,
              status: 'success',
              progress: 100,
              text: result.text,
              error: undefined,
              requestId: result.requestId,
              taskId: result.taskId ?? null
            }))

            return {
              status: 'success' as const,
              item
            }
          } catch (error) {
            const message =
              error instanceof Error
                ? error.message
                : 'Не удалось распознать аудио'

            updateItem(item.id, current => ({
              ...current,
              status: 'error',
              progress: 0,
              error: message
            }))

            return {
              status: 'error' as const,
              item,
              error: message
            }
          }
        })
      )

      results.push(...batchResults)

      const hasNextBatch = batchIndex < batches.length - 1

      if (hasNextBatch) {
        toast.info('Пауза перед следующей пачкой', {
          description: `${Math.ceil(BATCH_DELAY_MS / 1000)} сек.`
        })

        await sleep(BATCH_DELAY_MS)
      }
    }

    setIsProcessing(false)

    const done = results.filter(result => result.status === 'success').length
    const failed = results.filter(result => result.status === 'error').length

    if (done > 0 && failed === 0) {
      toast.success('Все аудио обработаны', {
        description: `Готово TXT: ${done}`
      })
    }

    if (failed > 0) {
      toast.error('Обработка завершена с ошибками', {
        description: `Готово: ${done}, ошибок: ${failed}`
      })
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">
          Конвертер аудио в TXT
        </h1>
        <p className="text-muted-foreground">
          Массовая расшифровка аудиофайлов через Fun-ASR. Каждый аудиофайл
          превращается в отдельный TXT.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <KeyRound className="h-5 w-5" />
            Настройки Fun-ASR
          </CardTitle>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-[1fr_360px]">
            <div className="space-y-2">
              <Label>QWEN_API_KEY</Label>
              <Input
                type="password"
                value={settings.apiKey}
                onChange={event => updateSetting('apiKey', event.target.value)}
                placeholder="sk-..."
                disabled={isProcessing}
              />
            </div>

            <div className="space-y-2">
              <Label>Модель</Label>
              <Input
                value={settings.model}
                onChange={event => updateSetting('model', event.target.value)}
                placeholder="fun-asr-flash-2026-06-15"
                disabled={isProcessing}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>QWEN_API_URL</Label>
            <Input
              value={settings.apiUrl}
              onChange={event => updateSetting('apiUrl', event.target.value)}
              placeholder="https://WORKSPACE_ID.ap-southeast-1.maas.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation"
              disabled={isProcessing}
            />
            <p className="text-xs text-muted-foreground">
              Для режима без OSS используй generation endpoint, не
              /compatible-mode/v1.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-[220px_1fr]">
            <div className="space-y-2">
              <Label>Sample rate</Label>
              <Input
                value={settings.sampleRate}
                onChange={event =>
                  updateSetting('sampleRate', event.target.value)
                }
                placeholder="можно пустым"
                disabled={isProcessing}
              />
            </div>

            <div className="space-y-2">
              <Label>Контекст для распознавания</Label>
              <textarea
                value={settings.context}
                onChange={event => updateSetting('context', event.target.value)}
                disabled={isProcessing}
                placeholder="Например: профнастил, сэндвич-панели, металлочерепица..."
                className="min-h-24 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm outline-none placeholder:text-muted-foreground focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
              />
            </div>
          </div>

          <div className="rounded-lg border bg-muted/40 p-4">
            <label className="flex cursor-pointer items-center gap-2 text-sm font-medium">
              <input
                type="checkbox"
                checked={settings.diarizationEnabled}
                onChange={event =>
                  updateSetting('diarizationEnabled', event.target.checked)
                }
                disabled={isProcessing}
                className="h-4 w-4"
              />
              Пробовать оформлять текст по ролям
            </label>

            <p className="mt-2 text-xs text-muted-foreground">
              В режиме без OSS это не настоящее speaker_id-разделение. Это
              только подсказка модели оформить текст как менеджер/клиент.
            </p>

            <div className="mt-4 grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label>Количество говорящих</Label>
                <Input
                  value={settings.speakerCount}
                  onChange={event =>
                    updateSetting('speakerCount', event.target.value)
                  }
                  placeholder="2"
                  disabled={isProcessing || !settings.diarizationEnabled}
                />
              </div>

              <div className="space-y-2">
                <Label>Роль 1</Label>
                <Input
                  value={settings.speaker0Role}
                  onChange={event =>
                    updateSetting('speaker0Role', event.target.value)
                  }
                  placeholder="Менеджер"
                  disabled={isProcessing || !settings.diarizationEnabled}
                />
              </div>

              <div className="space-y-2">
                <Label>Роль 2</Label>
                <Input
                  value={settings.speaker1Role}
                  onChange={event =>
                    updateSetting('speaker1Role', event.target.value)
                  }
                  placeholder="Клиент"
                  disabled={isProcessing || !settings.diarizationEnabled}
                />
              </div>
            </div>
          </div>

          <Button
            type="button"
            variant="outline"
            onClick={handleSaveSettings}
            disabled={isProcessing}
          >
            <Save className="mr-2 h-4 w-4" />
            Сохранить настройки
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileAudio2 className="h-5 w-5" />
            Аудиофайлы
          </CardTitle>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Загрузить аудио</Label>
            <Input
              ref={fileInputRef}
              type="file"
              multiple
              accept={AUDIO_ACCEPT}
              onChange={handleFilesChange}
              disabled={isProcessing}
            />
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              onClick={handleStart}
              disabled={isProcessing || items.length === 0}
            >
              {isProcessing ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Upload className="mr-2 h-4 w-4" />
              )}
              {isProcessing
                ? `Обработка... активных: ${processingCount}`
                : `Конвертировать пачками по 50: ${items.length}`}
            </Button>

            <Button
              variant="outline"
              onClick={handleClearFiles}
              disabled={isProcessing || isZipCreating || isFolderSaving}
            >
              Очистить список
            </Button>

            <Button
              variant="outline"
              onClick={handleDownloadZip}
              disabled={successCount === 0 || isZipCreating || isFolderSaving}
            >
              {isZipCreating ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <FileArchive className="mr-2 h-4 w-4" />
              )}
              {isZipCreating ? 'Создаю ZIP...' : 'Скачать все TXT одним ZIP'}
            </Button>

            <Button
              variant="outline"
              onClick={handleSaveAllToFolder}
              disabled={successCount === 0 || isZipCreating || isFolderSaving}
            >
              {isFolderSaving ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <FolderDown className="mr-2 h-4 w-4" />
              )}
              Сохранить все отдельными TXT в папку
            </Button>
          </div>

          {items.length > 0 ? (
            <div className="rounded-lg border p-4">
              <div className="mb-4">
                <p className="text-sm font-medium">Файлов: {items.length}</p>
                <p className="text-xs text-muted-foreground">
                  Готово: {successCount}, ошибок: {errorCount}, в обработке:{' '}
                  {processingCount}
                </p>
              </div>

              <div className="max-h-[620px] space-y-3 overflow-y-auto pr-1">
                {items.map(item => (
                  <div key={item.id} className="rounded-md border p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">
                          {item.file.name}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {formatFileSize(item.file.size)}
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        {item.status === 'success' ? (
                          <CheckCircle2 className="h-4 w-4" />
                        ) : null}

                        {item.status === 'error' ? (
                          <XCircle className="h-4 w-4" />
                        ) : null}

                        {item.status === 'processing' ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : null}

                        <Badge variant={getStatusVariant(item.status)}>
                          {getStatusLabel(item.status)}
                        </Badge>
                      </div>
                    </div>

                    <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full bg-primary transition-all"
                        style={{
                          width: `${item.progress}%`
                        }}
                      />
                    </div>

                    {item.error ? (
                      <p className="mt-2 text-sm text-destructive">
                        {item.error}
                      </p>
                    ) : null}

                    {item.text ? (
                      <div className="mt-4 space-y-3">
                        <div className="flex flex-wrap gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleCopyText(item.text)}
                          >
                            <Copy className="mr-2 h-4 w-4" />
                            Копировать текст
                          </Button>

                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleDownloadItem(item)}
                          >
                            <Download className="mr-2 h-4 w-4" />
                            Скачать TXT
                          </Button>
                        </div>

                        <textarea
                          value={item.text}
                          readOnly
                          className="min-h-40 w-full rounded-md border bg-muted/30 px-3 py-2 text-sm outline-none"
                        />
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  )
}
