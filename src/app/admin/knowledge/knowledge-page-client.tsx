'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Database, FileAudio2, RefreshCw, Upload } from 'lucide-react'
import { useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table'

type KnowledgeSource = {
  id: string
  title: string
  type: string
  fileId: string | null
  createdById: string | null
  createdAt: string
  updatedAt: string
  _count: {
    conversations: number
    chunks: number
  }
  file: {
    id: string
    originalName: string
    sizeBytes: number
    fileType: string
    s3Key: string
  } | null
}

type SourcesResponse = {
  sources: KnowledgeSource[]
}

type ImportResponse = {
  source: KnowledgeSource
  stats: {
    conversationsCount: number
    messagesCount: number
    chunksCount: number
  }
}

type EmbeddingStatsResponse = {
  stats: {
    total: number
    embedded: number
    notEmbedded: number
  }
}

type EmbeddingRunResponse = {
  result: {
    processed: number
    message?: string
    model?: string
    usage?: unknown
  }
  stats: {
    total: number
    embedded: number
    notEmbedded: number
  }
}

type KnowledgeSearchResponse = {
  results: Array<{
    id: string
    conversationId: string
    text: string
    chunkType: string
    chunkIndex: number
    score: number
    sourceId: string | null
    channel: string | null
    rawText: string | null
  }>
}

type UploadItemStatus = 'queued' | 'uploading' | 'success' | 'error'

type UploadSourceKind = 'text' | 'audio'

type UploadItem = {
  id: string
  file: File
  status: UploadItemStatus
  progress: number
  error?: string
  stats?: ImportResponse['stats']
}

type ImportKnowledgeFileOptions = {
  file: File
  title: string
  channel: string
  sourceKind: UploadSourceKind
  onProgress: (progress: number) => void
}

const TEXT_ACCEPT =
  '.txt,.jsonl,.xlsx,.xls,.csv,text/plain,application/json,application/jsonl,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv'

const AUDIO_ACCEPT =
  '.mp3,.wav,.m4a,.ogg,.aac,.flac,.webm,.mp4,audio/*,video/mp4'

const TEXT_EXTENSIONS = new Set(['.txt', '.jsonl', '.xlsx', '.xls', '.csv'])
const AUDIO_EXTENSIONS = new Set([
  '.mp3',
  '.wav',
  '.m4a',
  '.ogg',
  '.aac',
  '.flac',
  '.webm',
  '.mp4'
])

async function fetchSources() {
  const response = await fetch('/api/admin-api/knowledge/sources')

  if (!response.ok) {
    throw new Error('Не удалось загрузить базу знаний')
  }

  return response.json() as Promise<SourcesResponse>
}

function getFileExtension(file: File) {
  const name = file.name.toLowerCase()
  const dotIndex = name.lastIndexOf('.')

  if (dotIndex === -1) return ''

  return name.slice(dotIndex)
}

function isAllowedFile(file: File, sourceKind: UploadSourceKind) {
  const extension = getFileExtension(file)

  if (sourceKind === 'audio') {
    if (file.type.startsWith('audio/')) return true
    if (file.type === 'video/mp4') return true

    return AUDIO_EXTENSIONS.has(extension)
  }

  if (file.type === 'text/plain') return true
  if (file.type === 'application/json') return true
  if (file.type === 'application/jsonl') return true

  return TEXT_EXTENSIONS.has(extension)
}

function getImportEndpoint(sourceKind: UploadSourceKind) {
  if (sourceKind === 'audio') {
    return '/api/admin-api/knowledge/audio/import'
  }

  return '/api/admin-api/knowledge/import'
}

async function importKnowledgeFile({
  file,
  title,
  channel,
  sourceKind,
  onProgress
}: ImportKnowledgeFileOptions) {
  return new Promise<ImportResponse>((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    const formData = new FormData()

    formData.append('file', file)
    formData.append('title', title || file.name)
    formData.append('channel', channel)
    formData.append('sourceKind', sourceKind)

    xhr.open('POST', getImportEndpoint(sourceKind))

    xhr.upload.onprogress = event => {
      if (!event.lengthComputable) return

      const progress = Math.round((event.loaded / event.total) * 100)

      /**
       * 95%, потому что после загрузки файла backend ещё импортирует текст
       * или расшифровывает аудио, режет на chunks и сохраняет в базу.
       */
      onProgress(Math.min(progress, 95))
    }

    xhr.onload = () => {
      let json: unknown = null

      try {
        json = JSON.parse(xhr.responseText)
      } catch {
        json = null
      }

      if (xhr.status >= 200 && xhr.status < 300) {
        onProgress(100)
        resolve(json as ImportResponse)
        return
      }

      const errorMessage =
        json &&
        typeof json === 'object' &&
        'error' in json &&
        typeof json.error === 'string'
          ? json.error
          : xhr.responseText || 'Не удалось импортировать файл'

      reject(new Error(errorMessage))
    }

    xhr.onerror = () => {
      reject(new Error('Ошибка сети при импорте файла'))
    }

    xhr.onabort = () => {
      reject(new Error('Импорт файла был отменён'))
    }

    xhr.send(formData)
  })
}

async function fetchEmbeddingStats() {
  const response = await fetch('/api/admin-api/knowledge/embeddings')

  if (!response.ok) {
    throw new Error('Не удалось загрузить статистику embeddings')
  }

  return response.json() as Promise<EmbeddingStatsResponse>
}

async function runEmbeddings() {
  const response = await fetch('/api/admin-api/knowledge/embeddings?limit=10', {
    method: 'POST'
  })

  const json = await response.json()

  if (!response.ok) {
    throw new Error(json.error || 'Не удалось создать embeddings')
  }

  return json as EmbeddingRunResponse
}

async function searchKnowledge(query: string) {
  const params = new URLSearchParams({
    q: query,
    limit: '5'
  })

  const response = await fetch(`/api/admin-api/knowledge/search?${params}`)

  const json = await response.json()

  if (!response.ok) {
    throw new Error(json.error || 'Ошибка поиска по базе знаний')
  }

  return json as KnowledgeSearchResponse
}

function createUploadItemId(file: File) {
  return `${file.name}-${file.size}-${file.lastModified}-${Math.random()
    .toString(36)
    .slice(2)}`
}

function getUploadStatusLabel(status: UploadItemStatus) {
  if (status === 'queued') return 'В очереди'
  if (status === 'uploading') return 'Загрузка'
  if (status === 'success') return 'Готово'

  return 'Ошибка'
}

function getUploadStatusVariant(status: UploadItemStatus) {
  if (status === 'success') return 'default'
  if (status === 'error') return 'destructive'

  return 'secondary'
}

function formatFileSize(bytes?: number | null) {
  if (!bytes) {
    return '—'
  }

  if (bytes < 1024) {
    return `${bytes} B`
  }

  const kb = bytes / 1024

  if (kb < 1024) {
    return `${kb.toFixed(1)} KB`
  }

  const mb = kb / 1024

  if (mb < 1024) {
    return `${mb.toFixed(1)} MB`
  }

  return `${(mb / 1024).toFixed(2)} GB`
}

function getSourceKindLabel(sourceKind: UploadSourceKind) {
  if (sourceKind === 'audio') {
    return 'Аудиофайлы'
  }

  return 'Текстовые файлы'
}

function getFileInputAccept(sourceKind: UploadSourceKind) {
  if (sourceKind === 'audio') {
    return AUDIO_ACCEPT
  }

  return TEXT_ACCEPT
}

function getFileInputHint(sourceKind: UploadSourceKind) {
  if (sourceKind === 'audio') {
    return 'Можно выбрать сразу много MP3, WAV, M4A, OGG, AAC, FLAC, WEBM или MP4. Файлы будут загружаться на сервер, сервер расшифрует аудио в текст и добавит результат в базу знаний.'
  }

  return 'Можно выбрать сразу много TXT, JSONL, XLSX, XLS или CSV файлов. Excel-таблицы будут превращены в текст и импортированы в базу знаний.'
}

function getImportButtonLabel(
  sourceKind: UploadSourceKind,
  isImporting: boolean,
  count: number
) {
  if (isImporting) {
    return sourceKind === 'audio'
      ? 'Загружаю и расшифровываю аудио...'
      : 'Импортирую постепенно...'
  }

  return sourceKind === 'audio'
    ? `Загрузить и обработать аудио: ${count}`
    : `Импортировать файлов: ${count}`
}

export function KnowledgePageClient() {
  const queryClient = useQueryClient()
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const [title, setTitle] = useState('')
  const [channel, setChannel] = useState('PHONE')
  const [sourceKind, setSourceKind] = useState<UploadSourceKind>('text')
  const [uploadItems, setUploadItems] = useState<UploadItem[]>([])
  const [isImporting, setIsImporting] = useState(false)

  const [searchQuery, setSearchQuery] = useState('')
  const [searchResult, setSearchResult] =
    useState<KnowledgeSearchResponse | null>(null)

  const sourcesQuery = useQuery({
    queryKey: ['knowledge-sources'],
    queryFn: fetchSources
  })

  const embeddingStatsQuery = useQuery({
    queryKey: ['knowledge-embedding-stats'],
    queryFn: fetchEmbeddingStats
  })

  const embeddingsMutation = useMutation({
    mutationFn: runEmbeddings,
    onSuccess: data => {
      queryClient.invalidateQueries({
        queryKey: ['knowledge-embedding-stats']
      })

      queryClient.invalidateQueries({
        queryKey: ['knowledge-sources']
      })

      toast.success('Embeddings созданы', {
        description: `Обработано chunks: ${data.result.processed}`
      })
    },
    onError: error => {
      toast.error(error.message)
    }
  })

  const searchMutation = useMutation({
    mutationFn: searchKnowledge,
    onSuccess: data => {
      setSearchResult(data)
    },
    onError: error => {
      toast.error(error.message)
    }
  })

  const acceptedExtensionsLabel = useMemo(() => {
    return sourceKind === 'audio'
      ? 'MP3, WAV, M4A, OGG, AAC, FLAC, WEBM, MP4'
      : 'TXT, JSONL'
  }, [sourceKind])

  function handleSourceKindChange(value: string | null) {
    const nextKind: UploadSourceKind = value === 'audio' ? 'audio' : 'text'

    if (isImporting) return

    setSourceKind(nextKind)
    setUploadItems([])

    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }

    if (nextKind === 'audio') {
      setChannel('PHONE')
    }
  }

  function handleChannelChange(value: string | null) {
    setChannel(value ?? 'OTHER')
  }

  function handleFilesChange(event: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? [])

    if (files.length === 0) {
      setUploadItems([])
      return
    }

    const allowedFiles = files.filter(file => isAllowedFile(file, sourceKind))
    const rejectedCount = files.length - allowedFiles.length

    if (rejectedCount > 0) {
      toast.error('Некоторые файлы не подходят', {
        description: `Отклонено файлов: ${rejectedCount}. Разрешено: ${acceptedExtensionsLabel}`
      })
    }

    if (allowedFiles.length === 0) {
      setUploadItems([])

      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }

      return
    }

    const nextItems: UploadItem[] = allowedFiles.map(file => ({
      id: createUploadItemId(file),
      file,
      status: 'queued',
      progress: 0
    }))

    setUploadItems(nextItems)
  }

  function handleClearFiles() {
    if (isImporting) return

    setUploadItems([])

    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  function updateUploadItem(
    id: string,
    updater: (item: UploadItem) => UploadItem
  ) {
    setUploadItems(prev =>
      prev.map(item => {
        if (item.id !== id) return item

        return updater(item)
      })
    )
  }

  function createImportTitle(file: File) {
    const cleanTitle = title.trim()

    if (!cleanTitle) {
      return file.name
    }

    if (uploadItems.length === 1) {
      return cleanTitle
    }

    return `${cleanTitle}: ${file.name}`
  }

  async function handleSubmit() {
    if (uploadItems.length === 0) {
      toast.error(
        sourceKind === 'audio'
          ? 'Выбери аудиофайлы'
          : 'Выбери TXT, JSONL, Excel или CSV файлы'
      )
      return
    }

    const itemsToImport = uploadItems.filter(item => item.status !== 'success')

    if (itemsToImport.length === 0) {
      toast.success('Все выбранные файлы уже импортированы')
      return
    }

    setIsImporting(true)

    let successCount = 0
    let errorCount = 0

    /**
     * Сколько файлов можно загружать одновременно.
     *
     * Для аудио лучше не ставить большое число, чтобы не перегрузить сервер.
     * 2 — безопасный старт.
     *
     * Для текстов/Excel можно чуть больше.
     */
    const uploadConcurrency = sourceKind === 'audio' ? 2 : 4

    let nextIndex = 0

    async function uploadNextFile() {
      const item = itemsToImport[nextIndex]
      nextIndex += 1

      if (!item) {
        return
      }

      updateUploadItem(item.id, current => ({
        ...current,
        status: 'uploading',
        progress: 0,
        error: undefined
      }))

      try {
        const data = await importKnowledgeFile({
          file: item.file,
          title: createImportTitle(item.file),
          channel,
          sourceKind,
          onProgress: progress => {
            updateUploadItem(item.id, current => ({
              ...current,
              progress
            }))
          }
        })

        successCount += 1

        updateUploadItem(item.id, current => ({
          ...current,
          status: 'success',
          progress: 100,
          stats: data.stats,
          error: undefined
        }))

        toast.success(`Импортирован: ${item.file.name}`, {
          description: data.stats
            ? `Разговоров: ${data.stats.conversationsCount}, chunks: ${data.stats.chunksCount}`
            : 'Файл успешно загружен на сервер'
        })
      } catch (error) {
        errorCount += 1

        const message =
          error instanceof Error
            ? error.message
            : 'Не удалось импортировать файл'

        updateUploadItem(item.id, current => ({
          ...current,
          status: 'error',
          progress: 0,
          error: message
        }))

        toast.error(`Ошибка импорта: ${item.file.name}`, {
          description: message
        })
      }

      await uploadNextFile()
    }

    const workers = Array.from(
      {
        length: Math.min(uploadConcurrency, itemsToImport.length)
      },
      () => uploadNextFile()
    )

    await Promise.all(workers)

    setIsImporting(false)

    if (successCount > 0) {
      queryClient.invalidateQueries({
        queryKey: ['knowledge-sources']
      })

      queryClient.invalidateQueries({
        queryKey: ['knowledge-embedding-stats']
      })
    }

    if (successCount > 0 && errorCount === 0) {
      toast.success('Импорт завершён', {
        description: `Успешно импортировано файлов: ${successCount}`
      })
    }

    if (errorCount > 0) {
      toast.error('Импорт завершён с ошибками', {
        description: `Успешно: ${successCount}, ошибок: ${errorCount}`
      })
    }
  }

  const sources = sourcesQuery.data?.sources ?? []

  const importedCount = uploadItems.filter(
    item => item.status === 'success'
  ).length

  const errorCount = uploadItems.filter(item => item.status === 'error').length

  const uploadingItem = uploadItems.find(item => item.status === 'uploading')

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">База знаний</h1>
        <p className="text-muted-foreground">
          Импорт старых разговоров менеджеров, документов, текстовых источников
          и аудиозвонков для базы знаний ассистента.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {sourceKind === 'audio' ? (
              <FileAudio2 className="h-5 w-5" />
            ) : (
              <Upload className="h-5 w-5" />
            )}
            Импорт разговоров
          </CardTitle>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-[240px_1fr_220px]">
            <div className="space-y-2">
              <Label>Тип импорта</Label>
              <Select
                value={sourceKind}
                onValueChange={handleSourceKindChange}
                disabled={isImporting}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="text">Текстовые файлы</SelectItem>
                  <SelectItem value="audio">Аудиофайлы</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {getSourceKindLabel(sourceKind)}
              </p>
            </div>

            <div className="space-y-2">
              <Label>Название источника</Label>
              <Input
                value={title}
                onChange={event => setTitle(event.target.value)}
                placeholder={
                  sourceKind === 'audio'
                    ? 'Например: Звонки менеджеров за 2024'
                    : 'Например: Старые звонки менеджеров за 2024'
                }
                disabled={isImporting}
              />
              <p className="text-xs text-muted-foreground">
                Если выбрано несколько файлов, название будет добавлено к
                каждому файлу как префикс.
              </p>
            </div>

            <div className="space-y-2">
              <Label>Канал</Label>
              <Select
                value={channel}
                onValueChange={handleChannelChange}
                disabled={isImporting}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="OTHER">OTHER</SelectItem>
                  <SelectItem value="PHONE">PHONE</SelectItem>
                  <SelectItem value="CHAT">CHAT</SelectItem>
                  <SelectItem value="WHATSAPP">WHATSAPP</SelectItem>
                  <SelectItem value="TELEGRAM">TELEGRAM</SelectItem>
                  <SelectItem value="EMAIL">EMAIL</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {sourceKind === 'audio' ? (
            <div className="rounded-lg border bg-muted/40 p-4">
              <p className="text-sm font-medium">Как будет обработано аудио</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Файл загрузится на сервер, сервер расшифрует аудио в текст,
                затем текст будет импортирован как разговор в базу знаний,
                разбит на chunks и подготовлен для embeddings. Qwen будет
                использовать эти данные как память через поиск по базе знаний.
              </p>
            </div>
          ) : null}

          <div className="space-y-2">
            <Label>Файлы</Label>
            <Input
              key={sourceKind}
              ref={fileInputRef}
              type="file"
              multiple
              accept={getFileInputAccept(sourceKind)}
              onChange={handleFilesChange}
              disabled={isImporting}
            />
            <p className="text-xs text-muted-foreground">
              {getFileInputHint(sourceKind)}
            </p>
            <p className="text-xs text-muted-foreground">
              Разрешено: {acceptedExtensionsLabel}
            </p>
          </div>

          {uploadItems.length > 0 ? (
            <div className="space-y-3 rounded-lg border p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium">
                    Выбрано файлов: {uploadItems.length}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Готово: {importedCount}, ошибок: {errorCount}
                  </p>
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleClearFiles}
                  disabled={isImporting}
                >
                  Очистить список
                </Button>
              </div>

              {uploadingItem ? (
                <p className="text-xs text-muted-foreground">
                  Сейчас импортируется: {uploadingItem.file.name}
                </p>
              ) : null}

              <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
                {uploadItems.map(item => (
                  <div key={item.id} className="rounded-md border p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">
                          {item.file.name}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {formatFileSize(item.file.size)}
                        </p>
                      </div>

                      <Badge variant={getUploadStatusVariant(item.status)}>
                        {getUploadStatusLabel(item.status)}
                      </Badge>
                    </div>

                    <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full bg-primary transition-all"
                        style={{
                          width: `${item.progress}%`
                        }}
                      />
                    </div>

                    {item.status === 'uploading' ? (
                      <p className="mt-1 text-xs text-muted-foreground">
                        {item.progress < 95
                          ? `Загрузка: ${item.progress}%`
                          : sourceKind === 'audio'
                            ? 'Файл загружен, backend расшифровывает аудио и импортирует текст...'
                            : 'Файл загружен, backend импортирует данные...'}
                      </p>
                    ) : null}

                    {item.stats ? (
                      <p className="mt-1 text-xs text-muted-foreground">
                        Разговоров: {item.stats.conversationsCount}, сообщений:{' '}
                        {item.stats.messagesCount}, chunks:{' '}
                        {item.stats.chunksCount}
                      </p>
                    ) : null}

                    {item.error ? (
                      <p className="mt-1 text-xs text-destructive">
                        {item.error}
                      </p>
                    ) : null}
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          <Button
            onClick={handleSubmit}
            disabled={isImporting || uploadItems.length === 0}
          >
            <Database className="mr-2 h-4 w-4" />
            {getImportButtonLabel(sourceKind, isImporting, uploadItems.length)}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Embeddings и поиск</CardTitle>
        </CardHeader>

        <CardContent className="space-y-5">
          <div className="grid gap-3 md:grid-cols-3">
            <div className="rounded-lg border p-4">
              <p className="text-sm text-muted-foreground">Всего chunks</p>
              <p className="text-2xl font-bold">
                {embeddingStatsQuery.data?.stats.total ?? 0}
              </p>
            </div>

            <div className="rounded-lg border p-4">
              <p className="text-sm text-muted-foreground">С embedding</p>
              <p className="text-2xl font-bold">
                {embeddingStatsQuery.data?.stats.embedded ?? 0}
              </p>
            </div>

            <div className="rounded-lg border p-4">
              <p className="text-sm text-muted-foreground">Без embedding</p>
              <p className="text-2xl font-bold">
                {embeddingStatsQuery.data?.stats.notEmbedded ?? 0}
              </p>
            </div>
          </div>

          {embeddingStatsQuery.isError ? (
            <p className="text-sm text-destructive">
              Ошибка загрузки статистики embeddings
            </p>
          ) : null}

          <div className="flex flex-wrap gap-2">
            <Button
              onClick={() => embeddingsMutation.mutate()}
              disabled={embeddingsMutation.isPending}
            >
              {embeddingsMutation.isPending
                ? 'Создаю embeddings...'
                : 'Создать embeddings для 10 chunks'}
            </Button>

            <Button
              variant="outline"
              onClick={() => embeddingStatsQuery.refetch()}
              disabled={embeddingStatsQuery.isFetching}
            >
              {embeddingStatsQuery.isFetching
                ? 'Обновляю...'
                : 'Обновить статистику'}
            </Button>
          </div>

          <div className="space-y-2">
            <Label>Тест поиска по базе знаний</Label>
            <div className="flex gap-2">
              <Input
                value={searchQuery}
                onChange={event => setSearchQuery(event.target.value)}
                placeholder="Например: клиент спрашивает цену профнастила С8"
              />
              <Button
                variant="outline"
                onClick={() => searchMutation.mutate(searchQuery)}
                disabled={searchMutation.isPending || !searchQuery.trim()}
              >
                Искать
              </Button>
            </div>
          </div>

          {searchResult ? (
            <div className="space-y-3">
              {searchResult.results.map(result => (
                <div key={result.id} className="rounded-lg border p-4">
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <Badge variant="secondary">{result.chunkType}</Badge>
                    <span className="text-xs text-muted-foreground">
                      score: {result.score.toFixed(4)}
                    </span>
                  </div>

                  <p className="whitespace-pre-wrap text-sm">{result.text}</p>

                  <p className="mt-2 text-xs text-muted-foreground">
                    conversationId: {result.conversationId}
                  </p>
                </div>
              ))}

              {searchResult.results.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Ничего не найдено
                </p>
              ) : null}
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Источники базы знаний</CardTitle>
          <Button
            variant="outline"
            onClick={() => sourcesQuery.refetch()}
            disabled={sourcesQuery.isFetching}
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            Обновить
          </Button>
        </CardHeader>

        <CardContent>
          {sourcesQuery.isLoading ? (
            <p className="text-sm text-muted-foreground">Загрузка...</p>
          ) : null}

          {sourcesQuery.isError ? (
            <p className="text-sm text-destructive">
              Ошибка загрузки базы знаний
            </p>
          ) : null}

          {!sourcesQuery.isLoading && !sourcesQuery.isError ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Источник</TableHead>
                  <TableHead>Тип</TableHead>
                  <TableHead>Файл</TableHead>
                  <TableHead>Разговоры</TableHead>
                  <TableHead>Chunks</TableHead>
                  <TableHead>Создан</TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                {sources.map(source => (
                  <TableRow key={source.id}>
                    <TableCell>
                      <p className="font-medium">{source.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {source.id}
                      </p>
                    </TableCell>

                    <TableCell>
                      <Badge variant="secondary">{source.type}</Badge>
                    </TableCell>

                    <TableCell>
                      {source.file ? (
                        <div className="max-w-sm">
                          <p className="truncate text-sm">
                            {source.file.originalName}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {formatFileSize(source.file.sizeBytes)}
                          </p>
                        </div>
                      ) : (
                        '—'
                      )}
                    </TableCell>

                    <TableCell>{source._count.conversations}</TableCell>
                    <TableCell>{source._count.chunks}</TableCell>

                    <TableCell>
                      {new Date(source.createdAt).toLocaleString('ru-RU')}
                    </TableCell>
                  </TableRow>
                ))}

                {sources.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={6}
                      className="py-8 text-center text-sm text-muted-foreground"
                    >
                      Источников пока нет
                    </TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
          ) : null}
        </CardContent>
      </Card>
    </div>
  )
}
