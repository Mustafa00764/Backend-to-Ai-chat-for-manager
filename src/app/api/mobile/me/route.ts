import { NextResponse } from 'next/server'
import { handleApiError } from '@/lib/api/api-error'
import { requireCurrentAppUser } from '@/lib/auth/current-user'
import { getMe, updateMe } from '@/server/users/me-service'
import { updateMeSchema } from '@/server/users/me-schemas'

export const runtime = 'nodejs'

export async function GET(request: Request) {
  try {
    const currentUser = await requireCurrentAppUser(request)
    const user = await getMe(currentUser.id)

    return NextResponse.json({
      user
    })
  } catch (error) {
    return handleApiError(error)
  }
}

export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PATCH, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    }
  })
}

export async function PATCH(request: Request) {
  try {
    const currentUser = await requireCurrentAppUser(request)
    const json = await request.json()
    const dto = updateMeSchema.parse(json)

    const user = await updateMe(currentUser.id, dto)

    return NextResponse.json({
      user
    })
  } catch (error) {
    return handleApiError(error)
  }
}
