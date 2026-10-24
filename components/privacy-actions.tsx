"use client";

import { useState } from "react";
import { useJournal } from "@/components/journal-provider";
import { Button, ErrorBlock } from "@/components/ui";
import { formatWhen } from "@/lib/format";

export function PrivacyActions() {
  const { device, entries, clearDevice, recheck } = useJournal();
  const [confirming, setConfirming] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const deviceCount = entries.filter((entry) => entry.storage === "device").length;
  const visitCount = entries.filter((entry) => entry.storage === "session").length;

  function clear() {
    setBusy(true);
    window.setTimeout(() => {
      const result = clearDevice();
      setBusy(false);
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setConfirming(false);
      setError(null);
      setMessage("Entries stored on this device were removed from this browser. Visit-only entries are still in this tab.");
    }, 0);
  }

  return (
    <div className="space-y-4">
      <p className="text-sm leading-relaxed text-muted">
        {deviceCount} on this device. {visitCount} for this visit.
        {device.status === "ready" && device.savedAt ? ` Last written ${formatWhen(device.savedAt)}.` : ""}
      </p>
      {device.status === "error" ? (
        <ErrorBlock title="Device storage needs attention" message={device.message}>
          <Button variant="secondary" onClick={recheck}>
            Try again
          </Button>
        </ErrorBlock>
      ) : null}
      {error ? <ErrorBlock title="Storage was not cleared" message={error} /> : null}
      {message ? (
        <p role="status" className="rounded-2xl bg-sage px-4 py-3 text-sm leading-relaxed text-sage-text">
          {message}
        </p>
      ) : null}
      {confirming ? (
        <div className="rounded-2xl bg-blush px-4 py-4 text-sm leading-relaxed text-blush-text">
          <p>This removes every entry remembered on this device, including photos. Entries kept only for this visit stay until you close the tab.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button variant="danger" onClick={clear} disabled={busy}>
              {busy ? "Clearing…" : "Clear device storage"}
            </Button>
            <Button variant="secondary" onClick={() => setConfirming(false)} disabled={busy}>
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <Button variant="danger" onClick={() => setConfirming(true)}>
          Forget entries stored on this device
        </Button>
      )}
    </div>
  );
}
