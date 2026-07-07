import 'dotenv/config'
import { createServer } from 'node:http'
import { verifyToken } from '@clerk/backend'
import { PrismaPg } from '@prisma/adapter-pg'
import WebSocket, { WebSocketServer } from 'ws'
import { PrismaClient, UserStatus } from '../src/generated/prisma/client'
import {
  getQwenRealtimeApiKey,
  getQwenRealtimeUrl,
  makeDefaultRealtimeSession
} from '../src/server/voice/realtime-config'
import {
  isAllowedClientEvent,
  makeEventId
} from '../src/server/voice/realtime-events'

const port = Number(process.env.VOICE_GATEWAY_PORT || 3001)

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL
})

const prisma = new PrismaClient({
  adapter
})

function sendJson(ws: WebSocket, payload: unknown) {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(payload))
  }
}

function parseJson(data: WebSocket.RawData) {
  try {
    return JSON.parse(data.toString()) as unknown
  } catch {
    return null
  }
}

function getTokenFromRequestUrl(requestUrl?: string) {
  if (!requestUrl) {
    return null
  }

  const url = new URL(requestUrl, `http://localhost:${port}`)

  return url.searchParams.get('token')
}

async function getUserFromClerkToken(token: string) {
  const payload = await verifyToken(token, {
    secretKey: process.env.CLERK_SECRET_KEY
  })

  const clerkId = String(payload.sub || '')

  if (!clerkId) {
    return null
  }

  return prisma.user.findUnique({
    where: {
      clerkId
    }
  })
}

function withEventId(event: Record<string, unknown>) {
  return {
    event_id: makeEventId(),
    ...event
  }
}

const server = createServer()

const wss = new WebSocketServer({
  server,
  path: '/voice/realtime'
})

wss.on('connection', async (clientWs, request) => {
  let qwenWs: WebSocket | null = null

  try {
    const token = getTokenFromRequestUrl(request.url)

    if (!token) {
      sendJson(clientWs, {
        type: 'gateway.error',
        error: 'Missing Clerk token'
      })

      clientWs.close(1008, 'Missing token')
      return
    }

    const user = await getUserFromClerkToken(token)

    if (!user) {
      sendJson(clientWs, {
        type: 'gateway.error',
        error: 'User not found'
      })

      clientWs.close(1008, 'User not found')
      return
    }

    if (user.status !== UserStatus.ACTIVE) {
      sendJson(clientWs, {
        type: 'gateway.error',
        error: 'User disabled'
      })

      clientWs.close(1008, 'User disabled')
      return
    }

    const qwenUrl = await getQwenRealtimeUrl()
    const qwenApiKey = getQwenRealtimeApiKey()
    const defaultSession = await makeDefaultRealtimeSession()

    qwenWs = new WebSocket(qwenUrl, {
      headers: {
        Authorization: `Bearer ${qwenApiKey}`
      }
    })

    qwenWs.on('open', () => {
      sendJson(clientWs, {
        type: 'gateway.connected',
        userId: user.id
      })

      sendJson(
        qwenWs as WebSocket,
        withEventId({
          type: 'session.update',
          session: defaultSession
        })
      )
    })

    qwenWs.on('message', message => {
      const event = parseJson(message)

      if (!event) {
        return
      }

      sendJson(clientWs, event)
    })

    qwenWs.on('error', error => {
      sendJson(clientWs, {
        type: 'gateway.qwen_error',
        error: error.message
      })
    })

    qwenWs.on('close', (code, reason) => {
      sendJson(clientWs, {
        type: 'gateway.qwen_closed',
        code,
        reason: reason.toString()
      })

      clientWs.close()
    })

    clientWs.on('message', message => {
      const event = parseJson(message)

      if (!isAllowedClientEvent(event)) {
        sendJson(clientWs, {
          type: 'gateway.error',
          error: 'Unsupported or invalid client event'
        })

        return
      }

      if (!qwenWs || qwenWs.readyState !== WebSocket.OPEN) {
        sendJson(clientWs, {
          type: 'gateway.error',
          error: 'Qwen realtime socket is not ready'
        })

        return
      }

      sendJson(qwenWs, withEventId(event as unknown as Record<string, unknown>))
    })

    clientWs.on('close', () => {
      qwenWs?.close()
    })

    clientWs.on('error', () => {
      qwenWs?.close()
    })
  } catch (error) {
    sendJson(clientWs, {
      type: 'gateway.error',
      error: error instanceof Error ? error.message : 'Unknown gateway error'
    })

    qwenWs?.close()
    clientWs.close(1011, 'Gateway error')
  }
})

server.listen(port, () => {
  console.log(
    `Voice realtime gateway running on ws://localhost:${port}/voice/realtime`
  )
})
