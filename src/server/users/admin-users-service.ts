import { createClerkClient } from "@clerk/backend";
import { Prisma, UserRole, UserStatus } from "@/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";
import { env } from "@/lib/env";
import type {
  CreateAdminUserInput,
  UpdateAdminUserInput,
} from "@/server/users/user-schemas";

function generateTemporaryPassword() {
  const random = crypto.randomUUID().replaceAll("-", "").slice(0, 18);
  return `Ai-${random}1!`;
}

function splitFullName(name?: string | null) {
  if (!name) {
    return {};
  }

  const parts = name.trim().split(/\s+/).filter(Boolean);

  if (parts.length === 0) {
    return {};
  }

  const [firstName, ...lastNameParts] = parts;

  return {
    firstName,
    lastName: lastNameParts.length > 0 ? lastNameParts.join(" ") : undefined,
  };
}

function normalizeOptionalString(value?: string) {
  const trimmed = value?.trim();

  if (!trimmed) {
    return undefined;
  }

  return trimmed;
}

const clerkClient = createClerkClient({
  secretKey: env.CLERK_SECRET_KEY,
});

export async function listAdminUsers() {
  return prisma.user.findMany({
    orderBy: {
      createdAt: "desc",
    },
    include: {
      settings: true,
    },
  });
}

export async function createAdminUser(
  input: CreateAdminUserInput,
  actorId: string,
) {
  const email = input.email.trim().toLowerCase();
  const name = normalizeOptionalString(input.name);
  const username = normalizeOptionalString(input.username);
  const role = input.role as UserRole;
  const status = input.status as UserStatus;
  const temporaryPassword =
    normalizeOptionalString(input.temporaryPassword) ??
    generateTemporaryPassword();

  const existingUser = await prisma.user.findFirst({
    where: {
      OR: [
        {
          email,
        },
        username
          ? {
              username,
            }
          : undefined,
      ].filter(Boolean) as Prisma.UserWhereInput[],
    },
  });

  if (existingUser) {
    throw new Error("Пользователь с таким email или username уже существует");
  }

  const { firstName, lastName } = splitFullName(name);

  const clerkUser = await clerkClient.users.createUser({
    emailAddress: [email],
    password: temporaryPassword,
    firstName,
    lastName,
    username,
    publicMetadata: {
      role,
    },
    privateMetadata: {
      createdFrom: "manager-ai-admin",
    },
  });

  const user = await prisma.user.create({
    data: {
      clerkId: clerkUser.id,
      email,
      name,
      username,
      role,
      status,
      settings: {
        create: {},
      },
    },
    include: {
      settings: true,
    },
  });

  await prisma.auditLog.create({
    data: {
      actorId,
      action: "admin.users.create",
      entityType: "user",
      entityId: user.id,
      metadata: {
        email,
        role,
        status,
        clerkId: clerkUser.id,
      },
    },
  });

  return {
    user,
    temporaryPassword,
    warning:
      "Временный пароль показывается только один раз. Сохрани его и передай пользователю безопасно.",
  };
}

export async function updateAdminUser(
  userId: string,
  input: UpdateAdminUserInput,
  actorId: string,
) {
  const data: Prisma.UserUpdateInput = {};

  if (input.role) {
    data.role = input.role as UserRole;
  }

  if (input.status) {
    data.status = input.status as UserStatus;
  }

  const user = await prisma.user.update({
    where: {
      id: userId,
    },
    data,
    include: {
      settings: true,
    },
  });

  await prisma.auditLog.create({
    data: {
      actorId,
      action: "admin.users.update",
      entityType: "user",
      entityId: user.id,
      metadata: {
        role: input.role,
        status: input.status,
      },
    },
  });

  return user;
}
