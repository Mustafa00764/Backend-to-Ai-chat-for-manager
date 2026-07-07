import "dotenv/config";
import { CreateBucketCommand, HeadBucketCommand } from "@aws-sdk/client-s3";
import { s3Client } from "../src/lib/storage/s3-client";
import { env } from "../src/lib/env";

async function main() {
  try {
    await s3Client.send(
      new HeadBucketCommand({
        Bucket: env.S3_BUCKET,
      }),
    );

    console.log(`Bucket уже существует: ${env.S3_BUCKET}`);
    return;
  } catch {
    console.log(`Bucket не найден. Создаю: ${env.S3_BUCKET}`);
  }

  await s3Client.send(
    new CreateBucketCommand({
      Bucket: env.S3_BUCKET,
    }),
  );

  console.log(`Bucket создан: ${env.S3_BUCKET}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
