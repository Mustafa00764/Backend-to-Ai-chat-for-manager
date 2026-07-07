import "dotenv/config";
import {
  HeadBucketCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";

const region = process.env.S3_REGION || "us-east-1";
const bucket = process.env.S3_BUCKET;
const endpoint = process.env.S3_ENDPOINT;
const accessKeyId = process.env.S3_ACCESS_KEY_ID;
const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY;
const forcePathStyle = process.env.S3_FORCE_PATH_STYLE === "true";

function mask(value?: string) {
  if (!value) return "EMPTY";
  return `${value.slice(0, 4)}...${value.slice(-4)}`;
}

async function main() {
  console.log("S3 env:");
  console.log({
    region,
    bucket,
    endpoint,
    accessKeyId: mask(accessKeyId),
    secretAccessKey: mask(secretAccessKey),
    forcePathStyle,
  });

  if (!bucket) throw new Error("S3_BUCKET пустой");
  if (!endpoint) throw new Error("S3_ENDPOINT пустой");
  if (!accessKeyId) throw new Error("S3_ACCESS_KEY_ID пустой");
  if (!secretAccessKey) throw new Error("S3_SECRET_ACCESS_KEY пустой");

  const s3 = new S3Client({
    region,
    endpoint,
    forcePathStyle,
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
  });

  await s3.send(
    new HeadBucketCommand({
      Bucket: bucket,
    }),
  );

  console.log("Bucket найден:", bucket);

  await s3.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: "test/hello.txt",
      Body: Buffer.from("S3 works"),
      ContentType: "text/plain",
    }),
  );

  console.log("Файл загружен: test/hello.txt");
}

main().catch((error) => {
  console.error("S3 test error:");
  console.error(error);
  process.exitCode = 1;
});
