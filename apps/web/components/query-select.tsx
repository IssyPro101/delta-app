"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

export function QuerySelect({
  label,
  name,
  value,
  options,
}: Readonly<{
  label?: string;
  name: string;
  value: string;
  options: Array<{ value: string; label: string }>;
}>) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  return (
    <label className="inline-flex items-center gap-2.5 rounded-xl border border-[color:var(--line)] bg-[color:var(--panel)] px-4 py-2 text-sm text-[color:var(--muted)] transition-colors hover:border-[color:var(--line-strong)]">
      <span className="font-[var(--font-mono)] text-[10px] uppercase tracking-[0.2em]">
        {label ?? name}
      </span>
      <select
        value={value}
        onChange={(event) => {
          const params = new URLSearchParams(searchParams.toString());
          if (event.target.value === "" || event.target.value === "all") {
            params.delete(name);
          } else {
            params.set(name, event.target.value);
          }
          router.push(`${pathname}?${params.toString()}`);
        }}
        className="bg-transparent font-medium text-[color:var(--text)] outline-none"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value} className="bg-[var(--bg-elevated)] text-[color:var(--text)]">
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}
