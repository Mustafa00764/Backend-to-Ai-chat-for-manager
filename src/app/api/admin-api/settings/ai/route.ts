import { NextResponse } from 'next/server'
import { handleApiError } from '@/lib/api/api-error'
import { requireAdmin } from '@/lib/auth/current-user'
import {
  aiSettingsPatchSchema,
  getAiRuntimeSettings,
  updateAiRuntimeSettings
} from '@/server/settings/ai-settings-service'

export const runtime = 'nodejs'

export async function GET(request: Request) {
  try {
    await requireAdmin(request)

    const settings = await getAiRuntimeSettings()

    return NextResponse.json({
      settings
    })
  } catch (error) {
    return handleApiError(error)
  }
}

export async function PATCH(request: Request) {
  try {
    await requireAdmin(request)

    const body = (await request.json().catch(() => ({}))) as unknown
    const input = aiSettingsPatchSchema.parse(body)

    const settings = await updateAiRuntimeSettings(input)

    return NextResponse.json({
      settings
    })
  } catch (error) {
    return handleApiError(error)
  }
}
