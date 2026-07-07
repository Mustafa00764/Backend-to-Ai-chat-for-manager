import { FileType } from "@/generated/prisma/client";
import { AppApiError, handleApiError } from "@/lib/api/api-error";
import { requireCurrentAppUser } from "@/lib/auth/current-user";
import { listUserFiles, uploadUserFile } from "@/server/files/file-service";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

function parseFileType(value: string | null) {
  if (!value) {
    return undefined;
  }

  if (!Object.values(FileType).includes(value as FileType)) {
    throw new AppApiError(400, "Некорректный тип файла");
  }

  return value as FileType;
}

function getUploadedFilesFromFormData(formData: FormData) {
  const singleFile = formData.get("file");
  const multipleFiles = formData.getAll("files");

  const allItems = [...(singleFile ? [singleFile] : []), ...multipleFiles];

  return allItems.filter((item): item is File => item instanceof File);
}

export async function GET(request: Request) {
  try {
    const currentUser = await requireCurrentAppUser(request);
    const url = new URL(request.url);

    const fileType = parseFileType(url.searchParams.get("type"));

    const files = await listUserFiles(currentUser.id, {
      fileType,
    });

    return NextResponse.json({
      files,
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const currentUser = await requireCurrentAppUser(request);
    const formData = await request.formData();

    const files = getUploadedFilesFromFormData(formData);
    const source = String(formData.get("source") || "mobile");

    if (files.length === 0) {
      throw new AppApiError(400, "Файл не передан");
    }

    if (files.length > 10) {
      throw new AppApiError(400, "Можно загрузить максимум 10 файлов за раз");
    }

    const uploadedFiles = await Promise.all(
      files.map((file) =>
        uploadUserFile({
          userId: currentUser.id,
          file,
          source,
        }),
      ),
    );

    return NextResponse.json(
      {
        files: uploadedFiles,
      },
      {
        status: 201,
      },
    );
  } catch (error) {
    return handleApiError(error);
  }
}
