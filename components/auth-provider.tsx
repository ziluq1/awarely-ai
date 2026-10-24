"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { profileFromUser } from "@/lib/auth";
import type { AuthProfile } from "@/lib/auth";
import { browserSupabase } from "@/lib/supabase/browser";
import { publicSupabaseEnv } from "@/lib/supabase/env";

type AuthContextValue = {
  status: "loading" | "anonymous" | "signed-in";
  configured: boolean;
  user: AuthProfile | null;
  signOut: () => Promise<string | null>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const configured = publicSupabaseEnv() !== null;
  const [status, setStatus] = useState<AuthContextValue["status"]>("loading");
  const [user, setUser] = useState<AuthProfile | null>(null);

  useEffect(() => {
    const supabase = browserSupabase();
    if (!supabase) {
      setStatus("anonymous");
      setUser(null);
      return;
    }

    let alive = true;
    supabase.auth.getUser().then(({ data }) => {
      if (!alive) return;
      if (!data.user) {
        setUser(null);
        setStatus("anonymous");
        return;
      }
      setUser(profileFromUser(data.user));
      setStatus("signed-in");
    });

    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!alive) return;
      if (!session?.user) {
        setUser(null);
        setStatus("anonymous");
        return;
      }
      setUser(profileFromUser(session.user));
      setStatus("signed-in");
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
      user,
      async signOut() {
        const supabase = browserSupabase();
        if (!supabase) return "Supabase is not configured.";
        const { error } = await supabase.auth.signOut();
        if (error) return "awarely.ai could not log you out. Try again.";
        return null;
      },
    }),
    [configured, status, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used within AuthProvider");
  return value;
}
