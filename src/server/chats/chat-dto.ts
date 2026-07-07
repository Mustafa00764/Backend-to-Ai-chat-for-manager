import { Prisma } from "@/generated/prisma/client";
import { fileToDto } from "@/server/files/file-service";

type MessageWithAttachments = Prisma.MessageGetPayload<{
  include: {
    attachments: {
      include: {
        file: true;
      };
    };
  };
}>;

type ChatWithMessages = Prisma.ChatGetPayload<{
  include: {
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

type ChatListItem = Prisma.ChatGetPayload<{
  include: {
    messages: true;
  };
}>;

export function chatMessageToDto(message: MessageWithAttachments) {
  return {
    ...message,
    createdAt: message.createdAt.toISOString(),
    updatedAt: message.updatedAt.toISOString(),
    attachments: message.attachments.map((attachment) => ({
      ...attachment,
      createdAt: attachment.createdAt.toISOString(),
      file: fileToDto(attachment.file),
    })),
  };
}

export function chatToDto(chat: ChatWithMessages) {
  return {
    ...chat,
    createdAt: chat.createdAt.toISOString(),
    updatedAt: chat.updatedAt.toISOString(),
    lastMessageAt: chat.lastMessageAt?.toISOString() ?? null,
    messages: chat.messages.map(chatMessageToDto),
  };
}

export function chatListItemToDto(chat: ChatListItem) {
  return {
    ...chat,
    createdAt: chat.createdAt.toISOString(),
    updatedAt: chat.updatedAt.toISOString(),
    lastMessageAt: chat.lastMessageAt?.toISOString() ?? null,
    messages: chat.messages.map((message) => ({
      ...message,
      createdAt: message.createdAt.toISOString(),
      updatedAt: message.updatedAt.toISOString(),
    })),
  };
}
