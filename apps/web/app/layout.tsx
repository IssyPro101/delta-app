import type { Metadata } from "next";

import { AuthProvider } from "../components/auth-provider";

import "./globals.css";

export const metadata: Metadata = {
  title: "Pipeline Intelligence",
  description: "Pipeline health, insights, and activity intelligence.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="font-[var(--font-sans)] antialiased">
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
