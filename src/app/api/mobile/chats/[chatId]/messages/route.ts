import { NextResponse } from 'next/server'

import { handleApiError } from '@/lib/api/api-error'
import { requireCurrentAppUser } from '@/lib/auth/current-user'
import { createChatMessageWithAi } from '@/server/chats/chat-ai-service'
import { chatMessageToDto } from '@/server/chats/chat-dto'
import { createMessageSchema } from '@/server/chats/chat-schemas'
import { listChatMessages } from '@/server/chats/chat-service'

export const runtime = 'nodejs'

type RouteContext = {
  params: Promise<{
    chatId: string
  }>
}

export async function GET(request: Request, context: RouteContext) {
  try {
    const currentUser = await requireCurrentAppUser(request)
    const { chatId } = await context.params

    const messages = await listChatMessages(currentUser.id, chatId)

    return NextResponse.json({
      messages: messages.map(chatMessageToDto)
    })
  } catch (error) {
    return handleApiError(error)
  }
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const currentUser = await requireCurrentAppUser(request)
    const { chatId } = await context.params
    const json = await request.json()
    const dto = createMessageSchema.parse(json)

    const result = await createChatMessageWithAi(currentUser.id, chatId, dto)

    return NextResponse.json(
      {
        userMessage: chatMessageToDto(result.userMessage),
        assistantMessage: chatMessageToDto(result.assistantMessage)
      },
      {
        status: 201
      }
    )
  } catch (error) {
    return handleApiError(error)
  }
}