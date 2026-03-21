"use client";

import { createContext, useContext, useEffect, useState } from "react";

import type { AuthSession } from "@pipeline-intelligence/shared";

import { fetchAuthSession } from "../lib/api";
import { getSupabaseBrowserClient } from "../lib/supabase";

type AuthContextValue = {
  session: AuthSession | null;
  loading: boolean;
  signInPending: boolean;
  signingOut: boolean;
  signInWithGoogle: (next?: string) => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

function normalizeNext(next?: string) {
  return next && next.startsWith("/") ? next : "/pipeline";
}

export function AuthProvider({ children }: Readonly<{ children: React.ReactNode }>) {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [signInPending, setSignInPending] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    let active = true;
    const supabase = getSupabaseBrowserClient();

    const syncAuthSession = async (accessToken: string | null, finishBoot = false) => {
      if (!accessToken) {
        if (active) {
          setSession(null);
          if (finishBoot) {
            setLoading(false);
          }
        }
        return;
      }

      try {
        const nextSession = await fetchAuthSession(accessToken);

        if (active) {
          setSession(nextSession);
        }
      } catch (error) {
        console.error("Could not load auth session", error);

        if (active) {
          setSession(null);
        }
      } finally {
        if (active && finishBoot) {
          setLoading(false);
        }
      }
    };

    void (async () => {
      const { data, error } = await supabase.auth.getSession();

      if (!active) {
        return;
      }

      if (error) {
        console.error("Could not read Supabase session", error);
        setSession(null);
        setLoading(false);
        return;
      }

      await syncAuthSession(data.session?.access_token ?? null, true);
    })();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event: any, nextSession: any) => {
      void syncAuthSession(nextSession?.access_token ?? null);
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  async function signInWithGoogle(next?: string) {
    setSignInPending(true);

    try {
      const callbackUrl = new URL("/auth/callback", window.location.origin);
      callbackUrl.searchParams.set("next", normalizeNext(next));

      const { error } = await getSupabaseBrowserClient().auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: callbackUrl.toString(),
        },
      });

      if (error) {
        throw error;
      }
    } finally {
      setSignInPending(false);
    }
  }

  async function signOut() {
    setSigningOut(true);

    try {
      const { error } = await getSupabaseBrowserClient().auth.signOut();

      if (error) {
        throw error;
      }

      setSession(null);
    } finally {
      setSigningOut(false);
    }
  }

  return (
    <AuthContext.Provider
      value={{
        session,
        loading,
        signInPending,
        signingOut,
        signInWithGoogle,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const value = useContext(AuthContext);

  if (!value) {
    throw new Error("useAuth must be used within an AuthProvider");
  }

  return value;
}
