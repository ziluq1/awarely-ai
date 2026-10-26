"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useAuth } from "@/components/auth-provider";
import { useJournal } from "@/components/journal-provider";
import { useCompanionStatus } from "@/components/use-companion-status";
import { buttonClass, cardClass, ErrorBlock } from "@/components/ui";
import { listPhotoTimes, listSavedMoods } from "@/lib/account-journal";
import type { SavedMood } from "@/lib/account-journal";
import { photoStreak } from "@/lib/streak";
import { entryFeelings, formatWhen } from "@/lib/format";
import { MOODS } from "@/lib/types";
import type { JournalEntry } from "@/lib/types";

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
  const auth = useAuth();
  const { device, entries } = useJournal();
  const recent = entries.slice(0, 3);
  const [accountMoods, setAccountMoods] = useState<SavedMood[]>([]);
  const [photoTimes, setPhotoTimes] = useState<string[]>([]);
  const [moodNote, setMoodNote] = useState("");
  const [moodLoading, setMoodLoading] = useState(false);
  const [streakLoading, setStreakLoading] = useState(false);
  const history = moodHistory(entries, auth.status === "signed-in" && auth.verified ? accountMoods : []);
  const savedMoods = history.moods.filter((mood) => mood.count > 0);
  const labeled = savedMoods.reduce((sum, mood) => sum + mood.count, 0);
  const peak = Math.max(1, ...savedMoods.map((mood) => mood.count));

  useEffect(() => {
    let alive = true;
    if (auth.status === "loading") {
      return () => {
        alive = false;
      };
    }
    if (auth.status !== "signed-in" || !auth.verified) {
      queueMicrotask(() => {
        if (!alive) return;
        setAccountMoods([]);
        setPhotoTimes([]);
        setMoodNote("");
        setMoodLoading(false);
        setStreakLoading(false);
      });
      return () => {
        alive = false;
      };
    }
    queueMicrotask(() => {
      if (!alive) return;
      setMoodLoading(true);
      setStreakLoading(true);
    });
    listSavedMoods().then((result) => {
      if (!alive) return;
      setMoodLoading(false);
      if (!result.ok) {
        setAccountMoods([]);
        setMoodNote(result.message);
        return;
      }
      setAccountMoods(result.value);
      setMoodNote("");
    });
    listPhotoTimes().then((result) => {
      if (!alive) return;
      setStreakLoading(false);
      if (!result.ok) {
        setPhotoTimes([]);
        return;
      }
      setPhotoTimes(result.value);
    });
    return () => {
      alive = false;
    };
  }, [auth.status, auth.verified, auth.user?.id]);

  return (
    <div className="space-y-12">
      <section className="max-w-3xl">
        <p className="text-sm font-medium uppercase tracking-[0.18em] text-accent-text">Home</p>
        <h1 className="mt-4 text-balance font-serif text-4xl leading-[1.05] text-foreground sm:text-5xl lg:text-6xl">
          Take a moment for yourself.
        </h1>
        <p className="mt-6 text-lg leading-relaxed text-muted">
          A calm place to notice one moment, write what stands out, and keep a visual journal only if you choose.
          Photos are not used to guess how you feel. A signed-in save stores a photo privately with your account timeline.
        </p>
      </section>

      <div className="grid gap-4 min-[760px]:grid-cols-2">
        <Link
          href="/capture"
          className={`${cardClass} flex aspect-square min-w-0 flex-col bg-accent p-6 motion-safe:transition-transform motion-safe:duration-300 hover:motion-safe:-translate-y-0.5 sm:p-8`}
        >
          <p className="text-sm font-medium uppercase tracking-[0.18em] text-accent-text">Start here</p>
          <h2 className="mt-3 font-serif text-3xl text-foreground sm:text-4xl">Capture This Moment</h2>
          <p className="mt-4 text-base leading-relaxed text-muted">
            Take a photo, upload an image, or skip the photo. The camera is requested only when you choose it.
          </p>
          <span className={`${buttonClass("primary", "mt-auto")}`}>Open capture</span>
        </Link>
        <PhotoStreak
          count={photoStreak([
            ...photoTimes,
            ...entries.filter((entry) => entry.photoDataUrl).map((entry) => entry.createdAt),
          ])}
          loading={streakLoading || auth.status === "loading"}
        />
      </div>

      <CompanionShortcut />

      <section aria-labelledby="mood-history-heading" className="space-y-4">
        <h2 id="mood-history-heading" className="font-serif text-3xl text-foreground">
          Mood history
        </h2>
        <p className="max-w-2xl leading-relaxed text-muted">
          Every label you saved on your account or this device. Photos are never read for a mood.
        </p>
        {moodNote ? (
          <p className="rounded-2xl bg-accent px-4 py-3 text-sm text-accent-text" role="status">
            {moodNote}
          </p>
        ) : null}
        {moodLoading ? (
          <p className="leading-relaxed text-muted">Loading saved moods.</p>
        ) : labeled === 0 && history.customs.length === 0 ? (
          <p className="leading-relaxed text-muted">No mood labels yet. Bars appear after you save an entry with a label.</p>
        ) : (
          <ul className={`${cardClass} space-y-3 p-6`}>
            {savedMoods.map((mood) => (
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
            {history.customs.map((feeling) => (
              <li key={feeling.text}>
                <div className="flex items-baseline justify-between gap-3 text-sm">
                  <span className="font-medium text-foreground">{feeling.text}</span>
                  <span className="text-muted">{feeling.count}</span>
                </div>
              </li>
            ))}
          </ul>
        )}
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

function moodHistory(local: JournalEntry[], account: SavedMood[]) {
  const counts = new Map<string, { id: string; label: string; count: number }>();
  for (const mood of MOODS) counts.set(mood.id, { id: mood.id, label: mood.label, count: 0 });
  const customs = new Map<string, number>();

  function addMood(mood: string | null) {
    if (!mood) return;
    const known = counts.get(mood);
    if (known) {
      known.count += 1;
      return;
    }
    const label = mood === "tender" ? "Tender" : mood;
    counts.set(mood, { id: mood, label, count: 1 });
  }

  function addCustom(feeling: string | null) {
    const text = feeling?.trim();
    if (!text) return;
    customs.set(text, (customs.get(text) ?? 0) + 1);
  }

  for (const entry of account) {
    addMood(entry.mood);
    addCustom(entry.customFeeling);
  }
  for (const entry of local) {
    if (account.some((saved) => sameSavedMoment(entry, saved))) continue;
    addMood(entry.mood);
    addCustom(entry.customFeeling);
  }

  return {
    moods: [...counts.values()],
    customs: [...customs.entries()].map(([text, count]) => ({ text, count })),
  };
}

function sameSavedMoment(local: JournalEntry, saved: SavedMood): boolean {
  if (local.reflection.trim() !== saved.journalText.trim()) return false;
  if ((local.mood ?? null) !== saved.mood) return false;
  if ((local.customFeeling?.trim() || null) !== saved.customFeeling) return false;
  const localTime = Date.parse(local.createdAt);
  const savedTime = Date.parse(saved.createdAt);
  if (Number.isNaN(localTime) || Number.isNaN(savedTime)) return false;
  return Math.abs(localTime - savedTime) < 2 * 60 * 1000;
}

function PhotoStreak({ count, loading }: { count: number; loading: boolean }) {
  return (
    <section
      aria-labelledby="streak-heading"
      className={`${cardClass} flex aspect-square w-full flex-col items-center justify-center p-6 text-center sm:p-8`}
    >
      <h2 id="streak-heading" className="text-sm font-medium uppercase tracking-[0.16em] text-accent-text">
        Photo streak
      </h2>
      <p className="mt-2 font-serif text-5xl leading-none text-foreground">
        {loading ? "…" : count}
      </p>
      <p className="mt-2 text-sm text-muted">{loading ? "" : count === 1 ? "day" : "days"}</p>
      <p className="mt-3 text-xs leading-snug text-muted">Resets after 24 hours with no photo.</p>
    </section>
  );
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
    <section aria-labelledby="companion-heading" className={`${cardClass} p-6 sm:p-8`}>
      <h2 id="companion-heading" className="font-serif text-3xl text-foreground">
        AI wellness companion
      </h2>
      <p className="mt-3 leading-relaxed text-muted">{detail}</p>
      <Link href="/companion" className={buttonClass("secondary", "mt-6 w-full")}>
        Open the AI companion
      </Link>
    </section>
  );
}
