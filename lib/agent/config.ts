import { readGeminiModel } from "@/lib/agent/gemini";
import type { CompanionStatus } from "@/lib/agent/types";

const MODEL_ID = /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,79}$/;

export function readAvailability(): CompanionStatus {
  if (process.env.MODEL_CALLS_ENABLED !== "true") {
    return { available: false, reason: "disabled" };
  }

  const key = process.env.GROQ_API_KEY?.trim() ?? "";
  const model = process.env.GROQ_MODEL?.trim() ?? "";
  if (!key || !MODEL_ID.test(model)) {
    return { available: false, reason: "unconfigured" };
  }

  return { available: true, model, fallback: readGeminiModel() };
}
