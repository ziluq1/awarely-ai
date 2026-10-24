"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { applySavedIdentity, isEmailVerified, profileFromUser } from "@/lib/auth";
import type { AuthProfile, SavedIdentity } from "@/lib/auth";
import { ensureProfile } from "@/lib/social";
import { browserSupabase } from "@/lib/supabase/browser";
import { publicSupabaseEnv } from "@/lib/supabase/env";

type AuthContextValue = {
  status: "loading" | "anonymous" | "signed-in";
  configured: boolean;
  verified: boolean;
  identityReady: boolean;
  user: AuthProfile | null;
  rememberProfile: (profile: SavedIdentity, options?: { photo?: boolean }) => void;
  signOut: () => Promise<string | null>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const configured = publicSupabaseEnv() !== null;
  const [status, setStatus] = useState<AuthContextValue["status"]>(configured ? "loading" : "anonymous");
  const [verified, setVerified] = useState(false);
  const [identityReady, setIdentityReady] = useState(!configured);
  const [user, setUser] = useState<AuthProfile | null>(null);
  const saved = useRef<SavedIdentity | null>(null);
  const revision = useRef(0);
  const loadToken = useRef(0);

  function publish(account: AuthProfile) {
    setUser(applySavedIdentity(account, saved.current, revision.current));
  }

  const rememberProfile = useCallback((profile: SavedIdentity, options?: { photo?: boolean }) => {
    const displayName = profile.displayName.trim();
    if (!displayName) return;
    saved.current = { id: profile.id, displayName, avatarPath: profile.avatarPath };
    if (options?.photo) revision.current = Date.now();
    setIdentityReady(true);
    setUser((current) => {
      if (!current || current.id !== profile.id) return current;
      return applySavedIdentity(current, saved.current, revision.current);
    });
  }, []);

  useEffect(() => {
    const supabase = browserSupabase();
    if (!supabase) return;

    let alive = true;

    async function loadSaved(account: AuthProfile) {
      const token = loadToken.current + 1;
      loadToken.current = token;
      if (!saved.current || saved.current.id !== account.id) setIdentityReady(false);
      const result = await ensureProfile();
      if (!alive || token !== loadToken.current) return;
      setIdentityReady(true);
      if (!result.ok || result.value.id !== account.id || !result.value.displayName.trim()) return;
      saved.current = {
        id: result.value.id,
        displayName: result.value.displayName.trim(),
        avatarPath: result.value.avatarPath,
      };
      publish(account);
    }

    function showAccount(nextUser: NonNullable<Parameters<typeof profileFromUser>[0]>) {
      const account = profileFromUser(nextUser);
      const emailVerified = isEmailVerified(nextUser);
      if (saved.current && saved.current.id !== account.id) {
        saved.current = null;
        revision.current = 0;
      }
      publish(account);
      setVerified(emailVerified);
      setStatus("signed-in");
      if (!emailVerified) {
        loadToken.current += 1;
        setIdentityReady(true);
        return;
      }
      void loadSaved(account);
    }

    supabase.auth.getUser().then(({ data }) => {
      if (!alive) return;
      if (!data.user) {
        saved.current = null;
        revision.current = 0;
        setUser(null);
        setVerified(false);
        setIdentityReady(true);
        setStatus("anonymous");
        return;
      }
      showAccount(data.user);
    });

    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!alive) return;
      if (!session?.user) {
        saved.current = null;
        revision.current = 0;
        loadToken.current += 1;
        setUser(null);
        setVerified(false);
        setIdentityReady(true);
        setStatus("anonymous");
        return;
      }
      showAccount(session.user);
    });

    return () => {
      alive = false;
      data.subscription.unsubscribe();
    };
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      configured,
      verified,
      identityReady,
      user,
      rememberProfile,
      async signOut() {
        const supabase = browserSupabase();
        if (!supabase) return "Supabase is not configured.";
        const { error } = await supabase.auth.signOut();
        if (error) return "awarely.ai could not log you out. Try again.";
        return null;
      },
    }),
    [configured, identityReady, rememberProfile, status, user, verified],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used within AuthProvider");
  return value;
}
