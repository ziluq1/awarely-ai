import type { MoodId } from "@/lib/types";
import { MOODS } from "@/lib/types";

export function formatWhen(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "Undated entry";
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export function moodLabel(mood: MoodId | null): string | null {
  if (!mood) return null;
  return MOODS.find((item) => item.id === mood)?.label ?? null;
}

export function entryFeelings(mood: MoodId | null, customFeeling?: string | null): string {
  const preset = moodLabel(mood);
  const custom = customFeeling?.trim() || null;
  if (preset && custom) return `Your label: ${preset}. Your words: ${custom}.`;
  if (preset) return `Your label: ${preset}.`;
  if (custom) return `Your words: ${custom}.`;
  return "No mood label.";
}

export function createId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `id-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}
