"use client";

import { useEffect, useId, useRef, useState } from "react";
import type { FormEvent } from "react";
import {
  EXERCISES,
  SUGGESTED_QUESTIONS,
  exerciseLabel,
  questionLabel,
  replyForExercise,
  replyForQuestion,
  replyToNote,
} from "@/lib/companion-script";
import type { PreparedReply } from "@/lib/companion-script";
import { createId } from "@/lib/format";
import { COMPANION_NOTE_LIMIT } from "@/lib/types";
import { SafetyNotice } from "@/components/safety-notice";
import { Button, EmptyBlock, ErrorBlock, PageHeader, cardClass, fieldClass } from "@/components/ui";

type GuideMessage = {
  id: string;
  role: "guide";
  prompt: string;
  reply: PreparedReply;
};

type UserMessage = {
  id: string;
  role: "user";
  text: string;
};

type ChatMessage = GuideMessage | UserMessage;

const UNAVAILABLE = {
  disabled:
    "Demo mode. The AI companion is unavailable because MODEL_CALLS_ENABLED is not true. The exercises below were written in advance. They are not replies from a language model.",
  unconfigured:
    "Demo mode. The AI companion is unavailable because GROQ_API_KEY or GROQ_MODEL is not configured. The exercises below were written in advance. They are not replies from a language model.",
  unknown:
    "Demo mode. The AI companion status could not be checked, so no model is being used. The exercises below were written in advance. They are not replies from a language model.",
} as const;

export function CompanionChat({ unavailable = "disabled" }: { unavailable?: keyof typeof UNAVAILABLE }) {
  const noteId = useId();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [note, setNote] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [failedNote, setFailedNote] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const requestRef = useRef(0);
  const retryRef = useRef<null | { prompt: string; produce: () => PreparedReply }>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "nearest" });
  }, [messages, pending, error]);

  function appendGuide(prompt: string, reply: PreparedReply) {
    setMessages((current) => {
      const next = [
        ...current,
        { id: createId(), role: "user" as const, text: prompt },
        { id: createId(), role: "guide" as const, prompt, reply },
      ];
      return next.length > 40 ? next.slice(next.length - 40) : next;
    });
  }

  function earlierNotes(): string[] {
    return messages.filter((message) => message.role === "user").map((message) => message.text);
  }

  function openPrepared(prompt: string, produce: () => PreparedReply) {
    if (pending) return;
    const requestId = requestRef.current + 1;
    requestRef.current = requestId;
    retryRef.current = { prompt, produce };
    setError(null);
    setFailedNote(null);
    setPending(true);
    window.setTimeout(() => {
      if (requestId !== requestRef.current) return;
      try {
        appendGuide(prompt, produce());
        setPending(false);
      } catch (caught) {
        setPending(false);
        setFailedNote(prompt);
        setError(caught instanceof Error ? caught.message : "That prompt could not be opened.");
      }
    }, 280);
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const text = note.trim();
    if (!text) {
      setError("Write a note or choose a suggestion first.");
      setFailedNote(null);
      return;
    }
    setNote("");
    const prior = earlierNotes();
    openPrepared(text, () => replyToNote(text, prior));
  }

  return (
    <div className="space-y-8">
      <PageHeader eyebrow="AI Companion" title="Demo mode">
        <p>{UNAVAILABLE[unavailable]}</p>
        <p>
          These prompts cannot see your photos, assess your feelings, or offer a diagnosis. The conversation stays on
          this page until you leave or clear it. It is not saved.
        </p>
      </PageHeader>

      <div className="rounded-2xl bg-accent px-4 py-3 text-sm leading-relaxed text-accent-text" role="note">
        Demo mode. Every response below was written in advance. awarely.ai is not chatting with you through an AI model,
        and it cannot monitor you or contact emergency services.
      </div>

      <div className={`${cardClass} flex min-h-[32rem] flex-col`}>
        <div className="flex-1 space-y-4 p-4 sm:p-6" aria-live="polite" aria-relevant="additions">
          {messages.length === 0 && !pending ? (
            <EmptyBlock
              title="Choose a place to begin"
              message="Pick a reflection question or a wellness exercise. You can also write a short note. The reply will be a prepared prompt, not a generated answer."
            />
          ) : null}
          <ol className="space-y-4">
            {messages.map((message) =>
              message.role === "user" ? (
                <li key={message.id} className="flex justify-end">
                  <div className="max-w-[40rem] rounded-[1.5rem] bg-inverse px-4 py-3 text-inverse-text">
                    <p className="text-xs font-medium uppercase tracking-[0.14em] opacity-80">You</p>
                    <p className="journal-text mt-1 leading-relaxed">{message.text}</p>
                  </div>
                </li>
              ) : (
                <li key={message.id} className="max-w-[42rem]">
                  <GuideCard message={message} />
                </li>
              ),
            )}
          </ol>
          {pending ? (
            <p role="status" className="text-sm text-muted">
              Opening a prepared prompt…
            </p>
          ) : null}
          {messages.length >= 40 ? (
            <p className="text-sm text-muted">This page is showing the latest prompts. Earlier ones were not saved.</p>
          ) : null}
          <div ref={endRef} />
        </div>

        {error ? (
          <div className="px-4 pb-4 sm:px-6">
            <ErrorBlock title="That prompt did not open" message={error}>
              {failedNote ? (
                <Button
                  onClick={() => {
                    const retry = retryRef.current;
                    if (retry) openPrepared(retry.prompt, retry.produce);
                  }}
                  disabled={pending}
                >
                  Try again
                </Button>
              ) : null}
            </ErrorBlock>
          </div>
        ) : null}

        <form onSubmit={onSubmit} className="border-t border-line p-4 sm:p-6">
          <div className="space-y-3">
            <div>
              <p className="text-sm font-medium text-foreground">Suggested questions</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {SUGGESTED_QUESTIONS.map((question) => (
                  <Button
                    key={question.id}
                    variant="secondary"
                    disabled={pending}
                    onClick={() => openPrepared(question.label, () => replyForQuestion(question.id))}
                  >
                    {question.label}
                  </Button>
                ))}
              </div>
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">Wellness exercises</p>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                {EXERCISES.map((exercise) => (
                  <button
                    key={exercise.id}
                    type="button"
                    disabled={pending}
                    onClick={() => openPrepared(exercise.label, () => replyForExercise(exercise.id))}
                    className="rounded-2xl border border-line bg-background px-4 py-3 text-left disabled:opacity-50"
                  >
                    <span className="block font-medium text-foreground">{exercise.label}</span>
                    <span className="mt-1 block text-sm leading-relaxed text-muted">{exercise.summary}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
          <label htmlFor={noteId} className="mt-5 block text-sm font-medium text-foreground">
            Or write a note
          </label>
          <textarea
            id={noteId}
            value={note}
            maxLength={COMPANION_NOTE_LIMIT}
            onChange={(event) => setNote(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                event.currentTarget.form?.requestSubmit();
              }
            }}
            className={`${fieldClass} mt-2 min-h-24`}
            placeholder="A detail, a question, or the name of an exercise"
          />
          <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-muted">
              {note.length} / {COMPANION_NOTE_LIMIT}. Enter sends. Shift Enter adds a line.
            </p>
            <div className="flex gap-2">
              <Button type="submit" disabled={pending}>
                {pending ? "Opening…" : "Use this note"}
              </Button>
              <Button
                variant="quiet"
                disabled={pending || messages.length === 0}
                onClick={() => {
                  requestRef.current += 1;
                  setPending(false);
                  setMessages([]);
                  setError(null);
                  setFailedNote(null);
                }}
              >
                Clear practice
              </Button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

function GuideCard({ message }: { message: GuideMessage }) {
  const support = message.reply.kind === "support";
  const clarify = message.reply.kind === "clarify";
  return (
    <article className={`rounded-[1.5rem] px-4 py-4 ${support || clarify ? "bg-blush text-blush-text" : "bg-sage text-sage-text"}`}>
      <p className="text-xs font-medium uppercase tracking-[0.14em]">
        {support ? "Fixed safety notice" : clarify ? "Prepared check-in" : "Prepared prompt"}
      </p>
      <p className="journal-text mt-2 leading-relaxed">{message.reply.body}</p>
      {support ? <SafetyNotice prominent immediateDanger={message.reply.immediateDanger} /> : null}
      {clarify ? <SafetyNotice prominent={false} /> : null}
      {message.reply.steps.length > 0 ? (
        <ol className="mt-3 list-decimal space-y-1 pl-5">
          {message.reply.steps.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
      ) : null}
      {message.reply.exerciseId === "breath" ? <BreathPacer /> : null}
      <p className="mt-3 text-xs">
        {support
          ? "This notice is fixed text, not a personalized assessment."
          : clarify
            ? "Prepared check-in. Not a live AI reply."
            : `Written in advance for “${message.reply.exerciseId ? exerciseLabel(message.reply.exerciseId) : questionTitle(message)}”. Not a live AI reply.`}
      </p>
    </article>
  );
}

function questionTitle(message: GuideMessage): string {
  const match = SUGGESTED_QUESTIONS.find((item) => item.label === message.prompt);
  return match ? questionLabel(match.id) : "your note";
}

function BreathPacer() {
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(false);
  const [cycle, setCycle] = useState(0);
  const [phase, setPhase] = useState<"in" | "out">("in");
  const [count, setCount] = useState(4);

  useEffect(() => {
    if (!running) return;
    const timer = window.setTimeout(() => {
      if (phase === "in") {
        if (count > 1) setCount(count - 1);
        else {
          setPhase("out");
          setCount(6);
        }
        return;
      }
      if (count > 1) {
        setCount(count - 1);
        return;
      }
      if (cycle < 3) {
        setCycle(cycle + 1);
        setPhase("in");
        setCount(4);
        return;
      }
      setRunning(false);
      setDone(true);
    }, 1000);
    return () => window.clearTimeout(timer);
  }, [running, phase, count, cycle]);

  function start() {
    setDone(false);
    setCycle(0);
    setPhase("in");
    setCount(4);
    setRunning(true);
  }

  const spoken = !running ? (done ? "Breathing pace complete." : "Breathing pace is ready.") : phase === "in" ? "Breathe in." : "Breathe out.";

  return (
    <div className="mt-4 rounded-2xl bg-card p-4 text-foreground">
      <p className="text-sm font-medium">Four gentle rounds</p>
      <p className="sr-only" aria-live="polite">
        {spoken} {running ? `Round ${cycle + 1} of 4.` : ""}
      </p>
      <div className="mt-3 flex items-center gap-4">
        <div
          aria-hidden="true"
          className={`grid h-24 w-24 place-items-center rounded-full bg-sage text-2xl font-medium text-sage-text motion-safe:transition-transform ${
            running && phase === "in" ? "motion-safe:scale-110" : ""
          }`}
        >
          {running || done ? count : "4"}
        </div>
        <div>
          <p className="font-serif text-2xl">{running ? (phase === "in" ? "Breathe in" : "Breathe out") : done ? "Done" : "Ready"}</p>
          <p className="text-sm text-muted">{running ? `Round ${cycle + 1} of 4` : "Stop whenever you want."}</p>
        </div>
      </div>
      <div className="mt-4 flex gap-2">
        <Button onClick={start} disabled={running}>
          {done ? "Start again" : "Start pace"}
        </Button>
        <Button variant="secondary" onClick={() => setRunning(false)} disabled={!running}>
          Stop
        </Button>
      </div>
    </div>
  );
}
