import { FileType } from "@/generated/prisma/client";
import { AppApiError } from "@/lib/api/api-error";
import { prisma } from "@/lib/db/prisma";
import {
  createSignedDownloadUrl,
  deleteObjectFromS3,
} from "@/lib/storage/s3-client";
import { fileToDto } from "@/server/files/file-service";

export async function listAdminFiles(
  options: {
    fileType?: FileType;
    ownerId?: string;
  } = {},
) {
  const files = await prisma.file.findMany({
    where: {
      fileType: options.fileType,
      ownerId: options.ownerId,
    },
    orderBy: {
      createdAt: "desc",
    },
    take: 200,
  });

  return files.map(fileToDto);
}

export async function getAdminFile(fileId: string) {
  const file = await prisma.file.findUnique({
    where: {
      id: fileId,
    },
  });

  if (!file) {
    throw new AppApiError(404, "Файл не найден");
  }

  return file;
}

export async function createAdminFileDownloadUrl(fileId: string) {
  const file = await getAdminFile(fileId);

  const url = await createSignedDownloadUrl({
    key: file.s3Key,
    expiresIn: 60 * 60,
  });

  return {
    file: fileToDto(file),
    url,
    expiresIn: 60 * 60,
  };
}

export async function deleteAdminFile(fileId: string) {
  const file = await getAdminFile(fileId);

  await deleteObjectFromS3(file.s3Key);

  const deletedFile = await prisma.file.delete({
    where: {
      id: fileId,
    },
  });

  return fileToDto(deletedFile);
}
