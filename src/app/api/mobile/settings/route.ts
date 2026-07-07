import { NextResponse } from 'next/server'
import { z } from 'zod'

import { AppearanceMode, ResponseMode } from '@/generated/prisma/client'
import { handleApiError } from '@/lib/api/api-error'
import { requireCurrentAppUser } from '@/lib/auth/current-user'
import { prisma } from '@/lib/db/prisma'

export const runtime = 'nodejs'

const updateSettingsSchema = z.object({
  language: z.string().min(2).max(10).optional(),

  appearance: z.nativeEnum(AppearanceMode).optional(),

  assistantVoice: z.string().min(1).max(100).optional(),
  assistantModel: z.string().min(1).max(100).optional(),
  assistantVoiceModel: z.string().min(1).max(100).optional(),

  responseMode: z.nativeEnum(ResponseMode).optional()
})

function settingsToDto(settings: {
  id: string
  userId: string
  language: string
  appearance: AppearanceMode
  assistantVoice: string
  assistantModel: string
  assistantVoiceModel: string
  responseMode: ResponseMode
  createdAt: Date
  updatedAt: Date
}) {
  return {
    id: settings.id,
    userId: settings.userId,
    language: settings.language,
    appearance: settings.appearance,
    assistantVoice: settings.assistantVoice,
    assistantModel: settings.assistantModel,
    assistantVoiceModel: settings.assistantVoiceModel,
    responseMode: settings.responseMode,
    createdAt: settings.createdAt.toISOString(),
    updatedAt: settings.updatedAt.toISOString()
  }
}

async function getOrCreateUserSettings(userId: string) {
  return prisma.userSettings.upsert({
    where: {
      userId
    },
    update: {},
    create: {
      userId,
      language: 'ru',
      appearance: AppearanceMode.SYSTEM,
      assistantVoice: 'Cherry',
      assistantModel: 'qwen-plus',
      assistantVoiceModel: 'extended',
      responseMode: ResponseMode.NORMAL
    }
  })
}

export async function GET(request: Request) {
  try {
    const currentUser = await requireCurrentAppUser(request)

    const settings = await getOrCreateUserSettings(currentUser.id)

    return NextResponse.json({
      settings: settingsToDto(settings)
    })
  } catch (error) {
    return handleApiError(error)
  }
}

export async function PATCH(request: Request) {
  try {
    const currentUser = await requireCurrentAppUser(request)
    const json = await request.json()
    const dto = updateSettingsSchema.parse(json)

    await getOrCreateUserSettings(currentUser.id)

    const settings = await prisma.userSettings.update({
      where: {
        userId: currentUser.id
      },
      data: {
        language: dto.language,
        appearance: dto.appearance,
        assistantVoice: dto.assistantVoice,
        assistantModel: dto.assistantModel,
        assistantVoiceModel: dto.assistantVoiceModel,
        responseMode: dto.responseMode
      }
    })

    return NextResponse.json({
      settings: settingsToDto(settings)
    })
  } catch (error) {
    return handleApiError(error)
  }
}
