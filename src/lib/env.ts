import { z } from 'zod'

const serverEnvSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'test', 'production'])
    .default('development'),

  NEXT_PUBLIC_APP_URL: z.string().url(),

  DATABASE_URL: z.string().min(1),

  CLERK_SECRET_KEY: z.string().optional().default(''),
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: z.string().optional().default(''),

  NEXT_PUBLIC_CLERK_SIGN_IN_URL: z.string().default('/sign-in'),
  NEXT_PUBLIC_CLERK_SIGN_UP_URL: z.string().default('/sign-up'),

  NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL: z.string().default('/admin'),
  NEXT_PUBLIC_CLERK_SIGN_UP_FALLBACK_REDIRECT_URL: z.string().default('/admin'),

  NEXT_PUBLIC_CLERK_SIGN_IN_FORCE_REDIRECT_URL: z.string().default('/admin'),
  NEXT_PUBLIC_CLERK_SIGN_UP_FORCE_REDIRECT_URL: z.string().default('/admin'),

  FIRST_ADMIN_CLERK_ID: z.string().optional().default(''),
  FIRST_ADMIN_EMAIL: z.string().optional().default(''),
  FIRST_ADMIN_NAME: z.string().optional().default(''),

  REDIS_URL: z.string().min(1),

  S3_REGION: z.string().min(1),
  S3_BUCKET: z.string().min(1),
  S3_ENDPOINT: z.string().url().optional().or(z.literal('')),
  S3_ACCESS_KEY_ID: z.string().min(1),
  S3_SECRET_ACCESS_KEY: z.string().min(1),
  S3_FORCE_PATH_STYLE: z
    .enum(['true', 'false'])
    .default('true')
    .transform(value => value === 'true'),

  QWEN_API_KEY: z.string().optional().default(''),
  QWEN_BASE_URL: z.string().optional().default(''),
  QWEN_CHAT_MODEL: z.string().default('qwen-plus'),

  AI_MOCK_MODE: z
    .enum(['true', 'false'])
    .default('false')
    .transform(value => value === 'true'),

  QWEN_EMBEDDING_API_KEY: z.string().optional().default(''),
  QWEN_EMBEDDING_BASE_URL: z
    .string()
    .url()
    .default('https://dashscope-us.aliyuncs.com/compatible-mode/v1'),
  QWEN_EMBEDDING_MODEL: z.string().default('text-embedding-v4'),
  QWEN_EMBEDDING_DIMENSIONS: z.coerce.number().default(1536),

  EMBEDDING_MOCK_MODE: z
    .enum(['true', 'false'])
    .default('false')
    .transform(value => value === 'true'),

  QWEN_ASR_API_KEY: z.string().optional().default(''),
  QWEN_ASR_BASE_URL: z
    .string()
    .url()
    .default('https://dashscope-us.aliyuncs.com/compatible-mode/v1'),
  QWEN_ASR_MODEL: z.string().default('qwen3-asr-flash-us'),

  RAG_ENABLED: z
    .enum(['true', 'false'])
    .default('true')
    .transform(value => value === 'true'),

  RAG_MAX_CHUNKS: z.coerce.number().default(5),
  RAG_MIN_SCORE: z.coerce.number().default(0),

  VOICE_GATEWAY_PORT: z.coerce.number().default(3001),

  QWEN_REALTIME_API_KEY: z.string().optional().default(''),
  QWEN_REALTIME_WS_URL: z.string().optional().default(''),
  QWEN_REALTIME_MODEL: z.string().default('qwen3.5-omni-plus-realtime'),
  QWEN_REALTIME_VOICE: z.string().default('Tina')
})

export const env = serverEnvSchema.parse({
  NODE_ENV: process.env.NODE_ENV,

  NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,

  DATABASE_URL: process.env.DATABASE_URL,

  CLERK_SECRET_KEY: process.env.CLERK_SECRET_KEY,
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY:
    process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,

  NEXT_PUBLIC_CLERK_SIGN_IN_URL: process.env.NEXT_PUBLIC_CLERK_SIGN_IN_URL,
  NEXT_PUBLIC_CLERK_SIGN_UP_URL: process.env.NEXT_PUBLIC_CLERK_SIGN_UP_URL,

  NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL:
    process.env.NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL,
  NEXT_PUBLIC_CLERK_SIGN_UP_FALLBACK_REDIRECT_URL:
    process.env.NEXT_PUBLIC_CLERK_SIGN_UP_FALLBACK_REDIRECT_URL,

  NEXT_PUBLIC_CLERK_SIGN_IN_FORCE_REDIRECT_URL:
    process.env.NEXT_PUBLIC_CLERK_SIGN_IN_FORCE_REDIRECT_URL,
  NEXT_PUBLIC_CLERK_SIGN_UP_FORCE_REDIRECT_URL:
    process.env.NEXT_PUBLIC_CLERK_SIGN_UP_FORCE_REDIRECT_URL,

  FIRST_ADMIN_CLERK_ID: process.env.FIRST_ADMIN_CLERK_ID,
  FIRST_ADMIN_EMAIL: process.env.FIRST_ADMIN_EMAIL,
  FIRST_ADMIN_NAME: process.env.FIRST_ADMIN_NAME,

  REDIS_URL: process.env.REDIS_URL,

  S3_REGION: process.env.S3_REGION,
  S3_BUCKET: process.env.S3_BUCKET,
  S3_ENDPOINT: process.env.S3_ENDPOINT,
  S3_ACCESS_KEY_ID: process.env.S3_ACCESS_KEY_ID,
  S3_SECRET_ACCESS_KEY: process.env.S3_SECRET_ACCESS_KEY,
  S3_FORCE_PATH_STYLE: process.env.S3_FORCE_PATH_STYLE,

  QWEN_API_KEY: process.env.QWEN_API_KEY,
  QWEN_BASE_URL: process.env.QWEN_BASE_URL,
  QWEN_CHAT_MODEL: process.env.QWEN_CHAT_MODEL,

  AI_MOCK_MODE: process.env.AI_MOCK_MODE,

  QWEN_EMBEDDING_API_KEY: process.env.QWEN_EMBEDDING_API_KEY,
  QWEN_EMBEDDING_BASE_URL: process.env.QWEN_EMBEDDING_BASE_URL,
  QWEN_EMBEDDING_MODEL: process.env.QWEN_EMBEDDING_MODEL,
  QWEN_EMBEDDING_DIMENSIONS: process.env.QWEN_EMBEDDING_DIMENSIONS,

  EMBEDDING_MOCK_MODE: process.env.EMBEDDING_MOCK_MODE,

  QWEN_ASR_API_KEY: process.env.QWEN_ASR_API_KEY,
  QWEN_ASR_BASE_URL: process.env.QWEN_ASR_BASE_URL,
  QWEN_ASR_MODEL: process.env.QWEN_ASR_MODEL,

  RAG_ENABLED: process.env.RAG_ENABLED,
  RAG_MAX_CHUNKS: process.env.RAG_MAX_CHUNKS,
  RAG_MIN_SCORE: process.env.RAG_MIN_SCORE,

  VOICE_GATEWAY_PORT: process.env.VOICE_GATEWAY_PORT,

  QWEN_REALTIME_API_KEY: process.env.QWEN_REALTIME_API_KEY,
  QWEN_REALTIME_WS_URL: process.env.QWEN_REALTIME_WS_URL,
  QWEN_REALTIME_MODEL: process.env.QWEN_REALTIME_MODEL,
  QWEN_REALTIME_VOICE: process.env.QWEN_REALTIME_VOICE
})
