"use client";

import { AgentChat } from "@/components/agent-chat";
import { CompanionChat } from "@/components/companion-chat";
import { useCompanionStatus } from "@/components/use-companion-status";
import { LoadingBlock } from "@/components/ui";

export function CompanionScreen() {
  const status = useCompanionStatus();

  if (status.phase === "loading") {
    return <LoadingBlock label="Checking whether the companion model is available." />;
  }
  if (status.phase === "error") {
    return <CompanionChat unavailable="unknown" />;
  }
  if (!status.status.available) {
    return <CompanionChat unavailable={status.status.reason} />;
  }
  return <AgentChat model={status.status.model} fallback={status.status.fallback} />;
}
