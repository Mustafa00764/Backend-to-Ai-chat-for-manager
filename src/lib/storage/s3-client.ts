import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
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
  if (typeof value === 'boolean') {
    return value
  }

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

export function getS3BucketName() {
  return s3Bucket
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

export async function createSignedUploadUrl({
  key,
  contentType,
  expiresIn = 15 * 60
}: {
  key: string
  contentType: string
  expiresIn?: number
}) {
  const command = new PutObjectCommand({
    Bucket: s3Bucket,
    Key: key,
    ContentType: contentType
  })

  return getSignedUrl(s3Client, command, {
    expiresIn
  })
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

export async function getS3ObjectMetadata({
  key,
  bucket = s3Bucket
}: {
  key: string
  bucket?: string
}) {
  const result = await s3Client.send(
    new HeadObjectCommand({
      Bucket: bucket,
      Key: key
    })
  )

  return {
    bucket,
    key,
    contentLength: result.ContentLength ?? 0,
    contentType: result.ContentType ?? '',
    etag: result.ETag ?? '',
    lastModified: result.LastModified ?? null
  }
}

async function streamToBuffer(stream: NodeJS.ReadableStream) {
  const chunks: Buffer[] = []

  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
  }

  return Buffer.concat(chunks)
}

export async function downloadS3FileToBuffer({
  key,
  bucket = s3Bucket
}: {
  key: string
  bucket?: string
}) {
  const result = await s3Client.send(
    new GetObjectCommand({
      Bucket: bucket,
      Key: key
    })
  )

  if (!result.Body) {
    throw new Error('Файл в S3/MinIO не найден или пустой')
  }

  return streamToBuffer(result.Body as NodeJS.ReadableStream)
}

export async function deleteObjectFromS3(key: string, bucket = s3Bucket) {
  await s3Client.send(
    new DeleteObjectCommand({
      Bucket: bucket,
      Key: key
    })
  )
}
