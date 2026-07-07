import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { z } from 'zod'
import { env } from '@/lib/env'

const settingsDir = path.join(process.cwd(), 'storage')
const settingsFile = path.join(settingsDir, 'ai-settings.json')

export const aiSettingsPatchSchema = z
  .object({
    chatModel: z.string().min(1).optional(),
    aiMockMode: z.boolean().optional(),

    ragEnabled: z.boolean().optional(),
    ragMaxChunks: z.coerce.number().int().min(1).max(20).optional(),
    ragMinScore: z.coerce.number().min(0).max(1).optional(),

    embeddingMockMode: z.boolean().optional(),
    embeddingModel: z.string().min(1).optional(),

    asrModel: z.string().min(1).optional(),

    realtimeModel: z.string().min(1).optional(),
    realtimeVoice: z.string().min(1).optional()
  })
  .strict()

const aiSettingsFileSchema = aiSettingsPatchSchema.extend({
  updatedAt: z.string().optional()
})

export type AiSettingsPatchInput = z.infer<typeof aiSettingsPatchSchema>

export type AiRuntimeSettings = {
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

function getDefaultAiSettings(): AiRuntimeSettings {
  return {
    chatModel: env.QWEN_CHAT_MODEL,
    aiMockMode: env.AI_MOCK_MODE,

    ragEnabled: env.RAG_ENABLED,
    ragMaxChunks: env.RAG_MAX_CHUNKS,
    ragMinScore: env.RAG_MIN_SCORE,

    embeddingMockMode: env.EMBEDDING_MOCK_MODE,
    embeddingModel: env.QWEN_EMBEDDING_MODEL,
    embeddingDimensions: env.QWEN_EMBEDDING_DIMENSIONS,

    asrModel: env.QWEN_ASR_MODEL,

    realtimeModel: env.QWEN_REALTIME_MODEL,
    realtimeVoice: env.QWEN_REALTIME_VOICE,

    updatedAt: null
  }
}

async function readSettingsFile() {
  try {
    const content = await readFile(settingsFile, 'utf8')
    const parsed = JSON.parse(content) as unknown

    return aiSettingsFileSchema.parse(parsed)
  } catch {
    return null
  }
}

async function writeSettingsFile(settings: AiRuntimeSettings) {
  await mkdir(settingsDir, {
    recursive: true
  })

  await writeFile(settingsFile, JSON.stringify(settings, null, 2), 'utf8')
}

export async function getAiRuntimeSettings(): Promise<AiRuntimeSettings> {
  const defaults = getDefaultAiSettings()
  const saved = await readSettingsFile()

  if (!saved) {
    return defaults
  }

  return {
    ...defaults,
    ...saved,
    embeddingDimensions: defaults.embeddingDimensions,
    updatedAt: saved.updatedAt ?? null,
  }
}

export async function updateAiRuntimeSettings(input: AiSettingsPatchInput) {
  const current = await getAiRuntimeSettings()

  const next: AiRuntimeSettings = {
    ...current,
    ...input,
    embeddingDimensions: current.embeddingDimensions,
    updatedAt: new Date().toISOString()
  }

  await writeSettingsFile(next)

  return next
}
