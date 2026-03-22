"use client";

import { Suspense, useEffect } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { AppShell } from "../../components/app-shell";
import { AgentChatProvider } from "../../components/agent-chat-provider";
import { AgentSidebar } from "../../components/agent-sidebar";
import { useAuth } from "../../components/auth-provider";
import { DashboardDataProvider } from "../../components/dashboard-data-provider";

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
  return (
    <Suspense>
      <DashboardLayoutContent>{children}</DashboardLayoutContent>
    </Suspense>
  );
}

function DashboardLayoutContent({ children }: Readonly<{ children: React.ReactNode }>) {
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
        <div className="w-full max-w-md space-y-5 text-center">
          <div className="mx-auto grid h-10 w-10 animate-pulse place-items-center rounded-xl bg-gradient-to-br from-[#0e58dd] to-[#1d74e7] font-[var(--font-display)] text-sm text-white">
            Δ
          </div>
          <h1 className="font-[var(--font-display)] text-3xl text-[color:var(--text-strong)]">
            Checking your session
          </h1>
          <p className="text-sm leading-relaxed text-[color:var(--muted)]">
            Loading your workspace and verifying access.
          </p>
        </div>
      </main>
    );
  }

  return (
    <AgentChatProvider>
      <AppShell
        title={inferTitle(pathname)}
        pathname={pathname}
        session={session}
        onSignOut={signOut}
        signingOut={signingOut}
      >
        <DashboardDataProvider>{children}</DashboardDataProvider>
      </AppShell>
      <AgentSidebar />
    </AgentChatProvider>
  );
}
