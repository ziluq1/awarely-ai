"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AccountGate, StatusNote } from "@/components/social-ui";
import { Button, EmptyBlock, ErrorBlock, LoadingBlock, PageHeader, cardClass } from "@/components/ui";
import { useAuth } from "@/components/auth-provider";
import { listNotices, markAllNoticesRead, markNoticeRead } from "@/lib/social";
import type { Notice } from "@/lib/social";
import { formatWhen } from "@/lib/format";
import { safeSocialHref } from "@/lib/social-rules";

export function NotificationsScreen() {
  return (
    <AccountGate>
      <NotificationsBody />
    </AccountGate>
  );
}

function NotificationsBody() {
  const { user } = useAuth();
  const [notices, setNotices] = useState<Notice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    let alive = true;
    void listNotices().then((result) => {
      if (!alive) return;
      setLoading(false);
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setNotices(result.value);
    });
    return () => {
      alive = false;
    };
  }, [user]);

  return (
    <div className="space-y-8">
      <PageHeader eyebrow="Notification" />
      <StatusNote message={message} />
      {loading ? <LoadingBlock label="Loading notifications." /> : null}
      {error ? <ErrorBlock title="Notifications could not be loaded" message={error} /> : null}
      {!loading && !error && notices.some((notice) => !notice.readAt) ? (
        <Button
          variant="secondary"
          onClick={() =>
            void markAllNoticesRead().then(async (result) => {
              if (!result.ok) {
                setMessage(result.message);
                return;
              }
              const next = await listNotices();
              if (next.ok) setNotices(next.value);
              setMessage("Notifications marked as read.");
            })
          }
        >
          Mark all read
        </Button>
      ) : null}
      {!loading && !error && notices.length ? (
        <div className="space-y-3">
          {notices.map((notice) => (
            <Link
              key={notice.id}
              href={safeSocialHref(notice.href)}
              onClick={() => {
                if (!notice.readAt) void markNoticeRead(notice.id);
              }}
              className={`${cardClass} block p-4 sm:p-5 ${notice.readAt ? "" : "border-accent-text/40"}`}
            >
              <p className="text-sm text-muted">{formatWhen(notice.createdAt)}</p>
              <h2 className="mt-1 font-serif text-2xl text-foreground">{notice.title}</h2>
              <p className="mt-2 leading-relaxed text-foreground">{notice.body}</p>
            </Link>
          ))}
        </div>
      ) : null}
      {!loading && !error && !notices.length ? (
        <EmptyBlock title="No notifications yet" message="Friend requests, accepted requests, timeline invitations, and new shared entries will show up here." />
      ) : null}
    </div>
  );
}
