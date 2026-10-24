"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AccountGate, Avatar, StatusNote } from "@/components/social-ui";
import { useAuth } from "@/components/auth-provider";
import { Button, EmptyBlock, ErrorBlock, LoadingBlock, PageHeader, buttonClass, cardClass } from "@/components/ui";
import {
  blockPerson,
  cancelFriendRequest,
  listBlocks,
  listFriendships,
  profileByUsername,
  respondFriendRequest,
  sendFriendRequest,
} from "@/lib/social";
import type { Friendship, Person } from "@/lib/social";
import { friendAction, usernameError } from "@/lib/social-rules";

export function FriendProfile({ username }: { username: string }) {
  return (
    <AccountGate>
      <FriendProfileBody key={username.trim().toLowerCase()} username={username} />
    </AccountGate>
  );
}

function FriendProfileBody({ username }: { username: string }) {
  const { user } = useAuth();
  const me = user?.id ?? "";
  const name = username.trim().toLowerCase();
  const invalid = Boolean(usernameError(name));
  const [person, setPerson] = useState<Person | null>(null);
  const [friendships, setFriendships] = useState<Friendship[]>([]);
  const [blockedIds, setBlockedIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(!invalid);
  const [missing, setMissing] = useState(invalid);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!me || invalid) return;
    let alive = true;
    void Promise.all([profileByUsername(name), listFriendships(), listBlocks()]).then(([profile, friends, blocks]) => {
      if (!alive) return;
      setLoading(false);
      if (!profile.ok) {
        setError(profile.message);
        return;
      }
      if (!friends.ok) {
        setError(friends.message);
        return;
      }
      if (!blocks.ok) {
        setError(blocks.message);
        return;
      }
      setPerson(profile.value);
      setMissing(!profile.value);
      setFriendships(friends.value);
      setBlockedIds(blocks.value.map((item) => item.id));
    });
    return () => {
      alive = false;
    };
  }, [invalid, me, name]);

  async function act(action: () => Promise<{ ok: true; value: null } | { ok: false; message: string }>, success: string) {
    setBusy(true);
    setMessage(null);
    const result = await action();
    if (!result.ok) {
      setBusy(false);
      setMessage(result.message);
      return;
    }
    const friends = await listFriendships();
    setBusy(false);
    if (friends.ok) setFriendships(friends.value);
    setMessage(success);
  }

  if (invalid || missing) {
    return (
      <EmptyBlock title="That profile is not available" message="It may be private, or the username may be different.">
        <Link className={buttonClass("secondary")} href="/friends">
          Back to friends
        </Link>
      </EmptyBlock>
    );
  }

  const action = person ? friendAction(me, person.id, friendships.map((item) => ({
    requesterId: item.requesterId,
    addresseeId: item.addresseeId,
    status: item.status,
  })), blockedIds) : "add";
  const incoming = friendships.find((item) => person && item.status === "pending" && item.requesterId === person.id && item.addresseeId === me);
  const outgoing = friendships.find((item) => person && item.status === "pending" && item.requesterId === me && item.addresseeId === person.id);

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Profile" title={person?.displayName ?? "Profile"}>
        <p>This is the profile they chose to share. Their journal stays private.</p>
      </PageHeader>
      <Link className={buttonClass("secondary")} href="/friends">
        Back to friends
      </Link>
      {loading ? <LoadingBlock label="Loading profile." /> : null}
      {error ? <ErrorBlock title="Profile could not be loaded" message={error} /> : null}
      <StatusNote message={message} />
      {person ? (
        <article className={`${cardClass} space-y-4 p-5 sm:p-6`}>
          <div className="flex items-center gap-3">
            <Avatar userId={person.id} name={person.displayName} hasPhoto={Boolean(person.avatarPath)} />
            <div>
              <h2 className="font-serif text-3xl text-foreground">{person.displayName}</h2>
              <p className="text-sm text-muted">@{person.username}</p>
            </div>
          </div>
          {person.bio ? <p className="leading-relaxed text-foreground">{person.bio}</p> : null}
          <div className="flex flex-wrap gap-2">
            {action === "self" ? (
              <Link className={buttonClass("primary")} href="/profile">
                Edit your profile
              </Link>
            ) : null}
            {action === "add" ? (
              <Button disabled={busy} onClick={() => void act(() => sendFriendRequest(person.username), `Friend request sent to ${person.displayName}.`)}>
                Add friend
              </Button>
            ) : null}
            {action === "incoming" && incoming ? (
              <>
                <Button disabled={busy} onClick={() => void act(() => respondFriendRequest(incoming.id, true), "Friend request accepted.")}>
                  Accept
                </Button>
                <Button variant="secondary" disabled={busy} onClick={() => void act(() => respondFriendRequest(incoming.id, false), "Request declined.")}>
                  Decline
                </Button>
              </>
            ) : null}
            {action === "outgoing" && outgoing ? (
              <Button variant="secondary" disabled={busy} onClick={() => void act(() => cancelFriendRequest(outgoing.id), "Request cancelled.")}>
                Cancel request
              </Button>
            ) : null}
            {action === "friends" ? <p className="self-center text-sm text-muted">You are friends. Their journal is still private.</p> : null}
            {action === "blocked" ? <p className="self-center text-sm text-muted">You blocked this person.</p> : null}
            {action === "add" || action === "incoming" ? (
              <Button variant="quiet" disabled={busy} onClick={() => void act(() => blockPerson(person.id), "Blocked. They can no longer send you a request.")}>
                Block
              </Button>
            ) : null}
          </div>
        </article>
      ) : null}
    </div>
  );
}
