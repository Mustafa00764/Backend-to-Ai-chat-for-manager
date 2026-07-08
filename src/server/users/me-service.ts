import { AppearanceMode, Prisma, ResponseMode } from '@/generated/prisma/client'
import { prisma } from '@/lib/db/prisma'
import type {
  UpdateMeInput,
  UpdateSettingsInput
} from '@/server/users/me-schemas'

function normalizeOptionalString(value?: string) {
  const trimmed = value?.trim()

  if (!trimmed) {
    return null
  }

  return trimmed
}

export async function getMe(userId: string) {
  return prisma.user.findUnique({
    where: {
      id: userId
    },
    include: {
      settings: true
    }
  })
}

export async function updateMe(userId: string, input: UpdateMeInput) {
  const name =
    input.name === undefined ? undefined : normalizeOptionalString(input.name)

  const username =
    input.username === undefined
      ? undefined
      : normalizeOptionalString(input.username)

  try {
    return await prisma.user.update({
      where: {
        id: userId
      },
      data: {
        name,
        username
      },
      include: {
        settings: true
      }
    })
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      throw new Error('Пользователь с таким username уже существует')
    }

    throw error
  }
}

export async function getUserSettings(userId: string) {
  return prisma.userSettings.upsert({
    where: {
      userId
    },
    create: {
      userId
    },
    update: {}
  })
}

export async function updateUserSettings(
  userId: string,
  input: UpdateSettingsInput
) {
  return prisma.userSettings.upsert({
    where: {
      userId
    },
    create: {
      userId,
      language: input.language,
      appearance: input.appearance as AppearanceMode | undefined,
      assistantVoice: input.assistantVoice,
      assistantModel: input.assistantModel,
      assistantVoiceModel: input.assistantVoiceModel,
      responseMode: input.responseMode as ResponseMode | undefined
    },
    update: {
      language: input.language,
      appearance: input.appearance as AppearanceMode | undefined,
      assistantVoice: input.assistantVoice,
      assistantModel: input.assistantModel,
      assistantVoiceModel: input.assistantVoiceModel,
      responseMode: input.responseMode as ResponseMode | undefined
    }
  })
}
