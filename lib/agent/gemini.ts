import { SYSTEM_PROMPT, UNCERTAIN_PROMPT } from "@/lib/agent/prompt";
import { serverEnv } from "@/lib/agent/server-env";
import type { CompanionFailure, CompanionResponse } from "@/lib/agent/types";

const OUTPUT_TOKENS = 350;
const TIMEOUT_MS = 20_000;
const DEFAULT_MODEL = "gemini-3.5-flash-lite";
const MODEL_ID = /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,79}$/;

type GeminiInput = {
  message: string;
  history: { role: "user" | "assistant"; content: string }[];
  uncertain?: boolean;
};

export function readGeminiModel(): string | null {
  const key = serverEnv("GEMINI_API_KEY");
  const configured = serverEnv("GEMINI_MODEL");
  const model = configured || DEFAULT_MODEL;
  if (!key || !MODEL_ID.test(model)) return null;
  return model;
}

export async function createGeminiReply(model: string, input: GeminiInput): Promise<CompanionResponse> {
  const key = serverEnv("GEMINI_API_KEY");
  if (!key) {
    return {
      ok: false,
      code: "provider",
      message: "Gemini is not configured, so the fallback was not called.",
      tool: null,
    };
  }

  const instruction = input.uncertain ? `${SYSTEM_PROMPT}\n\n${UNCERTAIN_PROMPT}` : SYSTEM_PROMPT;
  const contents = [
    ...input.history.map((turn) => ({
      role: turn.role === "assistant" ? "model" : "user",
      parts: [{ text: turn.content }],
    })),
    { role: "user", parts: [{ text: input.message }] },
  ];

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-goog-api-key": key,
        },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: instruction }] },
          contents,
          generationConfig: { temperature: 0.4, maxOutputTokens: OUTPUT_TOKENS },
        }),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      },
    );
    const body: unknown = await response.json().catch(() => null);
    if (!response.ok) return geminiFailure(response.status);
    const text = extractText(body);
    if (!text) return emptyGeminiReply();
    return { ok: true, source: "model", provider: "gemini", message: text, tool: null, safety: null };
  } catch (error) {
    console.error("companion gemini request failed", isTimeout(error) ? "timeout" : "network");
    if (isTimeout(error)) {
      return {
        ok: false,
        code: "timeout",
        message: "Gemini timed out. Nothing was retried.",
        tool: null,
      };
    }
    return {
      ok: false,
      code: "provider",
      message: "Gemini could not be reached. Nothing was retried.",
      tool: null,
    };
  }
}

function extractText(body: unknown): string {
  if (!body || typeof body !== "object") return "";
  const candidates = (body as { candidates?: unknown }).candidates;
  if (!Array.isArray(candidates) || !candidates[0] || typeof candidates[0] !== "object") return "";
  const parts = (candidates[0] as { content?: { parts?: unknown } }).content?.parts;
  if (!Array.isArray(parts)) return "";
  return parts
    .map((part) => (part && typeof part === "object" && typeof (part as { text?: unknown }).text === "string" ? (part as { text: string }).text : ""))
    .join("")
    .trim();
}

function geminiFailure(status: number): CompanionFailure {
  console.error("companion gemini request failed", status);
  if (status === 401 || status === 403) {
    return {
      ok: false,
      code: "provider",
      message: "Gemini refused the API key. Check GEMINI_API_KEY. The request was not retried.",
      tool: null,
    };
  }
  if (status === 404) {
    return {
      ok: false,
      code: "provider",
      message: "Gemini did not recognize GEMINI_MODEL. The request was not retried.",
      tool: null,
    };
  }
  if (status === 429) {
    return {
      ok: false,
      code: "provider",
      message: "Gemini rate-limited this request. It was not retried.",
      tool: null,
    };
  }
  return {
    ok: false,
    code: "provider",
    message: "Gemini could not complete the request. It was not retried.",
    tool: null,
  };
}

function emptyGeminiReply(): CompanionFailure {
  return {
    ok: false,
    code: "provider",
    message: "Gemini did not return a reply. No tool was run.",
    tool: null,
  };
}

function isTimeout(error: unknown): boolean {
  return error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError");
}
