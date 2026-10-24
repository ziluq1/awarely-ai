"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { AccountGate, Avatar, CoverImage, StatusNote } from "@/components/social-ui";
import { Button, EmptyBlock, ErrorBlock, LoadingBlock, PageHeader, cardClass, fieldClass } from "@/components/ui";
import { useAuth } from "@/components/auth-provider";
import { createTimeline, ensureProfile, inviteFriend, listFriendships, listTimelines, otherPerson, saveCover } from "@/lib/social";
import type { Person, TimelineSummary } from "@/lib/social";
import { formatDay } from "@/lib/format";
import { timelineDescriptionError, timelineNameError } from "@/lib/social-rules";

export function SharedScreen() {
  return (
    <AccountGate>
      <SharedBody />
    </AccountGate>
  );
}

function SharedBody() {
  const { user } = useAuth();
  const me = user?.id ?? "";
  const [timelines, setTimelines] = useState<TimelineSummary[]>([]);
  const [friends, setFriends] = useState<Person[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [cover, setCover] = useState<File | null>(null);

  useEffect(() => {
    if (!me) return;
    let alive = true;
    void Promise.all([ensureProfile(), listTimelines(), listFriendships()]).then(([profile, timelineResult, friendResult]) => {
      if (!alive) return;
      setLoading(false);
      if (!profile.ok) {
        setError(profile.message);
        return;
      }
      if (!timelineResult.ok) {
        setError(timelineResult.message);
        return;
      }
      setTimelines(timelineResult.value);
      if (friendResult.ok) {
        setFriends(
          friendResult.value.flatMap((item) => {
            if (item.status !== "accepted") return [];
            const person = otherPerson(me, item);
            return person ? [person] : [];
          }),
        );
      }
    });
    return () => {
      alive = false;
    };
  }, [me]);

  async function onCreate(event: FormEvent) {
    event.preventDefault();
    const nextError = timelineNameError(name) ?? timelineDescriptionError(description);
    if (nextError) {
      setMessage(nextError);
      return;
    }
    setCreating(true);
    setMessage(null);
    const created = await createTimeline(name, description);
    if (!created.ok) {
      setCreating(false);
      setMessage(created.message);
      return;
    }
    if (cover) {
      const uploaded = await saveCover(created.value, cover);
      if (!uploaded.ok) setMessage(uploaded.message);
    }
    const invites = await Promise.all(selected.map((friendId) => inviteFriend(created.value, friendId)));
    const failed = invites.find((item) => !item.ok);
    const refreshed = await listTimelines();
    setCreating(false);
    setOpen(false);
    setName("");
    setDescription("");
    setSelected([]);
    setCover(null);
    if (refreshed.ok) setTimelines(refreshed.value);
    setMessage(failed && !failed.ok ? `Timeline created. ${failed.message}` : "Shared timeline created. Only the entries you add will be visible there.");
  }

  const invitations = timelines.filter((timeline) => timeline.myStatus === "invited");
  const spaces = timelines.filter((timeline) => timeline.myStatus === "active");

  return (
    <div className="space-y-8">
      <PageHeader eyebrow="Shared timelines" title="A few moments, with a few people">
        <p>Each timeline is a separate space. Sharing one entry does not open the rest of your journal.</p>
        <p>This is not professional mental-health care. Friends only see what you place here.</p>
      </PageHeader>
      <div className="flex flex-wrap gap-2">
        <Button onClick={() => setOpen((value) => !value)}>{open ? "Close form" : "New shared timeline"}</Button>
        <Link className="inline-flex min-h-11 items-center text-sm font-medium text-accent-text" href="/notifications">
          Alerts
        </Link>
      </div>
      <StatusNote message={message} />
      {open ? (
        <form onSubmit={onCreate} className={`${cardClass} space-y-4 p-5 sm:p-6`}>
          <label className="block space-y-2 text-sm font-medium text-foreground" htmlFor="timeline-name">
            Name
            <input id="timeline-name" value={name} maxLength={60} onChange={(event) => setName(event.target.value)} className={fieldClass} />
          </label>
          <label className="block space-y-2 text-sm font-medium text-foreground" htmlFor="timeline-description">
            Description
            <textarea id="timeline-description" value={description} maxLength={280} rows={3} onChange={(event) => setDescription(event.target.value)} className={fieldClass} />
          </label>
          <label className="block space-y-2 text-sm font-medium text-foreground" htmlFor="timeline-cover">
            Cover image
            <input id="timeline-cover" type="file" accept="image/*" className={fieldClass} onChange={(event) => setCover(event.target.files?.[0] ?? null)} />
          </label>
          {friends.length ? (
            <fieldset className="space-y-2">
              <legend className="text-sm font-medium text-foreground">Invite friends</legend>
              {friends.map((friend) => (
                <label key={friend.id} className="flex items-center gap-3 text-sm text-foreground">
                  <input
                    type="checkbox"
                    checked={selected.includes(friend.id)}
                    onChange={(event) =>
                      setSelected((current) =>
                        event.target.checked ? [...current, friend.id] : current.filter((id) => id !== friend.id),
                      )
                    }
                  />
                  {friend.displayName}
                  <span className="text-muted">@{friend.username}</span>
                </label>
              ))}
            </fieldset>
          ) : (
            <p className="text-sm text-muted">Add a friend before you can invite someone.</p>
          )}
          <Button type="submit" disabled={creating}>
            {creating ? "Creating" : "Create timeline"}
          </Button>
        </form>
      ) : null}
      {loading ? <LoadingBlock label="Loading shared timelines." /> : null}
      {error ? <ErrorBlock title="Shared timelines could not be loaded" message={error} /> : null}
      {!loading && !error && invitations.length ? (
        <section className="space-y-3">
          <h2 className="font-serif text-2xl text-foreground">Invitations</h2>
          <div className="grid gap-4 md:grid-cols-2">
            {invitations.map((timeline) => (
              <TimelineCard key={timeline.id} timeline={timeline} />
            ))}
          </div>
        </section>
      ) : null}
      {!loading && !error && spaces.length ? (
        <section className="grid gap-4 md:grid-cols-2">
          {spaces.map((timeline) => (
            <TimelineCard key={timeline.id} timeline={timeline} />
          ))}
        </section>
      ) : null}
      {!loading && !error && !timelines.length ? (
        <EmptyBlock title="No shared timelines yet" message="Create one when you want a separate space for a friend or a small group." />
      ) : null}
    </div>
  );
}

function TimelineCard({ timeline }: { timeline: TimelineSummary }) {
  const activeMembers = timeline.members.filter((member) => member.status === "active" && member.person);
  return (
    <Link href={`/shared/${timeline.id}`} className={`${cardClass} block overflow-hidden p-4 transition hover:bg-accent/40 sm:p-5`}>
      <CoverImage timelineId={timeline.id} name={timeline.name} hasCover={Boolean(timeline.coverPath)} />
      <h2 className="mt-4 font-serif text-3xl text-foreground">{timeline.name}</h2>
      {timeline.description ? <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-muted">{timeline.description}</p> : null}
      <div className="mt-4 flex items-center gap-2">
        <div className="flex -space-x-2">
          {activeMembers.slice(0, 5).map((member) =>
            member.person ? (
              <Avatar key={member.userId} userId={member.userId} name={member.person.displayName} hasPhoto={Boolean(member.person.avatarPath)} size="sm" />
            ) : null,
          )}
        </div>
        <p className="text-sm text-muted">{activeMembers.length} {activeMembers.length === 1 ? "member" : "members"}</p>
      </div>
      <p className="mt-3 text-sm text-muted">
        {timeline.myStatus === "invited"
          ? "Invitation waiting"
          : timeline.latestActivity
            ? `Latest entry ${formatDay(timeline.latestActivity)}`
            : "No entries yet"}
      </p>
    </Link>
  );
}
