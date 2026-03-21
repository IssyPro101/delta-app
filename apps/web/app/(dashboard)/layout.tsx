import { redirect } from "next/navigation";
import { headers } from "next/headers";

import type { AuthSession } from "@pipeline-intelligence/shared";

import { AppShell } from "../../components/app-shell";
import { getSession } from "../../lib/api";

function inferTitle(pathname: string) {
  if (pathname.startsWith("/insights")) return "Insights";
  if (pathname.startsWith("/feed")) return "Feed";
  if (pathname.startsWith("/settings")) return "Settings";
  return "Pipeline";
}

export default async function DashboardLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const session = (await getSession()) as AuthSession | null;

  if (!session) {
    redirect("/auth/signin");
  }

  const pathname = (await headers()).get("x-pathname") ?? "/pipeline";

  return (
    <AppShell title={inferTitle(pathname)} pathname={pathname} session={session}>
      {children}
    </AppShell>
  );
}
