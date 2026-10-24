export const MOODS = [
  { id: "happy", label: "Happy" },
  { id: "sad", label: "Sad" },
  { id: "excited", label: "Excited" },
  { id: "calm", label: "Calm" },
  { id: "grateful", label: "Grateful" },
  { id: "heavy", label: "Heavy" },
  { id: "restless", label: "Restless" },
  { id: "hopeful", label: "Hopeful" },
  { id: "unsure", label: "Unsure" },
] as const;

export type MoodId = (typeof MOODS)[number]["id"];

export type JournalEntry = {
  id: string;
  createdAt: string;
  reflection: string;
  mood: MoodId | null;
  customFeeling: string | null;
  photoDataUrl: string | null;
  storage: "session" | "device";
};

export type Draft = {
  photoDataUrl: string | null;
  skippedPhoto: boolean;
  mood: MoodId | null;
  customFeeling: string | null;
};

export const emptyDraft: Draft = {
  photoDataUrl: null,
  skippedPhoto: false,
  mood: null,
  customFeeling: null,
};

export type SaveResult =
  | { ok: true; id: string }
  | { ok: false; code: "empty" | "consent" | "quota" | "unavailable" | "missing"; message: string };

export const REFLECTION_LIMIT = 2000;
export const COMPANION_NOTE_LIMIT = 600;
