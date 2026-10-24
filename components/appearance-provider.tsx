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

export function useAppearance(): { preference: AppearancePreference } {
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  return { preference: preferenceFromSnapshot(snapshot) };
}

function subscribe(onChange: () => void): () => void {
  const onStorage = (event: StorageEvent) => {
    if (event.key === APPEARANCE_KEY) onChange();
  };
  window.addEventListener("storage", onStorage);
  window.addEventListener(APPEARANCE_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(APPEARANCE_EVENT, onChange);
  };
}

function getSnapshot(): string {
  return localStorage.getItem(APPEARANCE_KEY) ?? "";
}

function getServerSnapshot(): string {
  return "";
}

function preferenceFromSnapshot(snapshot: string): AppearancePreference {
  if (!snapshot) return normalizePreference(null);
  try {
    return normalizePreference(JSON.parse(snapshot));
  } catch {
    return normalizePreference(null);
  }
}
