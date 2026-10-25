"use client";

import { useEffect, useId, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth-provider";
import { Button, cardClass, fieldClass } from "@/components/ui";
import { DELETE_CONFIRMATION } from "@/lib/delete-account-rules";
import { clearDeviceJournal } from "@/lib/storage";

export function DeleteAccount() {
  const auth = useAuth();
  const router = useRouter();
  const titleId = useId();
  const [open, setOpen] = useState(false);
  const [confirmation, setConfirmation] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape" && !pending) {
        setOpen(false);
        setConfirmation("");
        setError("");
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, pending]);

  function close() {
    if (pending) return;
    setOpen(false);
    setConfirmation("");
    setError("");
  }

  async function confirmDelete() {
    if (pending || confirmation !== DELETE_CONFIRMATION) return;
    setPending(true);
    setError("");
    let result: { ok?: boolean; message?: string } = {};
    let response: Response;
    try {
      response = await fetch("/api/account", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmation: DELETE_CONFIRMATION }),
      });
      result = (await response.json()) as { ok?: boolean; message?: string };
    } catch {
      setPending(false);
      setError("The account could not be deleted. Check your connection and try again.");
      return;
    }
    if (!response.ok || result.ok !== true) {
      setPending(false);
      setError(result.message || "The account could not be deleted. Try again.");
      return;
    }
    clearDeviceJournal();
    await auth.signOut();
    router.replace("/login?deleted=1");
  }

  return (
    <section aria-labelledby="danger-heading" className={`${cardClass} border-danger p-6 sm:p-8`}>
      <h2 id="danger-heading" className="font-serif text-3xl text-danger">
        Danger Zone
      </h2>
      <p className="mt-3 max-w-xl leading-relaxed text-muted">
        Permanently delete your account and associated data. This action cannot be undone.
      </p>
      {auth.status === "signed-in" ? (
        <Button variant="danger" className="mt-5" onClick={() => setOpen(true)}>
          Delete Account
        </Button>
      ) : (
        <p className="mt-5 text-sm text-muted">Log in to delete your account.</p>
      )}
      {open ? (
        <div className="fixed inset-0 z-40 grid place-items-end bg-background/80 p-3 sm:place-items-center sm:p-6">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            className={`${cardClass} w-full max-w-lg p-5 sm:p-6`}
          >
            <h2 id={titleId} className="font-serif text-3xl text-foreground">
              Delete this account?
            </h2>
            <p className="mt-3 leading-relaxed text-muted">
              This permanently deletes your account, profile, profile photo, and personal records. Shared journals that
              belong to other people stay theirs. This cannot be undone.
            </p>
            <label className="mt-5 block text-sm font-medium text-foreground" htmlFor="delete-confirmation">
              Type DELETE to confirm
              <input
                id="delete-confirmation"
                className={`${fieldClass} mt-2`}
                value={confirmation}
                autoFocus
                autoCapitalize="characters"
                autoCorrect="off"
                spellCheck={false}
                disabled={pending}
                onChange={(event) => setConfirmation(event.target.value)}
              />
            </label>
            {error ? (
              <p className="mt-4 rounded-2xl bg-blush px-4 py-3 text-sm text-blush-text" role="alert">
                {error}
              </p>
            ) : null}
            <div className="mt-5 flex flex-wrap gap-3">
              <Button variant="secondary" disabled={pending} onClick={close}>
                Cancel
              </Button>
              <Button variant="danger" disabled={pending || confirmation !== DELETE_CONFIRMATION} onClick={() => void confirmDelete()}>
                {pending ? "Deleting account…" : "Delete Account"}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
