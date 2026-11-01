"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import type { MoodId } from "@/lib/types";
import { MOODS } from "@/lib/types";

const DRAFT_KEY = "awarely.guest-timeline-draft";
const BANNER_DISMISS_KEY = "awarely.guest-timeline-banner-dismissed";
const PHOTO_DATA_URL_LIMIT = 1_500_000;

export type GuestTimelineDraft = {
  text: string;
  mood: MoodId | null;
  custom: string | null;
  skipPhoto: boolean;
  photoDataUrl: string | null;
};

const bannerListeners = new Set<() => void>();

function emitBanner() {
  bannerListeners.forEach((listener) => listener());
}

function subscribeBanner(listener: () => void) {
  bannerListeners.add(listener);
  return () => {
    bannerListeners.delete(listener);
  };
}

function getBannerDismissed(): boolean {
  try {
    return sessionStorage.getItem(BANNER_DISMISS_KEY) === "1";
  } catch {
    return false;
  }
}

function getBannerServerSnapshot(): boolean {
  return true;
}

export function useGuestTimelineDraft() {
  const bannerDismissed = useSyncExternalStore(subscribeBanner, getBannerDismissed, getBannerServerSnapshot);
  const [restored, setRestored] = useState<GuestTimelineDraft | null>(null);

  useEffect(() => {
    let cancelled = false;
    const timer = window.setTimeout(() => {
      if (cancelled) return;
      const draft = takeDraft();
      if (draft) setRestored(draft);
    }, 0);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, []);

  const dismissBanner = useCallback(() => {
    try {
      sessionStorage.setItem(BANNER_DISMISS_KEY, "1");
    } catch {
      // Session storage may be blocked.
    }
    emitBanner();
  }, []);

  const stashDraft = useCallback(async (draft: {
    text: string;
    mood: MoodId | null;
    custom: string | null;
    skipPhoto: boolean;
    photo: Blob | null;
  }) => {
    let photoDataUrl: string | null = null;
    if (draft.photo) {
      try {
        const dataUrl = await blobToDataUrl(draft.photo);
        if (dataUrl.length <= PHOTO_DATA_URL_LIMIT) photoDataUrl = dataUrl;
      } catch {
        photoDataUrl = null;
      }
    }
    writeDraft({
      text: draft.text,
      mood: draft.mood,
      custom: draft.custom,
      skipPhoto: draft.skipPhoto,
      photoDataUrl,
    });
  }, []);

  const consumeRestored = useCallback(() => {
    setRestored(null);
  }, []);

  return {
    restored,
    consumeRestored,
    stashDraft,
    bannerDismissed,
    dismissBanner,
  };
}

function takeDraft(): GuestTimelineDraft | null {
  try {
    const raw = sessionStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    const draft = asDraft(parsed);
    sessionStorage.removeItem(DRAFT_KEY);
    return draft;
  } catch {
    return null;
  }
}

function writeDraft(draft: GuestTimelineDraft) {
  try {
    sessionStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
  } catch {
    // Session storage may be blocked or full.
  }
}

function asDraft(value: unknown): GuestTimelineDraft | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  if (typeof row.text !== "string") return null;
  const mood =
    row.mood === null ? null : typeof row.mood === "string" && MOODS.some((item) => item.id === row.mood) ? (row.mood as MoodId) : null;
  const custom = row.custom === null ? null : typeof row.custom === "string" ? row.custom : null;
  return {
    text: row.text,
    mood,
    custom,
    skipPhoto: Boolean(row.skipPhoto),
    photoDataUrl: typeof row.photoDataUrl === "string" ? row.photoDataUrl : null,
  };
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Could not read the photo."));
    reader.onload = () => {
      if (typeof reader.result === "string") resolve(reader.result);
      else reject(new Error("Could not read the photo."));
    };
    reader.readAsDataURL(blob);
  });
}
