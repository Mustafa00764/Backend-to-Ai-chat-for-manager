'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Save, Settings2 } from 'lucide-react'
import { useState } from 'react'
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

type AiSettings = {
  chatModel: string
  aiMockMode: boolean

  ragEnabled: boolean
  ragMaxChunks: number
  ragMinScore: number

  embeddingMockMode: boolean
  embeddingModel: string
  embeddingDimensions: number

  asrModel: string

  realtimeModel: string
  realtimeVoice: string

  updatedAt: string | null
}

type AiSettingsResponse = {
  settings: AiSettings
}

async function fetchAiSettings() {
  const response = await fetch('/api/admin-api/settings/ai')

  if (!response.ok) {
    throw new Error('Не удалось загрузить AI settings')
  }

  return response.json() as Promise<AiSettingsResponse>
}

async function saveAiSettings(settings: AiSettings) {
  const response = await fetch('/api/admin-api/settings/ai', {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      chatModel: settings.chatModel,
      aiMockMode: settings.aiMockMode,

      ragEnabled: settings.ragEnabled,
      ragMaxChunks: settings.ragMaxChunks,
      ragMinScore: settings.ragMinScore,

      embeddingMockMode: settings.embeddingMockMode,
      embeddingModel: settings.embeddingModel,

      asrModel: settings.asrModel,

      realtimeModel: settings.realtimeModel,
      realtimeVoice: settings.realtimeVoice
    })
  })

  const json = await response.json()

  if (!response.ok) {
    throw new Error(json.error || 'Не удалось сохранить AI settings')
  }

  return json as AiSettingsResponse
}

function booleanToSelectValue(value: boolean) {
  return value ? 'true' : 'false'
}

function selectValueToBoolean(value: string | null) {
  return value === 'true'
}

export function AiSettingsPageClient() {
  const queryClient = useQueryClient()
  const [draft, setDraft] = useState<AiSettings | null>(null)

  const settingsQuery = useQuery({
    queryKey: ['admin-ai-settings'],
    queryFn: fetchAiSettings
  })

  const form = draft ?? settingsQuery.data?.settings ?? null

  const saveMutation = useMutation({
    mutationFn: saveAiSettings,
    onSuccess: data => {
      setDraft(data.settings)

      queryClient.invalidateQueries({
        queryKey: ['admin-ai-settings']
      })

      toast.success('AI settings сохранены')
    },
    onError: error => {
      toast.error(error.message)
    }
  })

  function updateForm(patch: Partial<AiSettings>) {
    setDraft(current => {
      const base = current ?? settingsQuery.data?.settings

      if (!base) {
        return current
      }

      return {
        ...base,
        ...patch
      }
    })
  }

  if (settingsQuery.isLoading || !form) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">AI Settings</h1>
          <p className="text-muted-foreground">Загрузка настроек...</p>
        </div>
      </div>
    )
  }

  if (settingsQuery.isError) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">AI Settings</h1>
          <p className="text-destructive">Ошибка загрузки настроек</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-3 md:flex-row md:items-start">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">AI Settings</h1>
          <p className="text-muted-foreground">
            Управление моделями, RAG и mock-режимами без изменения .env.
          </p>
        </div>

        <Button
          onClick={() => saveMutation.mutate(form)}
          disabled={saveMutation.isPending}
        >
          <Save className="mr-2 h-4 w-4" />
          {saveMutation.isPending ? 'Сохраняю...' : 'Сохранить'}
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings2 className="h-5 w-5" />
            Qwen Chat
          </CardTitle>
        </CardHeader>

        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label>Chat model</Label>
            <Input
              value={form.chatModel}
              onChange={event =>
                updateForm({
                  chatModel: event.target.value
                })
              }
              placeholder="qwen-plus"
            />
          </div>

          <div className="space-y-2">
            <Label>AI mock mode</Label>
            <Select
              value={booleanToSelectValue(form.aiMockMode)}
              onValueChange={value =>
                updateForm({
                  aiMockMode: selectValueToBoolean(value)
                })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="false">false</SelectItem>
                <SelectItem value="true">true</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>RAG</CardTitle>
        </CardHeader>

        <CardContent className="grid gap-4 md:grid-cols-3">
          <div className="space-y-2">
            <Label>RAG enabled</Label>
            <Select
              value={booleanToSelectValue(form.ragEnabled)}
              onValueChange={value =>
                updateForm({
                  ragEnabled: selectValueToBoolean(value)
                })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="true">true</SelectItem>
                <SelectItem value="false">false</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>RAG max chunks</Label>
            <Input
              type="number"
              min={1}
              max={20}
              value={form.ragMaxChunks}
              onChange={event =>
                updateForm({
                  ragMaxChunks: Number(event.target.value)
                })
              }
            />
          </div>

          <div className="space-y-2">
            <Label>RAG min score</Label>
            <Input
              type="number"
              min={0}
              max={1}
              step={0.01}
              value={form.ragMinScore}
              onChange={event =>
                updateForm({
                  ragMinScore: Number(event.target.value)
                })
              }
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Embeddings</CardTitle>
        </CardHeader>

        <CardContent className="grid gap-4 md:grid-cols-3">
          <div className="space-y-2">
            <Label>Embedding mock mode</Label>
            <Select
              value={booleanToSelectValue(form.embeddingMockMode)}
              onValueChange={value =>
                updateForm({
                  embeddingMockMode: selectValueToBoolean(value)
                })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="true">true</SelectItem>
                <SelectItem value="false">false</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Embedding model</Label>
            <Input
              value={form.embeddingModel}
              onChange={event =>
                updateForm({
                  embeddingModel: event.target.value
                })
              }
            />
          </div>

          <div className="space-y-2">
            <Label>Embedding dimensions</Label>
            <div className="flex h-10 items-center">
              <Badge variant="secondary">
                vector({form.embeddingDimensions})
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              Размерность нельзя менять из UI, потому что она связана с pgvector
              колонкой.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Speech / Voice</CardTitle>
        </CardHeader>

        <CardContent className="grid gap-4 md:grid-cols-3">
          <div className="space-y-2">
            <Label>ASR model</Label>
            <Input
              value={form.asrModel}
              onChange={event =>
                updateForm({
                  asrModel: event.target.value
                })
              }
            />
          </div>

          <div className="space-y-2">
            <Label>Realtime model</Label>
            <Input
              value={form.realtimeModel}
              onChange={event =>
                updateForm({
                  realtimeModel: event.target.value
                })
              }
            />
          </div>

          <div className="space-y-2">
            <Label>Realtime voice</Label>
            <Input
              value={form.realtimeVoice}
              onChange={event =>
                updateForm({
                  realtimeVoice: event.target.value
                })
              }
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Состояние</CardTitle>
        </CardHeader>

        <CardContent>
          <p className="text-sm text-muted-foreground">
            Последнее изменение:{' '}
            {form.updatedAt
              ? new Date(form.updatedAt).toLocaleString('ru-RU')
              : 'ещё не сохранялось'}
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
