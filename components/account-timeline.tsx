"use client";

/* eslint-disable @next/next/no-img-element -- Private photo links expire, so these images stay on a plain img. */

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import type { ChangeEvent, FormEvent } from "react";
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
import { entryFeelings, formatDay, formatWhen, moodLabel } from "@/lib/format";
import { ImagePrepError, cameraErrorMessage, dataUrlToJpegBlob, imageFileToJpegBlob, videoFrameToDataUrl } from "@/lib/images";
import { MOODS, REFLECTION_LIMIT } from "@/lib/types";
import type { MoodId } from "@/lib/types";

type Draft = {
  text: string;
  mood: MoodId | null;
  custom: string | null;
  photo: Blob | null;
  previewUrl: string | null;
  skipPhoto: boolean;
  removePhoto: boolean;
};

const emptyDraft: Draft = {
  text: "",
  mood: null,
  custom: null,
  photo: null,
  previewUrl: null,
  skipPhoto: false,
  removePhoto: false,
};

export function AccountTimeline() {
  const auth = useAuth();
  const [entries, setEntries] = useState<AccountEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [photoMessage, setPhotoMessage] = useState("");
  const [moodFilter, setMoodFilter] = useState<MoodId | "all">("all");
  const [dateFilter, setDateFilter] = useState("");
  const [highlightedId, setHighlightedId] = useState<string | null>(null);
  const [lightbox, setLightbox] = useState<AccountEntry | null>(null);
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
      setPhotoMessage("");
      return;
    }
    setError("");
    setEntries(result.value.entries);
    setPhotoMessage(result.value.photoMessage ?? "");
  }

  useEffect(() => {
    if (auth.status === "loading") return;
    let current = true;
    void (async () => {
      if (auth.status !== "signed-in") {
        if (!current) return;
        setEntries([]);
        setLoading(false);
        setPhotoMessage("");
        return;
      }
      setLoading(true);
      const result = await listAccountEntries();
      if (!current) return;
      setLoading(false);
      if (!result.ok) {
        setError(result.message);
        setEntries([]);
        setPhotoMessage("");
        return;
      }
      setError("");
      setEntries(result.value.entries);
      setPhotoMessage(result.value.photoMessage ?? "");
    })();
    return () => {
      current = false;
    };
  }, [auth.status, auth.user?.id]);

  useEffect(() => {
    const controller = new AbortController();
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

  useEffect(() => {
    if (!highlightedId) return;
    const timer = window.setTimeout(() => setHighlightedId(null), 1800);
    return () => window.clearTimeout(timer);
  }, [highlightedId]);

  const visible = entries.filter((entry) => {
    if (moodFilter !== "all" && entry.mood !== moodFilter) return false;
    if (!dateFilter) return true;
    return localDay(entry.createdAt) === dateFilter;
  });
  const photos = visible.filter((entry) => entry.photoUrl);
  const showTimeline = auth.status === "signed-in" && !loading && !error && entries.length > 0;

  function saved(entry: AccountEntry) {
    setEntries((current) => [entry, ...current.filter((item) => item.id !== entry.id)].sort(newestFirst));
    setError("");
    window.setTimeout(() => focusEntry(entry.id), 50);
  }

  function focusEntry(id: string) {
    setHighlightedId(id);
    document.getElementById(`entry-${id}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  return (
    <div className="space-y-10">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-medium uppercase tracking-[0.18em] text-accent-text">Timeline</p>
          <h1 className="mt-3 font-serif text-4xl text-foreground sm:text-5xl">Your Timeline</h1>
          <p className="mt-3 max-w-2xl leading-relaxed text-muted">
            Moments you save here stay with your account. Newest entries are first. Photos stay private and open through a
            temporary link.
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

      {showTimeline ? (
        <>
          {photoMessage ? (
            <ErrorBlock title="A photo could not be opened" message={photoMessage}>
              <Button onClick={() => void refresh()}>Try again</Button>
            </ErrorBlock>
          ) : null}
          <section aria-labelledby="photo-timeline" className="space-y-4">
            <h2 id="photo-timeline" className="font-serif text-3xl text-foreground">
              Photos
            </h2>
            {photos.length === 0 ? (
              <p className="rounded-2xl bg-accent px-4 py-3 text-sm text-accent-text" role="status">
                No photos in this view. Written entries are below.
              </p>
            ) : (
              <ul className="grid grid-cols-2 gap-3 min-[600px]:grid-cols-3 lg:grid-cols-4">
                {photos.map((entry) => (
                  <li key={entry.id}>
                    <button
                      type="button"
                      onClick={() => focusEntry(entry.id)}
                      className="block w-full overflow-hidden rounded-2xl text-left outline-offset-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-text"
                      aria-label={`Go to the entry from ${formatDay(entry.createdAt)}, ${moodMark(entry)}`}
                    >
                      <span className="relative block">
                        <img
                          src={entry.photoUrl ?? ""}
                          alt=""
                          className="aspect-square w-full bg-camera object-cover"
                        />
                        <span className="absolute inset-x-2 bottom-2 flex items-end justify-between gap-2">
                          <span className="rounded-full bg-card/90 px-2 py-1 text-xs font-medium text-foreground">
                            {formatDay(entry.createdAt)}
                          </span>
                          <span className="rounded-full bg-card/90 px-2 py-1 text-xs font-medium text-foreground">
                            {moodMark(entry)}
                          </span>
                        </span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section aria-labelledby="written-timeline" className="space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <h2 id="written-timeline" className="font-serif text-3xl text-foreground">
                Journal
              </h2>
              <p className="text-sm text-muted">
                {visible.length} of {entries.length} shown
              </p>
            </div>
            <Filters
              mood={moodFilter}
              date={dateFilter}
              onMood={setMoodFilter}
              onDate={setDateFilter}
              onClear={() => {
                setMoodFilter("all");
                setDateFilter("");
              }}
            />
            {visible.length === 0 ? (
              <p className="rounded-2xl bg-accent px-4 py-3 text-sm text-accent-text" role="status">
                No entries match those filters.
              </p>
            ) : (
              <ol className="space-y-4">
                {visible.map((entry) => (
                  <li key={entry.id}>
                    <EntryArticle
                      entry={entry}
                      highlighted={highlightedId === entry.id}
                      onSaved={saved}
                      onOpenPhoto={setLightbox}
                      onAskDelete={() => setPendingDelete(entry)}
                    />
                  </li>
                ))}
              </ol>
            )}
          </section>
        </>
      ) : null}

      <section id="capture-moment" className="space-y-4 scroll-mt-24">
        <PromptLine
          prompt={prompt}
          source={promptSource}
          loading={promptLoading}
          onRefresh={() => {
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
          }}
        />
        <CaptureForm signedIn={auth.status === "signed-in"} onSaved={saved} />
      </section>

      {lightbox?.photoUrl ? <Lightbox entry={lightbox} onClose={() => setLightbox(null)} /> : null}
      {pendingDelete ? (
        <ConfirmDelete
          entry={pendingDelete}
          onCancel={() => setPendingDelete(null)}
          onDeleted={() => {
            setEntries((current) => current.filter((item) => item.id !== pendingDelete.id));
            if (lightbox?.id === pendingDelete.id) setLightbox(null);
            setPendingDelete(null);
          }}
        />
      ) : null}
    </div>
  );
}

function EntryArticle({
  entry,
  highlighted,
  onSaved,
  onOpenPhoto,
  onAskDelete,
}: {
  entry: AccountEntry;
  highlighted: boolean;
  onSaved: (entry: AccountEntry) => void;
  onOpenPhoto: (entry: AccountEntry) => void;
  onAskDelete: () => void;
}) {
  const [editing, setEditing] = useState(false);
  return (
    <article
      id={`entry-${entry.id}`}
      aria-labelledby={`entry-title-${entry.id}`}
      className={`${cardClass} scroll-mt-28 p-5 sm:p-6 ${highlighted ? "ring-2 ring-accent-text ring-offset-2 ring-offset-background" : ""}`}
    >
      {editing ? (
        <EntryEditor
          entry={entry}
          onCancel={() => setEditing(false)}
          onSaved={(next) => {
            setEditing(false);
            onSaved(next);
          }}
        />
      ) : (
        <div className="space-y-4">
          <h3 id={`entry-title-${entry.id}`} className="font-serif text-2xl text-foreground sm:text-3xl">
            {formatWhen(entry.createdAt)}
          </h3>
          <p className="text-sm text-muted">{entryFeelings(entry.mood, entry.customFeeling)}</p>
          {entry.photoUrl ? (
            <button
              type="button"
              onClick={() => onOpenPhoto(entry)}
              className="block w-full overflow-hidden rounded-2xl outline-offset-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-text"
              aria-label={`View the photo from ${formatWhen(entry.createdAt)}`}
            >
              <img
                src={entry.photoUrl}
                alt=""
                className="max-h-80 w-full bg-camera object-cover"
              />
            </button>
          ) : entry.photoPath ? (
            <p className="rounded-2xl bg-accent px-4 py-3 text-sm text-accent-text" role="status">
              This photo is saved, but its private link could not be opened.
            </p>
          ) : null}
          <p className="journal-text text-lg leading-relaxed text-foreground">{entry.journalText}</p>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => setEditing(true)}>
              Edit entry
            </Button>
            <Button variant="danger" onClick={onAskDelete}>
              Delete entry
            </Button>
          </div>
        </div>
      )}
    </article>
  );
}

function Lightbox({ entry, onClose }: { entry: AccountEntry; onClose: () => void }) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();

  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    closeRef.current?.focus();
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onCloseRef.current();
      if (event.key === "Tab") {
        event.preventDefault();
        closeRef.current?.focus();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  if (!entry.photoUrl) return null;

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/80 p-4" role="presentation" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="w-full max-w-4xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 id={titleId} className="font-serif text-2xl text-white">
            {formatWhen(entry.createdAt)}
          </h2>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            className="min-h-11 rounded-full bg-white px-4 text-sm font-medium text-black"
          >
            Close
          </button>
        </div>
        <img src={entry.photoUrl} alt={`Photo from ${formatWhen(entry.createdAt)}`} className="max-h-[75vh] w-full rounded-2xl object-contain" />
      </div>
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
        <select value={mood} onChange={(event) => onMood(moodChoice(event.target.value))} className={`${fieldClass} mt-2`}>
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
        photo: null,
        previewUrl: null,
        skipPhoto: !entry.photoPath,
        removePhoto: false,
      }}
      existing={entry}
      submitLabel="Save changes"
      onCancel={onCancel}
      onSubmit={async (draft, onProgress) =>
        updateAccountEntry({
          entry,
          journalText: draft.text,
          mood: draft.mood,
          customFeeling: draft.custom,
          photo: draft.photo,
          removePhoto: draft.removePhoto && !draft.photo,
          onProgress,
        })
      }
      onSaved={onSaved}
    />
  );
}

function CaptureForm({ signedIn, onSaved }: { signedIn: boolean; onSaved: (entry: AccountEntry) => void }) {
  return (
    <div className={`${cardClass} p-5 sm:p-8`}>
      <h2 className="font-serif text-3xl text-foreground">Capture This Moment</h2>
      <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted">
        Take a photo or choose one, look at it, then write what stands out. You can also skip the photo. The date and time
        are saved for you.
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
          if (!draft.photo && !draft.skipPhoto) {
            return { ok: false, message: "Add a photo, or choose Skip photo." };
          }
          return createAccountEntry({
            journalText: draft.text,
            mood: draft.mood,
            customFeeling: draft.custom,
            photo: draft.photo,
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
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const previewRef = useRef<string | null>(initial.previewUrl);
  const mountedRef = useRef(true);
  const [draft, setDraft] = useState<Draft>(initial);
  const [camera, setCamera] = useState<"off" | "starting" | "live">("off");
  const [progress, setProgress] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      releaseStream(streamRef, videoRef);
      revokePreview(previewRef.current);
    };
  }, []);

  useEffect(() => {
    if (camera !== "live") return;
    const video = videoRef.current;
    const stream = streamRef.current;
    if (!video || !stream) return;
    video.srcObject = stream;
  }, [camera]);

  function setPhoto(photo: Blob, previewUrl: string) {
    revokePreview(previewRef.current);
    previewRef.current = previewUrl;
    setDraft((current) => ({ ...current, photo, previewUrl, skipPhoto: false, removePhoto: false }));
  }

  function clearPhoto(skip: boolean) {
    revokePreview(previewRef.current);
    previewRef.current = null;
    setDraft((current) => ({ ...current, photo: null, previewUrl: null, skipPhoto: skip, removePhoto: skip }));
  }

  async function startCamera() {
    setError("");
    if (!navigator.mediaDevices?.getUserMedia) {
      setError("This browser cannot open a camera here. You can choose an image or skip.");
      return;
    }
    releaseStream(streamRef, videoRef);
    setCamera("starting");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      if (!mountedRef.current) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      streamRef.current = stream;
      setCamera("live");
    } catch (reason) {
      releaseStream(streamRef, videoRef);
      setCamera("off");
      setError(cameraErrorMessage(reason));
    }
  }

  function stopCamera() {
    releaseStream(streamRef, videoRef);
    setCamera("off");
  }

  async function captureFrame() {
    const video = videoRef.current;
    if (!video) return;
    setError("");
    try {
      const dataUrl = await videoFrameToDataUrl(video);
      const photo = await dataUrlToJpegBlob(dataUrl);
      stopCamera();
      setPhoto(photo, dataUrl);
    } catch (reason) {
      setError(reason instanceof ImagePrepError ? reason.message : "This photo could not be prepared.");
    }
  }

  async function onFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    event.target.value = "";
    if (!file) return;
    setError("");
    stopCamera();
    try {
      const photo = await imageFileToJpegBlob(file);
      setPhoto(photo, URL.createObjectURL(photo));
    } catch (reason) {
      setError(reason instanceof ImagePrepError ? reason.message : "That photo could not be prepared. Try another image.");
    }
  }

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
      releaseStream(streamRef, videoRef);
      setCamera("off");
      revokePreview(previewRef.current);
      previewRef.current = null;
      setDraft(emptyDraft);
      setProgress("");
      onSaved(result.value);
    } catch (reason) {
      setProgress("");
      setError(reason instanceof ImagePrepError ? reason.message : "That photo could not be prepared. Try another image.");
    }
  }

  const currentPhoto = draft.previewUrl ?? (existing?.photoUrl && !draft.removePhoto ? existing.photoUrl : null);

  return (
    <form className="mt-5 space-y-4" onSubmit={(event) => void onFormSubmit(event)}>
      <fieldset className="space-y-3">
        <legend className="text-sm font-medium text-foreground">Photo</legend>
        <p className="text-sm text-muted">JPG, PNG, and other images up to 15 MB. The photo is resized before it is saved.</p>
        {camera === "starting" ? <p className="text-sm text-foreground">Asking for camera access…</p> : null}
        {camera === "live" ? (
          <div className="space-y-3">
            <video ref={videoRef} autoPlay playsInline muted className="aspect-[4/3] w-full rounded-2xl bg-camera object-cover" />
            <div className="flex flex-wrap gap-2">
              <Button type="button" onClick={() => void captureFrame()}>
                Capture photo
              </Button>
              <Button type="button" variant="secondary" onClick={stopCamera}>
                Close camera
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            <Button type="button" onClick={() => void startCamera()} disabled={Boolean(progress)}>
              Take a photo
            </Button>
            <label className="inline-flex min-h-11 cursor-pointer items-center justify-center rounded-full border border-line bg-card px-4 text-sm font-medium text-foreground">
              Choose a photo
              <input id={`${fieldId}-photo`} className="sr-only" type="file" accept="image/*" onChange={(event) => void onFile(event)} />
            </label>
          </div>
        )}
        <label className="flex min-h-11 items-center gap-2 text-sm text-foreground">
          <input
            type="checkbox"
            checked={draft.skipPhoto && !draft.photo}
            onChange={(event) => {
              stopCamera();
              clearPhoto(event.target.checked);
            }}
          />
          Skip photo
        </label>
        {currentPhoto ? (
          <img src={currentPhoto} alt="Preview of the photo for this entry" className="max-h-64 w-full rounded-2xl bg-camera object-cover" />
        ) : null}
        {existing?.photoPath && !draft.photo && !draft.removePhoto ? (
          <p className="text-sm text-muted">The current photo stays unless you replace it or skip the photo.</p>
        ) : null}
      </fieldset>
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
          <Button
            variant="secondary"
            onClick={() => {
              stopCamera();
              onCancel();
            }}
            disabled={Boolean(progress)}
          >
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
      <div role="dialog" aria-modal="true" aria-labelledby={titleId} className={`${cardClass} w-full max-w-md p-6`}>
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
          {source === "fallback" ? "A prepared prompt, because the model is not replying." : "A short prompt from the companion model."}
        </p>
      )}
      <Button variant="secondary" className="mt-3" onClick={onRefresh} disabled={loading}>
        {loading ? "Asking…" : "Another prompt"}
      </Button>
    </div>
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

function moodMark(entry: AccountEntry): string {
  return moodLabel(entry.mood) ?? (entry.customFeeling?.trim() || "No label");
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

function revokePreview(url: string | null) {
  if (url?.startsWith("blob:")) URL.revokeObjectURL(url);
}

function releaseStream(streamRef: { current: MediaStream | null }, videoRef: { current: HTMLVideoElement | null }) {
  streamRef.current?.getTracks().forEach((track) => track.stop());
  streamRef.current = null;
  if (videoRef.current) videoRef.current.srcObject = null;
}

function isPrompt(value: unknown): value is { prompt: string; source: string } {
  if (!value || typeof value !== "object") return false;
  const body = value as { prompt?: unknown; source?: unknown };
  return typeof body.prompt === "string" && body.prompt.length > 0 && typeof body.source === "string";
}

function isAbort(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}
