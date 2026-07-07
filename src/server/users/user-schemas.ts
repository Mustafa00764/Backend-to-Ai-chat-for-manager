import { z } from "zod";

export const userRoleSchema = z.enum(["ADMIN", "MANAGER", "USER"]);
export const userStatusSchema = z.enum(["ACTIVE", "DISABLED"]);

export const createAdminUserSchema = z.object({
  email: z.string().email("Некорректный email"),
  name: z.string().min(2).max(100).optional().or(z.literal("")),
  username: z
    .string()
    .min(3)
    .max(50)
    .regex(/^[a-zA-Z0-9_.-]+$/, {
      message:
        "username может содержать только латинские буквы, цифры, точку, дефис и нижнее подчеркивание",
    })
    .optional()
    .or(z.literal("")),
  role: userRoleSchema.default("USER"),
  status: userStatusSchema.default("ACTIVE"),
  temporaryPassword: z.string().min(8).max(100).optional().or(z.literal("")),
});

export const updateAdminUserSchema = z.object({
  role: userRoleSchema.optional(),
  status: userStatusSchema.optional(),
});

export type CreateAdminUserInput = z.infer<typeof createAdminUserSchema>;
export type UpdateAdminUserInput = z.infer<typeof updateAdminUserSchema>;
