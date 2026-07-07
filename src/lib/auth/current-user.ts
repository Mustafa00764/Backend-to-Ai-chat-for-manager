import { verifyToken } from "@clerk/backend";
import { auth } from "@clerk/nextjs/server";
import { UserRole, UserStatus } from "@/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";
import { env } from "@/lib/env";

export class AppAuthError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "AppAuthError";
  }
}

function extractBearerToken(request?: Request) {
  if (!request) {
    return null;
  }

  const authorization = request.headers.get("authorization");

  if (!authorization) {
    return null;
  }

  const [type, token] = authorization.split(" ");

  if (type !== "Bearer" || !token) {
    return null;
  }

  return token;
}

async function getClerkUserId(request?: Request) {
  const bearerToken = extractBearerToken(request);

  if (bearerToken) {
    const payload = await verifyToken(bearerToken, {
      secretKey: env.CLERK_SECRET_KEY,
    });

    return String(payload.sub || "");
  }

  const { userId } = await auth();

  return userId;
}

export async function getCurrentAppUser(request?: Request) {
  const clerkUserId = await getClerkUserId(request);

  if (!clerkUserId) {
    return null;
  }

  return prisma.user.findUnique({
    where: {
      clerkId: clerkUserId,
    },
    include: {
      settings: true,
    },
  });
}

export async function requireCurrentAppUser(request?: Request) {
  const user = await getCurrentAppUser(request);

  if (!user) {
    throw new AppAuthError(
      401,
      "Пользователь авторизован в Clerk, но не найден в базе приложения",
    );
  }

  if (user.status !== UserStatus.ACTIVE) {
    throw new AppAuthError(403, "Пользователь отключен");
  }

  return user;
}

export async function requireAdmin(request?: Request) {
  const user = await requireCurrentAppUser(request);

  if (user.role !== UserRole.ADMIN) {
    throw new AppAuthError(403, "Недостаточно прав. Требуется роль ADMIN");
  }

  return user;
}
