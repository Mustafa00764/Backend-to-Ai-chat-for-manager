import { NextResponse } from 'next/server'
import { handleApiError } from '@/lib/api/api-error'
import { requireAdmin } from '@/lib/auth/current-user'
import { createOpenApiSpec } from '@/server/openapi/openapi-spec'

export const runtime = 'nodejs'

export async function GET(request: Request) {
  try {
    await requireAdmin(request)

    return NextResponse.json(createOpenApiSpec())
  } catch (error) {
    return handleApiError(error)
  }
}