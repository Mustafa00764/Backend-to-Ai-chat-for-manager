import { NextResponse } from "next/server";
import { handleApiError } from "@/lib/api/api-error";
import { requireAdmin } from "@/lib/auth/current-user";
import { createAdminFileDownloadUrl } from "@/server/files/admin-file-service";

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
    const result = await createAdminFileDownloadUrl(fileId);

    return NextResponse.json(result);
  } catch (error) {
    return handleApiError(error);
  }
}
