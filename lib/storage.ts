import { parseCustomFeeling } from "@/lib/feelings";
import type { JournalEntry, MoodId } from "@/lib/types";
import { MOODS, REFLECTION_LIMIT } from "@/lib/types";

const STORAGE_KEY = "mindmate.journal.v1";
const STORAGE_EVENT = "mindmate-journal";
const UNAVAILABLE = "\u0000unavailable";

const MOOD_IDS = new Set<MoodId>(MOODS.map((mood) => mood.id));

export type DeviceJournal =
  | { status: "empty" }
  | {
      status: "ready";
      savedAt: string | null;
      entries: JournalEntry[];
      warning: string | null;
    }
  | { status: "error"; message: string };

type WriteResult =
  | { ok: true }
  | { ok: false; code: "quota" | "unavailable"; message: string };

export function subscribeJournal(listener: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  const notify = () => listener();
  window.addEventListener(STORAGE_EVENT, notify);
  window.addEventListener("storage", notify);
  return () => {
    window.removeEventListener(STORAGE_EVENT, notify);
    window.removeEventListener("storage", notify);
  };
}

export function getJournalSnapshot(): string {
  if (typeof window === "undefined") return "";
  try {
    return window.localStorage.getItem(STORAGE_KEY) ?? "";
  } catch {
    return UNAVAILABLE;
  }
}

export function getJournalServerSnapshot(): string {
  return "";
}

export function recheckJournal(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(STORAGE_EVENT));
}

export function parseJournal(snapshot: string): DeviceJournal {
  if (snapshot === UNAVAILABLE) {
    return {
      status: "error",
      message:
        "This browser blocked local storage. You can still keep entries for this visit. They leave when you close the tab.",
    };
  }
  if (!snapshot) return { status: "empty" };

  let parsed: unknown;
  try {
    parsed = JSON.parse(snapshot);
  } catch {
    return unreadable();
  }

  if (!parsed || typeof parsed !== "object") return unreadable();
  const record = parsed as { version?: unknown; savedAt?: unknown; entries?: unknown };
  if (record.version !== 1 || !Array.isArray(record.entries)) return unreadable();

  const entries: JournalEntry[] = [];
  let photosAdjusted = 0;
  for (const item of record.entries) {
    const sanitized = sanitizeEntry(item);
    if (!sanitized) return unreadable();
    if (sanitized.photoAdjusted) photosAdjusted += 1;
    entries.push(sanitized.entry);
  }

  return {
    status: "ready",
    savedAt: typeof record.savedAt === "string" ? record.savedAt : null,
    entries,
    warning:
      photosAdjusted > 0
        ? "A stored photo could not be read, so that entry is shown without it. The words are unchanged."
        : null,
  };
}

export function writeDeviceJournal(entries: JournalEntry[]): WriteResult {
  const payload = {
    version: 1 as const,
    savedAt: new Date().toISOString(),
    entries,
  };
  try {
    const json = JSON.stringify(payload);
    if (json.length > 4_500_000) {
      return {
        ok: false,
        code: "quota",
        message:
          "This browser does not have enough room for that entry. You can keep it for this visit, or remember the words without the photo.",
      };
    }
    window.localStorage.setItem(STORAGE_KEY, json);
    window.dispatchEvent(new Event(STORAGE_EVENT));
    return { ok: true };
  } catch (error) {
    if (isQuotaError(error)) {
      return {
        ok: false,
        code: "quota",
        message:
          "This browser does not have enough room for that entry. You can keep it for this visit, or remember the words without the photo.",
      };
    }
    return {
      ok: false,
      code: "unavailable",
      message:
        "This browser blocked local storage. You can keep the entry for this visit instead. It is not written to the device.",
    };
  }
}

export function clearDeviceJournal(): WriteResult {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
    window.dispatchEvent(new Event(STORAGE_EVENT));
    return { ok: true };
  } catch {
    return {
      ok: false,
      code: "unavailable",
      message: "This browser blocked clearing local storage. The device copy is still there.",
    };
  }
}

function unreadable(): DeviceJournal {
  return {
    status: "error",
    message:
      "Entries stored on this device could not be read. You can try again, or clear device storage. Nothing new will overwrite them until you do. Entries kept for this visit still work.",
  };
}

function sanitizeEntry(value: unknown): { entry: JournalEntry; photoAdjusted: boolean } | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as Partial<JournalEntry>;
  if (typeof candidate.id !== "string" || candidate.id.length === 0 || candidate.id.length > 80) return null;
  if (typeof candidate.createdAt !== "string" || Number.isNaN(Date.parse(candidate.createdAt))) return null;
  if (typeof candidate.reflection !== "string") return null;
  const reflection = candidate.reflection.trim();
  if (!reflection || reflection.length > REFLECTION_LIMIT) return null;
  let mood: MoodId | null = null;
  if (candidate.mood != null) {
    if (typeof candidate.mood !== "string") return null;
    if (candidate.mood === "tender") mood = null;
    else if (MOOD_IDS.has(candidate.mood as MoodId)) mood = candidate.mood as MoodId;
    else return null;
  }
  if (
    candidate.customFeeling !== undefined &&
    candidate.customFeeling !== null &&
    typeof candidate.customFeeling !== "string"
  ) {
    return null;
  }
  const feeling = parseCustomFeeling(typeof candidate.customFeeling === "string" ? candidate.customFeeling : null);
  if (candidate.storage !== "device") return null;

  let photoDataUrl: string | null = null;
  let photoAdjusted = false;
  if (candidate.photoDataUrl != null) {
    if (
      typeof candidate.photoDataUrl === "string" &&
      candidate.photoDataUrl.startsWith("data:image/jpeg") &&
      candidate.photoDataUrl.length <= 900_000
    ) {
      photoDataUrl = candidate.photoDataUrl;
    } else {
      photoAdjusted = true;
    }
  }

  return {
    photoAdjusted,
    entry: {
      id: candidate.id,
      createdAt: candidate.createdAt,
      reflection,
      mood,
      customFeeling: feeling.ok ? feeling.value : null,
      photoDataUrl,
      storage: "device",
    },
  };
}

function isQuotaError(error: unknown): boolean {
  return (
    error instanceof DOMException &&
    (error.name === "QuotaExceededError" || error.name === "NS_ERROR_DOM_QUOTA_REACHED" || error.code === 22)
  );
}
