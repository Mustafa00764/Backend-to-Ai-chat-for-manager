'use client'

import { useQuery } from '@tanstack/react-query'
import { FileText, RefreshCw } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table'

type ChatMessageRole = 'USER' | 'ASSISTANT' | 'SYSTEM'

type AdminUser = {
  id: string
  email: string
  name: string | null
  username: string | null
  role: string
  status: string
}

type ChatListMessage = {
  id: string
  role: ChatMessageRole
  content: string
  createdAt: string
  updatedAt: string
}

type ChatAttachmentFile = {
  id: string
  bucket: string
  s3Key: string
  originalName: string
  mimeType: string
  extension: string | null
  sizeBytes: number
  fileType: string
  uploadStatus: string
  processingStatus: string
  createdAt: string
  updatedAt: string
}

type ChatAttachment = {
  id: string
  messageId: string
  fileId: string
  createdAt: string
  file: ChatAttachmentFile
}

type ChatMessage = {
  id: string
  chatId: string
  userId: string | null
  role: ChatMessageRole
  content: string
  responseMode: 'NORMAL' | 'ADVANCED' | null
  model: string | null
  metadata: unknown
  createdAt: string
  updatedAt: string
  attachments: ChatAttachment[]
}

type BaseAdminChat = {
  id: string
  userId: string
  title: string
  isPinned: boolean
  isArchived: boolean
  isDeleted: boolean
  lastMessageAt: string | null
  createdAt: string
  updatedAt: string
  user: AdminUser | null
}

type AdminChatListItem = BaseAdminChat & {
  messages: ChatListMessage[]
}

type AdminChatDetails = BaseAdminChat & {
  messages: ChatMessage[]
}

type ChatsResponse = {
  chats: AdminChatListItem[]
}

type ChatDetailsResponse = {
  chat: AdminChatDetails
}

function truncateText(text: string, maxLength = 90) {
  const normalized = text.trim().replace(/\s+/g, ' ')

  if (normalized.length <= maxLength) {
    return normalized
  }

  return `${normalized.slice(0, maxLength)}...`
}

function formatDate(value: string | null) {
  if (!value) {
    return '—'
  }

  return new Date(value).toLocaleString('ru-RU')
}

async function fetchChats() {
  const response = await fetch('/api/admin-api/chats')

  if (!response.ok) {
    throw new Error('Не удалось загрузить чаты')
  }

  return response.json() as Promise<ChatsResponse>
}

async function fetchChatDetails(chatId: string) {
  const response = await fetch(`/api/admin-api/chats/${chatId}`)

  if (!response.ok) {
    throw new Error('Не удалось загрузить чат')
  }

  return response.json() as Promise<ChatDetailsResponse>
}

export function ChatsPageClient() {
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null)
  const [search, setSearch] = useState('')

  const chatsQuery = useQuery({
    queryKey: ['admin-chats'],
    queryFn: fetchChats
  })

  const chatDetailsQuery = useQuery({
    queryKey: ['admin-chat', selectedChatId],
    queryFn: () => fetchChatDetails(selectedChatId as string),
    enabled: Boolean(selectedChatId)
  })

  const chats = chatsQuery.data?.chats

  const filteredChats = useMemo(() => {
    if (!chats) return []

    const query = search.trim().toLowerCase()

    if (!query) {
      return chats
    }

    return chats.filter(chat => {
      const userText = [chat.user?.email, chat.user?.name, chat.user?.username]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()

      const lastMessage = chat.messages[0]?.content?.toLowerCase() ?? ''

      return (
        chat.title.toLowerCase().includes(query) ||
        userText.includes(query) ||
        lastMessage.includes(query)
      )
    })
  }, [chats, search]) // ✅ Теперь chats — это undefined или стабильный массив

  const selectedChat = chatDetailsQuery.data?.chat ?? null

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">AI-чаты</h1>
          <p className="text-muted-foreground">
            Просмотр чатов пользователей, сообщений, ответов Qwen и вложений.
          </p>
        </div>

        <Button
          variant="outline"
          onClick={() => chatsQuery.refetch()}
          disabled={chatsQuery.isFetching}
        >
          <RefreshCw className="mr-2 h-4 w-4" />
          Обновить
        </Button>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_520px]">
        <Card>
          <CardHeader className="space-y-4">
            <CardTitle>Список чатов</CardTitle>
            <Input
              value={search}
              onChange={event => setSearch(event.target.value)}
              placeholder="Поиск по названию, email, имени или сообщению"
            />
          </CardHeader>

          <CardContent>
            {chatsQuery.isLoading ? (
              <p className="text-sm text-muted-foreground">Загрузка...</p>
            ) : null}

            {chatsQuery.isError ? (
              <p className="text-sm text-destructive">Ошибка загрузки чатов</p>
            ) : null}

            {!chatsQuery.isLoading && !chatsQuery.isError ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Чат</TableHead>
                    <TableHead>Пользователь</TableHead>
                    <TableHead>Последнее сообщение</TableHead>
                    <TableHead>Обновлён</TableHead>
                  </TableRow>
                </TableHeader>

                <TableBody>
                  {filteredChats.map(chat => {
                    const lastMessage = chat.messages[0]

                    return (
                      <TableRow
                        key={chat.id}
                        className="cursor-pointer"
                        onClick={() => setSelectedChatId(chat.id)}
                      >
                        <TableCell>
                          <div className="space-y-1">
                            <p className="font-medium">{chat.title}</p>
                            <div className="flex gap-2">
                              {chat.isPinned ? <Badge>PINNED</Badge> : null}
                              {chat.isArchived ? (
                                <Badge variant="secondary">ARCHIVED</Badge>
                              ) : null}
                              {chat.isDeleted ? (
                                <Badge variant="destructive">DELETED</Badge>
                              ) : null}
                            </div>
                          </div>
                        </TableCell>

                        <TableCell>
                          <div>
                            <p className="font-medium">
                              {chat.user?.name || 'Без имени'}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {chat.user?.email || '—'}
                            </p>
                          </div>
                        </TableCell>

                        <TableCell>
                          {lastMessage ? (
                            <div>
                              <Badge variant="outline">
                                {lastMessage.role}
                              </Badge>
                              <p className="mt-1 text-sm text-muted-foreground">
                                {truncateText(lastMessage.content)}
                              </p>
                            </div>
                          ) : (
                            <span className="text-sm text-muted-foreground">
                              Нет сообщений
                            </span>
                          )}
                        </TableCell>

                        <TableCell>{formatDate(chat.lastMessageAt)}</TableCell>
                      </TableRow>
                    )
                  })}

                  {filteredChats.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={4}
                        className="py-8 text-center text-sm text-muted-foreground"
                      >
                        Чатов пока нет
                      </TableCell>
                    </TableRow>
                  ) : null}
                </TableBody>
              </Table>
            ) : null}
          </CardContent>
        </Card>

        <Card className="xl:sticky xl:top-6 xl:h-[calc(100vh-7rem)]">
          <CardHeader>
            <CardTitle>Сообщения</CardTitle>
          </CardHeader>

          <CardContent className="h-[calc(100%-5rem)] overflow-y-auto">
            {!selectedChatId ? (
              <p className="text-sm text-muted-foreground">
                Выбери чат слева, чтобы посмотреть сообщения.
              </p>
            ) : null}

            {selectedChatId && chatDetailsQuery.isLoading ? (
              <p className="text-sm text-muted-foreground">
                Загрузка сообщений...
              </p>
            ) : null}

            {selectedChatId && chatDetailsQuery.isError ? (
              <p className="text-sm text-destructive">
                Ошибка загрузки сообщений
              </p>
            ) : null}

            {selectedChat ? (
              <div className="space-y-4">
                <div className="rounded-lg border bg-muted/40 p-3">
                  <p className="font-medium">{selectedChat.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {selectedChat.user?.email || 'Пользователь не найден'}
                  </p>
                </div>

                {selectedChat.messages.map(message => (
                  <div
                    key={message.id}
                    className="rounded-lg border bg-background p-4"
                  >
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <Badge
                        variant={
                          message.role === 'ASSISTANT' ? 'default' : 'secondary'
                        }
                      >
                        {message.role}
                      </Badge>

                      <span className="text-xs text-muted-foreground">
                        {formatDate(message.createdAt)}
                      </span>
                    </div>

                    <p className="whitespace-pre-wrap text-sm leading-6">
                      {message.content}
                    </p>

                    {message.model ? (
                      <p className="mt-2 text-xs text-muted-foreground">
                        model: {message.model}
                      </p>
                    ) : null}

                    {message.attachments.length > 0 ? (
                      <div className="mt-3 space-y-2">
                        {message.attachments.map(attachment => (
                          <div
                            key={attachment.id}
                            className="flex items-center gap-2 rounded-md bg-muted p-2 text-xs"
                          >
                            <FileText className="h-4 w-4" />
                            <div className="min-w-0">
                              <p className="truncate font-medium">
                                {attachment.file.originalName}
                              </p>
                              <p className="truncate text-muted-foreground">
                                {attachment.file.s3Key}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : null}
                  </div>
                ))}

                {selectedChat.messages.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    В этом чате пока нет сообщений.
                  </p>
                ) : null}
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
