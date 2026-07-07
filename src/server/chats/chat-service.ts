import {
  ChatMessageRole,
  Prisma,
  ResponseMode,
} from "@/generated/prisma/client";
import { AppApiError } from "@/lib/api/api-error";
import { prisma } from "@/lib/db/prisma";
import type {
  CreateChatInput,
  CreateMessageInput,
  UpdateChatInput,
} from "@/server/chats/chat-schemas";

type ListChatsOptions = {
  includeArchived?: boolean;
  pinnedOnly?: boolean;
};

function normalizeTitle(title?: string | null) {
  const trimmed = title?.trim();

  if (!trimmed) {
    return "Новый чат";
  }

  return trimmed;
}

function makeTitleFromMessage(text: string) {
  const normalized = text.trim().replace(/\s+/g, " ");

  if (!normalized) {
    return "Новый чат";
  }

  if (normalized.length <= 60) {
    return normalized;
  }

  return `${normalized.slice(0, 60)}...`;
}

export async function listUserChats(
  userId: string,
  options: ListChatsOptions = {},
) {
  return prisma.chat.findMany({
    where: {
      userId,
      isDeleted: false,
      isArchived: options.includeArchived ? undefined : false,
      isPinned: options.pinnedOnly ? true : undefined,
    },
    orderBy: [
      {
        isPinned: "desc",
      },
      {
        lastMessageAt: "desc",
      },
      {
        updatedAt: "desc",
      },
    ],
    include: {
      messages: {
        orderBy: {
          createdAt: "desc",
        },
        take: 1,
      },
    },
  });
}

export async function createUserChat(userId: string, input: CreateChatInput) {
  return prisma.chat.create({
    data: {
      userId,
      title: normalizeTitle(input.title),
      lastMessageAt: null,
    },
  });
}

export async function getUserChat(userId: string, chatId: string) {
  const chat = await prisma.chat.findFirst({
    where: {
      id: chatId,
      userId,
      isDeleted: false,
    },
    include: {
      messages: {
        orderBy: {
          createdAt: "asc",
        },
        include: {
          attachments: {
            include: {
              file: true,
            },
          },
        },
      },
    },
  });

  if (!chat) {
    throw new AppApiError(404, "Чат не найден");
  }

  return chat;
}

export async function updateUserChat(
  userId: string,
  chatId: string,
  input: UpdateChatInput,
) {
  const chat = await prisma.chat.findFirst({
    where: {
      id: chatId,
      userId,
      isDeleted: false,
    },
  });

  if (!chat) {
    throw new AppApiError(404, "Чат не найден");
  }

  return prisma.chat.update({
    where: {
      id: chatId,
    },
    data: {
      title:
        input.title === undefined ? undefined : normalizeTitle(input.title),
      isPinned: input.isPinned,
      isArchived: input.isArchived,
    },
  });
}

export async function deleteUserChat(userId: string, chatId: string) {
  const chat = await prisma.chat.findFirst({
    where: {
      id: chatId,
      userId,
      isDeleted: false,
    },
  });

  if (!chat) {
    throw new AppApiError(404, "Чат не найден");
  }

  return prisma.chat.update({
    where: {
      id: chatId,
    },
    data: {
      isDeleted: true,
      isPinned: false,
      isArchived: true,
    },
  });
}

export async function listChatMessages(userId: string, chatId: string) {
  await getUserChat(userId, chatId);

  return prisma.message.findMany({
    where: {
      chatId,
    },
    orderBy: {
      createdAt: "asc",
    },
    include: {
      attachments: {
        include: {
          file: true,
        },
      },
    },
  });
}

export async function createChatUserMessage(
  userId: string,
  chatId: string,
  input: CreateMessageInput,
) {
  const cleanText = input.text.trim();

  const chat = await prisma.chat.findFirst({
    where: {
      id: chatId,
      userId,
      isDeleted: false,
    },
  });

  if (!chat) {
    throw new AppApiError(404, "Чат не найден");
  }

  const fileIds = input.fileIds ?? [];

  if (fileIds.length > 0) {
    const files = await prisma.file.findMany({
      where: {
        id: {
          in: fileIds,
        },
        OR: [
          {
            ownerId: userId,
          },
          {
            ownerId: null,
          },
        ],
      },
      select: {
        id: true,
      },
    });

    if (files.length !== fileIds.length) {
      throw new AppApiError(
        400,
        "Один или несколько файлов не найдены или недоступны",
      );
    }
  }

  const result = await prisma.$transaction(async (tx) => {
    const message = await tx.message.create({
      data: {
        chatId,
        userId,
        role: ChatMessageRole.USER,
        content: cleanText,
        responseMode: input.responseMode as ResponseMode | undefined,
        attachments:
          fileIds.length > 0
            ? {
                create: fileIds.map((fileId) => ({
                  fileId,
                })),
              }
            : undefined,
      },
      include: {
        attachments: {
          include: {
            file: true,
          },
        },
      },
    });

    const updateData: Prisma.ChatUpdateInput = {
      lastMessageAt: new Date(),
    };

    if (chat.title === "Новый чат") {
      updateData.title = makeTitleFromMessage(cleanText);
    }

    await tx.chat.update({
      where: {
        id: chatId,
      },
      data: updateData,
    });

    return message;
  });

  return result;
}
