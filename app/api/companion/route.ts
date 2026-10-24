import { connection, NextResponse } from "next/server";
import { readAvailability } from "@/lib/agent/config";
import { withGeminiFallback } from "@/lib/agent/fallback";
import { createCompanionReply } from "@/lib/agent/groq";
import { consumeModelCall, RATE_LIMIT_KEY } from "@/lib/agent/limits";
import { parseCompanionRequest, REQUEST_BODY_LIMIT } from "@/lib/agent/request";
import { assessSafety, CRISIS_MESSAGE, guardModelReply, modelSignalsCrisis } from "@/lib/agent/safety";
import type { CompanionResponse } from "@/lib/agent/types";

export async function POST(request: Request) {
  await connection();

  let raw = "";
  try {
    raw = await request.text();
  } catch {
    return respond(invalid("The request could not be read."), 400);
  }
  if (raw.length > REQUEST_BODY_LIMIT) {
    return respond(invalid("That request is too large."), 400);
  }

  let parsed: unknown;
  try {
    parsed = raw ? JSON.parse(raw) : null;
  } catch {
    return respond(invalid("Send the message as JSON."), 400);
  }

  const input = parseCompanionRequest(parsed);
  if (!input.ok) return respond(invalid(input.message), 400);

  const assessment = assessSafety(input.input.message, input.input.history);
  if (assessment.level === "clear") {
    return respond(
      {
        ok: true,
        source: "safety",
        message: CRISIS_MESSAGE,
        tool: null,
        safety: { level: "clear", immediateDanger: assessment.immediateDanger },
      },
      200,
    );
  }

  const availability = readAvailability();
  if (!availability.available) {
    const message =
      availability.reason === "disabled"
        ? "The AI companion is unavailable because MODEL_CALLS_ENABLED is not true. Prepared exercises on this page do not use a model."
        : "The AI companion is unavailable because GROQ_API_KEY or GROQ_MODEL is missing or not usable. No model was called.";
    return respond({ ok: false, code: availability.reason, message, tool: null }, 503);
  }

  const slot = consumeModelCall(RATE_LIMIT_KEY);
  if (!slot.ok) {
    return NextResponse.json(
      {
        ok: false,
        code: "rate_limited",
        message: `This server process has reached its limit for model calls. Try again in about ${slot.retryAfterSeconds} seconds. This limit is not a global spending budget.`,
        tool: null,
      } satisfies CompanionResponse,
      { status: 429, headers: { "Retry-After": String(slot.retryAfterSeconds) } },
    );
  }

  const attempt = await createCompanionReply(availability.model, {
    ...input.input,
    uncertain: assessment.level === "uncertain",
  });
  const result = await withGeminiFallback(attempt, availability.fallback, {
    ...input.input,
    uncertain: assessment.level === "uncertain",
  });
  if (!result.ok) {
    const status = result.code === "timeout" ? 504 : result.code === "rate_limited" ? 429 : 502;
    return respond(result, status);
  }

  const guarded = guardModelReply(result.message);
  if (guarded.blocked) {
    return respond(
      {
        ok: true,
        source: "safety",
        message: CRISIS_MESSAGE,
        tool: null,
        safety: { level: "clear", immediateDanger: false },
      },
      200,
    );
  }

  const confirmed = assessment.level === "uncertain" && modelSignalsCrisis(guarded.text);

  return respond(
    {
      ...result,
      message: guarded.text,
      safety: confirmed
        ? { level: "clear", immediateDanger: false }
        : assessment.level === "uncertain"
          ? { level: "uncertain", immediateDanger: false }
          : null,
    },
    200,
  );
}

function invalid(message: string): CompanionResponse {
  return { ok: false, code: "invalid", message, tool: null };
}

function respond(body: CompanionResponse, status: number) {
  return NextResponse.json(body, { status });
}
