'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Database, RefreshCw, Upload } from 'lucide-react'
import { useRef, useState } from 'react'
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

async function fetchSources() {
  const response = await fetch('/api/admin-api/knowledge/sources')

  if (!response.ok) {
    throw new Error('Не удалось загрузить базу знаний')
  }

  return response.json() as Promise<SourcesResponse>
}

async function importKnowledge(formData: FormData) {
  const response = await fetch('/api/admin-api/knowledge/import', {
    method: 'POST',
    body: formData
  })

  const json = await response.json()

  if (!response.ok) {
    throw new Error(json.error || 'Не удалось импортировать файл')
  }

  return json as ImportResponse
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

  return `${(kb / 1024).toFixed(1)} MB`
}

export function KnowledgePageClient() {
  const queryClient = useQueryClient()
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const [title, setTitle] = useState('')
  const [channel, setChannel] = useState('OTHER')

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

  const importMutation = useMutation({
    mutationFn: importKnowledge,
    onSuccess: data => {
      queryClient.invalidateQueries({
        queryKey: ['knowledge-sources']
      })

      queryClient.invalidateQueries({
        queryKey: ['knowledge-embedding-stats']
      })

      setTitle('')

      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }

      toast.success('База знаний импортирована', {
        description: `Разговоров: ${data.stats.conversationsCount}, chunks: ${data.stats.chunksCount}`
      })
    },
    onError: error => {
      toast.error(error.message)
    }
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

  function handleChannelChange(value: string | null) {
    setChannel(value ?? 'OTHER')
  }

  function handleSubmit() {
    const file = fileInputRef.current?.files?.[0]

    if (!file) {
      toast.error('Выбери TXT или JSONL файл')
      return
    }

    const formData = new FormData()

    formData.append('file', file)
    formData.append('title', title || file.name)
    formData.append('channel', channel)

    importMutation.mutate(formData)
  }

  const sources = sourcesQuery.data?.sources ?? []

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">База знаний</h1>
        <p className="text-muted-foreground">
          Импорт старых разговоров менеджеров, документов и текстовых
          источников.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Импорт разговоров
          </CardTitle>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-[1fr_220px]">
            <div className="space-y-2">
              <Label>Название источника</Label>
              <Input
                value={title}
                onChange={event => setTitle(event.target.value)}
                placeholder="Например: Старые звонки менеджеров за 2024"
              />
            </div>

            <div className="space-y-2">
              <Label>Канал</Label>
              <Select value={channel} onValueChange={handleChannelChange}>
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

          <div className="space-y-2">
            <Label>Файл</Label>
            <Input
              ref={fileInputRef}
              type="file"
              accept=".txt,.jsonl,text/plain,application/json"
            />
            <p className="text-xs text-muted-foreground">
              TXT: один разговор или несколько частей через строку с ---. JSONL:
              один JSON-объект разговора на строку.
            </p>
          </div>

          <Button onClick={handleSubmit} disabled={importMutation.isPending}>
            <Database className="mr-2 h-4 w-4" />
            {importMutation.isPending ? 'Импорт...' : 'Импортировать'}
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
