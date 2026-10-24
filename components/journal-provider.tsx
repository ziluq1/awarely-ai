"use client";

import { useCallback, useMemo, useState, useSyncExternalStore } from "react";
import { createContext, useContext } from "react";
import type { ReactNode } from "react";
import { createId } from "@/lib/format";
import {
  clearDeviceJournal,
  getJournalServerSnapshot,
  getJournalSnapshot,
  parseJournal,
  recheckJournal,
  subscribeJournal,
  writeDeviceJournal,
} from "@/lib/storage";
import type { DeviceJournal } from "@/lib/storage";
import { parseCustomFeeling } from "@/lib/feelings";
import type { Draft, JournalEntry, MoodId, SaveResult } from "@/lib/types";
import { emptyDraft, REFLECTION_LIMIT } from "@/lib/types";

type SaveInput = {
  reflection: string;
  mood: MoodId | null;
  customFeeling: string | null;
  photoDataUrl: string | null;
  where: "session" | "device";
  deviceConsent: boolean;
};

type JournalContextValue = {
  device: DeviceJournal;
  entries: JournalEntry[];
  draft: Draft;
  setDraft: (draft: Draft) => void;
  clearDraft: () => void;
  saveEntry: (input: SaveInput) => SaveResult;
  deleteEntry: (id: string) => SaveResult;
  clearDevice: () => SaveResult;
  recheck: () => void;
};

const JournalContext = createContext<JournalContextValue | null>(null);

export function JournalProvider({ children }: { children: ReactNode }) {
  const snapshot = useSyncExternalStore(subscribeJournal, getJournalSnapshot, getJournalServerSnapshot);
  const device = useMemo(() => parseJournal(snapshot), [snapshot]);
  const [sessionEntries, setSessionEntries] = useState<JournalEntry[]>([]);
  const [draft, setDraft] = useState<Draft>(emptyDraft);

  const entries = useMemo(() => {
    const deviceEntries = device.status === "ready" ? device.entries : [];
    return [...deviceEntries, ...sessionEntries].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  }, [device, sessionEntries]);

  const saveEntry = useCallback(
    (input: SaveInput): SaveResult => {
      const reflection = input.reflection.trim();
      if (!reflection) {
        return { ok: false, code: "empty", message: "Write what stands out before keeping this entry." };
      }
      if (reflection.length > REFLECTION_LIMIT) {
        return {
          ok: false,
          code: "empty",
          message: `Reflections can be up to ${REFLECTION_LIMIT} characters.`,
        };
      }
      if (input.where === "device" && !input.deviceConsent) {
        return {
          ok: false,
          code: "consent",
          message: "To remember an entry on this device, confirm that you understand it stays in this browser.",
        };
      }
      if (input.where === "device" && device.status === "error") {
        return { ok: false, code: "unavailable", message: device.message };
      }
      const feeling = parseCustomFeeling(input.customFeeling);
      if (!feeling.ok) return { ok: false, code: "empty", message: feeling.message };

      const entry: JournalEntry = {
        id: createId(),
        createdAt: new Date().toISOString(),
        reflection,
        mood: input.mood,
        customFeeling: feeling.value,
        photoDataUrl: input.photoDataUrl,
        storage: input.where,
      };

      if (input.where === "session") {
        setSessionEntries((current) => [entry, ...current]);
        return { ok: true, id: entry.id };
      }

      const existing = device.status === "ready" ? device.entries : [];
      const written = writeDeviceJournal([entry, ...existing]);
      if (!written.ok) return written;
      return { ok: true, id: entry.id };
    },
    [device],
  );

  const deleteEntry = useCallback(
    (id: string): SaveResult => {
      const sessionTarget = sessionEntries.find((entry) => entry.id === id);
      if (sessionTarget) {
        setSessionEntries((current) => current.filter((entry) => entry.id !== id));
        return { ok: true, id };
      }
      if (device.status !== "ready") {
        return {
          ok: false,
          code: "unavailable",
          message: device.status === "error" ? device.message : "That entry is no longer here.",
        };
      }
      const target = device.entries.find((entry) => entry.id === id);
      if (!target) return { ok: false, code: "missing", message: "That entry is no longer here." };
      const written = writeDeviceJournal(device.entries.filter((entry) => entry.id !== id));
      if (!written.ok) return written;
      return { ok: true, id };
    },
    [device, sessionEntries],
  );

  const clearDevice = useCallback((): SaveResult => {
    const cleared = clearDeviceJournal();
    if (!cleared.ok) return cleared;
    return { ok: true, id: "cleared" };
  }, []);

  const value = useMemo<JournalContextValue>(
    () => ({
      device,
      entries,
      draft,
      setDraft,
      clearDraft: () => setDraft(emptyDraft),
      saveEntry,
      deleteEntry,
      clearDevice,
      recheck: recheckJournal,
    }),
    [clearDevice, deleteEntry, device, draft, entries, saveEntry],
  );

  return <JournalContext.Provider value={value}>{children}</JournalContext.Provider>;
}

export function useJournal(): JournalContextValue {
  const value = useContext(JournalContext);
  if (!value) {
    throw new Error("useJournal must be used within JournalProvider");
  }
  return value;
}
