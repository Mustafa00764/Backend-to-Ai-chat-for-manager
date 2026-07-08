import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client
} from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { env } from '@/lib/env'

const globalForS3 = globalThis as unknown as {
  s3Client?: S3Client
}

function cleanEnv(value: string | undefined | null) {
  return value?.trim() ?? ''
}

function toBoolean(value: boolean | string | undefined | null) {
  if (typeof value === 'boolean') return value
  return (
    String(value ?? '')
      .trim()
      .toLowerCase() === 'true'
  )
}

const s3Region = cleanEnv(env.S3_REGION) || 'ru-central1'
const s3Endpoint =
  cleanEnv(env.S3_ENDPOINT) || 'https://storage.yandexcloud.net'
const s3Bucket = cleanEnv(env.S3_BUCKET)
const s3AccessKeyId = cleanEnv(env.S3_ACCESS_KEY_ID)
const s3SecretAccessKey = cleanEnv(env.S3_SECRET_ACCESS_KEY)
const s3ForcePathStyle = toBoolean(env.S3_FORCE_PATH_STYLE)

if (!s3Bucket) {
  throw new Error('S3_BUCKET не указан')
}

if (!s3AccessKeyId) {
  throw new Error('S3_ACCESS_KEY_ID не указан')
}

if (!s3SecretAccessKey) {
  throw new Error('S3_SECRET_ACCESS_KEY не указан')
}

export const s3Client =
  globalForS3.s3Client ??
  new S3Client({
    region: s3Region,
    endpoint: s3Endpoint,
    forcePathStyle: s3ForcePathStyle,
    credentials: {
      accessKeyId: s3AccessKeyId,
      secretAccessKey: s3SecretAccessKey
    }
  })

if (process.env.NODE_ENV !== 'production') {
  globalForS3.s3Client = s3Client
}

export async function uploadBufferToS3({
  key,
  body,
  contentType,
  contentLength
}: {
  key: string
  body: Buffer
  contentType: string
  contentLength: number
}) {
  await s3Client.send(
    new PutObjectCommand({
      Bucket: s3Bucket,
      Key: key,
      Body: body,
      ContentType: contentType,
      ContentLength: contentLength
    })
  )

  return {
    bucket: s3Bucket,
    key
  }
}

export async function createSignedDownloadUrl({
  key,
  expiresIn = 60 * 60
}: {
  key: string
  expiresIn?: number
}) {
  const command = new GetObjectCommand({
    Bucket: s3Bucket,
    Key: key
  })

  return getSignedUrl(s3Client, command, {
    expiresIn
  })
}

export async function deleteObjectFromS3(key: string) {
  await s3Client.send(
    new DeleteObjectCommand({
      Bucket: s3Bucket,
      Key: key
    })
  )
}
