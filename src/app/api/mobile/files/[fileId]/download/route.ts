import { NextResponse } from "next/server";
import { handleApiError } from "@/lib/api/api-error";
import { requireCurrentAppUser } from "@/lib/auth/current-user";
import { createUserFileDownloadUrl } from "@/server/files/file-service";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{
    fileId: string;
  }>;
};

export async function GET(request: Request, context: RouteContext) {
  try {
    const currentUser = await requireCurrentAppUser(request);
    const { fileId } = await context.params;

    const result = await createUserFileDownloadUrl(currentUser.id, fileId);

    return NextResponse.json(result);
  } catch (error) {
    return handleApiError(error);
  }
}
