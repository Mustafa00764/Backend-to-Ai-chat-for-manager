import { AppApiError } from "@/lib/api/api-error";
import { prisma } from "@/lib/db/prisma";

export async function listAdminChats(options: {
  userId?: string;
  includeDeleted?: boolean;
} = {}) {
  return prisma.chat.findMany({
    where: {
      userId: options.userId,
      isDeleted: options.includeDeleted ? undefined : false,
    },
    orderBy: [
      {
        lastMessageAt: "desc",
      },
      {
        updatedAt: "desc",
      },
    ],
    take: 200,
    include: {
      user: true,
      messages: {
        orderBy: {
          createdAt: "desc",
        },
        take: 1,
      },
    },
  });
}

export async function getAdminChat(chatId: string) {
  const chat = await prisma.chat.findUnique({
    where: {
      id: chatId,
    },
    include: {
      user: true,
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