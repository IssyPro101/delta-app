"use client";

import clsx from "clsx";
import Link from "next/link";

import { sidebarNavigation } from "@pipeline-intelligence/shared";

import type { AuthSession } from "@pipeline-intelligence/shared";

import { useAgentChat } from "./agent-chat-provider";

function getInitials(name: string) {
  return name
    .split(" ")
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

const navIcons: Record<string, React.ReactNode> = {
  Pipeline: (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="currentColor">
      <rect x="1.5" y="11" width="3" height="5.5" rx="0.75" opacity="0.35" />
      <rect x="6" y="7" width="3" height="9.5" rx="0.75" opacity="0.55" />
      <rect x="10.5" y="4" width="3" height="12.5" rx="0.75" opacity="0.75" />
      <rect x="15" y="1.5" width="1.5" height="15" rx="0.75" />
    </svg>
  ),
  Deals: (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2.5" y="3" width="13" height="12" rx="2" />
      <path d="M6 7h6M6 10h4" />
    </svg>
  ),
  Insights: (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="currentColor">
      <path d="M9 1.5L10.2 6.3L15 7.5L10.2 8.7L9 13.5L7.8 8.7L3 7.5L7.8 6.3L9 1.5Z" />
      <circle cx="14.5" cy="3.5" r="1.2" opacity="0.3" />
      <circle cx="3.5" cy="13.5" r="0.9" opacity="0.2" />
    </svg>
  ),
  Feed: (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="currentColor">
      <rect x="2" y="2.5" width="14" height="2" rx="1" />
      <rect x="2" y="7" width="10" height="2" rx="1" opacity="0.5" />
      <rect x="2" y="11.5" width="12" height="2" rx="1" opacity="0.3" />
      <rect x="2" y="15.5" width="8" height="1" rx="0.5" opacity="0.15" />
    </svg>
  ),
  Settings: (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
      <circle cx="9" cy="9" r="2.5" />
      <path d="M9 2v2.5M9 13.5V16M2 9h2.5M13.5 9H16M4 4l1.8 1.8M12.2 12.2L14 14M14 4l-1.8 1.8M5.8 12.2L4 14" />
    </svg>
  ),
};

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
  const { open: agentOpen, toggleOpen: toggleAgent } = useAgentChat();

  return (
    <div className="min-h-screen">
      {/* ── Mobile header ── */}
      <div className="border-b border-[color:var(--line)] bg-[var(--sidebar)] md:hidden">
        <div className="flex items-center justify-between px-4 py-3">
          <img src="/delta-logo.png" alt="Delta" className="h-8" />
          <div className="grid h-8 w-8 place-items-center rounded-full bg-gradient-to-br from-[#012fbd] to-[#0e58dd] text-[10px] font-semibold text-white">
            {getInitials(session.user.name)}
          </div>
        </div>
        <nav className="flex gap-1 px-3 pb-3">
          {sidebarNavigation.map((item) => {
            const active = pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={clsx(
                  "flex-1 rounded-lg px-2 py-2 text-center text-xs font-medium transition-colors",
                  active
                    ? "bg-[color:var(--accent-soft)] text-[color:var(--accent)]"
                    : "text-[color:var(--muted)] hover:text-[color:var(--text)]",
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>

      {/* ── Desktop sidebar ── */}
      <aside className="fixed inset-y-0 left-0 z-20 hidden w-[72px] flex-col border-r border-[color:var(--line)] bg-[var(--sidebar)] md:flex xl:w-[260px]">
        {/* Logo */}
        <div className="flex items-center gap-3.5 px-4 py-6 xl:px-6">
          <img src="/delta-logo.png" alt="Delta" className="h-10 shrink-0" />
        </div>

        {/* Navigation */}
        <nav className="mt-1 flex-1 space-y-0.5 px-2.5 xl:px-3">
          {sidebarNavigation.map((item) => {
            const active = pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={clsx(
                  "group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-all duration-150",
                  active
                    ? "bg-[color:var(--accent-soft)] text-[color:var(--accent)]"
                    : "text-[color:var(--muted)] hover:bg-[color:var(--panel)] hover:text-[color:var(--text)]",
                )}
              >
                <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center">
                  {navIcons[item.label] ?? item.label[0]}
                </span>
                <span className="hidden font-medium xl:inline">{item.label}</span>
                {active ? (
                  <span className="ml-auto hidden h-1.5 w-1.5 rounded-full bg-[color:var(--accent)] xl:block" />
                ) : null}
              </Link>
            );
          })}
        </nav>

        {/* User profile */}
        <div className="border-t border-[color:var(--line)] px-2.5 py-4 xl:px-4">
          <div className="flex items-center gap-3">
            <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-gradient-to-br from-[#012fbd] to-[#0e58dd] text-xs font-medium text-white">
              {getInitials(session.user.name)}
            </div>
            <div className="hidden min-w-0 flex-1 xl:block">
              <p className="truncate text-sm font-medium text-[color:var(--text-strong)]">
                {session.user.name}
              </p>
              <p className="truncate text-[11px] text-[color:var(--muted)]">
                {session.user.email}
              </p>
            </div>
          </div>
          <button
            onClick={() => void onSignOut()}
            disabled={signingOut}
            className="mt-3 hidden w-full items-center justify-center rounded-lg border border-[color:var(--line)] px-3 py-1.5 text-xs text-[color:var(--muted)] transition-colors hover:border-[color:var(--line-strong)] hover:text-[color:var(--text)] disabled:opacity-50 xl:flex"
          >
            {signingOut ? "Signing out..." : "Sign out"}
          </button>
        </div>
      </aside>

      {/* ── Main content ── */}
      <main
        className={clsx(
          "transition-[margin] duration-250 ease-[cubic-bezier(0.25,0.1,0.25,1)] md:ml-[72px] xl:ml-[260px]",
          agentOpen && "md:mr-[380px]",
        )}
      >
        <header className="sticky top-0 z-10 border-b border-[color:var(--line)] bg-[var(--bg)]/80 px-6 py-6 backdrop-blur-xl md:px-10">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-[var(--font-mono)] text-[10px] uppercase tracking-[0.25em] text-[color:var(--muted)]">
                Pipeline Intelligence
              </p>
              <h1 className="mt-1.5 font-[var(--font-display)] text-[28px] tracking-[-0.01em] text-[color:var(--text-strong)]">
                {title}
              </h1>
            </div>
            {!agentOpen ? (
              <button
                onClick={toggleAgent}
                title="Open Delta (⌘.)"
                className="flex shrink-0 items-center gap-2 rounded-xl bg-[color:var(--accent)] px-4 py-2 text-sm font-medium text-white shadow-[0_2px_12px_rgba(14,88,221,0.3)] transition-all duration-200 hover:scale-105 hover:shadow-[0_4px_20px_rgba(14,88,221,0.4)]"
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path d="M8 1l1.8 3.6L14 6.4l-3 2.9.7 4.1L8 11.4 4.3 13.4l.7-4.1-3-2.9 4.2-.8L8 1z"/></svg>
                Chat with Delta
              </button>
            ) : null}
          </div>
        </header>
        <div className="space-y-8 px-6 py-8 md:px-10 md:py-10">{children}</div>
      </main>
    </div>
  );
}
