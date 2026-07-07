import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { AppAuthError } from "@/lib/auth/current-user";

export class AppApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "AppApiError";
  }
}

export function handleApiError(error: unknown) {
  if (error instanceof AppAuthError) {
    return NextResponse.json(
      {
        error: error.message,
      },
      {
        status: error.status,
      },
    );
  }

  if (error instanceof AppApiError) {
    return NextResponse.json(
      {
        error: error.message,
      },
      {
        status: error.status,
      },
    );
  }

  if (error instanceof ZodError) {
    return NextResponse.json(
      {
        error: "Ошибка валидации",
        details: error.flatten(),
      },
      {
        status: 400,
      },
    );
  }

  if (error instanceof Error) {
    return NextResponse.json(
      {
        error: error.message || "Внутренняя ошибка сервера",
      },
      {
        status: 500,
      },
    );
  }

  console.error(error);

  return NextResponse.json(
    {
      error: "Внутренняя ошибка сервера",
    },
    {
      status: 500,
    },
  );
}
