import { NextResponse } from 'next/server'

import { handleApiError } from '@/lib/api/api-error'
import { requireCurrentAppUser } from '@/lib/auth/current-user'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const QWEN_REALTIME_MODEL = 'qwen3.5-omni-plus-realtime'

function getQwenWebrtcUrl() {
  const endpoint = process.env.QWEN_REALTIME_WEBRTC_ENDPOINT

  if (!endpoint) {
    throw new Error('QWEN_REALTIME_WEBRTC_ENDPOINT is missing')
  }

  const url = new URL(endpoint)
  url.searchParams.set('model', QWEN_REALTIME_MODEL)

  return url.toString()
}

export async function POST(request: Request) {
  try {
    await requireCurrentAppUser(request)

    const apiKey = process.env.DASHSCOPE_API_KEY

    if (!apiKey) {
      throw new Error('DASHSCOPE_API_KEY is missing')
    }

    const offerSdp = await request.text()

    if (!offerSdp.trim()) {
      return NextResponse.json(
        {
          message: 'Offer SDP is empty'
        },
        {
          status: 400
        }
      )
    }

    const response = await fetch(getQwenWebrtcUrl(), {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/sdp'
      },
      body: offerSdp
    })

    const answerSdp = await response.text()

    if (!response.ok) {
      return NextResponse.json(
        {
          message: 'Qwen WebRTC SDP exchange failed',
          status: response.status,
          detail: answerSdp
        },
        {
          status: response.status
        }
      )
    }

    return new Response(answerSdp, {
      status: 200,
      headers: {
        'Content-Type': 'application/sdp'
      }
    })
  } catch (error) {
    return handleApiError(error)
  }
}
