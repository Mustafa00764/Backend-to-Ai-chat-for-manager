import { NextResponse } from "next/server";
import { handleApiError } from "@/lib/api/api-error";
import { requireAdmin } from "@/lib/auth/current-user";
import {
  deleteAdminFile,
  getAdminFile,
} from "@/server/files/admin-file-service";
import { fileToDto } from "@/server/files/file-service";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{
    fileId: string;
  }>;
};

export async function GET(request: Request, context: RouteContext) {
  try {
    await requireAdmin(request);

    const { fileId } = await context.params;
    const file = await getAdminFile(fileId);

    return NextResponse.json({
      file: fileToDto(file),
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  try {
    await requireAdmin(request);

    const { fileId } = await context.params;
    const file = await deleteAdminFile(fileId);

    return NextResponse.json({
      file,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
