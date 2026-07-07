"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, RefreshCw } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

type AdminUser = {
  id: string;
  clerkId: string;
  email: string;
  name: string | null;
  username: string | null;
  role: "ADMIN" | "MANAGER" | "USER";
  status: "ACTIVE" | "DISABLED";
  createdAt: string;
};

type UsersResponse = {
  users: AdminUser[];
};

type CreateUserResponse = {
  user: AdminUser;
  temporaryPassword: string;
  warning: string;
};

type CreateUserForm = {
  email: string;
  name: string;
  username: string;
  role: "ADMIN" | "MANAGER" | "USER";
  status: "ACTIVE" | "DISABLED";
  temporaryPassword: string;
};

const defaultForm: CreateUserForm = {
  email: "",
  name: "",
  username: "",
  role: "MANAGER",
  status: "ACTIVE",
  temporaryPassword: "",
};

async function fetchUsers() {
  const response = await fetch("/api/admin-api/users");

  if (!response.ok) {
    throw new Error("Не удалось загрузить пользователей");
  }

  return response.json() as Promise<UsersResponse>;
}

async function createUser(form: CreateUserForm) {
  const response = await fetch("/api/admin-api/users", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email: form.email,
      name: form.name || undefined,
      username: form.username || undefined,
      role: form.role,
      status: form.status,
      temporaryPassword: form.temporaryPassword || undefined,
    }),
  });

  const json = await response.json();

  if (!response.ok) {
    throw new Error(json.error || "Не удалось создать пользователя");
  }

  return json as CreateUserResponse;
}

async function updateUser(
  userId: string,
  payload: Partial<Pick<AdminUser, "role" | "status">>,
) {
  const response = await fetch(`/api/admin-api/users/${userId}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const json = await response.json();

  if (!response.ok) {
    throw new Error(json.error || "Не удалось обновить пользователя");
  }

  return json;
}

export function UsersPageClient() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<CreateUserForm>(defaultForm);

  const usersQuery = useQuery({
    queryKey: ["admin-users"],
    queryFn: fetchUsers,
  });

  const createMutation = useMutation({
    mutationFn: createUser,
    onSuccess: (data) => {
      queryClient.invalidateQueries({
        queryKey: ["admin-users"],
      });

      setForm(defaultForm);
      setOpen(false);

      toast.success("Пользователь создан", {
        description: `Временный пароль: ${data.temporaryPassword}`,
        duration: 15000,
      });
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({
      userId,
      payload,
    }: {
      userId: string;
      payload: Partial<Pick<AdminUser, "role" | "status">>;
    }) => updateUser(userId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["admin-users"],
      });

      toast.success("Пользователь обновлен");
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const users = usersQuery.data?.users ?? [];

  function submitCreateUser() {
    createMutation.mutate(form);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Пользователи</h1>
          <p className="text-muted-foreground">
            Управление менеджерами, пользователями и администраторами.
          </p>
        </div>

        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => usersQuery.refetch()}
            disabled={usersQuery.isFetching}
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            Обновить
          </Button>

          <Dialog open={open} onOpenChange={setOpen}>
            {/* 👇 ИСПРАВЛЕНИЕ 1: Убрал asChild */}
            <DialogTrigger
              className={cn(
                "group/button inline-flex shrink-0 items-center justify-center rounded-lg border border-transparent bg-clip-padding text-sm font-medium whitespace-nowrap transition-all outline-none select-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 active:not-aria-[haspopup]:translate-y-px disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
                "bg-primary text-primary-foreground hover:bg-primary/80",
                "h-8 gap-1.5 px-2.5 has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2",
              )}
            >
              <Plus className="mr-2 h-4 w-4" />
              Добавить пользователя
            </DialogTrigger>

            <DialogContent>
              <DialogHeader>
                <DialogTitle>Новый пользователь</DialogTitle>
                <DialogDescription>
                  Пользователь будет создан в Clerk и в базе приложения.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input
                    value={form.email}
                    onChange={(event) =>
                      setForm((prev) => ({
                        ...prev,
                        email: event.target.value,
                      }))
                    }
                    placeholder="manager@company.com"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Имя</Label>
                  <Input
                    value={form.name}
                    onChange={(event) =>
                      setForm((prev) => ({
                        ...prev,
                        name: event.target.value,
                      }))
                    }
                    placeholder="Мустафа Эшчанов"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Username</Label>
                  <Input
                    value={form.username}
                    onChange={(event) =>
                      setForm((prev) => ({
                        ...prev,
                        username: event.target.value,
                      }))
                    }
                    placeholder="eshchanov9"
                  />
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Роль</Label>
                    <Select
                      value={form.role}
                      onValueChange={(value) => {
                        if (!value) return;
                        setForm((prev) => ({
                          ...prev,
                          role: value as CreateUserForm["role"],
                        }));
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ADMIN">ADMIN</SelectItem>
                        <SelectItem value="MANAGER">MANAGER</SelectItem>
                        <SelectItem value="USER">USER</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Статус</Label>
                    <Select
                      value={form.status}
                      onValueChange={(value) => {
                        if (!value) return;
                        setForm((prev) => ({
                          ...prev,
                          role: value as CreateUserForm["role"],
                        }));
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ACTIVE">ACTIVE</SelectItem>
                        <SelectItem value="DISABLED">DISABLED</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Временный пароль</Label>
                  <Input
                    value={form.temporaryPassword}
                    onChange={(event) =>
                      setForm((prev) => ({
                        ...prev,
                        temporaryPassword: event.target.value,
                      }))
                    }
                    placeholder="Можно оставить пустым"
                  />
                </div>

                <Button
                  className="w-full"
                  onClick={submitCreateUser}
                  disabled={createMutation.isPending}
                >
                  {createMutation.isPending
                    ? "Создание..."
                    : "Создать пользователя"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Список пользователей</CardTitle>
        </CardHeader>

        <CardContent>
          {usersQuery.isLoading ? (
            <p className="text-sm text-muted-foreground">Загрузка...</p>
          ) : null}

          {usersQuery.isError ? (
            <p className="text-sm text-destructive">
              Ошибка загрузки пользователей
            </p>
          ) : null}

          {!usersQuery.isLoading && !usersQuery.isError ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Пользователь</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Роль</TableHead>
                  <TableHead>Статус</TableHead>
                  <TableHead>Создан</TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                {users.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">
                          {user.name || "Без имени"}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {user.username || user.clerkId}
                        </p>
                      </div>
                    </TableCell>

                    <TableCell>{user.email}</TableCell>

                    <TableCell>
                      <Select
                        value={user.role}
                        onValueChange={(value) => {
                          if (!value) return;
                          updateMutation.mutate({
                            userId: user.id,
                            payload: {
                              status: value as AdminUser["status"],
                            },
                          });
                        }}
                      >
                        <SelectTrigger className="w-36">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="ADMIN">ADMIN</SelectItem>
                          <SelectItem value="MANAGER">MANAGER</SelectItem>
                          <SelectItem value="USER">USER</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>

                    <TableCell>
                      <Select
                        value={user.status}
                        onValueChange={(value) => {
                          if (!value) return;
                          updateMutation.mutate({
                            userId: user.id,
                            payload: {
                              status: value as AdminUser["status"],
                            },
                          });
                        }}
                      >
                        <SelectTrigger className="w-36">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="ACTIVE">ACTIVE</SelectItem>
                          <SelectItem value="DISABLED">DISABLED</SelectItem>
                        </SelectContent>
                      </Select>

                      <div className="mt-2">
                        <Badge
                          variant={
                            user.status === "ACTIVE" ? "default" : "secondary"
                          }
                        >
                          {user.status}
                        </Badge>
                      </div>
                    </TableCell>

                    <TableCell>
                      {new Date(user.createdAt).toLocaleDateString("ru-RU")}
                    </TableCell>
                  </TableRow>
                ))}

                {users.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={5}
                      className="py-8 text-center text-sm text-muted-foreground"
                    >
                      Пользователей пока нет
                    </TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
