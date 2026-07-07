import { z } from "zod";

export const createChatSchema = z.object({
  title: z
    .string()
    .min(1, "Название чата не может быть пустым")
    .max(120, "Название чата слишком длинное")
    .optional()
    .or(z.literal("")),
});

export const updateChatSchema = z
  .object({
    title: z
      .string()
      .min(1, "Название чата не может быть пустым")
      .max(120, "Название чата слишком длинное")
      .optional(),

    isPinned: z.boolean().optional(),

    isArchived: z.boolean().optional(),
  })
  .refine(
    (value) =>
      value.title !== undefined ||
      value.isPinned !== undefined ||
      value.isArchived !== undefined,
    {
      message: "Нужно передать хотя бы одно поле для обновления",
    },
  );

export const createMessageSchema = z.object({
  text: z
    .string()
    .min(1, "Сообщение не может быть пустым")
    .max(30000, "Сообщение слишком длинное"),

  responseMode: z.enum(["NORMAL", "ADVANCED"]).optional(),

  fileIds: z.array(z.string().min(1)).max(10).optional(),
});

export type CreateChatInput = z.infer<typeof createChatSchema>;
export type UpdateChatInput = z.infer<typeof updateChatSchema>;
export type CreateMessageInput = z.infer<typeof createMessageSchema>;
