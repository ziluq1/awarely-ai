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
  const { user } = useAuth();
  return (
    <AccountGate>
      {user ? <ProfileBody key={user.id} /> : null}
    </AccountGate>
  );
}

function ProfileBody() {
  const { user, rememberProfile } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [searchable, setSearchable] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [photoRevision, setPhotoRevision] = useState(0);
  const userId = user?.id ?? "";

  function applyProfile(next: Profile) {
    setProfile(next);
    setUsername(next.username);
    setDisplayName(next.displayName);
    setBio(next.bio ?? "");
    setSearchable(next.searchable);
  }

  useEffect(() => {
    if (!userId) return;
    let alive = true;
    void ensureProfile().then((result) => {
      if (!alive) return;
      setLoading(false);
      if (!result.ok) {
        setError(result.message);
        return;
      }
      applyProfile(result.value);
    });
    return () => {
      alive = false;
    };
  }, [userId]);

  async function loadProfile() {
    setLoading(true);
    setError(null);
    setFormError(null);
    const result = await ensureProfile();
    setLoading(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    applyProfile(result.value);
  }

  async function onSave(event: FormEvent) {
    event.preventDefault();
    if (saving) return;
    const nextError = usernameError(username) ?? displayNameError(displayName) ?? bioError(bio);
    if (nextError) {
      setMessage(null);
      setFormError(nextError);
      return;
    }
    setSaving(true);
    setMessage(null);
    setFormError(null);
    const result = await updateProfile({ username, displayName, bio, searchable });
    setSaving(false);
    if (!result.ok) {
      setFormError(result.message);
      return;
    }
    applyProfile(result.value);
    rememberProfile(result.value);
    setMessage("Profile saved. Your journal is still private.");
  }

  async function onPhoto(file: File | undefined) {
    if (!file || saving) return;
    setSaving(true);
    setMessage(null);
    setFormError(null);
    const result = await saveAvatar(file);
    setSaving(false);
    if (!result.ok) {
      setFormError(result.message);
      return;
    }
    applyProfile(result.value);
    rememberProfile(result.value, { photo: true });
    setPhotoRevision(Date.now());
    setMessage("Profile photo saved.");
  }

  async function onClearPhoto() {
    if (saving) return;
    setSaving(true);
    setMessage(null);
    setFormError(null);
    const result = await clearAvatar();
    setSaving(false);
    if (!result.ok) {
      setFormError(result.message);
      return;
    }
    applyProfile(result.value);
    rememberProfile(result.value, { photo: true });
    setPhotoRevision(Date.now());
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
      {error ? (
        <ErrorBlock title="Profile could not be loaded" message={error}>
          <Button type="button" variant="secondary" onClick={() => void loadProfile()}>
            Try again
          </Button>
        </ErrorBlock>
      ) : null}
      <StatusNote message={message} />
      {formError ? (
        <p role="alert" className="rounded-2xl bg-blush px-4 py-3 text-sm text-blush-text">
          {formError}
        </p>
      ) : null}
      {profile && !loading ? (
        <form onSubmit={onSave} className={`${cardClass} min-w-0 space-y-4 p-5 sm:p-6`}>
          <div className="flex min-w-0 items-center gap-3">
            <Avatar
              userId={profile.id}
              name={displayName || profile.displayName}
              hasPhoto={Boolean(profile.avatarPath)}
              revision={photoRevision}
            />
            <div className="min-w-0">
              <p className="truncate font-medium text-foreground">{displayName || profile.displayName}</p>
              <p className="truncate text-sm text-muted">@{username || profile.username}</p>
            </div>
          </div>
          <label className="block text-sm font-medium text-foreground" htmlFor="avatar-file">
            Profile photo
          </label>
          <input
            id="avatar-file"
            type="file"
            accept="image/*"
            className={`${fieldClass} max-w-full`}
            disabled={saving}
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = "";
              void onPhoto(file);
            }}
          />
          {profile.avatarPath ? (
            <Button type="button" variant="secondary" disabled={saving} onClick={() => void onClearPhoto()}>
              Remove photo
            </Button>
          ) : null}
          <label className="block space-y-2 text-sm font-medium text-foreground" htmlFor="display-name">
            Display name
            <input
              id="display-name"
              value={displayName}
              maxLength={60}
              disabled={saving}
              onChange={(event) => setDisplayName(event.target.value)}
              className={fieldClass}
            />
          </label>
          <label className="block space-y-2 text-sm font-medium text-foreground" htmlFor="username">
            Username
            <input
              id="username"
              value={username}
              maxLength={20}
              autoCapitalize="none"
              autoCorrect="off"
              disabled={saving}
              onChange={(event) => setUsername(event.target.value.toLowerCase())}
              className={fieldClass}
            />
          </label>
          <label className="block space-y-2 text-sm font-medium text-foreground" htmlFor="bio">
            Short bio
            <textarea
              id="bio"
              value={bio}
              maxLength={160}
              rows={3}
              disabled={saving}
              onChange={(event) => setBio(event.target.value)}
              className={fieldClass}
            />
          </label>
          <label className="flex items-start gap-3 text-sm leading-relaxed text-foreground" htmlFor="searchable">
            <input
              id="searchable"
              type="checkbox"
              className="mt-1 h-4 w-4"
              checked={searchable}
              disabled={saving}
              onChange={(event) => setSearchable(event.target.checked)}
            />
            <span>Let people find me by my name or username. Turn this off to stay out of search. Friends can still see this profile.</span>
          </label>
          <Button type="submit" disabled={saving} aria-busy={saving}>
            {saving ? "Saving" : "Save profile"}
          </Button>
          {saving ? (
            <p role="status" className="text-sm text-muted">
              Saving your profile.
            </p>
          ) : null}
        </form>
      ) : null}
    </div>
  );
}
