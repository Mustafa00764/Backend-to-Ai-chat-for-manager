import { NextResponse } from "next/server";
import { handleApiError } from "@/lib/api/api-error";
import { requireAdmin } from "@/lib/auth/current-user";
import {
  createAdminUser,
  listAdminUsers,
} from "@/server/users/admin-users-service";
import { createAdminUserSchema } from "@/server/users/user-schemas";

export const runtime = "nodejs";

export async function GET() {
  try {
    await requireAdmin();

    const users = await listAdminUsers();

    return NextResponse.json({
      users,
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const actor = await requireAdmin();
    const json = await request.json();
    const dto = createAdminUserSchema.parse(json);

    const result = await createAdminUser(dto, actor.id);

    return NextResponse.json(result, {
      status: 201,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
