import { NextResponse } from "next/server";
import { handleApiError } from "@/lib/api/api-error";
import { requireCurrentAppUser } from "@/lib/auth/current-user";
import {
  deleteUserChat,
  getUserChat,
  updateUserChat,
} from "@/server/chats/chat-service";
import { updateChatSchema } from "@/server/chats/chat-schemas";
import { chatToDto } from "@/server/chats/chat-dto";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{
    chatId: string;
  }>;
};

function simpleChatToDto(chat: {
  createdAt: Date;
  updatedAt: Date;
  lastMessageAt: Date | null;
}) {
  return {
    ...chat,
    createdAt: chat.createdAt.toISOString(),
    updatedAt: chat.updatedAt.toISOString(),
    lastMessageAt: chat.lastMessageAt?.toISOString() ?? null,
  };
}

export async function GET(request: Request, context: RouteContext) {
  try {
    const currentUser = await requireCurrentAppUser(request);
    const { chatId } = await context.params;

    const chat = await getUserChat(currentUser.id, chatId);

    return NextResponse.json({
      chat: chatToDto(chat),
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const currentUser = await requireCurrentAppUser(request);
    const { chatId } = await context.params;
    const json = await request.json();
    const dto = updateChatSchema.parse(json);

    const chat = await updateUserChat(currentUser.id, chatId, dto);

    return NextResponse.json({
      chat: simpleChatToDto(chat),
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  try {
    const currentUser = await requireCurrentAppUser(request);
    const { chatId } = await context.params;

    const chat = await deleteUserChat(currentUser.id, chatId);

    return NextResponse.json({
      chat: simpleChatToDto(chat),
    });
  } catch (error) {
    return handleApiError(error);
  }
}
