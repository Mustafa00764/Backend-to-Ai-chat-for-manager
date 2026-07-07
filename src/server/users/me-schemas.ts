import { z } from 'zod'

export const updateMeSchema = z.object({
  name: z
    .string()
    .min(2, 'Имя должно быть не короче 2 символов')
    .max(100, 'Имя слишком длинное')
    .optional()
    .or(z.literal('')),

  username: z
    .string()
    .min(3, 'Username должен быть не короче 3 символов')
    .max(50, 'Username слишком длинный')
    .regex(/^[a-zA-Z0-9_.-]+$/, {
      message:
        'username может содержать только латинские буквы, цифры, точку, дефис и нижнее подчеркивание'
    })
    .optional()
    .or(z.literal(''))
})

export const appearanceModeSchema = z.enum(['SYSTEM', 'LIGHT', 'DARK'])

export const responseModeSchema = z.enum(['NORMAL', 'ADVANCED'])

export const updateSettingsSchema = z.object({
  language: z
    .string()
    .min(2, 'Язык должен быть не короче 2 символов')
    .max(10, 'Язык слишком длинный')
    .optional(),

  appearance: appearanceModeSchema.optional(),

  assistantVoice: z
    .string()
    .min(2, 'Название голоса слишком короткое')
    .max(50, 'Название голоса слишком длинное')
    .optional(),

  assistantModel: z
    .string()
    .min(2, 'Название модели слишком короткое')
    .max(100, 'Название модели слишком длинное')
    .optional(),

  assistantVoiceModel: z
    .string()
    .min(2, 'Название модели слишком короткое')
    .max(100, 'Название модели слишком длинное')
    .optional(),

  responseMode: responseModeSchema.optional()
})

export type UpdateMeInput = z.infer<typeof updateMeSchema>
export type UpdateSettingsInput = z.infer<typeof updateSettingsSchema>
