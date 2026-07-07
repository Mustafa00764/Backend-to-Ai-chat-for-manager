import { Prisma } from "@/generated/prisma/client";
import { chatMessageToDto } from "@/server/chats/chat-dto";

type AdminChatListItem = Prisma.ChatGetPayload<{
  include: {
    user: true;
    messages: true;
  };
}>;

type AdminChatDetails = Prisma.ChatGetPayload<{
  include: {
    user: true;
    messages: {
      include: {
        attachments: {
          include: {
            file: true;
          };
        };
      };
    };
  };
}>;

function userToDto(user: AdminChatListItem["user"]) {
  if (!user) {
    return null;
  }

  return {
    ...user,
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
  };
}

export function adminChatListItemToDto(chat: AdminChatListItem) {
  return {
    ...chat,
    createdAt: chat.createdAt.toISOString(),
    updatedAt: chat.updatedAt.toISOString(),
    lastMessageAt: chat.lastMessageAt?.toISOString() ?? null,
    user: userToDto(chat.user),
    messages: chat.messages.map((message) => ({
      ...message,
      createdAt: message.createdAt.toISOString(),
      updatedAt: message.updatedAt.toISOString(),
    })),
  };
}

export function adminChatDetailsToDto(chat: AdminChatDetails) {
  return {
    ...chat,
    createdAt: chat.createdAt.toISOString(),
    updatedAt: chat.updatedAt.toISOString(),
    lastMessageAt: chat.lastMessageAt?.toISOString() ?? null,
    user: userToDto(chat.user),
    messages: chat.messages.map(chatMessageToDto),
  };
}
