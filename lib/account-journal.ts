import type { MoodId } from "@/lib/types";
import { MOODS, REFLECTION_LIMIT } from "@/lib/types";
import { parseCustomFeeling } from "@/lib/feelings";
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

export type JournalResult<T> = { ok: true; value: T } | { ok: false; message: string };

type EntryRow = {
  id: string;
  created_at: string;
  mood: string | null;
  custom_feeling: string | null;
  journal_text: string;
  photo_path: string | null;
};

export async function listAccountEntries(): Promise<JournalResult<AccountEntry[]>> {
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
  const urls = await signedUrls(
    supabase,
    rows.map((row) => row.photo_path).filter((path): path is string => Boolean(path)),
  );
  return { ok: true, value: rows.map((row) => toEntry(row, urls)) };
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
  const ready = await readyClient();
  if (!ready.ok) return ready;
  const id = crypto.randomUUID();
  let photoPath: string | null = null;
  if (input.photo) {
    input.onProgress("Uploading photo…");
    const uploaded = await uploadPhoto(ready.value.supabase, ready.value.userId, id, input.photo);
    if (!uploaded.ok) return uploaded;
    photoPath = uploaded.value;
  }
  input.onProgress("Saving entry…");
  const { data, error } = await ready.value.supabase
    .from("journal_entries")
    .insert({
      id,
      user_id: ready.value.userId,
      mood: input.mood,
      custom_feeling: parsed.value.customFeeling,
      journal_text: parsed.value.journalText,
      photo_path: photoPath,
    })
    .select("id, created_at, mood, custom_feeling, journal_text, photo_path")
    .single();
  if (error) {
    if (photoPath) await ready.value.supabase.storage.from(PHOTO_BUCKET).remove([photoPath]);
    return { ok: false, message: journalError(error.message, error.code) };
  }
  const row = oneEntryRow(data);
  if (!row) {
    if (photoPath) await ready.value.supabase.storage.from(PHOTO_BUCKET).remove([photoPath]);
    return { ok: false, message: "Supabase saved the entry, but the reply was missing the expected fields." };
  }
  const urls = photoPath ? await signedUrls(ready.value.supabase, [photoPath]) : new Map<string, string>();
  return { ok: true, value: toEntry(row, urls) };
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
  const previous = input.entry.photoPath;
  if (previous && previous !== photoPath) {
    await ready.value.supabase.storage.from(PHOTO_BUCKET).remove([previous]);
  }
  const urls = photoPath ? await signedUrls(ready.value.supabase, [photoPath]) : new Map<string, string>();
  return { ok: true, value: toEntry(row, urls) };
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

async function signedUrls(
  supabase: NonNullable<ReturnType<typeof browserSupabase>>,
  paths: string[],
): Promise<Map<string, string>> {
  const urls = new Map<string, string>();
  if (paths.length === 0) return urls;
  const { data } = await supabase.storage.from(PHOTO_BUCKET).createSignedUrls(paths, 60 * 60);
  for (const item of data ?? []) {
    if (item.path && item.signedUrl) urls.set(item.path, item.signedUrl);
  }
  return urls;
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
