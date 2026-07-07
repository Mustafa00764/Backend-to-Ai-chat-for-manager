import { NextResponse } from "next/server";
import { handleApiError } from "@/lib/api/api-error";
import { requireAdmin } from "@/lib/auth/current-user";
import { updateAdminUser } from "@/server/users/admin-users-service";
import { updateAdminUserSchema } from "@/server/users/user-schemas";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const actor = await requireAdmin();
    const { id } = await context.params;
    const json = await request.json();
    const dto = updateAdminUserSchema.parse(json);

    const user = await updateAdminUser(id, dto, actor.id);

    return NextResponse.json({
      user,
    });
  } catch (error) {
    return handleApiError(error);
  }
}