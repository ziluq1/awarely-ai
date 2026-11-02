"use client";

import { useEffect, useId, useRef, useState } from "react";
import type { FormEvent } from "react";
import { assessSafety } from "@/lib/agent/safety";
import { isCompanionResponse } from "@/lib/agent/types";
import type { CompanionFailure, CompanionSuccess } from "@/lib/agent/types";
import { createId } from "@/lib/format";
import { COMPANION_NOTE_LIMIT } from "@/lib/types";
import { SafetyNotice } from "@/components/safety-notice";
import { ChatIdentity } from "@/components/social-ui";
import { Button, ErrorBlock, PageHeader, cardClass, fieldClass } from "@/components/ui";

const PACE_KEY = "mindmate.companion.pace.v1";
const CONVO_KEY = "mindmate.companion.convo.v1";
const COOLDOWN_MS = 5_000;

function paceNote(now: number, convo: number): string {
  if (convo >= 10) return "This conversation has 10 messages. Clear the chat to start a new one.";
  const stamps = readStamps(now);
  const last = stamps.at(-1) ?? 0;
  const wait = COOLDOWN_MS - (now - last);
  if (wait > 0) return `Wait ${Math.ceil(wait / 1000)} seconds before the next message.`;
  if (stamps.filter((stamp) => now - stamp < 60_000).length >= 5) return "Five messages a minute is the limit. Wait, then try again.";
  if (stamps.length >= 20) return "Twenty messages a day is the limit. Try again after the oldest message is 24 hours old.";
  return "";
}

function readStamps(now: number): number[] {
  try {
    const raw = JSON.parse(localStorage.getItem(PACE_KEY) ?? "[]") as unknown;
    return Array.isArray(raw) ? raw.filter((stamp): stamp is number => typeof stamp === "number" && now - stamp < 86_400_000) : [];
  } catch {
    return [];
  }
}

function clock(): number {
  return Date.now();
}

function convoCount(): number {
  try {
    return Number(sessionStorage.getItem(CONVO_KEY) ?? 0) || 0;
  } catch {
    return 0;
  }
}

const PROMPTS = [
  "I'm overwhelmed by schoolwork.",
  "Help me reflect on my day.",
  "I feel stressed and need a moment.",
  "Help me figure out one small next step.",
  "Give me a quote.",
  "Guide me through a breathing exercise.",
];

const TOOL_LABELS: Record<string, string> = {
  guided_grounding: "Guided grounding",
  journaling_prompt: "Journaling prompt",
  break_down_task: "Break down a task",
  mood_reflection: "Mood reflection",
  suggest_next_step: "Next step",
};

type Turn = {
  id: string;
  user: string;
  pending: boolean;
  reply?: CompanionSuccess;
  exercise?: boolean;
  error?: CompanionFailure | { message: string; tool: null };
};

export function AgentChat({ model, fallback }: { model: string; fallback: string | null }) {
  const fieldId = useId();
  const [turns, setTurns] = useState<Turn[]>([]);
  const [draft, setDraft] = useState("");
  const [pending, setPending] = useState(false);
  const [limitNote, setLimitNote] = useState("");
  const [convo, setConvo] = useState(0);
  const endRef = useRef<HTMLDivElement>(null);
  const aliveRef = useRef(true);

  useEffect(() => {
    aliveRef.current = true;
    return () => {
      aliveRef.current = false;
    };
  }, []);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "nearest" });
  }, [turns, pending]);

  useEffect(() => {
    queueMicrotask(() => {
      const count = convoCount();
      setConvo(count);
      setLimitNote(paceNote(clock(), count));
    });
  }, []);

  useEffect(() => {
    if (!limitNote) return;
    const timer = window.setInterval(() => setLimitNote(paceNote(Date.now(), convoCount())), 1000);
    return () => window.clearInterval(timer);
  }, [limitNote]);

  async function send(text: string) {
    const message = text.trim();
    if (!message || pending) return;
    const note = paceNote(clock(), convoCount());
    if (note && !(wantsBreathingExercise(message) && assessSafety(message).level === "ordinary")) {
      setLimitNote(note);
      return;
    }
    if (wantsBreathingExercise(message) && assessSafety(message).level === "ordinary") {
      setDraft("");
      setTurns((current) => [...current, { id: createId(), user: message, pending: false, exercise: true }]);
      return;
    }
    const history = turns
      .flatMap((turn) =>
        turn.reply?.source === "model"
          ? [
              { role: "user" as const, content: turn.user },
              { role: "assistant" as const, content: turn.reply.message },
            ]
          : [],
      )
      .slice(-8);
    const id = createId();
    const now = clock();
    const nextConvo = convoCount() + 1;
    localStorage.setItem(PACE_KEY, JSON.stringify([...readStamps(now), now]));
    sessionStorage.setItem(CONVO_KEY, String(nextConvo));
    setConvo(nextConvo);
    setLimitNote(paceNote(now + 1, nextConvo));
    setDraft("");
    setPending(true);
    setTurns((current) => [...current, { id, user: message, pending: true }]);
    try {
      const response = await fetch("/api/companion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, history }),
      });
      const body: unknown = await response.json();
      if (!aliveRef.current) return;
      if (!isCompanionResponse(body)) {
        setTurns((current) =>
          current.map((turn) =>
            turn.id === id ? finishWithoutModel(turn, "The companion returned an unexpected response.") : turn,
          ),
        );
        return;
      }
      setTurns((current) =>
        current.map((turn) => {
          if (turn.id !== id) return turn;
          if (body.ok) return { ...turn, pending: false, reply: body };
          return finishWithoutModel(turn, body.message, body);
        }),
      );
    } catch {
      if (!aliveRef.current) return;
      setTurns((current) =>
        current.map((turn) =>
          turn.id === id ? finishWithoutModel(turn, "The companion could not be reached. No model reply was received.") : turn,
        ),
      );
    } finally {
      if (aliveRef.current) setPending(false);
    }
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void send(draft);
  }

  const modelNote = fallback
    ? `Replies come from the Groq model (${model}). If Groq cannot take the request, the same message is sent to Gemini (${fallback}) instead. Sending a message sends that text, and recent model replies in this chat, to whichever of those providers answers.`
    : `Replies on this page come from the configured Groq model (${model}). Sending a message sends that text, and recent model replies in this chat, to Groq.`;

  const exerciseTurn = [...turns].reverse().find((turn) => turn.exercise);

  return (
    <div className="max-w-3xl space-y-6">
      <PageHeader eyebrow="AI Companion" title="A moment of support">
        <p>
          awarely.ai is a wellness and reflection tool. It is not a therapist, a diagnosis, or an emergency service, and
          it cannot monitor you or send help. The chat stays on this page until you clear it. It is not saved.
        </p>
      </PageHeader>
      <p className="max-w-2xl leading-relaxed text-muted">
        Write what would help, or choose a prompt. Replies stay short and ask one question at a time. If a tool runs,
        its name and status appear with the reply.
      </p>

      <div className={`${cardClass} flex flex-col`}>
        {turns.length > 0 ? (
        <div className="max-h-52 space-y-4 overflow-y-auto p-4" aria-live="polite" aria-relevant="additions">
          <ol className="space-y-4">
            {turns.map((turn) => (
              <li key={turn.id} className="space-y-3">
                <div className="flex justify-end">
                  <div className="max-w-[40rem] rounded-[1.5rem] bg-inverse px-4 py-3 text-inverse-text">
                    <ChatIdentity />
                    <p className="journal-text mt-1 leading-relaxed">{turn.user}</p>
                  </div>
                </div>
                {turn.pending ? (
                  <p className="text-sm text-muted">Waiting for the model…</p>
                ) : null}
                {turn.reply ? <ReplyCard reply={turn.reply} /> : null}
                {turn.error ? (
                  <div className="space-y-3">
                    {turn.error.tool ? <ToolCard tool={turn.error.tool} /> : null}
                    <ErrorBlock title={errorTitle(turn.error)} message={turn.error.message}>
                      <Button onClick={() => void send(turn.user)} disabled={pending}>
                        Try again
                      </Button>
                    </ErrorBlock>
                  </div>
                ) : null}
              </li>
            ))}
          </ol>
          <div ref={endRef} />
        </div>
        ) : null}

        {exerciseTurn ? (
          <div className="border-t border-line">
            <BreathingExercise
              key={exerciseTurn.id}
              onClose={() => {
                setTurns((current) =>
                  current.map((turn) => (turn.id === exerciseTurn.id ? { ...turn, exercise: false } : turn)),
                );
              }}
            />
          </div>
        ) : null}

        <form onSubmit={onSubmit} className={`p-4 ${turns.length > 0 ? "border-t border-line" : ""}`}>
          <p className="text-sm font-medium text-foreground">Suggested prompts</p>
          <div className="mt-2 grid grid-cols-2 gap-2">
            {PROMPTS.map((prompt) => (
              <Button key={prompt} variant="secondary" className="h-auto min-h-12 w-full whitespace-normal px-3 py-2 text-sm leading-snug" disabled={pending} onClick={() => void send(prompt)}>
                {prompt}
              </Button>
            ))}
          </div>
          {limitNote ? <p className="mt-3 text-sm text-muted" role="status">{limitNote}</p> : null}
          <label htmlFor={fieldId} className="mt-5 block text-sm font-medium text-foreground">
            Your message
          </label>
          <textarea
            id={fieldId}
            value={draft}
            maxLength={COMPANION_NOTE_LIMIT}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                event.currentTarget.form?.requestSubmit();
              }
            }}
            disabled={pending || convo >= 10}
            className={`${fieldClass} mt-2 min-h-16 disabled:opacity-60`}
            placeholder="What would help right now?"
          />
          <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-muted">
              {draft.length} / {COMPANION_NOTE_LIMIT}. Enter sends. Shift Enter adds a line.
            </p>
            <div className="flex gap-2">
              <Button type="submit" disabled={pending || !draft.trim() || Boolean(limitNote)}>
                {pending ? "Sending…" : "Send"}
              </Button>
              <Button
                variant="quiet"
                disabled={pending || turns.length === 0}
                onClick={() => {
                  sessionStorage.removeItem(CONVO_KEY);
                  setConvo(0);
                  setLimitNote(paceNote(Date.now(), 0));
                  setTurns([]);
                }}
              >
                Clear chat
              </Button>
            </div>
          </div>
        </form>
      </div>
      <p className="max-w-2xl text-sm leading-relaxed text-muted">
        {modelNote} Photos and saved journal entries are not included.
      </p>
    </div>
  );
}

function wantsBreathingExercise(text: string): boolean {
  const breath = /\b(?:breath(?:e|ing)?|breatheing|brething|bretah(?:ing)?)\b/i.test(text);
  const ask = /\b(?:exerc\w*|excer\w*|eccer\w*|exers\w*|guide|walk|pace)\b/i.test(text);
  return breath && ask;
}

function finishWithoutModel(turn: Turn, message: string, error?: CompanionFailure): Turn {
  return { ...turn, pending: false, error: error ?? { message, tool: null } };
}

const BREATH_IN = 4;
const BREATH_OUT = 6;
const BREATH_ROUNDS = 4;

function BreathingExercise({ onClose }: { onClose: () => void }) {
  const closeRef = useRef(onClose);
  const [running, setRunning] = useState(true);
  const [round, setRound] = useState(1);
  const [phase, setPhase] = useState<"in" | "out">("in");
  const [tick, setTick] = useState(1);
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    closeRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => setReduceMotion(query.matches);
    apply();
    query.addEventListener("change", apply);
    return () => query.removeEventListener("change", apply);
  }, []);

  useEffect(() => {
    if (!running) return;
    const limit = phase === "in" ? BREATH_IN : BREATH_OUT;
    const timer = window.setTimeout(() => {
      if (tick < limit) {
        setTick((value) => value + 1);
        return;
      }
      if (phase === "in") {
        setPhase("out");
        setTick(1);
        return;
      }
      if (round < BREATH_ROUNDS) {
        setRound((value) => value + 1);
        setPhase("in");
        setTick(1);
        return;
      }
      closeRef.current();
    }, 1000);
    return () => window.clearTimeout(timer);
  }, [running, phase, tick, round]);

  const span = phase === "in" ? BREATH_IN : BREATH_OUT;
  const scale = phase === "in" ? 0.62 + (tick / span) * 0.38 : 1 - (tick / span) * 0.38;
  const label = phase === "in" ? "Inhale" : "Exhale";

  return (
    <div className="relative px-4 py-5 text-foreground">
      <button
        type="button"
        aria-label="Close breathing exercise"
        onClick={onClose}
        className="absolute top-3 right-3 grid size-8 place-items-center rounded-full text-muted hover:bg-accent hover:text-foreground"
      >
        <svg viewBox="0 0 16 16" className="size-3.5" aria-hidden="true">
          <path d="M3.5 3.5 12.5 12.5M12.5 3.5 3.5 12.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </button>
      <div className="pr-10">
        <p className="text-sm font-medium">Breathing exercise</p>
        <p className="mt-1 max-w-xl text-sm leading-relaxed text-muted">
          Four rounds. Breathe in for 4, then out for 6. Stop if you feel dizzy or uncomfortable. This is not a treatment.
        </p>
      </div>
      <div className="mt-5 flex flex-col items-center gap-4">
        <div
          aria-hidden="true"
          className="size-28 rounded-full bg-sage-text motion-safe:transition-transform motion-safe:duration-1000 motion-safe:ease-linear"
          style={reduceMotion ? undefined : { transform: `scale(${scale})` }}
        />
        <p className="text-center">
          <span className="block text-sm font-medium uppercase tracking-[0.14em]" aria-live="polite">
            {label}
          </span>
          <span aria-hidden="true" className="mt-1 block text-4xl font-medium tabular-nums">
            {tick}
          </span>
        </p>
        <p className="text-sm text-muted">Round {round} of {BREATH_ROUNDS}</p>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => setRunning((value) => !value)}>
            {running ? "Pause" : "Continue"}
          </Button>
          <Button variant="quiet" onClick={onClose}>
            Stop
          </Button>
        </div>
      </div>
    </div>
  );
}

function errorTitle(error: Turn["error"]): string {
  if (error && "code" in error && (error.code === "disabled" || error.code === "unconfigured")) {
    return "The AI companion is unavailable";
  }
  if (error && "code" in error && error.code === "rate_limited") return "The companion is pausing";
  return "The model could not reply";
}

function ReplyCard({ reply }: { reply: CompanionSuccess }) {
  const safety = reply.source === "safety" || reply.safety?.level === "clear";
  return (
    <article className={`max-w-[42rem] rounded-[1.5rem] px-4 py-4 ${safety ? "bg-blush text-blush-text" : "bg-accent text-accent-text"}`}>
      <p className={`text-xs font-medium tracking-[0.14em] ${safety ? "uppercase" : "normal-case"}`}>
        {reply.source === "safety" ? "Fixed safety notice" : reply.provider === "gemini" ? "Gemini reply" : "ziluq"}
      </p>
      <p className="journal-text mt-2 whitespace-pre-wrap leading-relaxed">{reply.message}</p>
      {reply.safety ? (
        <SafetyNotice prominent={reply.safety.level === "clear"} immediateDanger={reply.safety.immediateDanger} />
      ) : null}
      {reply.source === "model" && reply.tool ? <ToolCard tool={reply.tool} /> : null}
    </article>
  );
}

function ToolCard({ tool }: { tool: NonNullable<CompanionSuccess["tool"]> }) {
  const ran = tool.status === "completed";
  const label = TOOL_LABELS[tool.name] ?? "Wellness tool";
  return (
    <div className="mt-3 rounded-2xl bg-card px-3 py-3 text-foreground">
      <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted">Tool</p>
      <p className="mt-1 text-sm font-medium">
        {tool.name}
        <span className="font-normal text-muted"> · {label}</span>
      </p>
      <p className={`mt-1 text-sm font-medium ${ran ? "text-sage-text" : "text-danger"}`}>
        {ran ? "Status: completed" : "Status: rejected, not run"}
      </p>
      <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-muted">{tool.summary}</p>
    </div>
  );
}
