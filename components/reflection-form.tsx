"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import type { FormEvent } from "react";
import { CustomFeelingField } from "@/components/custom-feeling";
import { useJournal } from "@/components/journal-provider";
import { PhotoView } from "@/components/photo-view";
import { Button, PageHeader, buttonClass, cardClass, fieldClass } from "@/components/ui";
import { parseCustomFeeling } from "@/lib/feelings";
import { entryFeelings } from "@/lib/format";
import { MOODS, REFLECTION_LIMIT } from "@/lib/types";

type StorageChoice = "session" | "device" | "";

export function ReflectionForm() {
  const formId = useId();
  const { draft, setDraft, clearDraft, saveEntry } = useJournal();
  const [reflection, setReflection] = useState("");
  const mood = draft.mood;
  const customFeeling = draft.customFeeling;
  const [where, setWhere] = useState<StorageChoice>("");
  const [deviceConsent, setDeviceConsent] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [quota, setQuota] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState<{ where: "session" | "device"; hadPhoto: boolean } | null>(null);
  const errorRef = useRef<HTMLDivElement>(null);
  const successRef = useRef<HTMLDivElement>(null);
  const reflectionRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (formError) errorRef.current?.focus();
  }, [formError]);

  useEffect(() => {
    if (saved) successRef.current?.focus();
  }, [saved]);

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    const text = reflection.trim();
    if (!text) {
      setQuota(false);
      setFormError("Write what stands out to you before keeping this entry.");
      reflectionRef.current?.focus();
      return;
    }
    if (!where) {
      setQuota(false);
      setFormError("Choose where this entry should stay. Nothing is kept until you do.");
      return;
    }
    if (where === "device" && !deviceConsent) {
      setQuota(false);
      setFormError("Confirm that you understand this entry, including any photo, will be stored in this browser.");
      return;
    }
    const feeling = parseCustomFeeling(customFeeling);
    if (!feeling.ok) {
      setQuota(false);
      setFormError(feeling.message);
      return;
    }
    const photoDataUrl = draft.photoDataUrl;
    setSaving(true);
    setFormError(null);
    window.setTimeout(() => {
      const result = saveEntry({
        reflection: text,
        mood,
        customFeeling,
        photoDataUrl,
        where,
        deviceConsent: where === "device" && deviceConsent,
      });
      setSaving(false);
      if (!result.ok) {
        setQuota(result.code === "quota");
        setFormError(result.message);
        return;
      }
      setSaved({ where, hadPhoto: Boolean(photoDataUrl) });
      setQuota(false);
      clearDraft();
    }, 0);
  }

  function saveWithoutPhoto() {
    if (where !== "device") return;
    setSaving(true);
    window.setTimeout(() => {
      const result = saveEntry({
        reflection,
        mood,
        customFeeling,
        photoDataUrl: null,
        where: "device",
        deviceConsent: true,
      });
      setSaving(false);
      if (!result.ok) {
        setFormError(result.message);
        return;
      }
      setSaved({ where: "device", hadPhoto: false });
      setQuota(false);
      clearDraft();
    }, 0);
  }

  function keepVisitInstead() {
    setSaving(true);
    window.setTimeout(() => {
      const result = saveEntry({
        reflection,
        mood,
        customFeeling,
        photoDataUrl: draft.photoDataUrl,
        where: "session",
        deviceConsent: false,
      });
      setSaving(false);
      if (!result.ok) {
        setFormError(result.message);
        return;
      }
      setSaved({ where: "session", hadPhoto: Boolean(draft.photoDataUrl) });
      setQuota(false);
      clearDraft();
    }, 0);
  }

  function discardDraft() {
    const hasWork = Boolean(reflection.trim() || draft.photoDataUrl || draft.mood || draft.customFeeling || draft.skippedPhoto);
    if (hasWork && !window.confirm("Discard this draft? It will not be saved.")) return;
    setReflection("");
    setWhere("");
    setDeviceConsent(false);
    setFormError(null);
    setQuota(false);
    clearDraft();
  }

  function writeAnother() {
    setSaved(null);
    setReflection("");
    setWhere("");
    setDeviceConsent(false);
    setFormError(null);
    setQuota(false);
  }

  if (saved) {
    return (
      <div className="space-y-8">
        <PageHeader eyebrow="Reflect" title="What stands out to you about this moment?" />
        <div ref={successRef} tabIndex={-1} role="status" className={`${cardClass} p-6 outline-none sm:p-8`}>
          <h2 className="font-serif text-3xl text-foreground">
            {saved.where === "device" ? "Remembered on this device" : "Kept for this visit"}
          </h2>
          <p className="mt-3 leading-relaxed text-muted">
            {saved.where === "device"
              ? "This entry is in this browser’s local storage. It was not uploaded. You can delete it from the timeline or the privacy page."
              : "This entry stays in this tab’s memory. Reloading or closing the tab removes it. It was not written to device storage."}
          </p>
          {saved.hadPhoto ? (
            <p className="mt-3 leading-relaxed text-muted">The photo is included with the entry. The draft no longer holds a copy.</p>
          ) : null}
          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <Link href="/timeline" className={buttonClass("primary", "w-full sm:w-auto")}>
              View timeline
            </Link>
            <Button variant="secondary" onClick={writeAnother}>
              Write another
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <PageHeader eyebrow="Reflect" title="What stands out to you about this moment?">
        <p>Use your own words. A mood label is optional, and awarely.ai does not choose it from a photo.</p>
      </PageHeader>

      {draft.photoDataUrl ? (
        <figure className={`${cardClass} space-y-3 p-4 sm:p-6`}>
          <PhotoView src={draft.photoDataUrl} alt="Your photo for this reflection" />
          <figcaption className="text-sm leading-relaxed text-muted">
            Shown only here and, if you agree, with the saved entry. awarely.ai does not analyze the photo or infer an
            emotion from it.
          </figcaption>
          <div className="flex flex-wrap gap-3">
            <Link href="/capture" className={buttonClass("secondary")}>
              Change photo
            </Link>
            <Button
              variant="quiet"
              onClick={() => setDraft({ ...draft, photoDataUrl: null, skippedPhoto: true })}
            >
              Remove photo
            </Button>
          </div>
        </figure>
      ) : (
        <p className={`${cardClass} p-5 text-sm leading-relaxed text-muted`}>
          {draft.skippedPhoto
            ? "You skipped adding a photo. You can still write, or go back and add one."
            : "No photo added yet. You can write without one."}{" "}
          <Link className="font-medium text-accent-text underline decoration-line underline-offset-4" href="/capture">
            Capture this moment
          </Link>
        </p>
      )}

      <form onSubmit={onSubmit} className={`${cardClass} space-y-8 p-5 sm:p-8`} noValidate>
        {formError ? (
          <div ref={errorRef} tabIndex={-1} role="alert" className="rounded-2xl bg-blush px-4 py-3 text-sm leading-relaxed text-blush-text outline-none">
            {formError}
          </div>
        ) : null}

        <div>
          <label htmlFor={`${formId}-reflection`} className="text-base font-medium text-foreground">
            Your reflection
          </label>
          <p id={`${formId}-help`} className="mt-1 text-sm leading-relaxed text-muted">
            What stands out to you about this moment? Up to {REFLECTION_LIMIT} characters.
          </p>
          <textarea
            ref={reflectionRef}
            id={`${formId}-reflection`}
            name="reflection"
            className={`${fieldClass} mt-3 min-h-40`}
            maxLength={REFLECTION_LIMIT}
            value={reflection}
            onChange={(event) => setReflection(event.target.value)}
            aria-describedby={`${formId}-help ${formId}-count`}
            aria-invalid={Boolean(formError && !reflection.trim())}
            required
          />
          <p id={`${formId}-count`} className="mt-2 text-sm text-muted">
            {reflection.length} / {REFLECTION_LIMIT}
          </p>
        </div>

        <fieldset>
          <legend className="text-base font-medium text-foreground">How do you feel?</legend>
          <p id={`${formId}-mood`} className="mt-1 text-sm leading-relaxed text-muted">
            Optional. This is your label, not an assessment, and it is not taken from the photo.
          </p>
          <div className="mt-4 flex flex-wrap gap-2" aria-describedby={`${formId}-mood`}>
            <MoodOption
              name={`${formId}-mood-choice`}
              label="No label"
              checked={mood === null}
              onSelect={() => setDraft({ ...draft, mood: null })}
            />
            {MOODS.map((item) => (
              <MoodOption
                key={item.id}
                name={`${formId}-mood-choice`}
                label={item.label}
                checked={mood === item.id}
                onSelect={() => setDraft({ ...draft, mood: item.id })}
              />
            ))}
            <label className="inline-flex min-h-11 cursor-pointer items-center rounded-full border border-line bg-card px-4 text-sm font-medium text-foreground has-[:checked]:border-transparent has-[:checked]:bg-accent has-[:checked]:text-accent-text has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-3 has-[:focus-visible]:outline-accent-text">
              <input
                className="sr-only"
                type="checkbox"
                checked={customFeeling !== null}
                onChange={() => setDraft({ ...draft, customFeeling: customFeeling === null ? "" : null })}
              />
              Other
            </label>
          </div>
          {customFeeling !== null ? (
            <CustomFeelingField
              id={`${formId}-custom-feeling-text`}
              value={customFeeling}
              onChange={(value) => setDraft({ ...draft, customFeeling: value })}
              onClear={() => setDraft({ ...draft, customFeeling: null })}
            />
          ) : null}
        </fieldset>

        <fieldset>
          <legend className="text-base font-medium text-foreground">Where should this entry stay?</legend>
          <p id={`${formId}-storage`} className="mt-1 text-sm leading-relaxed text-muted">
            Nothing is added to your timeline until you choose. Photos and writing are not uploaded.{" "}
            <Link className="font-medium text-accent-text underline decoration-line underline-offset-4" href="/privacy">
              Read how storage works
            </Link>
            .
          </p>
          <div className="mt-4 space-y-3" aria-describedby={`${formId}-storage`}>
            <StorageOption
              name={`${formId}-where`}
              checked={where === "session"}
              onSelect={() => {
                setWhere("session");
                setDeviceConsent(false);
              }}
              title="Keep for this visit only"
              detail="Held in this tab’s memory. It is not written to device storage. Closing or reloading the tab removes it."
            />
            <StorageOption
              name={`${formId}-where`}
              checked={where === "device"}
              onSelect={() => setWhere("device")}
              title="Remember on this device"
              detail="Saved in this browser’s local storage, including a photo if you added one. Anyone who can use this browser can open it. You can delete it later."
            />
          </div>
          {where === "device" ? (
            <label className="mt-4 flex items-start gap-3 rounded-2xl bg-accent px-4 py-3 text-sm leading-relaxed text-accent-text">
              <input
                type="checkbox"
                className="mt-1 h-4 w-4"
                checked={deviceConsent}
                onChange={(event) => setDeviceConsent(event.target.checked)}
              />
              <span>I understand and agree to store this entry, including any photo, only in this browser.</span>
            </label>
          ) : null}
        </fieldset>

        {quota ? (
          <div className="flex flex-col gap-3 sm:flex-row">
            <Button variant="secondary" onClick={saveWithoutPhoto} disabled={saving || !deviceConsent}>
              Remember the words without the photo
            </Button>
            <Button variant="secondary" onClick={keepVisitInstead} disabled={saving}>
              Keep everything for this visit
            </Button>
          </div>
        ) : null}

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <Button type="submit" disabled={saving}>
            {saving ? "Saving…" : "Keep this entry"}
          </Button>
          <Button variant="quiet" disabled={saving} onClick={discardDraft}>
            Discard
          </Button>
          <p className="text-sm text-muted" aria-live="polite">
            {saving
              ? "Saving your entry in this browser."
              : entryFeelings(mood, customFeeling) === "No mood label."
                ? "No mood label selected."
                : entryFeelings(mood, customFeeling)}
          </p>
        </div>
      </form>
    </div>
  );
}

function MoodOption({
  name,
  label,
  checked,
  onSelect,
}: {
  name: string;
  label: string;
  checked: boolean;
  onSelect: () => void;
}) {
  return (
    <label className="inline-flex min-h-11 cursor-pointer items-center rounded-full border border-line bg-card px-4 text-sm font-medium text-foreground has-[:checked]:border-transparent has-[:checked]:bg-accent has-[:checked]:text-accent-text has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-3 has-[:focus-visible]:outline-accent-text">
      <input className="sr-only" type="radio" name={name} checked={checked} onChange={onSelect} />
      {label}
    </label>
  );
}

function StorageOption({
  name,
  title,
  detail,
  checked,
  onSelect,
}: {
  name: string;
  title: string;
  detail: string;
  checked: boolean;
  onSelect: () => void;
}) {
  return (
    <label className="block cursor-pointer rounded-2xl border border-line bg-background px-4 py-3 has-[:checked]:border-accent-text has-[:checked]:bg-accent has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-3 has-[:focus-visible]:outline-accent-text">
      <span className="flex items-start gap-3">
        <input className="mt-1" type="radio" name={name} checked={checked} onChange={onSelect} />
        <span>
          <span className="block font-medium text-foreground">{title}</span>
          <span className="mt-1 block text-sm leading-relaxed text-muted">{detail}</span>
        </span>
      </span>
    </label>
  );
}
