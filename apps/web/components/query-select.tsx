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
    <label className="inline-flex items-center gap-3 rounded-full border border-[color:var(--line)] bg-white/80 px-4 py-2 text-sm text-[color:var(--muted)]">
      <span className="font-[var(--font-mono)] text-[11px] uppercase tracking-[0.22em]">{label ?? name}</span>
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
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}
