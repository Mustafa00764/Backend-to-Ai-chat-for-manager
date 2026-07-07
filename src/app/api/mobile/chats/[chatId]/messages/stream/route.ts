import { AppApiError } from '@/lib/api/api-error'
import { requireCurrentAppUser } from '@/lib/auth/current-user'
import { createChatMessageWithAiStream } from '@/server/chats/chat-ai-service'
import { chatMessageToDto } from '@/server/chats/chat-dto'
import { createMessageSchema } from '@/server/chats/chat-schemas'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type RouteContext = {
  params: Promise<{
    chatId: string
  }>
}

function encodeSse(event: string, data: unknown) {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`
}

function getErrorMessage(error: unknown) {
  if (error instanceof AppApiError) return error.message
  if (error instanceof Error) return error.message

  return 'Ошибка streaming ответа ассистента'
}

export async function POST(request: Request, context: RouteContext) {
  const encoder = new TextEncoder()
  const { readable, writable } = new TransformStream<Uint8Array, Uint8Array>()
  const writer = writable.getWriter()

  async function send(event: string, data: unknown) {
    await writer.write(encoder.encode(encodeSse(event, data)))
  }

  void (async () => {
    try {
      await send('token', { token: '' })

      const currentUser = await requireCurrentAppUser(request)
      const { chatId } = await context.params
      const json = await request.json()
      const dto = createMessageSchema.parse(json)

      await createChatMessageWithAiStream(currentUser.id, chatId, dto, {
        onToken: token => {
          void send('token', { token })
        },
        onDone: data => {
          void send('done', {
            userMessage: chatMessageToDto(data.userMessage as never),
            assistantMessage: chatMessageToDto(data.assistantMessage as never)
          })
        }
      })
    } catch (error) {
      await send('error', {
        message: getErrorMessage(error)
      })
    } finally {
      await writer.close()
    }
  })()

  return new Response(readable, {
    status: 200,
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no'
    }
  })
}
