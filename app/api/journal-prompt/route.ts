import { connection, NextResponse } from "next/server";
import { readAvailability } from "@/lib/agent/config";
import { withGeminiFallback } from "@/lib/agent/fallback";
import { createCompanionReply } from "@/lib/agent/groq";
import { consumeModelCall } from "@/lib/agent/limits";
import { guardModelReply } from "@/lib/agent/safety";

const ASK =
  "Write one gentle journaling question in a single sentence. Invite a pause and a look at one ordinary moment. Do not give a list, a diagnosis, or crisis instructions.";

const FALLBACKS = [
  "What is one small thing from today that you want to remember?",
  "Where did your attention rest, even for a moment?",
  "What would you like to tell your future self about this hour?",
  "Which ordinary detail around you feels worth keeping?",
  "What changed in your body or your mood since you woke up?",
];

export async function GET() {
  await connection();
  const availability = readAvailability();
  if (!availability.available) return NextResponse.json({ prompt: fallbackPrompt(), source: "fallback" });

  const slot = consumeModelCall("journal-prompt");
  if (!slot.ok) return NextResponse.json({ prompt: fallbackPrompt(), source: "fallback" });

  const attempt = await createCompanionReply(availability.model, { message: ASK, history: [] });
  const result = await withGeminiFallback(attempt, availability.fallback, { message: ASK, history: [] });
  if (!result.ok || result.source !== "model") return NextResponse.json({ prompt: fallbackPrompt(), source: "fallback" });

  const guarded = guardModelReply(result.message);
  if (guarded.blocked) return NextResponse.json({ prompt: fallbackPrompt(), source: "fallback" });
  const prompt = firstSentence(guarded.text);
  if (!prompt) return NextResponse.json({ prompt: fallbackPrompt(), source: "fallback" });
  return NextResponse.json({ prompt, source: result.provider ?? "model" });
}

function fallbackPrompt(): string {
  const index = Math.floor(Date.now() / 3_600_000) % FALLBACKS.length;
  return FALLBACKS[index] ?? FALLBACKS[0];
}

function firstSentence(text: string): string {
  const clean = text.replace(/\s+/g, " ").trim();
  const match = clean.match(/^.{1,280}?[.?!](?=\s|$)/);
  return (match?.[0] ?? clean.slice(0, 280)).trim();
}
