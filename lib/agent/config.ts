import { readGeminiModel } from "@/lib/agent/gemini";
import { modelCallsEnabled, serverEnv } from "@/lib/agent/server-env";
import type { CompanionStatus } from "@/lib/agent/types";

const MODEL_ID = /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,79}$/;

export function readAvailability(): CompanionStatus {
  if (!modelCallsEnabled()) {
    return { available: false, reason: "disabled" };
  }

  const key = serverEnv("GROQ_API_KEY");
  const model = serverEnv("GROQ_MODEL");
  if (!key || !MODEL_ID.test(model)) {
    return { available: false, reason: "unconfigured" };
  }

  return { available: true, model, fallback: readGeminiModel() };
}
