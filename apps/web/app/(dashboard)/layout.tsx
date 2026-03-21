"use client";

import { useEffect } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { AppShell } from "../../components/app-shell";
import { useAuth } from "../../components/auth-provider";
import { Panel } from "../../components/ui";

function inferTitle(pathname: string) {
  if (pathname.startsWith("/insights")) return "Insights";
  if (pathname.startsWith("/feed")) return "Feed";
  if (pathname.startsWith("/settings")) return "Settings";
  return "Pipeline";
}

function buildNextHref(pathname: string, searchParams: { toString(): string }) {
  const query = searchParams.toString();
  return query ? `${pathname}?${query}` : pathname;
}

export default function DashboardLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { session, loading, signOut, signingOut } = useAuth();

  useEffect(() => {
    if (!loading && !session) {
      const next = buildNextHref(pathname, searchParams);
      router.replace(`/auth/signin?next=${encodeURIComponent(next)}`);
    }
  }, [loading, pathname, router, searchParams, session]);

  if (loading || !session) {
    return (
      <main className="grid min-h-screen place-items-center p-6">
        <Panel className="w-full max-w-lg text-center">
          <div className="space-y-3 py-8">
            <p className="font-[var(--font-mono)] text-[11px] uppercase tracking-[0.28em] text-[color:var(--muted)]">
              Authentication
            </p>
            <h1 className="text-3xl font-semibold tracking-[-0.06em]">Checking your session</h1>
            <p className="text-sm leading-7 text-[color:var(--muted)]">
              Loading your workspace and verifying access.
            </p>
          </div>
        </Panel>
      </main>
    );
  }

  return (
    <AppShell
      title={inferTitle(pathname)}
      pathname={pathname}
      session={session}
      onSignOut={signOut}
      signingOut={signingOut}
    >
      {children}
    </AppShell>
  );
}
