'use client'

import JSZip from 'jszip'
import {
  CheckCircle2,
  Copy,
  Download,
  FileArchive,
  FileAudio2,
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
  format: string
  text: string
  usage: unknown
  requestId: string | null
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
  return fileName
    .replace(/[<>:"/\\|?*\u0000-\u001F]/g, '_')
    .replace(/\s+/g, ' ')
    .trim()
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

function downloadTextFile(fileName: string, text: string) {
  const blob = new Blob([text], {
    type: 'text/plain;charset=utf-8'
  })

  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')

  link.href = url
  link.download = fileName
  link.style.display = 'none'

  document.body.appendChild(link)
  link.click()
  link.remove()

  window.setTimeout(() => {
    URL.revokeObjectURL(url)
  }, 1000)
}

async function downloadBlob(fileName: string, blob: Blob) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')

  link.href = url
  link.download = fileName
  link.style.display = 'none'

  document.body.appendChild(link)
  link.click()
  link.remove()

  window.setTimeout(() => {
    URL.revokeObjectURL(url)
  }, 1000)
}

async function transcribeFile(params: { file: File; settings: SavedSettings }) {
  const formData = new FormData()

  formData.append('file', params.file)
  formData.append('apiKey', params.settings.apiKey)
  formData.append('apiUrl', params.settings.apiUrl)
  formData.append('model', params.settings.model)
  formData.append('sampleRate', params.settings.sampleRate)
  formData.append('context', params.settings.context)
  formData.append(
    'diarizationEnabled',
    String(params.settings.diarizationEnabled)
  )
  formData.append('speakerCount', params.settings.speakerCount)
  formData.append('speaker0Role', params.settings.speaker0Role)
  formData.append('speaker1Role', params.settings.speaker1Role)

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
    if (isProcessing || isZipCreating) return

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

  function handleDownloadItem(item: TranscribeItem) {
    downloadTextFile(
      createBaseTxtFileName(item.file.name),
      createTxtContent(item)
    )
  }

  function handleDownloadAllSeparateTxt() {
    const readyItems = getReadyItems()

    if (readyItems.length === 0) {
      toast.error('Нет готовых текстов')
      return
    }

    const usedNames = new Set<string>()

    readyItems.forEach((item, index) => {
      const fileName = createUniqueTxtFileName(item, index, usedNames)
      const content = createTxtContent(item)

      window.setTimeout(() => {
        downloadTextFile(fileName, content)
      }, index * 600)
    })

    toast.success('Скачивание отдельных TXT запущено', {
      description:
        'Если браузер заблокирует массовое скачивание, используй кнопку ZIP.'
    })
  }

  async function handleDownloadZip() {
    const readyItems = getReadyItems()

    if (readyItems.length === 0) {
      toast.error('Нет готовых текстов')
      return
    }

    setIsZipCreating(true)

    try {
      const zip = new JSZip()
      const folder = zip.folder('transcripts')
      const usedNames = new Set<string>()

      readyItems.forEach((item, index) => {
        const fileName = createUniqueTxtFileName(item, index, usedNames)
        const content = createTxtContent(item)

        folder?.file(fileName, content)
      })

      const blob = await zip.generateAsync({
        type: 'blob',
        compression: 'DEFLATE',
        compressionOptions: {
          level: 6
        }
      })

      await downloadBlob('audio_transcripts_txt.zip', blob)

      toast.success('ZIP создан', {
        description: `TXT файлов внутри архива: ${readyItems.length}`
      })
    } catch {
      toast.error('Не удалось создать ZIP архив')
    } finally {
      setIsZipCreating(false)
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
        status: 'processing',
        progress: 15,
        error: undefined,
        text: ''
      }))
    }

    const results = await Promise.all(
      itemsToProcess.map(async item => {
        try {
          updateItem(item.id, current => ({
            ...current,
            progress: 45
          }))

          const result = await transcribeFile({
            file: item.file,
            settings
          })

          updateItem(item.id, current => ({
            ...current,
            status: 'success',
            progress: 100,
            text: result.text,
            requestId: result.requestId
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
              <p className="text-xs text-muted-foreground">
                Ключ сохраняется только в браузере через localStorage и
                отправляется на твой backend только во время обработки.
              </p>
            </div>

            <div className="space-y-2">
              <Label>Модель</Label>
              <Input
                value={settings.model}
                onChange={event => updateSetting('model', event.target.value)}
                placeholder="Например: fun-asr-flash-2026-06-15"
                disabled={isProcessing}
              />
              <p className="text-xs text-muted-foreground">
                Можно вписать любую модель вручную.
              </p>
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
              Для Singapore:
              https://WORKSPACE_ID.ap-southeast-1.maas.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation
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
                placeholder="например 16000"
                disabled={isProcessing}
              />
              <p className="text-xs text-muted-foreground">
                Можно оставить пустым.
              </p>
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
              <p className="text-xs text-muted-foreground">
                Контекст помогает распознавать строительные термины.
              </p>
            </div>
          </div>

          <div className="rounded-lg border bg-muted/40 p-4">
            <div className="flex flex-wrap items-center gap-3">
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
                Включить разделение говорящих
              </label>
            </div>

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
                <Label>Speaker 0</Label>
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
                <Label>Speaker 1</Label>
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

            <p className="mt-3 text-xs text-muted-foreground">
              Если Fun-ASR вернёт speaker_id, TXT будет оформлен как “Менеджер:
              … / Клиент: …”. Если speaker_id не придёт, будет сохранён обычный
              текст.
            </p>
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
            <p className="text-xs text-muted-foreground">
              Можно выбрать много файлов. Все выбранные файлы будут отправлены и
              обработаны одновременно.
            </p>
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
                : `Конвертировать все одновременно: ${items.length}`}
            </Button>

            <Button
              variant="outline"
              onClick={handleClearFiles}
              disabled={isProcessing || isZipCreating}
            >
              Очистить список
            </Button>

            <Button
              variant="outline"
              onClick={handleDownloadAllSeparateTxt}
              disabled={successCount === 0 || isZipCreating}
            >
              <Download className="mr-2 h-4 w-4" />
              Скачать все отдельными TXT
            </Button>

            <Button
              variant="outline"
              onClick={handleDownloadZip}
              disabled={successCount === 0 || isZipCreating}
            >
              {isZipCreating ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <FileArchive className="mr-2 h-4 w-4" />
              )}
              {isZipCreating ? 'Создаю ZIP...' : 'Скачать ZIP с TXT'}
            </Button>
          </div>

          {items.length > 0 ? (
            <div className="rounded-lg border p-4">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium">Файлов: {items.length}</p>
                  <p className="text-xs text-muted-foreground">
                    Готово: {successCount}, ошибок: {errorCount}, в обработке:{' '}
                    {processingCount}
                  </p>
                </div>
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
