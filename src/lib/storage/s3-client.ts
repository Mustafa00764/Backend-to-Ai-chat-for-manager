import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { env } from "@/lib/env";

const globalForS3 = globalThis as unknown as {
  s3Client?: S3Client;
};

export const s3Client =
  globalForS3.s3Client ??
  new S3Client({
    region: env.S3_REGION,
    endpoint: env.S3_ENDPOINT || undefined,
    forcePathStyle: env.S3_FORCE_PATH_STYLE,
    credentials: {
      accessKeyId: env.S3_ACCESS_KEY_ID,
      secretAccessKey: env.S3_SECRET_ACCESS_KEY,
    },
  });

if (process.env.NODE_ENV !== "production") {
  globalForS3.s3Client = s3Client;
}

export async function uploadBufferToS3({
  key,
  body,
  contentType,
  contentLength,
}: {
  key: string;
  body: Buffer;
  contentType: string;
  contentLength: number;
}) {
  await s3Client.send(
    new PutObjectCommand({
      Bucket: env.S3_BUCKET,
      Key: key,
      Body: body,
      ContentType: contentType,
      ContentLength: contentLength,
    }),
  );

  return {
    bucket: env.S3_BUCKET,
    key,
  };
}

export async function createSignedDownloadUrl({
  key,
  expiresIn = 60 * 60,
}: {
  key: string;
  expiresIn?: number;
}) {
  const command = new GetObjectCommand({
    Bucket: env.S3_BUCKET,
    Key: key,
  });

  return getSignedUrl(s3Client, command, {
    expiresIn,
  });
}

export async function deleteObjectFromS3(key: string) {
  await s3Client.send(
    new DeleteObjectCommand({
      Bucket: env.S3_BUCKET,
      Key: key,
    }),
  );
}
