"use client";

import Link from "next/link";
import { useEffect, useId, useState } from "react";
import type { FormEvent } from "react";
import { useAuth } from "@/components/auth-provider";
import { CustomFeelingField } from "@/components/custom-feeling";
import { Button, EmptyBlock, ErrorBlock, LoadingBlock, buttonClass, cardClass, fieldClass } from "@/components/ui";
import {
  createAccountEntry,
  deleteAccountEntry,
  listAccountEntries,
  updateAccountEntry,
} from "@/lib/account-journal";
import type { AccountEntry } from "@/lib/account-journal";
import { entryFeelings, formatWhen } from "@/lib/format";
import { ImagePrepError, imageFileToJpegBlob } from "@/lib/images";
import { MOODS, REFLECTION_LIMIT } from "@/lib/types";
import type { MoodId } from "@/lib/types";

type Draft = {
  text: string;
  mood: MoodId | null;
  custom: string | null;
  file: File | null;
  skipPhoto: boolean;
  removePhoto: boolean;
};

const emptyDraft: Draft = { text: "", mood: null, custom: null, file: null, skipPhoto: false, removePhoto: false };

export function AccountTimeline() {
  const auth = useAuth();
  const [entries, setEntries] = useState<AccountEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [moodFilter, setMoodFilter] = useState<MoodId | "all">("all");
  const [dateFilter, setDateFilter] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<AccountEntry | null>(null);
  const [prompt, setPrompt] = useState("");
  const [promptSource, setPromptSource] = useState("");
  const [promptLoading, setPromptLoading] = useState(true);

  async function refresh() {
    if (auth.status !== "signed-in") {
      setEntries([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const result = await listAccountEntries();
    setLoading(false);
    if (!result.ok) {
      setError(result.message);
      setEntries([]);
      return;
    }
    setError("");
    setEntries(result.value);
  }

  useEffect(() => {
    if (auth.status === "loading") return;
    let current = true;
    void (async () => {
      if (auth.status !== "signed-in") {
        if (!current) return;
        setEntries([]);
        setLoading(false);
        return;
      }
      setLoading(true);
      const result = await listAccountEntries();
      if (!current) return;
      setLoading(false);
      if (!result.ok) {
        setError(result.message);
        setEntries([]);
        return;
      }
      setError("");
      setEntries(result.value);
    })();
    return () => {
      current = false;
    };
  }, [auth.status, auth.user?.id]);

  useEffect(() => {
    const controller = new AbortController();
    setPromptLoading(true);
    fetch("/api/journal-prompt", { signal: controller.signal })
      .then(async (response) => {
        const body: unknown = await response.json();
        if (!response.ok || !isPrompt(body)) throw new Error("prompt");
        setPrompt(body.prompt);
        setPromptSource(body.source);
      })
      .catch((reason: unknown) => {
        if (isAbort(reason)) return;
        setPrompt("What is one small thing from today that you want to remember?");
        setPromptSource("fallback");
      })
      .finally(() => {
        if (!controller.signal.aborted) setPromptLoading(false);
      });
    return () => controller.abort();
  }, []);

  const visible = entries.filter((entry) => {
    if (moodFilter !== "all" && entry.mood !== moodFilter) return false;
    if (!dateFilter) return true;
    return localDay(entry.createdAt) === dateFilter;
  });
  const selected = entries.find((entry) => entry.id === selectedId) ?? null;

  function saved(entry: AccountEntry) {
    setEntries((current) => [entry, ...current.filter((item) => item.id !== entry.id)].sort(newestFirst));
    setSelectedId(entry.id);
    setEditing(false);
    setError("");
  }

  return (
    <div className="space-y-10">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-medium uppercase tracking-[0.18em] text-accent-text">Timeline</p>
          <h1 className="mt-3 font-serif text-4xl text-foreground sm:text-5xl">Your Timeline</h1>
          <p className="mt-3 max-w-2xl leading-relaxed text-muted">
            Moments you save here stay with your account. Newest entries are first. Photos are stored privately and shown
            with a temporary link.
          </p>
        </div>
        <a href="#capture-moment" className={buttonClass("primary")}>
          Capture This Moment
        </a>
      </header>

      {auth.status === "loading" || (auth.status === "signed-in" && loading) ? (
        <LoadingBlock label="Opening your timeline." />
      ) : null}
      {error ? (
        <ErrorBlock title="The timeline could not be loaded" message={error}>
          <Button onClick={() => void refresh()}>Try again</Button>
        </ErrorBlock>
      ) : null}

      {auth.status === "anonymous" ? (
        <EmptyBlock
          title="Sign in to keep a timeline"
          message="Entries saved here belong to your account, so they stay after you log out, refresh, or open awarely.ai on another device."
        >
          <Link href="/login" className={buttonClass("primary")}>
            Log in
          </Link>
          <Link href="/signup" className={buttonClass("secondary")}>
            Sign up
          </Link>
        </EmptyBlock>
      ) : null}

      {auth.status === "signed-in" && !loading && !error && entries.length === 0 ? (
        <EmptyBlock
          title="Your timeline is waiting"
          message="This is a quiet place for the moments you choose to keep. Start with one photo, or skip the photo and write a few words."
        >
          <a href="#capture-moment" className={buttonClass("primary")}>
            Create your first entry
          </a>
        </EmptyBlock>
      ) : null}

      {auth.status === "signed-in" && entries.length > 0 ? (
        <section aria-labelledby="saved-moments" className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <h2 id="saved-moments" className="font-serif text-3xl text-foreground">
              Saved moments
            </h2>
            <p className="text-sm text-muted">
              {visible.length} of {entries.length} shown
            </p>
          </div>
          <Filters mood={moodFilter} date={dateFilter} onMood={setMoodFilter} onDate={setDateFilter} onClear={() => {
            setMoodFilter("all");
            setDateFilter("");
          }} />
          {visible.length === 0 ? (
            <p className="rounded-2xl bg-accent px-4 py-3 text-sm text-accent-text" role="status">
              No entries match those filters.
            </p>
          ) : (
            <ul className="grid gap-4 min-[600px]:grid-cols-2">
              {visible.map((entry) => (
                <li key={entry.id}>
                  <EntryCard entry={entry} onOpen={() => { setSelectedId(entry.id); setEditing(false); }} />
                </li>
              ))}
            </ul>
          )}
          {selected ? (
            <EntryDetail
              entry={selected}
              editing={editing}
              onEdit={() => setEditing(true)}
              onClose={() => { setSelectedId(null); setEditing(false); }}
              onCancelEdit={() => setEditing(false)}
              onSaved={saved}
              onAskDelete={() => setPendingDelete(selected)}
            />
          ) : null}
        </section>
      ) : null}

      <section id="capture-moment" className="space-y-4 scroll-mt-24">
        <PromptLine prompt={prompt} source={promptSource} loading={promptLoading} onRefresh={() => {
          setPromptLoading(true);
          void fetch("/api/journal-prompt")
            .then(async (response) => {
              const body: unknown = await response.json();
              if (!isPrompt(body)) throw new Error("prompt");
              setPrompt(body.prompt);
              setPromptSource(body.source);
            })
            .catch(() => {
              setPrompt("Which ordinary detail around you feels worth keeping?");
              setPromptSource("fallback");
            })
            .finally(() => setPromptLoading(false));
        }} />
        <CaptureForm
          signedIn={auth.status === "signed-in"}
          onSaved={(entry) => {
            saved(entry);
            document.getElementById("saved-moments")?.scrollIntoView({ behavior: "smooth", block: "start" });
          }}
        />
      </section>

      {pendingDelete ? (
        <ConfirmDelete
          entry={pendingDelete}
          onCancel={() => setPendingDelete(null)}
          onDeleted={() => {
            setEntries((current) => current.filter((item) => item.id !== pendingDelete.id));
            if (selectedId === pendingDelete.id) setSelectedId(null);
            setPendingDelete(null);
          }}
        />
      ) : null}
    </div>
  );
}

function Filters({
  mood,
  date,
  onMood,
  onDate,
  onClear,
}: {
  mood: MoodId | "all";
  date: string;
  onMood: (mood: MoodId | "all") => void;
  onDate: (date: string) => void;
  onClear: () => void;
}) {
  return (
    <div className={`${cardClass} grid gap-3 p-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end`}>
      <label className="text-sm font-medium text-foreground">
        Mood
        <select
          value={mood}
          onChange={(event) => onMood(moodChoice(event.target.value))}
          className={`${fieldClass} mt-2`}
        >
          <option value="all">All moods</option>
          {MOODS.map((item) => (
            <option key={item.id} value={item.id}>
              {item.label}
            </option>
          ))}
        </select>
      </label>
      <label className="text-sm font-medium text-foreground">
        Date
        <input type="date" value={date} onChange={(event) => onDate(event.target.value)} className={`${fieldClass} mt-2`} />
      </label>
      <Button variant="secondary" onClick={onClear}>
        Clear filters
      </Button>
    </div>
  );
}

function EntryCard({ entry, onOpen }: { entry: AccountEntry; onOpen: () => void }) {
  return (
    <article className={`${cardClass} overflow-hidden p-4`}>
      <Photo entry={entry} />
      <h3 className="mt-4 font-serif text-2xl text-foreground">{formatWhen(entry.createdAt)}</h3>
      <p className="mt-2 text-sm text-muted">{entryFeelings(entry.mood, entry.customFeeling)}</p>
      <p className="journal-text mt-3 line-clamp-4 leading-relaxed text-foreground">{entry.journalText}</p>
      <Button variant="secondary" className="mt-4" onClick={onOpen}>
        Open entry
      </Button>
    </article>
  );
}

function EntryDetail({
  entry,
  editing,
  onEdit,
  onClose,
  onCancelEdit,
  onSaved,
  onAskDelete,
}: {
  entry: AccountEntry;
  editing: boolean;
  onEdit: () => void;
  onClose: () => void;
  onCancelEdit: () => void;
  onSaved: (entry: AccountEntry) => void;
  onAskDelete: () => void;
}) {
  return (
    <section aria-labelledby="entry-detail" className={`${cardClass} p-5 sm:p-6`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <h2 id="entry-detail" className="font-serif text-3xl text-foreground">
          {formatWhen(entry.createdAt)}
        </h2>
        <Button variant="quiet" onClick={onClose}>
          Close
        </Button>
      </div>
      {editing ? (
        <EntryEditor entry={entry} onCancel={onCancelEdit} onSaved={onSaved} />
      ) : (
        <div className="mt-4 space-y-4">
          <Photo entry={entry} />
          <p className="text-sm text-muted">{entryFeelings(entry.mood, entry.customFeeling)}</p>
          <p className="journal-text text-lg leading-relaxed text-foreground">{entry.journalText}</p>
          <div className="flex flex-wrap gap-2">
            <Button onClick={onEdit}>Edit entry</Button>
            <Button variant="danger" onClick={onAskDelete}>
              Delete entry
            </Button>
          </div>
        </div>
      )}
    </section>
  );
}

function EntryEditor({
  entry,
  onCancel,
  onSaved,
}: {
  entry: AccountEntry;
  onCancel: () => void;
  onSaved: (entry: AccountEntry) => void;
}) {
  return (
    <EntryFields
      initial={{
        text: entry.journalText,
        mood: entry.mood,
        custom: entry.customFeeling,
        file: null,
        skipPhoto: !entry.photoPath,
        removePhoto: false,
      }}
      existing={entry}
      submitLabel="Save changes"
      onCancel={onCancel}
      onSubmit={async (draft, onProgress) => {
        const photo = draft.file ? await imageFileToJpegBlob(draft.file) : null;
        return updateAccountEntry({
          entry,
          journalText: draft.text,
          mood: draft.mood,
          customFeeling: draft.custom,
          photo,
          removePhoto: draft.removePhoto && !draft.file,
          onProgress,
        });
      }}
      onSaved={onSaved}
    />
  );
}

function CaptureForm({ signedIn, onSaved }: { signedIn: boolean; onSaved: (entry: AccountEntry) => void }) {
  return (
    <div className={`${cardClass} p-5 sm:p-8`}>
      <h2 className="font-serif text-3xl text-foreground">Capture This Moment</h2>
      <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted">
        Add a photo or skip it, write what stands out, and choose a mood if you want one. The date and time are saved
        for you.
      </p>
      {signedIn ? null : (
        <p className="mt-4 text-sm text-muted">
          <Link className="font-medium text-accent-text underline decoration-line underline-offset-4" href="/login">
            Log in
          </Link>{" "}
          before saving. The words stay in this form until you do.
        </p>
      )}
      <EntryFields
        initial={emptyDraft}
        existing={null}
        submitLabel="Save Entry"
        onSubmit={async (draft, onProgress) => {
          if (!draft.file && !draft.skipPhoto) {
            return { ok: false, message: "Add a photo, or choose Skip photo." };
          }
          const photo = draft.file ? await imageFileToJpegBlob(draft.file) : null;
          return createAccountEntry({
            journalText: draft.text,
            mood: draft.mood,
            customFeeling: draft.custom,
            photo,
            onProgress,
          });
        }}
        onSaved={onSaved}
      />
    </div>
  );
}

function EntryFields({
  initial,
  existing,
  submitLabel,
  onCancel,
  onSubmit,
  onSaved,
}: {
  initial: Draft;
  existing: AccountEntry | null;
  submitLabel: string;
  onCancel?: () => void;
  onSubmit: (draft: Draft, onProgress: (label: string) => void) => Promise<{ ok: true; value: AccountEntry } | { ok: false; message: string }>;
  onSaved: (entry: AccountEntry) => void;
}) {
  const fieldId = useId();
  const [draft, setDraft] = useState<Draft>(initial);
  const [progress, setProgress] = useState("");
  const [error, setError] = useState("");

  async function onFormSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (progress) return;
    setError("");
    setProgress("Preparing entry…");
    try {
      const result = await onSubmit(draft, setProgress);
      if (!result.ok) {
        setError(result.message);
        setProgress("");
        return;
      }
      setProgress("");
      event.currentTarget.reset();
      setDraft(emptyDraft);
      onSaved(result.value);
    } catch (reason) {
      setProgress("");
      setError(reason instanceof ImagePrepError ? reason.message : "That photo could not be prepared. Try another image.");
    }
  }

  return (
    <form className="mt-5 space-y-4" onSubmit={(event) => void onFormSubmit(event)}>
      <div>
        <label htmlFor={`${fieldId}-photo`} className="text-sm font-medium text-foreground">
          Photo
        </label>
        <input
          id={`${fieldId}-photo`}
          type="file"
          accept="image/*"
          className={`${fieldClass} mt-2`}
          onChange={(event) => {
            const file = event.target.files?.[0] ?? null;
            setDraft((current) => ({ ...current, file, skipPhoto: false, removePhoto: false }));
          }}
        />
        <label className="mt-3 flex min-h-11 items-center gap-2 text-sm text-foreground">
          <input
            type="checkbox"
            checked={draft.skipPhoto && !draft.file}
            onChange={(event) => setDraft((current) => ({ ...current, skipPhoto: event.target.checked, file: null, removePhoto: event.target.checked }))}
          />
          Skip photo
        </label>
        {existing?.photoPath && !draft.file && !draft.removePhoto ? (
          <p className="mt-2 text-sm text-muted">The current photo stays unless you replace it or skip the photo.</p>
        ) : null}
      </div>
      <div>
        <label htmlFor={`${fieldId}-text`} className="text-sm font-medium text-foreground">
          Journal entry
        </label>
        <textarea
          id={`${fieldId}-text`}
          required
          maxLength={REFLECTION_LIMIT}
          value={draft.text}
          onChange={(event) => setDraft((current) => ({ ...current, text: event.target.value }))}
          className={`${fieldClass} mt-2 min-h-32`}
        />
        <p className="mt-2 text-sm text-muted">
          {draft.text.length} / {REFLECTION_LIMIT}
        </p>
      </div>
      <fieldset>
        <legend className="text-sm font-medium text-foreground">Mood</legend>
        <div className="mt-2 flex flex-wrap gap-2">
          <MoodButton pressed={draft.mood === null} onClick={() => setDraft((current) => ({ ...current, mood: null }))}>
            No label
          </MoodButton>
          {MOODS.map((mood) => (
            <MoodButton
              key={mood.id}
              pressed={draft.mood === mood.id}
              onClick={() => setDraft((current) => ({ ...current, mood: current.mood === mood.id ? null : mood.id }))}
            >
              {mood.label}
            </MoodButton>
          ))}
          <MoodButton
            pressed={draft.custom !== null}
            onClick={() => setDraft((current) => ({ ...current, custom: current.custom === null ? "" : null }))}
          >
            Other
          </MoodButton>
        </div>
      </fieldset>
      {draft.custom !== null ? (
        <CustomFeelingField
          id={`${fieldId}-feeling`}
          value={draft.custom}
          onChange={(custom) => setDraft((current) => ({ ...current, custom }))}
          onClear={() => setDraft((current) => ({ ...current, custom: null }))}
        />
      ) : null}
      {error ? (
        <p className="text-sm text-danger" role="alert">
          {error}
        </p>
      ) : null}
      {progress ? (
        <div role="status" aria-live="polite">
          <p className="text-sm font-medium text-foreground">{progress}</p>
          <progress className="mt-2 w-full" />
        </div>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={Boolean(progress)}>
          {progress ? "Saving…" : submitLabel}
        </Button>
        {onCancel ? (
          <Button variant="secondary" onClick={onCancel} disabled={Boolean(progress)}>
            Cancel
          </Button>
        ) : null}
      </div>
    </form>
  );
}

function ConfirmDelete({
  entry,
  onCancel,
  onDeleted,
}: {
  entry: AccountEntry;
  onCancel: () => void;
  onDeleted: () => void;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const titleId = useId();

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape" && !pending) onCancel();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel, pending]);

  return (
    <div className="fixed inset-0 z-40 grid place-items-center bg-black/50 p-4" role="presentation">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={`${cardClass} w-full max-w-md p-6`}
      >
        <h2 id={titleId} className="font-serif text-3xl text-foreground">
          Delete this entry?
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-muted">
          {formatWhen(entry.createdAt)} will be removed from your account, including its photo. This cannot be undone.
        </p>
        {error ? (
          <p className="mt-3 text-sm text-danger" role="alert">
            {error}
          </p>
        ) : null}
        <div className="mt-5 flex flex-wrap gap-2">
          <Button
            variant="danger"
            disabled={pending}
            onClick={() => {
              setPending(true);
              void deleteAccountEntry(entry).then((result) => {
                setPending(false);
                if (!result.ok) {
                  setError(result.message);
                  return;
                }
                onDeleted();
              });
            }}
          >
            {pending ? "Deleting…" : "Delete entry"}
          </Button>
          <Button variant="secondary" onClick={onCancel} disabled={pending}>
            Keep it
          </Button>
        </div>
      </div>
    </div>
  );
}

function PromptLine({
  prompt,
  source,
  loading,
  onRefresh,
}: {
  prompt: string;
  source: string;
  loading: boolean;
  onRefresh: () => void;
}) {
  return (
    <div className="rounded-[1.75rem] bg-sage px-5 py-4 text-sage-text">
      <p className="text-xs font-medium uppercase tracking-[0.16em]">A prompt for this moment</p>
      <p className="mt-2 font-serif text-2xl leading-snug" role="status">
        {loading ? "Finding a prompt…" : prompt}
      </p>
      {loading ? null : (
        <p className="mt-2 text-sm">
          {source === "fallback"
            ? "A prepared prompt, because the model is not replying."
            : "A short prompt from the companion model."}
        </p>
      )}
      <Button variant="secondary" className="mt-3" onClick={onRefresh} disabled={loading}>
        {loading ? "Asking…" : "Another prompt"}
      </Button>
    </div>
  );
}

function Photo({ entry }: { entry: AccountEntry }) {
  if (!entry.photoUrl) {
    return <div className="grid h-36 place-items-center rounded-[1.25rem] bg-accent text-sm text-accent-text">No photo</div>;
  }
  return (
    <img src={entry.photoUrl} alt="Photo saved with this entry" className="max-h-80 w-full rounded-[1.25rem] bg-camera object-contain" />
  );
}

function MoodButton({ pressed, onClick, children }: { pressed: boolean; onClick: () => void; children: string }) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onClick}
      className={`min-h-11 rounded-full px-4 text-sm font-medium ${pressed ? "bg-inverse text-inverse-text" : "border border-line bg-card text-foreground"}`}
    >
      {children}
    </button>
  );
}

function moodChoice(value: string): MoodId | "all" {
  if (value === "all") return "all";
  const match = MOODS.find((mood) => mood.id === value);
  return match ? match.id : "all";
}

function newestFirst(a: AccountEntry, b: AccountEntry): number {
  return a.createdAt < b.createdAt ? 1 : -1;
}

function localDay(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

function isPrompt(value: unknown): value is { prompt: string; source: string } {
  if (!value || typeof value !== "object") return false;
  const body = value as { prompt?: unknown; source?: unknown };
  return typeof body.prompt === "string" && body.prompt.length > 0 && typeof body.source === "string";
}

function isAbort(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}
