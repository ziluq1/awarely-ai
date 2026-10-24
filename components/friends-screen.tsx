"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { AccountGate, Avatar, Dialog, StatusNote } from "@/components/social-ui";
import { Button, EmptyBlock, ErrorBlock, LoadingBlock, PageHeader, buttonClass, cardClass, fieldClass } from "@/components/ui";
import { useAuth } from "@/components/auth-provider";
import {
  blockPerson,
  cancelFriendRequest,
  ensureProfile,
  listBlocks,
  listFriendships,
  otherPerson,
  removeFriend,
  respondFriendRequest,
  searchPeople,
  sendFriendRequest,
  unblockPerson,
} from "@/lib/social";
import type { Friendship, Person } from "@/lib/social";
import { friendAction, searchQueryError } from "@/lib/social-rules";
import type { FriendAction } from "@/lib/social-rules";

type Tab = "friends" | "incoming" | "sent";
type Confirm = { kind: "remove" | "block"; person: Person } | null;

async function fetchFriends() {
  const [profile, friends, blocked] = await Promise.all([ensureProfile(), listFriendships(), listBlocks()]);
  if (!profile.ok) return { error: profile.message, friendships: null, blocks: null };
  if (!friends.ok) return { error: friends.message, friendships: null, blocks: null };
  if (!blocked.ok) return { error: blocked.message, friendships: null, blocks: null };
  return { error: null, friendships: friends.value, blocks: blocked.value };
}

export function FriendsScreen() {
  return (
    <AccountGate>
      <FriendsBody />
    </AccountGate>
  );
}

function FriendsBody() {
  const { user } = useAuth();
  const me = user?.id ?? "";
  const [tab, setTab] = useState<Tab>("friends");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Person[]>([]);
  const [friendships, setFriendships] = useState<Friendship[]>([]);
  const [blocks, setBlocks] = useState<Person[]>([]);
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<Confirm>(null);

  function applyFriends(result: Awaited<ReturnType<typeof fetchFriends>>) {
    setError(result.error);
    if (result.friendships) setFriendships(result.friendships);
    if (result.blocks) setBlocks(result.blocks);
  }

  useEffect(() => {
    if (!me) return;
    let alive = true;
    void fetchFriends().then((result) => {
      if (!alive) return;
      setError(result.error);
      if (result.friendships) setFriendships(result.friendships);
      if (result.blocks) setBlocks(result.blocks);
      setLoading(false);
    });
    return () => {
      alive = false;
    };
  }, [me]);

  async function onSearch(event: FormEvent) {
    event.preventDefault();
    const queryError = searchQueryError(query);
    if (queryError) {
      setMessage(queryError);
      return;
    }
    setSearching(true);
    setMessage(null);
    const result = await searchPeople(query);
    setSearching(false);
    if (!result.ok) {
      setMessage(result.message);
      return;
    }
    setResults(result.value.filter((person) => person.id !== me));
    if (!result.value.length) setMessage("No one else matched. Search uses a name or username, not an email address.");
  }

  async function run(key: string, action: () => Promise<{ ok: true } | { ok: false; message: string }>, success: string) {
    setBusy(key);
    setMessage(null);
    const result = await action();
    if (!result.ok) {
      setBusy(null);
      setMessage(result.message);
      return;
    }
    applyFriends(await fetchFriends());
    setBusy(null);
    setMessage(success);
    setConfirm(null);
  }

  const links = friendships.map((item) => ({
    requesterId: item.requesterId,
    addresseeId: item.addresseeId,
    status: item.status,
  }));
  const blockedIds = blocks.map((person) => person.id);
  const incoming = friendships.filter((item) => item.status === "pending" && item.addresseeId === me);
  const sent = friendships.filter((item) => item.status === "pending" && item.requesterId === me);
  const friends = friendships.filter((item) => item.status === "accepted");

  return (
    <div className="space-y-8">
      <PageHeader eyebrow="Friends" title="People you choose">
        <p>
          Search uses the name or username someone chose to share. Email addresses stay private. A friend request does
          not share your journal.
        </p>
        <p>Friends are not a substitute for professional mental-health care.</p>
      </PageHeader>
      <div className="flex flex-wrap gap-2">
        <Link className={buttonClass("secondary")} href="/profile">
          Your profile
        </Link>
        <Link className={buttonClass("secondary")} href="/shared">
          Shared timelines
        </Link>
        <Link className={buttonClass("quiet")} href="/notifications">
          Alerts
        </Link>
      </div>

      <form onSubmit={onSearch} className={`${cardClass} space-y-3 p-4 sm:p-5`}>
        <label className="block text-sm font-medium text-foreground" htmlFor="friend-search">
          Search by name or username
        </label>
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            id="friend-search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className={fieldClass}
            placeholder="Name or username"
            autoComplete="off"
            maxLength={40}
          />
          <Button type="submit" disabled={searching}>
            {searching ? "Searching" : "Search"}
          </Button>
        </div>
      </form>

      <StatusNote message={message} />
      {error ? <ErrorBlock title="Friends could not be loaded" message={error} /> : null}
      {loading ? <LoadingBlock label="Loading friends." /> : null}

      {results.length ? (
        <section className="space-y-3" aria-label="Search results">
          <h2 className="font-serif text-2xl text-foreground">Search results</h2>
          {results.map((person) => (
            <PersonCard
              key={person.id}
              person={person}
              action={friendAction(me, person.id, links, blockedIds)}
              busy={busy}
              onAdd={() => void run(person.id, () => sendFriendRequest(person.username), `Friend request sent to ${person.displayName}.`)}
              onCancel={() => {
                const row = friendships.find((item) => item.requesterId === me && (item.addresseeId === person.id || item.requester?.id === person.id) && item.status === "pending");
                if (!row) return;
                void run(row.id, () => cancelFriendRequest(row.id), "Request cancelled.");
              }}
              onAccept={() => {
                const row = incoming.find((item) => item.requesterId === person.id);
                if (!row) return;
                void run(row.id, () => respondFriendRequest(row.id, true), `You and ${person.displayName} are now friends.`);
              }}
              onDecline={() => {
                const row = incoming.find((item) => item.requesterId === person.id);
                if (!row) return;
                void run(row.id, () => respondFriendRequest(row.id, false), "Request declined.");
              }}
            />
          ))}
        </section>
      ) : null}

      <div role="tablist" aria-label="Friend lists" className="flex flex-wrap gap-2">
        <TabButton current={tab} id="friends" label="Friends" count={friends.length} onSelect={setTab} />
        <TabButton current={tab} id="incoming" label="Incoming" count={incoming.length} onSelect={setTab} />
        <TabButton current={tab} id="sent" label="Sent" count={sent.length} onSelect={setTab} />
      </div>

      {!loading && !error && tab === "friends" ? (
        friends.length ? (
          <div className="space-y-3">
            {friends.map((item) => {
              const person = otherPerson(me, item);
              if (!person) return null;
              return (
                <PersonCard
                  key={item.id}
                  person={person}
                  action="friends"
                  busy={busy}
                  onRemove={() => setConfirm({ kind: "remove", person })}
                  onBlock={() => setConfirm({ kind: "block", person })}
                />
              );
            })}
          </div>
        ) : (
          <EmptyBlock title="No friends yet" message="Search for someone by the name or username they chose to share." />
        )
      ) : null}

      {!loading && !error && tab === "incoming" ? (
        incoming.length ? (
          <div className="space-y-3">
            {incoming.map((item) => {
              const person = item.requester;
              if (!person) return null;
              return (
                <PersonCard
                  key={item.id}
                  person={person}
                  action="incoming"
                  busy={busy}
                  onAccept={() => void run(item.id, () => respondFriendRequest(item.id, true), `${person.displayName} is now a friend.`)}
                  onDecline={() => void run(item.id, () => respondFriendRequest(item.id, false), "Request declined.")}
                  onBlock={() => setConfirm({ kind: "block", person })}
                />
              );
            })}
          </div>
        ) : (
          <EmptyBlock title="No incoming requests" message="When someone sends you a request, it will wait here." />
        )
      ) : null}

      {!loading && !error && tab === "sent" ? (
        sent.length ? (
          <div className="space-y-3">
            {sent.map((item) => {
              const person = item.addressee;
              if (!person) return null;
              return (
                <PersonCard
                  key={item.id}
                  person={person}
                  action="outgoing"
                  busy={busy}
                  onCancel={() => void run(item.id, () => cancelFriendRequest(item.id), "Request cancelled.")}
                />
              );
            })}
          </div>
        ) : (
          <EmptyBlock title="No sent requests" message="A request you send will stay here until it is accepted, declined, or cancelled." />
        )
      ) : null}

      {blocks.length ? (
        <section className="space-y-3">
          <h2 className="font-serif text-2xl text-foreground">Blocked</h2>
          <p className="text-sm leading-relaxed text-muted">
            Blocking stops friend requests. It does not remove someone from a shared timeline. Remove them there too if
            you need to.
          </p>
          {blocks.map((person) => (
            <PersonCard
              key={person.id}
              person={person}
              action="blocked"
              busy={busy}
              onUnblock={() => void run(person.id, () => unblockPerson(person.id), `${person.displayName} is unblocked.`)}
            />
          ))}
        </section>
      ) : null}

      {confirm ? (
        <Dialog title={confirm.kind === "block" ? "Block this person?" : "Remove this friend?"} onClose={() => setConfirm(null)}>
          <p className="leading-relaxed text-muted">
            {confirm.kind === "block"
              ? `${confirm.person.displayName} will not be able to send you a request. This does not delete your journal.`
              : `${confirm.person.displayName} will be removed from your friends. Shared entries stay until you remove them.`}
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="danger"
              disabled={busy === confirm.person.id}
              onClick={() =>
                void run(
                  confirm.person.id,
                  () => (confirm.kind === "block" ? blockPerson(confirm.person.id) : removeFriend(confirm.person.id)),
                  confirm.kind === "block" ? "Blocked. They can no longer send you a request." : "Removed from your friends.",
                )
              }
            >
              {confirm.kind === "block" ? "Block" : "Remove friend"}
            </Button>
            <Button variant="secondary" onClick={() => setConfirm(null)}>
              Keep
            </Button>
          </div>
        </Dialog>
      ) : null}
    </div>
  );
}

function TabButton({
  current,
  id,
  label,
  count,
  onSelect,
}: {
  current: Tab;
  id: Tab;
  label: string;
  count: number;
  onSelect: (tab: Tab) => void;
}) {
  const selected = current === id;
  return (
    <button
      type="button"
      role="tab"
      aria-selected={selected}
      className={buttonClass(selected ? "primary" : "secondary", "px-4")}
      onClick={() => onSelect(id)}
    >
      {label}
      {count ? ` (${count})` : ""}
    </button>
  );
}

function PersonCard({
  person,
  action,
  busy,
  onAdd,
  onAccept,
  onDecline,
  onCancel,
  onRemove,
  onBlock,
  onUnblock,
}: {
  person: Person;
  action: FriendAction;
  busy: string | null;
  onAdd?: () => void;
  onAccept?: () => void;
  onDecline?: () => void;
  onCancel?: () => void;
  onRemove?: () => void;
  onBlock?: () => void;
  onUnblock?: () => void;
}) {
  const disabled = busy !== null;
  return (
    <article className={`${cardClass} flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between`}>
      <div className="flex min-w-0 items-center gap-3">
        <Avatar userId={person.id} name={person.displayName} hasPhoto={Boolean(person.avatarPath)} />
        <div className="min-w-0">
          <Link href={`/friends/${person.username}`} className="block truncate font-medium text-foreground">
            {person.displayName}
          </Link>
          <p className="truncate text-sm text-muted">@{person.username}</p>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        {action === "add" && onAdd ? (
          <Button disabled={disabled} onClick={onAdd}>
            Add friend
          </Button>
        ) : null}
        {action === "incoming" && onAccept && onDecline ? (
          <>
            <Button disabled={disabled} onClick={onAccept}>
              Accept
            </Button>
            <Button variant="secondary" disabled={disabled} onClick={onDecline}>
              Decline
            </Button>
          </>
        ) : null}
        {action === "outgoing" && onCancel ? (
          <Button variant="secondary" disabled={disabled} onClick={onCancel}>
            Cancel request
          </Button>
        ) : null}
        {action === "friends" ? <span className="self-center text-sm text-muted">Friends</span> : null}
        {action === "friends" && onRemove ? (
          <Button variant="secondary" disabled={disabled} onClick={onRemove}>
            Remove
          </Button>
        ) : null}
        {action === "blocked" && onUnblock ? (
          <Button variant="secondary" disabled={disabled} onClick={onUnblock}>
            Unblock
          </Button>
        ) : null}
        {action === "self" ? <span className="self-center text-sm text-muted">This is you</span> : null}
        {(action === "friends" || action === "incoming") && onBlock ? (
          <Button variant="quiet" disabled={disabled} onClick={onBlock}>
            Block
          </Button>
        ) : null}
      </div>
    </article>
  );
}
