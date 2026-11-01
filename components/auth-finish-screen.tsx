"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ErrorBlock, LoadingBlock, PageHeader, buttonClass } from "@/components/ui";
import { finishAuthFromLocation } from "@/lib/finish-auth-client";

export function AuthFinishScreen({
  forcedNext,
  title = "Finishing sign-in",
  description = "This page completes the link from your email or sign-in provider.",
}: {
  forcedNext?: string;
  title?: string;
  description?: string;
}) {
  const [message, setMessage] = useState("");

  useEffect(() => {
    let alive = true;
    void finishAuthFromLocation(forcedNext).then((result) => {
      if (!alive) return;
      if (result.ok) {
        window.location.replace(result.next);
        return;
      }
      setMessage(result.message);
    });
    return () => {
      alive = false;
    };
  }, [forcedNext]);

  return (
    <div className="mx-auto max-w-lg space-y-8">
      <PageHeader eyebrow="Account" title={title}>
        <p>{description}</p>
      </PageHeader>
      {message ? (
        <ErrorBlock title="That link did not finish sign-in" message={message}>
          <Link className={buttonClass("secondary")} href="/login">
            Back to log in
          </Link>
        </ErrorBlock>
      ) : (
        <LoadingBlock label="Checking the sign-in link." />
      )}
    </div>
  );
}
