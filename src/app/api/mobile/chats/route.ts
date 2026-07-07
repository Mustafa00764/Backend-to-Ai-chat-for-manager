import { NextResponse } from "next/server";
import { handleApiError } from "@/lib/api/api-error";
import { requireCurrentAppUser } from "@/lib/auth/current-user";
import { createUserChat, listUserChats } from "@/server/chats/chat-service";
import { createChatSchema } from "@/server/chats/chat-schemas";
import { chatListItemToDto } from "@/server/chats/chat-dto";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const currentUser = await requireCurrentAppUser(request);
    const url = new URL(request.url);

    const includeArchived = url.searchParams.get("includeArchived") === "true";
    const pinnedOnly = url.searchParams.get("pinnedOnly") === "true";

    const chats = await listUserChats(currentUser.id, {
      includeArchived,
      pinnedOnly,
    });

    return NextResponse.json({
      chats: chats.map(chatListItemToDto),
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const currentUser = await requireCurrentAppUser(request);
    const json = await request.json();
    const dto = createChatSchema.parse(json);

    const chat = await createUserChat(currentUser.id, dto);

    return NextResponse.json(
      {
        chat: {
          ...chat,
          createdAt: chat.createdAt.toISOString(),
          updatedAt: chat.updatedAt.toISOString(),
          lastMessageAt: chat.lastMessageAt?.toISOString() ?? null,
        },
      },
      {
        status: 201,
      },
    );
  } catch (error) {
    return handleApiError(error);
  }
}
