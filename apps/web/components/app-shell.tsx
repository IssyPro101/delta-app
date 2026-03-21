import Link from "next/link";

import { sidebarNavigation } from "@pipeline-intelligence/shared";

import type { AuthSession } from "@pipeline-intelligence/shared";

import { SecondaryButton } from "./ui";

function getInitials(name: string) {
  return name
    .split(" ")
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

export function AppShell({
  title,
  pathname,
  session,
  onSignOut,
  signingOut = false,
  children,
}: Readonly<{
  title: string;
  pathname: string;
  session: AuthSession;
  onSignOut: () => Promise<void>;
  signingOut?: boolean;
  children: React.ReactNode;
}>) {
  return (
    <div className="min-h-screen p-4 md:p-6">
      <div className="grid min-h-[calc(100vh-2rem)] gap-4 md:grid-cols-[88px_minmax(0,1fr)] md:gap-6 xl:grid-cols-[240px_minmax(0,1fr)]">
        <aside className="sticky top-4 h-fit rounded-[30px] border border-[color:var(--line)] bg-[color:var(--panel)] p-4 shadow-[var(--shadow)] backdrop-blur md:top-6">
          <div className="flex items-center gap-3 rounded-2xl bg-[color:var(--text)] px-3 py-4 text-white">
            <div className="grid h-10 w-10 place-items-center rounded-2xl bg-white/10 font-[var(--font-mono)] text-sm">
              Δ
            </div>
            <div className="hidden xl:block">
              <p className="font-[var(--font-mono)] text-[10px] uppercase tracking-[0.3em] text-white/60">
                Delta
              </p>
              <p className="text-sm font-medium">Pipeline Intelligence</p>
            </div>
          </div>
          <nav className="mt-6 space-y-2">
            {sidebarNavigation.map((item) => {
              const active = pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-3 rounded-2xl px-3 py-3 text-sm transition ${
                    active
                      ? "bg-[color:var(--accent-soft)] text-[color:var(--text)]"
                      : "text-[color:var(--muted)] hover:bg-white/70 hover:text-[color:var(--text)]"
                  }`}
                >
                  <span className="inline-flex h-8 w-8 items-center justify-center rounded-xl border border-[color:var(--line)] bg-white/70 font-[var(--font-mono)] text-xs">
                    {item.label[0]}
                  </span>
                  <span className="hidden xl:inline">{item.label}</span>
                </Link>
              );
            })}
          </nav>
        </aside>
        <main className="space-y-6 rounded-[36px] border border-[color:var(--line)] bg-[linear-gradient(180deg,rgba(255,252,246,0.78),rgba(255,247,237,0.68))] p-4 shadow-[var(--shadow)] backdrop-blur md:p-6 xl:p-8">
          <header className="flex flex-col gap-4 border-b border-[color:var(--line)] pb-6 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="font-[var(--font-mono)] text-[11px] uppercase tracking-[0.28em] text-[color:var(--muted)]">
                Pipeline Intelligence
              </p>
              <h1 className="mt-2 text-3xl font-semibold tracking-[-0.06em] text-[color:var(--text)] md:text-4xl">
                {title}
              </h1>
            </div>
            <div className="flex flex-wrap items-center gap-3 self-start rounded-full border border-[color:var(--line)] bg-white/75 px-3 py-2 md:self-auto">
              <div className="grid h-11 w-11 place-items-center rounded-full bg-[color:var(--accent)] text-sm font-semibold text-white">
                {getInitials(session.user.name)}
              </div>
              <div>
                <p className="text-sm font-medium">{session.user.name}</p>
                <p className="text-xs text-[color:var(--muted)]">{session.user.email}</p>
              </div>
              <SecondaryButton onClick={() => void onSignOut()} disabled={signingOut} className="whitespace-nowrap">
                {signingOut ? "Signing out..." : "Sign out"}
              </SecondaryButton>
            </div>
          </header>
          {children}
        </main>
      </div>
    </div>
  );
}
