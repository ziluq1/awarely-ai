"use client";

import { useLayoutEffect, useSyncExternalStore } from "react";
import type { ReactNode } from "react";
import {
  APPEARANCE_EVENT,
  APPEARANCE_KEY,
  applyAppearance,
  normalizePreference,
  readPreference,
} from "@/lib/appearance";
import type { AppearancePreference } from "@/lib/appearance";

export function AppearanceProvider({ children }: { children: ReactNode }) {
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  useLayoutEffect(() => {
    applyAppearance(document.documentElement, readPreference());
  }, [snapshot]);
  return children;
}

export function useAppearance(): { preference: AppearancePreference; systemDark: boolean } {
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  return {
    preference: preferenceFromSnapshot(snapshot),
    systemDark: snapshot.startsWith("dark|"),
  };
}

function subscribe(onChange: () => void): () => void {
  const onStorage = (event: StorageEvent) => {
    if (event.key === APPEARANCE_KEY) onChange();
  };
  window.addEventListener("storage", onStorage);
  window.addEventListener(APPEARANCE_EVENT, onChange);
  const media = window.matchMedia("(prefers-color-scheme: dark)");
  media.addEventListener("change", onChange);
  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(APPEARANCE_EVENT, onChange);
    media.removeEventListener("change", onChange);
  };
}

function getSnapshot(): string {
  const stored = localStorage.getItem(APPEARANCE_KEY) ?? "";
  const system = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  return `${system}|${stored}`;
}

function getServerSnapshot(): string {
  return "light|";
}

function preferenceFromSnapshot(snapshot: string): AppearancePreference {
  const stored = snapshot.slice(snapshot.indexOf("|") + 1);
  if (!stored) return normalizePreference(null);
  try {
    return normalizePreference(JSON.parse(stored));
  } catch {
    return normalizePreference(null);
  }
}
