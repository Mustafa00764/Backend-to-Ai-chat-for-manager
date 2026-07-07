import { NextResponse } from "next/server";
import { handleApiError } from "@/lib/api/api-error";
import { requireAdmin } from "@/lib/auth/current-user";
import { listKnowledgeSources } from "@/server/knowledge/knowledge-import-service";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    await requireAdmin(request);

    const sources = await listKnowledgeSources();

    return NextResponse.json({
      sources: sources.map((source) => ({
        ...source,
        type: source.sourceType,
        file: null,
        createdAt: source.createdAt.toISOString(),
        updatedAt: source.updatedAt.toISOString(),
      })),
    });
  } catch (error) {
    return handleApiError(error);
  }
}