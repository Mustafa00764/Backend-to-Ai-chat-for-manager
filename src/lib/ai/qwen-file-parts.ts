import { downloadS3FileToBuffer } from '@/lib/storage/s3-download'

type FileLike = {
  bucket: string
  s3Key: string
  mimeType: string
}

export type QwenContentPart =
  | {
      type: 'text'
      text: string
    }
  | {
      type: 'image_url'
      image_url: {
        url: string
      }
    }

export async function createQwenImagePartsFromFiles(files: FileLike[]) {
  const parts: QwenContentPart[] = []

  for (const file of files) {
    if (!file.mimeType.startsWith('image/')) {
      continue
    }

    const buffer = await downloadS3FileToBuffer({
      bucket: file.bucket,
      key: file.s3Key
    })

    const base64 = buffer.toString('base64')

    parts.push({
      type: 'image_url',
      image_url: {
        url: `data:${file.mimeType};base64,${base64}`
      }
    })
  }

  return parts
}
