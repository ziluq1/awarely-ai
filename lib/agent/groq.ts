import { APIConnectionTimeoutError, APIError, Groq } from "groq-sdk";
import { serverEnv } from "@/lib/agent/server-env";
import type { ChatCompletionMessageParam } from "groq-sdk/resources/chat/completions";
import { consumeModelCall, RATE_LIMIT_KEY } from "@/lib/agent/limits";
import { SYSTEM_PROMPT, UNCERTAIN_PROMPT } from "@/lib/agent/prompt";
import type { CompanionFailure, CompanionResponse, ToolReport } from "@/lib/agent/types";
import { resolveToolCall, toolResultForModel, WELLNESS_TOOLS } from "@/lib/agent/tools";

const OUTPUT_TOKENS = 350;
const TIMEOUT_MS = 20_000;
const modelsWithoutTools = new Set<string>();

export type GroqAttempt = CompanionResponse & { exhausted?: boolean };

export async function createCompanionReply(
  model: string,
  input: { message: string; history: { role: "user" | "assistant"; content: string }[]; uncertain?: boolean },
): Promise<GroqAttempt> {
  const groq = new Groq({
    apiKey: serverEnv("GROQ_API_KEY"),
    timeout: TIMEOUT_MS,
    maxRetries: 0,
    logLevel: "off",
  });

  const messages: ChatCompletionMessageParam[] = [
    { role: "system", content: SYSTEM_PROMPT },
    ...(input.uncertain ? [{ role: "system" as const, content: UNCERTAIN_PROMPT }] : []),
    ...input.history.map((turn) => ({ role: turn.role, content: turn.content })),
    { role: "user", content: input.message },
  ];

  if (modelsWithoutTools.has(model)) return replyWithoutTools(groq, model, messages);

  let first;
  try {
    first = await groq.chat.completions.create({
      model,
      messages,
      tools: WELLNESS_TOOLS,
      tool_choice: "auto",
      parallel_tool_calls: false,
      temperature: 0.4,
      max_tokens: OUTPUT_TOKENS,
    });
  } catch (error) {
    if (toolCallingUnsupported(error)) {
      modelsWithoutTools.add(model);
      return replyWithoutTools(groq, model, messages);
    }
    return providerFailure(error, null);
  }

  const assistant = first.choices[0]?.message;
  if (!assistant) return emptyModelReply(null);

  const calls = assistant.tool_calls ?? [];
  if (calls.length === 0) {
    const text = assistant.content?.trim() ?? "";
    if (!text) return emptyModelReply(null);
    return { ok: true, source: "model", provider: "groq", message: text, tool: null, safety: null };
  }

  const [firstCall, ...skipped] = calls;
  if (!firstCall?.id) {
    return {
      ok: false,
      code: "provider",
      message: "The model returned a tool call that could not be run. No success was recorded.",
      tool: {
        name: firstCall?.function.name?.slice(0, 80) || "unknown",
        status: "rejected",
        summary: "The tool was not run because the model did not provide a usable tool call.",
      },
    };
  }

  const report = resolveToolCall(firstCall.function.name, firstCall.function.arguments ?? "");
  const followUpSlot = consumeModelCall(RATE_LIMIT_KEY);
  if (!followUpSlot.ok) {
    return {
      ok: false,
      code: "rate_limited",
      message: `The tool status below is what happened. A follow-up model call was not made because this server process reached its limit. Try again in about ${followUpSlot.retryAfterSeconds} seconds. This limit is not a global spending budget.`,
      tool: report,
    };
  }

  const followUp: ChatCompletionMessageParam[] = [
    ...messages,
    { role: "assistant", content: assistant.content, tool_calls: calls },
    ...calls.map((call) => ({
      role: "tool" as const,
      tool_call_id: call.id,
      content:
        call.id === firstCall.id
          ? toolResultForModel(report, skipped.length)
          : "Not executed. awarely.ai runs at most one tool per turn.",
    })),
  ];

  let second;
  try {
    second = await groq.chat.completions.create({
      model,
      messages: followUp,
      tool_choice: "none",
      temperature: 0.4,
      max_tokens: OUTPUT_TOKENS,
    });
  } catch (error) {
    return providerFailure(error, report);
  }

  const reply = second.choices[0]?.message.content?.trim() ?? "";
  if (!reply) return emptyModelReply(report);
  return { ok: true, source: "model", provider: "groq", message: reply, tool: report, safety: null };
}

async function replyWithoutTools(
  groq: Groq,
  model: string,
  messages: ChatCompletionMessageParam[],
): Promise<GroqAttempt> {
  try {
    const completion = await groq.chat.completions.create({
      model,
      messages,
      temperature: 0.4,
      max_tokens: OUTPUT_TOKENS,
    });
    const text = completion.choices[0]?.message?.content?.trim() ?? "";
    if (!text) return emptyModelReply(null);
    return { ok: true, source: "model", provider: "groq", message: text, tool: null, safety: null };
  } catch (error) {
    return providerFailure(error, null);
  }
}

function toolCallingUnsupported(error: unknown): boolean {
  if (!(error instanceof APIError) || error.status !== 400) return false;
  const detail = JSON.stringify(error.error ?? error.message);
  return detail.toLowerCase().includes("tool calling");
}

function emptyModelReply(tool: ToolReport | null): CompanionFailure {
  return {
    ok: false,
    code: "provider",
    message: tool
      ? "The model did not return a reply. The tool status below is the only result."
      : "The model did not return a reply. No tool was run.",
    tool,
  };
}

function providerFailure(error: unknown, tool: ToolReport | null): CompanionFailure & { exhausted: boolean } {
  const status = error instanceof APIError ? error.status : undefined;
  const exhausted = status == null || status === 429 || status >= 500;
  console.error("companion model request failed", error instanceof APIConnectionTimeoutError ? "timeout" : (status ?? "network"));
  if (error instanceof APIConnectionTimeoutError) {
    return {
      ok: false,
      code: "timeout",
      message: tool
        ? "The model request timed out before a reply. Nothing was retried. The tool status below is what actually happened."
        : "The model request timed out. Nothing was retried, and no tool was run.",
      tool,
      exhausted,
    };
  }
  if (status === 401 || status === 403) {
    return {
      ok: false,
      code: "provider",
      message: "Groq refused the API key. Check GROQ_API_KEY. The request was not retried.",
      tool,
      exhausted: false,
    };
  }
  if (status === 404) {
    return {
      ok: false,
      code: "provider",
      message: "Groq did not recognize GROQ_MODEL. The request was not retried.",
      tool,
      exhausted: false,
    };
  }
  if (status === 429) {
    return {
      ok: false,
      code: "provider",
      message: "Groq rate-limited this request. It was not retried.",
      tool,
      exhausted: true,
    };
  }
  return {
    ok: false,
    code: "provider",
    message: "The model provider could not complete the request. It was not retried.",
    tool,
    exhausted,
  };
}
