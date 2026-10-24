import { createGeminiReply } from "@/lib/agent/gemini";
import type { CompanionResponse } from "@/lib/agent/types";

type ReplyInput = {
  message: string;
  history: { role: "user" | "assistant"; content: string }[];
  uncertain?: boolean;
};

export async function withGeminiFallback(
  attempt: CompanionResponse,
  fallbackModel: string | null,
  input: ReplyInput,
): Promise<CompanionResponse> {
  if (attempt.ok || !attempt.exhausted || attempt.tool || !fallbackModel) return publish(attempt);
  console.error("companion groq unavailable, trying gemini");
  const fallback = await createGeminiReply(fallbackModel, input);
  if (!fallback.ok) {
    return {
      ...fallback,
      message: `Groq could not take this request. ${fallback.message}`,
    };
  }
  return fallback;
}

function publish(result: CompanionResponse): CompanionResponse {
  if (result.ok) return result;
  const { exhausted: _drop, ...rest } = result;
  return rest;
}
