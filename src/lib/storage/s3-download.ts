import { GetObjectCommand } from '@aws-sdk/client-s3'
import { s3Client } from './s3-client'

async function streamToBuffer(stream: NodeJS.ReadableStream) {
  const chunks: Buffer[] = []

  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
  }

  return Buffer.concat(chunks)
}

export async function downloadS3FileToBuffer(params: {
  bucket: string
  key: string
}) {
  const result = await s3Client.send(
    new GetObjectCommand({
      Bucket: params.bucket,
      Key: params.key
    })
  )

  if (!result.Body) {
    throw new Error('Файл в S3/MinIO не найден или пустой')
  }

  return streamToBuffer(result.Body as NodeJS.ReadableStream)
}