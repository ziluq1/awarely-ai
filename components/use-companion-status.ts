"use client";

import { useEffect, useState } from "react";
import { isCompanionStatus } from "@/lib/agent/types";
import type { CompanionStatus } from "@/lib/agent/types";

export type StatusState =
  | { phase: "loading" }
  | { phase: "error" }
  | { phase: "ready"; status: CompanionStatus };

export function useCompanionStatus(): StatusState {
  const [state, setState] = useState<StatusState>({ phase: "loading" });

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/companion/status", { signal: controller.signal })
      .then(async (response) => {
        const body: unknown = await response.json();
        if (!response.ok || !isCompanionStatus(body)) throw new Error("status");
        setState({ phase: "ready", status: body });
      })
      .catch((error: unknown) => {
        if (isAbort(error)) return;
        setState({ phase: "error" });
      });
    return () => controller.abort();
  }, []);

  return state;
}

function isAbort(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}
