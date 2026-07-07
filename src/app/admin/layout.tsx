import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { UserRole, UserStatus } from "@/generated/prisma/client";
import { AdminSidebar } from "@/components/admin/admin-sidebar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getCurrentAppUser } from "@/lib/auth/current-user";
import { UserButton } from "@clerk/nextjs";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { userId } = await auth();

  if (!userId) {
    redirect("/sign-in");
  }

  const user = await getCurrentAppUser();

  if (!user) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background p-6">
        <Card className="max-w-xl">
          <CardHeader>
            <CardTitle>Пользователь не добавлен в базу</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>
              Ты вошел через Clerk, но этого пользователя ещё нет в PostgreSQL.
            </p>

            <div className="rounded-md bg-muted p-3 font-mono text-xs text-foreground">
              Clerk user id: {userId}
            </div>

            <p>
              Скопируй этот Clerk user id в <b>FIRST_ADMIN_CLERK_ID</b> в файле{" "}
              <b>.env</b>, затем запусти seed первого админа.
            </p>
          </CardContent>
        </Card>
      </main>
    );
  }

  if (user.status !== UserStatus.ACTIVE) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background p-6">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle>Пользователь отключен</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Твой аккаунт отключен администратором.
          </CardContent>
        </Card>
      </main>
    );
  }

  if (user.role !== UserRole.ADMIN) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background p-6">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle>Нет доступа</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Для входа в админку нужна роль ADMIN.
          </CardContent>
        </Card>
      </main>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="flex">
        <AdminSidebar />

        <div className="min-h-screen flex-1">
          <header className="flex h-16 items-center justify-between border-b px-6">
            <div>
              <p className="text-sm text-muted-foreground">Админка</p>
              <p className="font-medium">{user.name || user.email}</p>
            </div>

            <UserButton />
          </header>

          <main className="p-6">{children}</main>
        </div>
      </div>
    </div>
  );
}
