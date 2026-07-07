import { env } from '@/lib/env'
import { getAiRuntimeSettings } from '@/server/settings/ai-settings-service'

export function getQwenRealtimeApiKey() {
  const key = env.QWEN_REALTIME_API_KEY || env.QWEN_API_KEY

  if (!key) {
    throw new Error('QWEN_REALTIME_API_KEY или QWEN_API_KEY не указан')
  }

  return key
}

export async function getQwenRealtimeUrl() {
  const settings = await getAiRuntimeSettings()

  if (!env.QWEN_REALTIME_WS_URL) {
    throw new Error('QWEN_REALTIME_WS_URL не указан')
  }

  const url = new URL(env.QWEN_REALTIME_WS_URL)

  url.searchParams.set('model', settings.realtimeModel)

  console.log(
    'Qwen realtime URL:',
    url.toString().replace(/token=[^&]+/g, 'token=***')
  )
  console.log('Qwen realtime model:', settings.realtimeModel)

  return url.toString()
}

export async function makeDefaultRealtimeSession() {
  const settings = await getAiRuntimeSettings()

  return {
    modalities: ['text', 'audio'],
    voice: settings.realtimeVoice,
    input_audio_format: 'pcm16',
    output_audio_format: 'pcm16',
    instructions: [
      'Ты голосовой AI-ассистент для менеджеров компании.',
      'Отвечай на русском языке.',
      'Помогай менеджеру быстро отвечать клиентам.',
      'Отвечай кратко, понятно и по делу.',
      'Если информации недостаточно, задай уточняющий вопрос.'
    ].join('\n'),
    turn_detection: {
      type: 'semantic_vad',
      threshold: 0.5,
      silence_duration_ms: 800
    }
  }
}
