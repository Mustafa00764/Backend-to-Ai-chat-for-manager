import OpenAI from "openai";
import { env } from "@/lib/env";

export function getQwenClient() {
  if (!env.QWEN_API_KEY) {
    throw new Error("QWEN_API_KEY не указан в .env");
  }

  if (!env.QWEN_BASE_URL) {
    throw new Error("QWEN_BASE_URL не указан в .env");
  }

  return new OpenAI({
    apiKey: env.QWEN_API_KEY,
    baseURL: env.QWEN_BASE_URL,
  });
}
