"use client";

import Link from "next/link";
import { useJournal } from "@/components/journal-provider";
import { useCompanionStatus } from "@/components/use-companion-status";
import { buttonClass, cardClass, ErrorBlock } from "@/components/ui";
import { CustomFeelingField } from "@/components/custom-feeling";
import { entryFeelings, formatWhen } from "@/lib/format";
import { MOODS } from "@/lib/types";
import type { MoodId } from "@/lib/types";

const STEPS = [
  {
    title: "Capture",
    copy: "Take a photo, upload an image, or skip. The camera is asked for only if you choose it.",
  },
  {
    title: "Reflect",
    copy: "Write what stands out. Add a mood label only if you want one. The label is yours, not a reading of the photo.",
  },
  {
    title: "Revisit",
    copy: "The timeline shows entries you chose to keep for this visit, or on this device after you agree.",
  },
];

export function Dashboard() {
  const { device, entries, draft, setDraft } = useJournal();
  const recent = entries.slice(0, 3);
  const moodCounts = MOODS.map((mood) => ({
    ...mood,
    count: entries.filter((entry) => entry.mood === mood.id).length,
  }));
  const labeled = moodCounts.reduce((sum, mood) => sum + mood.count, 0);
  const customCount = entries.filter((entry) => entry.customFeeling).length;
  const peak = Math.max(1, ...moodCounts.map((mood) => mood.count));

  function chooseMood(id: MoodId) {
    setDraft({ ...draft, mood: draft.mood === id ? null : id });
  }

  return (
    <div className="space-y-12">
      <section className="max-w-3xl">
        <p className="text-sm font-medium uppercase tracking-[0.18em] text-accent-text">Home</p>
        <h1 className="mt-4 font-serif text-4xl leading-[1.05] text-foreground min-[380px]:text-5xl sm:text-6xl">
          Take a moment for yourself.
        </h1>
        <p className="mt-6 text-lg leading-relaxed text-muted">
          A calm place to notice one moment, write what stands out, and keep a visual journal only if you choose.
          Photos stay in this browser. They are not uploaded, and they are not used to guess how you feel.
        </p>
      </section>

      <Link
        href="/capture"
        className={`${cardClass} block bg-accent p-6 motion-safe:transition-transform motion-safe:duration-300 hover:motion-safe:-translate-y-0.5 sm:p-8`}
      >
        <p className="text-sm font-medium uppercase tracking-[0.18em] text-accent-text">Start here</p>
        <h2 className="mt-3 font-serif text-3xl text-foreground min-[380px]:text-4xl sm:text-5xl">Capture This Moment</h2>
        <p className="mt-4 max-w-2xl text-lg leading-relaxed text-muted">
          Take a photo, upload an image, or skip the photo. The camera is requested only when you choose it.
        </p>
        <span className={`${buttonClass("primary", "mt-6")}`}>Open capture</span>
      </Link>

      <section aria-labelledby="mood-checkin-heading" className={`${cardClass} p-6 sm:p-8`}>
        <h2 id="mood-checkin-heading" className="font-serif text-3xl text-foreground">
          Optional mood check-in
        </h2>
        <p className="mt-3 max-w-2xl leading-relaxed text-muted">
          Choose a label if you want one. It stays with this draft and is not saved until you keep a reflection.
          awarely.ai does not pick it for you.
        </p>
        <div className="mt-5 flex flex-wrap gap-2">
          {MOODS.map((mood) => {
            const selected = draft.mood === mood.id;
            return (
              <button
                key={mood.id}
                type="button"
                aria-pressed={selected}
                onClick={() => chooseMood(mood.id)}
                className={`inline-flex min-h-11 items-center rounded-full border px-4 text-sm font-medium ${
                  selected
                    ? "border-transparent bg-accent text-accent-text"
                    : "border-line bg-card text-foreground hover:bg-accent/60"
                }`}
              >
                {mood.label}
              </button>
            );
          })}
          <button
            type="button"
            aria-pressed={draft.customFeeling !== null}
            onClick={() =>
              setDraft({ ...draft, customFeeling: draft.customFeeling === null ? "" : null })
            }
            className={`inline-flex min-h-11 items-center rounded-full border px-4 text-sm font-medium ${
              draft.customFeeling !== null
                ? "border-transparent bg-accent text-accent-text"
                : "border-line bg-card text-foreground hover:bg-accent/60"
            }`}
          >
            Other
          </button>
        </div>
        {draft.customFeeling !== null ? (
          <CustomFeelingField
            id="dashboard-custom-feeling"
            value={draft.customFeeling}
            onChange={(customFeeling) => setDraft({ ...draft, customFeeling })}
            onClear={() => setDraft({ ...draft, customFeeling: null })}
          />
        ) : null}
        <p className="mt-4 text-sm text-muted" aria-live="polite">
          {draftStatus(draft.mood, draft.customFeeling)}
        </p>
        <Link href="/reflect" className={`${buttonClass("secondary", "mt-4")}`}>
          Continue to your reflection
        </Link>
      </section>

      <CompanionShortcut />

      <section aria-labelledby="mood-history-heading" className="space-y-4">
        <h2 id="mood-history-heading" className="font-serif text-3xl text-foreground">
          Mood history
        </h2>
        <p className="max-w-2xl leading-relaxed text-muted">
          Counts only labels you chose on entries you saved. Photos are never read for a mood.
        </p>
        {labeled === 0 ? (
          <p className="leading-relaxed text-muted">
            {customCount === 0
              ? "No mood labels yet. Bars appear after you save an entry with a label."
              : "No preset labels yet. Your own words are listed on each entry."}
          </p>
        ) : (
          <ul className={`${cardClass} space-y-3 p-6`}>
            {moodCounts.map((mood) => (
              <li key={mood.id}>
                <div className="flex items-baseline justify-between gap-3 text-sm">
                  <span className="font-medium text-foreground">{mood.label}</span>
                  <span className="text-muted">{mood.count}</span>
                </div>
                <div className="mt-1 h-2 rounded-full bg-accent" aria-hidden="true">
                  <div
                    className="h-2 rounded-full bg-sage-text/70"
                    style={{ width: `${Math.round((mood.count / peak) * 100)}%` }}
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
        {customCount > 0 ? (
          <p className="text-sm text-muted">
            {customCount} saved {customCount === 1 ? "entry uses" : "entries use"} your own words for a feeling. Those words stay on the entry.
          </p>
        ) : null}
      </section>

      <section aria-labelledby="recent-heading" className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h2 id="recent-heading" className="font-serif text-3xl text-foreground">
            Recent reflections
          </h2>
          <Link className="text-sm font-medium text-accent-text underline decoration-line underline-offset-4" href="/timeline">
            View timeline
          </Link>
        </div>
        {device.status === "error" ? (
          <ErrorBlock title="Device entries are unavailable" message={device.message}>
            <Link href="/privacy" className={buttonClass("secondary")}>
              Review storage
            </Link>
          </ErrorBlock>
        ) : null}
        {recent.length > 0 ? (
          <div className="grid gap-4">
            {recent.map((entry) => (
              <article key={entry.id} className={`${cardClass} p-6`}>
                <p className="text-sm text-muted">{formatWhen(entry.createdAt)}</p>
                <p className="mt-3 journal-text text-lg leading-relaxed text-foreground">{entry.reflection}</p>
                <p className="mt-4 text-sm text-muted">
                  {entryFeelings(entry.mood, entry.customFeeling)}{" "}
                  {entry.storage === "device" ? "Remembered on this device." : "Kept for this visit."}
                </p>
              </article>
            ))}
          </div>
        ) : (
          <p className="leading-relaxed text-muted">
            {device.status === "error"
              ? "Entries kept for this visit will show here. Entries stored on the device stay unread until storage can be opened."
              : "No reflections are kept yet. When you save one, it will show here and on the timeline."}
          </p>
        )}
      </section>

      <section aria-labelledby="steps-heading">
        <h2 id="steps-heading" className="font-serif text-3xl text-foreground">
          A gentle order
        </h2>
        <ol className="mt-5 grid gap-4 min-[600px]:grid-cols-2 lg:grid-cols-3">
          {STEPS.map((step, index) => (
            <li key={step.title} className={`${cardClass} p-5`}>
              <p className="text-sm font-medium text-accent-text">0{index + 1}</p>
              <h3 className="mt-3 font-serif text-2xl text-foreground">{step.title}</h3>
              <p className="mt-2 leading-relaxed text-muted">{step.copy}</p>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}

function draftStatus(mood: MoodId | null, customFeeling: string | null): string {
  const summary = entryFeelings(mood, customFeeling);
  if (summary === "No mood label.") return "No draft label.";
  return `${summary} Not saved yet.`;
}

function CompanionShortcut() {
  const status = useCompanionStatus();
  const detail =
    status.phase === "loading"
      ? "Checking whether a model can reply."
      : status.phase === "error"
        ? "The companion status could not be checked. Prepared exercises stay available and are labeled as such."
        : status.status.available
          ? status.status.fallback
            ? `The companion can reply with ${status.status.model}. If Groq cannot take a request, Gemini (${status.status.fallback}) is used instead. A message you send is shared with that provider. Photos and saved entries are not included.`
            : `The companion can reply with ${status.status.model}. A message you send is shared with Groq. Photos and saved entries are not included.`
          : status.status.reason === "disabled"
            ? "Model calls are turned off. The companion page offers prepared exercises and says they are not AI replies."
            : "The model is not configured. The companion page offers prepared exercises instead of AI replies.";

  return (
    <section aria-labelledby="companion-heading" className={`${cardClass} grid gap-6 p-6 md:grid-cols-[1.4fr_0.8fr] md:p-8`}>
      <div>
        <h2 id="companion-heading" className="font-serif text-3xl text-foreground">
          AI wellness companion
        </h2>
        <p className="mt-3 max-w-xl leading-relaxed text-muted">{detail}</p>
      </div>
      <div className="flex items-end">
        <Link href="/companion" className={buttonClass("secondary", "w-full md:w-auto")}>
          Open the AI companion
        </Link>
      </div>
    </section>
  );
}
