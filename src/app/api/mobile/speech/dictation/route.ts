import { NextResponse } from 'next/server'
import { AppApiError, handleApiError } from '@/lib/api/api-error'
import { requireCurrentAppUser } from '@/lib/auth/current-user'
import { createChatUserMessage } from '@/server/chats/chat-service'
import { chatMessageToDto } from '@/server/chats/chat-dto'
import { uploadUserFile } from '@/server/files/file-service'
import { transcribeAudioFileWithQwen } from '@/server/speech/qwen-asr-service'

export const runtime = 'nodejs'

function getAudioFile(formData: FormData) {
  const audio = formData.get('audio') ?? formData.get('file')

  if (!(audio instanceof File)) {
    throw new AppApiError(400, 'Аудиофайл не передан')
  }

  return audio
}

export async function POST(request: Request) {
  try {
    const currentUser = await requireCurrentAppUser(request)
    const formData = await request.formData()

    const audioFile = getAudioFile(formData)
    const chatId = String(formData.get('chatId') || '').trim() || null

    const uploadedAudioFile = await uploadUserFile({
      userId: currentUser.id,
      file: audioFile,
      source: 'voice_dictation'
    })

    const transcription = await transcribeAudioFileWithQwen(audioFile)

    const message = chatId
      ? await createChatUserMessage(currentUser.id, chatId, {
          text: transcription.text,
          responseMode: 'NORMAL',
          fileIds: [uploadedAudioFile.id]
        })
      : null

    return NextResponse.json(
      {
        text: transcription.text,
        model: transcription.model,
        usage: transcription.usage,
        audioFile: uploadedAudioFile,
        message: message ? chatMessageToDto(message) : null
      },
      {
        status: 201
      }
    )
  } catch (error) {
    return handleApiError(error)
  }
}
