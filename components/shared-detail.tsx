"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import type { FormEvent } from "react";
import { AccountGate, Avatar, CoverImage, Dialog, SharedPhoto, StatusNote } from "@/components/social-ui";
import { useAuth } from "@/components/auth-provider";
import { Button, EmptyBlock, ErrorBlock, LoadingBlock, PageHeader, buttonClass, cardClass, fieldClass } from "@/components/ui";
import { formatWhen, moodLabel } from "@/lib/format";
import {
  clearCover,
  deleteTimeline,
  inviteFriend,
  leaveTimeline,
  listFriendships,
  listSharedPosts,
  listTimelines,
  otherPerson,
  peopleNames,
  removeMember,
  respondInvite,
  reshareEntry,
  saveCover,
  unshareEntry,
  updateTimeline,
} from "@/lib/social";
import type { Person, SharedPost, TimelineSummary } from "@/lib/social";
import { isUuid, timelineDescriptionError, timelineNameError } from "@/lib/social-rules";

export function SharedDetail({ timelineId }: { timelineId: string }) {
  return (
    <AccountGate>
      <DetailBody timelineId={timelineId} />
    </AccountGate>
  );
}

async function fetchDetail(timelineId: string, currentMe: string) {
  const [timelineResult, postResult, friendResult] = await Promise.all([
    listTimelines(),
    listSharedPosts(timelineId),
    listFriendships(),
  ]);
  if (!timelineResult.ok) return { error: timelineResult.message, missing: false, timeline: null as TimelineSummary | null };
  const found = timelineResult.value.find((item) => item.id === timelineId) ?? null;
  if (!found || !found.myStatus) return { error: null, missing: true, timeline: null as TimelineSummary | null };
  if (!postResult.ok && found.myStatus === "active") {
    return { error: postResult.message, missing: false, timeline: null as TimelineSummary | null };
  }
  const postsNext = found.myStatus === "active" && postResult.ok ? postResult.value : [];
  const ids = [
    ...found.members.map((member) => member.userId),
    ...postsNext.flatMap((post) => [post.sharedBy, post.authorId ?? ""]),
  ];
  const people = await peopleNames(ids);
  if (!people.ok) return { error: people.message, missing: false, timeline: null as TimelineSummary | null };
  const memberIds = new Set(found.members.map((member) => member.userId));
  const friendsNext = friendResult.ok
    ? friendResult.value.flatMap((item) => {
        if (item.status !== "accepted") return [];
        const person = otherPerson(currentMe, item);
        if (!person || memberIds.has(person.id)) return [];
        return [person];
      })
    : [];
  return {
    error: null,
    missing: false,
    timeline: found,
    posts: postsNext,
    names: people.value,
    friends: friendsNext,
    destinations: timelineResult.value
      .filter((item) => item.myStatus === "active" && item.id !== timelineId)
      .map((item) => ({ id: item.id, name: item.name })),
  };
}

function DetailBody({ timelineId }: { timelineId: string }) {
  const { user } = useAuth();
  const me = user?.id ?? "";
  const valid = isUuid(timelineId);
  const [timeline, setTimeline] = useState<TimelineSummary | null>(null);
  const [posts, setPosts] = useState<SharedPost[]>([]);
  const [names, setNames] = useState<Map<string, Person>>(new Map());
  const [friends, setFriends] = useState<Person[]>([]);
  const [loading, setLoading] = useState(valid);
  const [missing, setMissing] = useState(!valid);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [inviteId, setInviteId] = useState("");
  const [confirm, setConfirm] = useState<"delete" | "leave" | { remove: string } | null>(null);
  const [photoEntry, setPhotoEntry] = useState<string | null>(null);
  const [resharePost, setResharePost] = useState<SharedPost | null>(null);
  const [destinations, setDestinations] = useState<{ id: string; name: string }[]>([]);

  function applyDetail(result: Awaited<ReturnType<typeof fetchDetail>>) {
    setError(result.error);
    setMissing(result.missing);
    if (!result.timeline) return;
    setTimeline(result.timeline);
    setName(result.timeline.name);
    setDescription(result.timeline.description ?? "");
    if (result.posts) setPosts(result.posts);
    if (result.names) setNames(result.names);
    if (result.friends) setFriends(result.friends);
    if (result.destinations) setDestinations(result.destinations);
  }

  useEffect(() => {
    if (!me || !valid) return;
    let alive = true;
    void fetchDetail(timelineId, me).then((result) => {
      if (!alive) return;
      setError(result.error);
      setMissing(result.missing);
      if (result.timeline) {
        setTimeline(result.timeline);
        setName(result.timeline.name);
        setDescription(result.timeline.description ?? "");
        setPosts(result.posts ?? []);
        setNames(result.names ?? new Map());
        setFriends(result.friends ?? []);
        setDestinations(result.destinations ?? []);
      }
      setLoading(false);
    });
    return () => {
      alive = false;
    };
  }, [me, timelineId, valid]);

  async function refresh(success: string) {
    applyDetail(await fetchDetail(timelineId, me));
    setBusy(false);
    setConfirm(null);
    setMessage(success);
  }

  if (loading) return <LoadingBlock label="Loading this shared timeline." />;
  if (error && !timeline) return <ErrorBlock title="This timeline could not be loaded" message={error} />;

  if (!valid || missing || !timeline) {
    return (
      <EmptyBlock title="That shared timeline is not available" message="It may have been removed, or you may not be a member.">
        <Link className={buttonClass("secondary")} href="/shared">
          All shared timelines
        </Link>
      </EmptyBlock>
    );
  }

  const owner = timeline.myRole === "owner";
  const invited = timeline.myStatus === "invited";

  return (
    <div className="space-y-8">
      <PageHeader eyebrow="Shared timeline" title={timeline.name}>
        <p>Only current members can see the entries on this timeline. The rest of each person’s journal stays private.</p>
        <p>A shared timeline is not professional mental-health care.</p>
      </PageHeader>
      <div className="flex flex-wrap gap-2">
        <Link className={buttonClass("secondary")} href="/shared">
          All shared timelines
        </Link>
        <Link className={buttonClass("quiet")} href="/timeline">
          Your private timeline
        </Link>
      </div>
      <StatusNote message={message} />
      {error ? <ErrorBlock title="This timeline could not be loaded" message={error} /> : null}
      <CoverImage timelineId={timeline.id} name={timeline.name} hasCover={Boolean(timeline.coverPath)} />
      {timeline.description ? <p className="max-w-2xl leading-relaxed text-muted">{timeline.description}</p> : null}

      {invited ? (
        <div className={`${cardClass} space-y-4 p-5`}>
          <h2 className="font-serif text-2xl text-foreground">You are invited</h2>
          <p className="text-sm leading-relaxed text-muted">Accept to see the entries people have chosen to share here.</p>
          <div className="flex flex-wrap gap-2">
            <Button disabled={busy} onClick={() => void (async () => { setBusy(true); const result = await respondInvite(timeline.id, true); if (!result.ok) { setBusy(false); setMessage(result.message); return; } await refresh("You joined the timeline."); })()}>
              Accept
            </Button>
            <Button variant="secondary" disabled={busy} onClick={() => void (async () => { setBusy(true); const result = await respondInvite(timeline.id, false); if (!result.ok) { setBusy(false); setMessage(result.message); return; } await refresh("Invitation declined."); })()}>
              Decline
            </Button>
          </div>
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
          <section className="space-y-4" aria-label="Shared entries">
            {posts.length ? (
              posts.map((post) => (
                <SharedEntryCard
                  key={post.id}
                  post={post}
                  names={names}
                  mine={post.authorId === me}
                  busy={busy}
                  onOpen={() => setPhotoEntry(post.entryId)}
                  onUnshare={() =>
                    void (async () => {
                      setBusy(true);
                      const result = await unshareEntry(post.id);
                      if (!result.ok) {
                        setBusy(false);
                        setMessage(result.message);
                        return;
                      }
                      await refresh("Entry removed from this timeline. Your private copy stays.");
                    })()
                  }
                  onReshare={post.allowReshare ? () => setResharePost(post) : undefined}
                />
              ))
            ) : (
              <EmptyBlock title="No shared entries yet" message="Entries appear here only after someone chooses to share one from their private timeline." />
            )}
          </section>
          <aside className={`${cardClass} h-fit space-y-4 p-4 sm:p-5`}>
            <h2 className="font-serif text-2xl text-foreground">Members</h2>
            <ul className="space-y-3">
              {timeline.members.map((member) => {
                const person = member.person ?? names.get(member.userId);
                const label = person?.displayName ?? "Member";
                return (
                  <li key={member.userId} className="flex items-center justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-2">
                      <Avatar userId={member.userId} name={label} hasPhoto={Boolean(person?.avatarPath)} size="sm" />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-foreground">{label}</p>
                        <p className="text-xs text-muted">{member.role === "owner" ? "Owner" : member.status === "invited" ? "Invited" : "Member"}</p>
                      </div>
                    </div>
                    {owner && member.userId !== me ? (
                      <Button variant="quiet" className="px-3" disabled={busy} onClick={() => setConfirm({ remove: member.userId })}>
                        Remove
                      </Button>
                    ) : null}
                  </li>
                );
              })}
            </ul>
            {owner ? (
              <form
                className="space-y-3 border-t border-line pt-4"
                onSubmit={(event) => {
                  event.preventDefault();
                  if (!inviteId) return;
                  void (async () => {
                    setBusy(true);
                    const result = await inviteFriend(timeline.id, inviteId);
                    if (!result.ok) {
                      setBusy(false);
                      setMessage(result.message);
                      return;
                    }
                    setInviteId("");
                    await refresh("Invitation sent.");
                  })();
                }}
              >
                <label className="block text-sm font-medium text-foreground" htmlFor="invite-friend">
                  Invite a friend
                </label>
                <select id="invite-friend" value={inviteId} onChange={(event) => setInviteId(event.target.value)} className={fieldClass}>
                  <option value="">Choose a friend</option>
                  {friends.map((friend) => (
                    <option key={friend.id} value={friend.id}>
                      {friend.displayName}
                    </option>
                  ))}
                </select>
                <Button type="submit" variant="secondary" disabled={busy || !inviteId}>
                  Send invitation
                </Button>
              </form>
            ) : (
              <Button variant="secondary" disabled={busy} onClick={() => setConfirm("leave")}>
                Leave timeline
              </Button>
            )}
          </aside>
        </div>
      )}

      {owner ? (
        <OwnerTools
          busy={busy}
          name={name}
          description={description}
          hasCover={Boolean(timeline.coverPath)}
          onName={setName}
          onDescription={setDescription}
          onSave={async (event) => {
            event.preventDefault();
            const nextError = timelineNameError(name) ?? timelineDescriptionError(description);
            if (nextError) {
              setMessage(nextError);
              return;
            }
            setBusy(true);
            const result = await updateTimeline(timeline.id, name, description);
            if (!result.ok) {
              setBusy(false);
              setMessage(result.message);
              return;
            }
            await refresh("Timeline updated.");
          }}
          onCover={async (file) => {
            if (!file) return;
            setBusy(true);
            const result = await saveCover(timeline.id, file);
            if (!result.ok) {
              setBusy(false);
              setMessage(result.message);
              return;
            }
            await refresh("Cover image saved.");
          }}
          onClearCover={async () => {
            setBusy(true);
            const result = await clearCover(timeline.id, timeline.coverPath);
            if (!result.ok) {
              setBusy(false);
              setMessage(result.message);
              return;
            }
            await refresh("Cover image removed.");
          }}
          onDelete={() => setConfirm("delete")}
        />
      ) : null}

      {confirm === "delete" ? (
        <Dialog title="Delete this shared timeline?" onClose={() => setConfirm(null)}>
          <p className="leading-relaxed text-muted">Members will lose access. This does not delete anyone’s private journal.</p>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="danger"
              disabled={busy}
              onClick={() =>
                void (async () => {
                  setBusy(true);
                  const result = await deleteTimeline(timeline.id, timeline.coverPath);
                  if (!result.ok) {
                    setBusy(false);
                    setMessage(result.message);
                    return;
                  }
                  setMissing(true);
                  setMessage("Timeline deleted.");
                  setBusy(false);
                  setConfirm(null);
                })()
              }
            >
              Delete timeline
            </Button>
            <Button variant="secondary" onClick={() => setConfirm(null)}>
              Keep it
            </Button>
          </div>
        </Dialog>
      ) : null}
      {confirm === "leave" ? (
        <Dialog title="Leave this shared timeline?" onClose={() => setConfirm(null)}>
          <p className="leading-relaxed text-muted">You will stop seeing its entries. Entries you already shared stay until you remove them from your private timeline.</p>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="danger"
              disabled={busy}
              onClick={() =>
                void (async () => {
                  setBusy(true);
                  const result = await leaveTimeline(timeline.id);
                  if (!result.ok) {
                    setBusy(false);
                    setMessage(result.message);
                    return;
                  }
                  await refresh("You left the timeline.");
                })()
              }
            >
              Leave
            </Button>
            <Button variant="secondary" onClick={() => setConfirm(null)}>
              Stay
            </Button>
          </div>
        </Dialog>
      ) : null}
      {confirm && typeof confirm === "object" ? (
        <Dialog title="Remove this member?" onClose={() => setConfirm(null)}>
          <p className="leading-relaxed text-muted">They will lose access to entries shared on this timeline.</p>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="danger"
              disabled={busy}
              onClick={() =>
                void (async () => {
                  setBusy(true);
                  const result = await removeMember(timeline.id, confirm.remove);
                  if (!result.ok) {
                    setBusy(false);
                    setMessage(result.message);
                    return;
                  }
                  await refresh("Member removed.");
                })()
              }
            >
              Remove member
            </Button>
            <Button variant="secondary" onClick={() => setConfirm(null)}>
              Keep
            </Button>
          </div>
        </Dialog>
      ) : null}
      {photoEntry ? <PhotoDialog entryId={photoEntry} onClose={() => setPhotoEntry(null)} /> : null}
      {resharePost ? (
        <Dialog title="Add to another timeline" onClose={() => setResharePost(null)}>
          <p className="text-sm leading-relaxed text-muted">The owner allowed this entry to be placed on another timeline you belong to.</p>
          {destinations.length ? (
            <div className="space-y-2">
              {destinations.map((destination) => (
                <Button
                  key={destination.id}
                  variant="secondary"
                  disabled={busy}
                  onClick={() =>
                    void (async () => {
                      setBusy(true);
                      const result = await reshareEntry(timeline.id, destination.id, resharePost.entryId);
                      if (!result.ok) {
                        setBusy(false);
                        setMessage(result.message);
                        setResharePost(null);
                        return;
                      }
                      setResharePost(null);
                      await refresh(`Added to ${destination.name}.`);
                    })()
                  }
                >
                  {destination.name}
                </Button>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted">Join another shared timeline before adding this entry there.</p>
          )}
        </Dialog>
      ) : null}
    </div>
  );
}

function SharedEntryCard({
  post,
  names,
  mine,
  busy,
  onOpen,
  onUnshare,
  onReshare,
}: {
  post: SharedPost;
  names: Map<string, Person>;
  mine: boolean;
  busy: boolean;
  onOpen: () => void;
  onUnshare: () => void;
  onReshare?: () => void;
}) {
  const author = post.authorId ? names.get(post.authorId) : null;
  const sharer = names.get(post.sharedBy);
  const when = post.createdAtEntry ?? post.createdAt;
  const mood = moodLabel(post.mood);
  const feeling = [mood, post.customFeeling].filter(Boolean).join(" · ") || "No mood label";
  return (
    <article id={`shared-${post.entryId}`} className={`${cardClass} space-y-3 p-4 sm:p-5`}>
      <div className="flex items-center gap-3">
        <Avatar userId={post.sharedBy} name={sharer?.displayName ?? "Member"} hasPhoto={Boolean(sharer?.avatarPath)} size="sm" />
        <div>
          <p className="text-sm font-medium text-foreground">Shared by {sharer?.displayName ?? "a member"}</p>
          {author && author.id !== post.sharedBy ? <p className="text-sm text-muted">Written by {author.displayName}</p> : null}
        </div>
      </div>
      <h3 className="font-serif text-2xl text-foreground">{formatWhen(when)}</h3>
      <p className="text-sm text-muted">{feeling}</p>
      {post.photoPath ? (
        <button type="button" onClick={onOpen} className="block w-full overflow-hidden rounded-2xl outline-offset-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-text" aria-label={`View the shared photo from ${formatWhen(when)}`}>
          <SharedPhoto entryId={post.entryId} alt="" className="max-h-80 w-full bg-accent object-cover" />
        </button>
      ) : null}
      {post.journalText ? <p className="journal-text text-lg leading-relaxed text-foreground">{post.journalText}</p> : null}
      <div className="flex flex-wrap gap-2">
        {mine ? (
          <Button variant="secondary" disabled={busy} onClick={onUnshare}>
            Remove from this timeline
          </Button>
        ) : null}
        {onReshare ? (
          <Button variant="quiet" disabled={busy} onClick={onReshare}>
            Add to another timeline
          </Button>
        ) : null}
      </div>
    </article>
  );
}

function OwnerTools({
  busy,
  name,
  description,
  hasCover,
  onName,
  onDescription,
  onSave,
  onCover,
  onClearCover,
  onDelete,
}: {
  busy: boolean;
  name: string;
  description: string;
  hasCover: boolean;
  onName: (value: string) => void;
  onDescription: (value: string) => void;
  onSave: (event: FormEvent) => void;
  onCover: (file: File | undefined) => void;
  onClearCover: () => void;
  onDelete: () => void;
}) {
  return (
    <form onSubmit={onSave} className={`${cardClass} space-y-4 p-5`}>
      <h2 className="font-serif text-2xl text-foreground">Timeline settings</h2>
      <label className="block space-y-2 text-sm font-medium text-foreground" htmlFor="rename-timeline">
        Name
        <input id="rename-timeline" value={name} maxLength={60} onChange={(event) => onName(event.target.value)} className={fieldClass} />
      </label>
      <label className="block space-y-2 text-sm font-medium text-foreground" htmlFor="describe-timeline">
        Description
        <textarea id="describe-timeline" value={description} maxLength={280} rows={3} onChange={(event) => onDescription(event.target.value)} className={fieldClass} />
      </label>
      <Button type="submit" disabled={busy}>
        Save changes
      </Button>
      <label className="block space-y-2 text-sm font-medium text-foreground" htmlFor="replace-cover">
        Cover image
        <input id="replace-cover" type="file" accept="image/*" className={fieldClass} disabled={busy} onChange={(event) => onCover(event.target.files?.[0])} />
      </label>
      {hasCover ? (
        <Button type="button" variant="secondary" disabled={busy} onClick={onClearCover}>
          Remove cover
        </Button>
      ) : null}
      <Button type="button" variant="danger" disabled={busy} onClick={onDelete}>
        Delete timeline
      </Button>
    </form>
  );
}

function PhotoDialog({ entryId, onClose }: { entryId: string; onClose: () => void }) {
  const titleId = useId();
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onCloseRef.current();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  return (
    <div className="fixed inset-0 z-40 grid place-items-center bg-background/90 p-4">
      <div role="dialog" aria-modal="true" aria-labelledby={titleId} className="w-full max-w-3xl">
        <div className="mb-3 flex justify-end">
          <Button autoFocus onClick={onClose}>
            Close
          </Button>
        </div>
        <h2 id={titleId} className="sr-only">
          Shared photo
        </h2>
        <SharedPhoto entryId={entryId} alt="Shared photo" className="max-h-[80dvh] w-full rounded-2xl object-contain" />
      </div>
    </div>
  );
}

