import "dotenv/config";
import OpenAI from "openai";

const apiKey = process.env.QWEN_API_KEY;
const baseURL = process.env.QWEN_BASE_URL;
const model = process.env.QWEN_CHAT_MODEL || "qwen-plus";

async function main() {
  if (!apiKey) {
    throw new Error("QWEN_API_KEY не указан в .env");
  }

  if (!baseURL) {
    throw new Error("QWEN_BASE_URL не указан в .env");
  }

  const client = new OpenAI({
    apiKey,
    baseURL,
  });

  console.log("Проверяю Qwen...");
  console.log({
    baseURL,
    model,
  });

  const completion = await client.chat.completions.create({
    model,
    messages: [
      {
        role: "system",
        content: "Ты полезный AI-ассистент. Отвечай на русском.",
      },
      {
        role: "user",
        content: "Напиши коротко: подключение Qwen работает?",
      },
    ],
    temperature: 0.2,
  });

  const text = completion.choices[0]?.message?.content;

  console.log("Ответ Qwen:");
  console.log(text);

  console.log("Usage:");
  console.log(completion.usage);
}

main().catch((error) => {
  console.error("Ошибка Qwen:");
  console.error(error);
  process.exitCode = 1;
});
