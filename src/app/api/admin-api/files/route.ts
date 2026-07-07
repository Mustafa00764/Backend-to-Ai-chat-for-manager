import { NextResponse } from "next/server";
import { FileType } from "@/generated/prisma/client";
import { AppApiError, handleApiError } from "@/lib/api/api-error";
import { requireAdmin } from "@/lib/auth/current-user";
import { listAdminFiles } from "@/server/files/admin-file-service";

export const runtime = "nodejs";

function parseFileType(value: string | null) {
  if (!value || value === "ALL") {
    return undefined;
  }

  if (!Object.values(FileType).includes(value as FileType)) {
    throw new AppApiError(400, "Некорректный тип файла");
  }

  return value as FileType;
}

export async function GET(request: Request) {
  try {
    await requireAdmin(request);

    const url = new URL(request.url);
    const fileType = parseFileType(url.searchParams.get("fileType"));

    const files = await listAdminFiles({
      fileType,
    });

    return NextResponse.json({
      files,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
