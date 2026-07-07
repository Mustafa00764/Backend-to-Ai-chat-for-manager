import { NextResponse } from "next/server";
import { handleApiError } from "@/lib/api/api-error";
import { requireAdmin } from "@/lib/auth/current-user";
import { adminChatDetailsToDto } from "@/server/chats/admin-chat-dto";
import { getAdminChat } from "@/server/chats/admin-chat-service";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{
    chatId: string;
  }>;
};

export async function GET(request: Request, context: RouteContext) {
  try {
    await requireAdmin(request);

    const { chatId } = await context.params;
    const chat = await getAdminChat(chatId);

    return NextResponse.json({
      chat: adminChatDetailsToDto(chat),
    });
  } catch (error) {
    return handleApiError(error);
  }
}
