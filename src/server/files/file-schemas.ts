import { z } from "zod";

export const fileTypeSchema = z.enum([
  "IMAGE",
  "AUDIO",
  "VIDEO",
  "DOCUMENT",
  "OTHER",
]);

export const listFilesQuerySchema = z.object({
  type: fileTypeSchema.optional(),
});

export type ListFilesQueryInput = z.infer<typeof listFilesQuerySchema>;
