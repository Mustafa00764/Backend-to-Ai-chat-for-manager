'use client'

import { useQuery } from '@tanstack/react-query'
import { Code2, Download, RefreshCw } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

type OpenApiPathMethod = {
  tags?: string[]
  summary?: string
}

type OpenApiSpec = {
  openapi: string
  info: {
    title: string
    version: string
    description?: string
  }
  paths: Record<string, Record<string, OpenApiPathMethod>>
}

async function fetchOpenApiSpec() {
  let response = await fetch('/api/openapi.json')

  if (response.status === 404) {
    response = await fetch('/api/openapi')
  }

  if (!response.ok) {
    throw new Error('Не удалось загрузить OpenAPI spec')
  }

  return response.json() as Promise<OpenApiSpec>
}

function getMethodBadgeVariant(method: string) {
  if (method === 'get') {
    return 'secondary'
  }

  if (method === 'post') {
    return 'default'
  }

  if (method === 'patch') {
    return 'outline'
  }

  return 'destructive'
}

export function ApiDocsPageClient() {
  const specQuery = useQuery({
    queryKey: ['openapi-spec'],
    queryFn: fetchOpenApiSpec
  })

  const spec = specQuery.data

  const endpoints = spec
    ? Object.entries(spec.paths).flatMap(([path, methods]) =>
        Object.entries(methods).map(([method, data]) => ({
          path,
          method,
          summary: data.summary ?? '',
          tag: data.tags?.[0] ?? 'Other'
        }))
      )
    : []

  const groupedEndpoints = endpoints.reduce<Record<string, typeof endpoints>>(
    (acc, endpoint) => {
      acc[endpoint.tag] = acc[endpoint.tag] ?? []
      acc[endpoint.tag].push(endpoint)
      return acc
    },
    {}
  )

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-3 md:flex-row md:items-start">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">API Docs</h1>
          <p className="text-muted-foreground">
            OpenAPI документация для Expo, backend и админских API.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            onClick={() => specQuery.refetch()}
            disabled={specQuery.isFetching}
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            Обновить
          </Button>

          <Button asChild>
            <a href="/api/openapi.json" target="_blank">
              <Download className="mr-2 h-4 w-4" />
              OpenAPI JSON
            </a>
          </Button>
        </div>
      </div>

      {specQuery.isLoading ? (
        <Card>
          <CardContent className="py-8 text-sm text-muted-foreground">
            Загрузка документации...
          </CardContent>
        </Card>
      ) : null}

      {specQuery.isError ? (
        <Card>
          <CardContent className="py-8 text-sm text-destructive">
            Ошибка загрузки OpenAPI spec
          </CardContent>
        </Card>
      ) : null}

      {spec ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Code2 className="h-5 w-5" />
              {spec.info.title}
            </CardTitle>
          </CardHeader>

          <CardContent className="space-y-2">
            <p className="text-sm text-muted-foreground">
              Version: {spec.info.version}
            </p>
            <p className="text-sm text-muted-foreground">
              OpenAPI: {spec.openapi}
            </p>
            {spec.info.description ? (
              <p className="text-sm">{spec.info.description}</p>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      {Object.entries(groupedEndpoints).map(([tag, items]) => (
        <Card key={tag}>
          <CardHeader>
            <CardTitle>{tag}</CardTitle>
          </CardHeader>

          <CardContent className="space-y-3">
            {items.map(endpoint => (
              <div
                key={`${endpoint.method}-${endpoint.path}`}
                className="rounded-lg border p-4"
              >
                <div className="flex flex-wrap items-center gap-3">
                  <Badge variant={getMethodBadgeVariant(endpoint.method)}>
                    {endpoint.method.toUpperCase()}
                  </Badge>

                  <code className="rounded bg-muted px-2 py-1 text-sm">
                    {endpoint.path}
                  </code>
                </div>

                {endpoint.summary ? (
                  <p className="mt-2 text-sm text-muted-foreground">
                    {endpoint.summary}
                  </p>
                ) : null}
              </div>
            ))}
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
