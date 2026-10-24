"use client";

import Link from "next/link";
import { useState } from "react";
import { Dialog, StatusNote } from "@/components/social-ui";
import { Button, buttonClass } from "@/components/ui";
import { listActiveTimelineChoices, listEntryShares, setReshare, shareEntry, unshareEntry } from "@/lib/social";
import type { EntryShare } from "@/lib/social";

export function ShareEntryButton({ entryId }: { entryId: string }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [choices, setChoices] = useState<{ id: string; name: string }[]>([]);
  const [shares, setShares] = useState<EntryShare[]>([]);
  const [timelineId, setTimelineId] = useState("");
  const [allowReshare, setAllowReshare] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function openDialog() {
    setOpen(true);
    setLoading(true);
    setMessage(null);
    const [timelineResult, shareResult] = await Promise.all([listActiveTimelineChoices(), listEntryShares(entryId)]);
    setLoading(false);
    if (!timelineResult.ok) {
      setMessage(timelineResult.message);
      return;
    }
    if (!shareResult.ok) {
      setMessage(shareResult.message);
      return;
    }
    setChoices(timelineResult.value);
    setShares(shareResult.value);
    setTimelineId(timelineResult.value.find((item) => !shareResult.value.some((share) => share.timelineId === item.id))?.id ?? "");
  }

  const selected = choices.find((item) => item.id === timelineId);

  return (
    <>
      <Button variant="secondary" onClick={() => void openDialog()}>
        Share
      </Button>
      {open ? (
        <Dialog title="Share this entry" onClose={() => setOpen(false)}>
          <p className="text-sm leading-relaxed text-muted">
            This shares the photo, date, mood, and reflection for this entry only. The rest of your journal stays
            private. If you edit the entry later, the shared view changes too, because it is the same entry.
          </p>
          <StatusNote message={message} />
          {loading ? <p className="text-sm text-muted">Loading your shared timelines.</p> : null}
          {!loading && choices.length ? (
            <form
              className="space-y-3"
              onSubmit={(event) => {
                event.preventDefault();
                if (!timelineId) return;
                void (async () => {
                  setBusy(true);
                  const result = await shareEntry(timelineId, entryId, allowReshare);
                  setBusy(false);
                  if (!result.ok) {
                    setMessage(result.message);
                    return;
                  }
                  const name = selected?.name ?? "that timeline";
                  setMessage(`Shared with ${name}. Only current members of that timeline can see this entry.`);
                  const next = await listEntryShares(entryId);
                  if (next.ok) setShares(next.value);
                })();
              }}
            >
              <label className="block text-sm font-medium text-foreground" htmlFor={`share-${entryId}`}>
                Shared timeline
              </label>
              <select
                id={`share-${entryId}`}
                value={timelineId}
                onChange={(event) => setTimelineId(event.target.value)}
                className="w-full rounded-2xl border border-line bg-card px-4 py-3 text-base text-foreground"
              >
                <option value="">Choose a timeline</option>
                {choices.map((choice) => (
                  <option key={choice.id} value={choice.id} disabled={shares.some((share) => share.timelineId === choice.id)}>
                    {choice.name}
                  </option>
                ))}
              </select>
              <label className="flex items-start gap-3 text-sm leading-relaxed text-foreground">
                <input
                  type="checkbox"
                  className="mt-1 h-4 w-4"
                  checked={allowReshare}
                  onChange={(event) => setAllowReshare(event.target.checked)}
                />
                <span>Members can place this entry on another shared timeline they belong to. They still cannot open the rest of your journal.</span>
              </label>
              <Button type="submit" disabled={busy || !timelineId}>
                {busy ? "Sharing" : "Share entry"}
              </Button>
            </form>
          ) : null}
          {!loading && !choices.length ? (
            <p className="text-sm leading-relaxed text-muted">
              Create a shared timeline and join it before sharing an entry.{" "}
              <Link className={buttonClass("quiet", "px-3")} href="/shared">
                Shared timelines
              </Link>
            </p>
          ) : null}
          {shares.length ? (
            <div className="space-y-3 border-t border-line pt-4">
              <h3 className="font-medium text-foreground">Already shared</h3>
              {shares.map((share) => (
                <div key={share.id} className="space-y-2 rounded-2xl border border-line p-3">
                  <p className="text-sm text-foreground">{share.timelineName ?? "A timeline you are not a member of"}</p>
                  <p className="text-sm text-muted">
                    {share.allowReshare ? "Members can add this entry to another timeline." : "Members cannot add this entry to another timeline."}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="secondary"
                      disabled={busy}
                      onClick={() =>
                        void (async () => {
                          setBusy(true);
                          const result = await setReshare(share.id, !share.allowReshare);
                          setBusy(false);
                          if (!result.ok) {
                            setMessage(result.message);
                            return;
                          }
                          setShares((current) =>
                            current.map((item) => (item.id === share.id ? { ...item, allowReshare: !item.allowReshare } : item)),
                          );
                        })()
                      }
                    >
                      {share.allowReshare ? "Stop resharing" : "Allow resharing"}
                    </Button>
                    <Button
                      variant="danger"
                      disabled={busy}
                      onClick={() =>
                        void (async () => {
                          setBusy(true);
                          const result = await unshareEntry(share.id);
                          setBusy(false);
                          if (!result.ok) {
                            setMessage(result.message);
                            return;
                          }
                          setShares((current) => current.filter((item) => item.id !== share.id));
                          setMessage("Removed from that timeline. Your private entry stays.");
                        })()
                      }
                    >
                      Remove
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : null}
        </Dialog>
      ) : null}
    </>
  );
}
