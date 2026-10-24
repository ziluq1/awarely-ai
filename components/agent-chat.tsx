"use client";

import { useEffect, useId, useRef, useState } from "react";
import type { FormEvent } from "react";
import { isCompanionResponse } from "@/lib/agent/types";
import type { CompanionFailure, CompanionSuccess } from "@/lib/agent/types";
import { createId } from "@/lib/format";
import { COMPANION_NOTE_LIMIT } from "@/lib/types";
import { SafetyNotice } from "@/components/safety-notice";
import { Button, ErrorBlock, PageHeader, cardClass, fieldClass } from "@/components/ui";

const PROMPTS = [
  "I'm overwhelmed by schoolwork.",
  "Help me reflect on my day.",
  "I feel stressed and need a moment.",
  "Help me figure out one small next step.",
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
  error?: CompanionFailure | { message: string; tool: null };
};

export function AgentChat({ model, fallback }: { model: string; fallback: string | null }) {
  const fieldId = useId();
  const [turns, setTurns] = useState<Turn[]>([]);
  const [draft, setDraft] = useState("");
  const [pending, setPending] = useState(false);
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

  async function send(text: string) {
    const message = text.trim();
    if (!message || pending) return;
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
            turn.id === id
              ? { ...turn, pending: false, error: { message: "The companion returned an unexpected response.", tool: null } }
              : turn,
          ),
        );
        return;
      }
      setTurns((current) =>
        current.map((turn) =>
          turn.id === id
            ? body.ok
              ? { ...turn, pending: false, reply: body }
              : { ...turn, pending: false, error: body }
            : turn,
        ),
      );
    } catch {
      if (!aliveRef.current) return;
      setTurns((current) =>
        current.map((turn) =>
          turn.id === id
            ? {
                ...turn,
                pending: false,
                error: { message: "The companion could not be reached. No model reply was received.", tool: null },
              }
            : turn,
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

  return (
    <div className="space-y-8">
      <PageHeader eyebrow="AI Companion" title="A moment of support">
        <p>
          {fallback
            ? `Replies come from the Groq model (${model}). If Groq cannot take the request, the same message is sent to Gemini (${fallback}) instead. Sending a message sends that text, and recent model replies in this chat, to whichever of those providers answers.`
            : `Replies on this page come from the configured Groq model (${model}). Sending a message sends that text, and recent model replies in this chat, to Groq.`}{" "}
          Photos and saved journal entries are not included.
        </p>
        <p>
          awarely.ai is a wellness and reflection tool. It is not a therapist, a diagnosis, or an emergency service, and
          it cannot monitor you or send help. The chat stays on this page until you clear it. It is not saved.
        </p>
      </PageHeader>

      <div className={`${cardClass} flex min-h-[32rem] flex-col`}>
        <div className="flex-1 space-y-4 p-4 sm:p-6" aria-live="polite" aria-relevant="additions">
          {turns.length === 0 ? (
            <p className="leading-relaxed text-muted">
              Write what would help, or choose a prompt. Replies stay short and ask one question at a time. If a tool
              runs, its name and status appear with the reply.
            </p>
          ) : null}
          <ol className="space-y-4">
            {turns.map((turn) => (
              <li key={turn.id} className="space-y-3">
                <div className="flex justify-end">
                  <div className="max-w-[40rem] rounded-[1.5rem] bg-inverse px-4 py-3 text-inverse-text">
                    <p className="text-xs font-medium uppercase tracking-[0.14em] opacity-80">You</p>
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

        <form onSubmit={onSubmit} className="border-t border-line p-4 sm:p-6">
          <p className="text-sm font-medium text-foreground">Suggested prompts</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {PROMPTS.map((prompt) => (
              <Button key={prompt} variant="secondary" disabled={pending} onClick={() => void send(prompt)}>
                {prompt}
              </Button>
            ))}
          </div>
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
            className={`${fieldClass} mt-2 min-h-24`}
            placeholder="What would help right now?"
          />
          <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-muted">
              {draft.length} / {COMPANION_NOTE_LIMIT}. Enter sends. Shift Enter adds a line.
            </p>
            <div className="flex gap-2">
              <Button type="submit" disabled={pending || !draft.trim()}>
                {pending ? "Sending…" : "Send"}
              </Button>
              <Button
                variant="quiet"
                disabled={pending || turns.length === 0}
                onClick={() => {
                  setTurns([]);
                }}
              >
                Clear chat
              </Button>
            </div>
          </div>
        </form>
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
    <article className={`max-w-[42rem] rounded-[1.5rem] px-4 py-4 ${safety ? "bg-blush text-blush-text" : "bg-sage text-sage-text"}`}>
      <p className="text-xs font-medium uppercase tracking-[0.14em]">
        {reply.source === "safety" ? "Fixed safety notice" : reply.provider === "gemini" ? "Gemini reply" : "Model reply"}
      </p>
      <p className="journal-text mt-2 whitespace-pre-wrap leading-relaxed">{reply.message}</p>
      {reply.safety ? (
        <SafetyNotice prominent={reply.safety.level === "clear"} immediateDanger={reply.safety.immediateDanger} />
      ) : null}
      {reply.source === "model" ? (
        reply.tool ? (
          <ToolCard tool={reply.tool} />
        ) : (
          <p className="mt-3 text-xs">No tool was used for this reply.</p>
        )
      ) : null}
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
