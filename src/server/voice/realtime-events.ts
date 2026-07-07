export type VoiceClientEvent =
  | {
      type: 'session.update'
      session: Record<string, unknown>
    }
  | {
      type: 'input_audio_buffer.append'
      audio: string
    }
  | {
      type: 'input_audio_buffer.commit'
    }
  | {
      type: 'response.create'
      response?: Record<string, unknown>
    }
  | {
      type: 'conversation.item.create'
      item: Record<string, unknown>
    }
  | {
      type: 'response.cancel'
    }

export type GatewayEvent =
  | {
      type: 'gateway.connected'
      userId: string
    }
  | {
      type: 'gateway.error'
      error: string
    }
  | {
      type: 'gateway.qwen_error'
      error: string
    }
  | {
      type: 'gateway.qwen_closed'
      code: number
      reason: string
    }

export function isAllowedClientEvent(
  value: unknown
): value is VoiceClientEvent {
  if (!value || typeof value !== 'object') {
    return false
  }

  const event = value as {
    type?: unknown
  }

  if (typeof event.type !== 'string') {
    return false
  }

  return [
    'session.update',
    'input_audio_buffer.append',
    'input_audio_buffer.commit',
    'response.create',
    'conversation.item.create',
    'response.cancel'
  ].includes(event.type)
}

export function makeEventId() {
  return `event_${Date.now()}_${Math.random().toString(16).slice(2)}`
}
