"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { AccountGate, Avatar, StatusNote } from "@/components/social-ui";
import { useAuth } from "@/components/auth-provider";
import { Button, ErrorBlock, LoadingBlock, PageHeader, buttonClass, cardClass, fieldClass } from "@/components/ui";
import { clearAvatar, ensureProfile, saveAvatar, updateProfile } from "@/lib/social";
import type { Profile } from "@/lib/social";
import { bioError, displayNameError, usernameError } from "@/lib/social-rules";

export function ProfileScreen() {
  return (
    <AccountGate>
      <ProfileBody />
    </AccountGate>
  );
}

function ProfileBody() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [searchable, setSearchable] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) return;
    let alive = true;
    void ensureProfile().then((result) => {
      if (!alive) return;
      setLoading(false);
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setProfile(result.value);
      setUsername(result.value.username);
      setDisplayName(result.value.displayName);
      setBio(result.value.bio ?? "");
      setSearchable(result.value.searchable);
    });
    return () => {
      alive = false;
    };
  }, [user]);

  async function onSave(event: FormEvent) {
    event.preventDefault();
    const nextError = usernameError(username) ?? displayNameError(displayName) ?? bioError(bio);
    if (nextError) {
      setMessage(nextError);
      return;
    }
    setSaving(true);
    setMessage(null);
    const result = await updateProfile({ username, displayName, bio, searchable });
    setSaving(false);
    if (!result.ok) {
      setMessage(result.message);
      return;
    }
    setProfile(result.value);
    setUsername(result.value.username);
    setMessage("Profile saved. Your journal is still private.");
  }

  async function onPhoto(file: File | undefined) {
    if (!file) return;
    setSaving(true);
    setMessage(null);
    const result = await saveAvatar(file);
    setSaving(false);
    if (!result.ok) {
      setMessage(result.message);
      return;
    }
    setProfile((current) => (current && user ? { ...current, avatarPath: `${user.id.toLowerCase()}/avatar.jpg` } : current));
    setMessage("Profile photo saved.");
  }

  async function onClearPhoto() {
    setSaving(true);
    const result = await clearAvatar();
    setSaving(false);
    if (!result.ok) {
      setMessage(result.message);
      return;
    }
    setProfile((current) => (current ? { ...current, avatarPath: null } : current));
    setMessage("Profile photo removed.");
  }

  return (
    <div className="space-y-8">
      <PageHeader eyebrow="Profile" title="What other people can see">
        <p>This page shows your name, username, bio, and photo. It does not show your email or your journal.</p>
      </PageHeader>
      <Link className={buttonClass("secondary")} href="/friends">
        Back to friends
      </Link>
      {loading ? <LoadingBlock label="Loading your profile." /> : null}
      {error ? <ErrorBlock title="Profile could not be loaded" message={error} /> : null}
      <StatusNote message={message} />
      {profile ? (
        <form onSubmit={onSave} className={`${cardClass} space-y-4 p-5 sm:p-6`}>
          <div className="flex items-center gap-3">
            <Avatar userId={profile.id} name={displayName || profile.displayName} hasPhoto={Boolean(profile.avatarPath)} />
            <div>
              <p className="font-medium text-foreground">{displayName || profile.displayName}</p>
              <p className="text-sm text-muted">@{username || profile.username}</p>
            </div>
          </div>
          <label className="block text-sm font-medium text-foreground" htmlFor="avatar-file">
            Profile photo
          </label>
          <input
            id="avatar-file"
            type="file"
            accept="image/*"
            className={fieldClass}
            disabled={saving}
            onChange={(event) => void onPhoto(event.target.files?.[0])}
          />
          {profile.avatarPath ? (
            <Button type="button" variant="secondary" disabled={saving} onClick={() => void onClearPhoto()}>
              Remove photo
            </Button>
          ) : null}
          <label className="block space-y-2 text-sm font-medium text-foreground" htmlFor="display-name">
            Display name
            <input id="display-name" value={displayName} maxLength={60} onChange={(event) => setDisplayName(event.target.value)} className={fieldClass} />
          </label>
          <label className="block space-y-2 text-sm font-medium text-foreground" htmlFor="username">
            Username
            <input
              id="username"
              value={username}
              maxLength={20}
              autoCapitalize="none"
              autoCorrect="off"
              onChange={(event) => setUsername(event.target.value.toLowerCase())}
              className={fieldClass}
            />
          </label>
          <label className="block space-y-2 text-sm font-medium text-foreground" htmlFor="bio">
            Short bio
            <textarea id="bio" value={bio} maxLength={160} rows={3} onChange={(event) => setBio(event.target.value)} className={fieldClass} />
          </label>
          <label className="flex items-start gap-3 text-sm leading-relaxed text-foreground" htmlFor="searchable">
            <input
              id="searchable"
              type="checkbox"
              className="mt-1 h-4 w-4"
              checked={searchable}
              onChange={(event) => setSearchable(event.target.checked)}
            />
            <span>Let people find me by my name or username. Turn this off to stay out of search. Friends can still see this profile.</span>
          </label>
          <Button type="submit" disabled={saving}>
            {saving ? "Saving" : "Save profile"}
          </Button>
        </form>
      ) : null}
    </div>
  );
}
