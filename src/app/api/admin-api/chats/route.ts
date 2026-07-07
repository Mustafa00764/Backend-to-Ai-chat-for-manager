import { NextResponse } from "next/server";
import { handleApiError } from "@/lib/api/api-error";
import { requireAdmin } from "@/lib/auth/current-user";
import { adminChatListItemToDto } from "@/server/chats/admin-chat-dto";
import { listAdminChats } from "@/server/chats/admin-chat-service";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    await requireAdmin(request);

    const url = new URL(request.url);
    const userId = url.searchParams.get("userId") || undefined;
    const includeDeleted = url.searchParams.get("includeDeleted") === "true";

    const chats = await listAdminChats({
      userId,
      includeDeleted,
    });

    return NextResponse.json({
      chats: chats.map(adminChatListItemToDto),
    });
  } catch (error) {
    return handleApiError(error);
  }
}
