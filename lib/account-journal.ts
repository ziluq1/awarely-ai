import type { MoodId } from "@/lib/types";
import { MOODS, REFLECTION_LIMIT } from "@/lib/types";
import { parseCustomFeeling } from "@/lib/feelings";
import { associateSignedUrls } from "@/lib/photo-links";
import { browserSupabase } from "@/lib/supabase/browser";

export const PHOTO_BUCKET = "journal-photos";

export type AccountEntry = {
  id: string;
  createdAt: string;
  journalText: string;
  mood: MoodId | null;
  customFeeling: string | null;
  photoPath: string | null;
  photoUrl: string | null;
};

export type AccountList = {
  entries: AccountEntry[];
  photoMessage: string | null;
};

export type JournalResult<T> = { ok: true; value: T } | { ok: false; message: string };

type EntryRow = {
  id: string;
  created_at: string;
  mood: string | null;
  custom_feeling: string | null;
  journal_text: string;
  photo_path: string | null;
};

export type SavedMood = {
  id: string;
  createdAt: string;
  journalText: string;
  mood: string | null;
  customFeeling: string | null;
};

export async function listPhotoTimes(): Promise<JournalResult<string[]>> {
  const ready = await readyClient();
  if (!ready.ok) return ready;
  const times: string[] = [];
  const pageSize = 1000;
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await ready.value.supabase
      .from("journal_entries")
      .select("created_at")
      .not("photo_path", "is", null)
      .order("created_at", { ascending: false })
      .range(from, from + pageSize - 1);
    if (error) return { ok: false, message: journalError(error.message, error.code) };
    const batch = Array.isArray(data) ? data : [];
    for (const row of batch) {
      if (row && typeof row === "object" && typeof (row as { created_at?: unknown }).created_at === "string") {
        times.push((row as { created_at: string }).created_at);
      }
    }
    if (batch.length < pageSize) break;
  }
  return { ok: true, value: times };
}

export async function listSavedMoods(): Promise<JournalResult<SavedMood[]>> {
  const ready = await readyClient();
  if (!ready.ok) return ready;
  const rows: SavedMood[] = [];
  const pageSize = 1000;
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await ready.value.supabase
      .from("journal_entries")
      .select("id, created_at, mood, custom_feeling, journal_text")
      .order("created_at", { ascending: true })
      .range(from, from + pageSize - 1);
    if (error) return { ok: false, message: journalError(error.message, error.code) };
    const batch = Array.isArray(data) ? data : [];
    for (const row of batch) {
      const saved = savedMoodRow(row);
      if (saved) rows.push(saved);
    }
    if (batch.length < pageSize) break;
  }
  return { ok: true, value: rows };
}

export async function listAccountEntries(): Promise<JournalResult<AccountList>> {
  const ready = await readyClient();
  if (!ready.ok) return ready;
  const { supabase } = ready.value;
  const { data, error } = await supabase
    .from("journal_entries")
    .select("id, created_at, mood, custom_feeling, journal_text, photo_path")
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) return { ok: false, message: journalError(error.message, error.code) };
  const rows = entryRows(data);
  const paths = rows.map((row) => row.photo_path).filter((path): path is string => Boolean(path));
  const signed = await signedUrls(supabase, paths);
  if (!signed.ok) {
    return {
      ok: true,
      value: {
        entries: rows.map((row) => toEntry(row, new Map())),
        photoMessage: signed.message,
      },
    };
  }
  const missing = paths.filter((path) => !signed.value.has(path));
  return {
    ok: true,
    value: {
      entries: rows.map((row) => toEntry(row, signed.value)),
      photoMessage: missing.length > 0 ? "Some photos are saved, but their private links could not be opened." : null,
    },
  };
}

export async function createAccountEntry(input: {
  journalText: string;
  mood: MoodId | null;
  customFeeling: string | null;
  photo: Blob | null;
  onProgress: (label: string) => void;
}): Promise<JournalResult<AccountEntry>> {
  const parsed = parseDraft(input.journalText, input.customFeeling);
  if (!parsed.ok) return parsed;

  input.onProgress(input.photo ? "Uploading photo…" : "Saving entry…");
  const form = new FormData();
  form.set("journalText", parsed.value.journalText);
  form.set("mood", input.mood ?? "");
  form.set("customFeeling", parsed.value.customFeeling ?? "");
  if (input.photo) form.set("photo", input.photo, "photo.jpg");

  let response: Response;
  try {
    response = await fetch("/api/journal", {
      method: "POST",
      body: form,
      credentials: "same-origin",
      cache: "no-store",
    });
  } catch {
    return { ok: false, message: "The save request could not reach the server. Try again." };
  }

  let body: unknown = null;
  try {
    body = await response.json();
  } catch {
    body = null;
  }

  if (response.status === 401) {
    return { ok: false, message: "Sign in to save your timeline." };
  }

  if (
    body &&
    typeof body === "object" &&
    "ok" in body &&
    (body as { ok: unknown }).ok === true &&
    "entry" in body &&
    isAccountEntry((body as { entry: unknown }).entry)
  ) {
    return { ok: true, value: (body as { entry: AccountEntry }).entry };
  }

  const message =
    body && typeof body === "object" && "message" in body && typeof (body as { message: unknown }).message === "string"
      ? (body as { message: string }).message
      : "Supabase could not save that journal change. Try again.";
  return { ok: false, message };
}

export async function updateAccountEntry(input: {
  entry: AccountEntry;
  journalText: string;
  mood: MoodId | null;
  customFeeling: string | null;
  photo: Blob | null;
  removePhoto: boolean;
  onProgress: (label: string) => void;
}): Promise<JournalResult<AccountEntry>> {
  const parsed = parseDraft(input.journalText, input.customFeeling);
  if (!parsed.ok) return parsed;
  const ready = await readyClient();
  if (!ready.ok) return ready;
  let photoPath = input.removePhoto ? null : input.entry.photoPath;
  let uploadedPath: string | null = null;
  if (input.photo) {
    input.onProgress("Uploading photo…");
    const uploaded = await uploadPhoto(ready.value.supabase, ready.value.userId, input.entry.id, input.photo);
    if (!uploaded.ok) return uploaded;
    uploadedPath = uploaded.value;
    photoPath = uploaded.value;
  }
  input.onProgress("Saving entry…");
  const { data, error } = await ready.value.supabase
    .from("journal_entries")
    .update({
      mood: input.mood,
      custom_feeling: parsed.value.customFeeling,
      journal_text: parsed.value.journalText,
      photo_path: photoPath,
    })
    .eq("id", input.entry.id)
    .select("id, created_at, mood, custom_feeling, journal_text, photo_path")
    .single();
  if (error) {
    if (uploadedPath) await ready.value.supabase.storage.from(PHOTO_BUCKET).remove([uploadedPath]);
    return { ok: false, message: journalError(error.message, error.code) };
  }
  const row = oneEntryRow(data);
  if (!row) {
    if (uploadedPath) await ready.value.supabase.storage.from(PHOTO_BUCKET).remove([uploadedPath]);
    return { ok: false, message: "Supabase saved the entry, but the reply was missing the expected fields." };
  }
  const linked = await requirePhotoLink(
    ready.value.supabase,
    row.id,
    photoPath,
    uploadedPath ? { kind: "replace", previousPath: input.entry.photoPath } : { kind: "keep" },
  );
  if (!linked.ok) return linked;
  const previous = input.entry.photoPath;
  if (previous && previous !== photoPath) {
    await ready.value.supabase.storage.from(PHOTO_BUCKET).remove([previous]);
  }
  return { ok: true, value: toEntry(row, linked.value) };
}

export async function deleteAccountEntry(entry: AccountEntry): Promise<JournalResult<null>> {
  const ready = await readyClient();
  if (!ready.ok) return ready;
  const { error } = await ready.value.supabase.from("journal_entries").delete().eq("id", entry.id);
  if (error) return { ok: false, message: journalError(error.message, error.code) };
  if (entry.photoPath) await ready.value.supabase.storage.from(PHOTO_BUCKET).remove([entry.photoPath]);
  return { ok: true, value: null };
}

async function uploadPhoto(
  supabase: NonNullable<ReturnType<typeof browserSupabase>>,
  userId: string,
  entryId: string,
  photo: Blob,
): Promise<JournalResult<string>> {
  const path = `${userId}/${entryId}-${Date.now()}.jpg`;
  const { error } = await supabase.storage.from(PHOTO_BUCKET).upload(path, photo, {
    contentType: "image/jpeg",
    upsert: false,
  });
  if (error) return { ok: false, message: storageError(error.message) };
  return { ok: true, value: path };
}

type PhotoRollback = { kind: "create" } | { kind: "replace"; previousPath: string | null } | { kind: "keep" };

async function requirePhotoLink(
  supabase: NonNullable<ReturnType<typeof browserSupabase>>,
  entryId: string,
  photoPath: string | null,
  rollback: PhotoRollback,
): Promise<JournalResult<Map<string, string>>> {
  const signed = photoPath ? await signedUrls(supabase, [photoPath]) : { ok: true as const, value: new Map<string, string>() };
  if (signed.ok && (!photoPath || signed.value.has(photoPath))) return signed;
  if (rollback.kind === "keep") return { ok: true, value: new Map() };
  const message = signed.ok
    ? "The photo was uploaded, but a private link could not be created. The new photo was not kept."
    : signed.message;
  if (rollback.kind === "replace") {
    await supabase.from("journal_entries").update({ photo_path: rollback.previousPath }).eq("id", entryId);
    if (photoPath) await supabase.storage.from(PHOTO_BUCKET).remove([photoPath]);
    return { ok: false, message };
  }
  await supabase.from("journal_entries").delete().eq("id", entryId);
  if (photoPath) await supabase.storage.from(PHOTO_BUCKET).remove([photoPath]);
  return { ok: false, message: signed.ok ? "The photo was uploaded, but a private link could not be created. The entry was not kept." : signed.message };
}

async function signedUrls(
  supabase: NonNullable<ReturnType<typeof browserSupabase>>,
  paths: string[],
): Promise<JournalResult<Map<string, string>>> {
  if (paths.length === 0) return { ok: true, value: new Map() };
  const { data, error } = await supabase.storage.from(PHOTO_BUCKET).createSignedUrls(paths, 60 * 60);
  if (error) return { ok: false, message: storageError(error.message) };
  const linked = associateSignedUrls(
    paths,
    (data ?? []).map((item) => ({
      path: item.path,
      signedUrl: item.signedUrl,
      error: item.error,
    })),
  );
  return { ok: true, value: linked.urls };
}

async function readyClient(): Promise<JournalResult<{ supabase: NonNullable<ReturnType<typeof browserSupabase>>; userId: string }>> {
  const supabase = browserSupabase();
  if (!supabase) {
    return { ok: false, message: "Supabase is not configured. Add the project URL and publishable key, then restart the dev server." };
  }
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return { ok: false, message: "Log in to open the entries saved to your account." };
  return { ok: true, value: { supabase, userId: data.user.id } };
}

function parseDraft(journalText: string, customFeeling: string | null): JournalResult<{ journalText: string; customFeeling: string | null }> {
  const text = journalText.trim();
  if (!text) return { ok: false, message: "Write a few words before saving this entry." };
  if (text.length > REFLECTION_LIMIT) {
    return { ok: false, message: `Journal entries can be up to ${REFLECTION_LIMIT} characters.` };
  }
  const feeling = parseCustomFeeling(customFeeling);
  if (!feeling.ok) return { ok: false, message: feeling.message };
  return { ok: true, value: { journalText: text, customFeeling: feeling.value } };
}

function entryRows(data: unknown): EntryRow[] {
  if (!Array.isArray(data)) return [];
  return data.filter(isEntryRow);
}

function oneEntryRow(data: unknown): EntryRow | null {
  return isEntryRow(data) ? data : null;
}

function isEntryRow(value: unknown): value is EntryRow {
  if (!value || typeof value !== "object") return false;
  const row = value as Record<string, unknown>;
  return (
    typeof row.id === "string" &&
    typeof row.created_at === "string" &&
    typeof row.journal_text === "string" &&
    (row.mood === null || typeof row.mood === "string") &&
    (row.custom_feeling === null || typeof row.custom_feeling === "string") &&
    (row.photo_path === null || typeof row.photo_path === "string")
  );
}

function isAccountEntry(value: unknown): value is AccountEntry {
  if (!value || typeof value !== "object") return false;
  const entry = value as Record<string, unknown>;
  return (
    typeof entry.id === "string" &&
    typeof entry.createdAt === "string" &&
    typeof entry.journalText === "string" &&
    (entry.mood === null || typeof entry.mood === "string") &&
    (entry.customFeeling === null || typeof entry.customFeeling === "string") &&
    (entry.photoPath === null || typeof entry.photoPath === "string") &&
    (entry.photoUrl === null || typeof entry.photoUrl === "string")
  );
}

function savedMoodRow(value: unknown): SavedMood | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  if (typeof row.id !== "string" || typeof row.created_at !== "string" || typeof row.journal_text !== "string") return null;
  return {
    id: row.id,
    createdAt: row.created_at,
    journalText: row.journal_text,
    mood: typeof row.mood === "string" && row.mood.trim() ? row.mood : null,
    customFeeling: typeof row.custom_feeling === "string" && row.custom_feeling.trim() ? row.custom_feeling.trim() : null,
  };
}

function toEntry(row: EntryRow, urls: Map<string, string>): AccountEntry {
  return {
    id: row.id,
    createdAt: row.created_at,
    journalText: row.journal_text,
    mood: asMood(row.mood),
    customFeeling: row.custom_feeling,
    photoPath: row.photo_path,
    photoUrl: row.photo_path ? (urls.get(row.photo_path) ?? null) : null,
  };
}

function asMood(value: string | null): MoodId | null {
  if (!value) return null;
  return MOODS.some((mood) => mood.id === value) ? (value as MoodId) : null;
}

function journalError(message: string, code?: string): string {
  if (code === "PGRST205" || message.toLowerCase().includes("schema cache")) {
    return "The journal_entries table is not in Supabase yet. Run both SQL files in supabase/migrations from the Supabase SQL Editor.";
  }
  if (code === "42501" || message.toLowerCase().includes("row-level security")) {
    return "Supabase refused that change. You can only open and change your own entries.";
  }
  if (message.toLowerCase().includes("jwt") || message.toLowerCase().includes("not authenticated")) {
    return "Log in again, then retry. The session was not accepted.";
  }
  return "Supabase could not save that journal change. Try again.";
}

function storageError(message: string): string {
  const text = message.toLowerCase();
  if (text.includes("bucket") || text.includes("not found")) {
    return "The private journal-photos bucket is not in Supabase yet. Run the photo SQL file in the Supabase SQL Editor.";
  }
  if (text.includes("row-level security") || text.includes("policy") || text.includes("unauthorized")) {
    return "Supabase refused the photo. You can only store photos in your own folder.";
  }
  return "The photo could not be uploaded. Try a smaller JPG or PNG.";
}
