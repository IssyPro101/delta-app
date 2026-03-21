import clsx from "clsx";
import Link from "next/link";

export function Panel({
  children,
  className,
}: Readonly<{ children: React.ReactNode; className?: string }>) {
  return (
    <section
      className={clsx(
        "rounded-2xl border border-[color:var(--line)] bg-[color:var(--panel)] p-6 shadow-[var(--shadow)] backdrop-blur-sm",
        className,
      )}
    >
      {children}
    </section>
  );
}

export function SectionTitle({
  eyebrow,
  title,
  action,
}: Readonly<{
  eyebrow?: string;
  title: string;
  action?: React.ReactNode;
}>) {
  return (
    <div className="flex items-end justify-between gap-4">
      <div className="space-y-1.5">
        {eyebrow ? (
          <p className="font-[var(--font-mono)] text-[10px] uppercase tracking-[0.2em] text-[color:var(--muted)]">
            {eyebrow}
          </p>
        ) : null}
        <h2 className="font-[var(--font-display)] text-2xl tracking-[-0.01em] text-[color:var(--text-strong)]">
          {title}
        </h2>
      </div>
      {action}
    </div>
  );
}

export function PillLink({
  href,
  label,
  active = false,
}: Readonly<{
  href: string;
  label: string;
  active?: boolean;
}>) {
  return (
    <Link
      href={href}
      className={clsx(
        "rounded-full border px-4 py-2 text-sm font-medium transition-all duration-200",
        active
          ? "border-[color:var(--accent)] bg-[color:var(--accent-soft)] text-[color:var(--accent)]"
          : "border-[color:var(--line)] text-[color:var(--muted)] hover:border-[color:var(--line-strong)] hover:text-[color:var(--text)]",
      )}
    >
      {label}
    </Link>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: Readonly<{
  title: string;
  description: string;
  action?: React.ReactNode;
}>) {
  return (
    <Panel className="border-dashed text-center">
      <div className="mx-auto max-w-md space-y-3 py-10">
        <div className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-full border border-[color:var(--line)] text-[color:var(--muted)]">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
            <circle cx="10" cy="10" r="8" />
            <path d="M10 6.5v4M10 13.5v0" />
          </svg>
        </div>
        <h3 className="font-[var(--font-display)] text-2xl text-[color:var(--text-strong)]">
          {title}
        </h3>
        <p className="text-sm leading-relaxed text-[color:var(--muted)]">{description}</p>
        {action ? <div className="pt-3">{action}</div> : null}
      </div>
    </Panel>
  );
}

export function PrimaryButton({
  children,
  className,
  ...props
}: Readonly<React.ButtonHTMLAttributes<HTMLButtonElement>>) {
  return (
    <button
      {...props}
      className={clsx(
        "rounded-xl bg-gradient-to-r from-[#0e58dd] to-[#1d74e7] px-5 py-2.5 text-sm font-semibold text-white shadow-[0_1px_8px_rgba(14,88,221,0.3)] transition-all duration-200 hover:brightness-110 hover:shadow-[0_2px_16px_rgba(14,88,221,0.4)] disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none",
        className,
      )}
    >
      {children}
    </button>
  );
}

export function SecondaryButton({
  children,
  className,
  ...props
}: Readonly<React.ButtonHTMLAttributes<HTMLButtonElement>>) {
  return (
    <button
      {...props}
      className={clsx(
        "rounded-xl border border-[color:var(--line-strong)] bg-transparent px-4 py-2.5 text-sm font-medium text-[color:var(--text)] transition-all duration-200 hover:border-[color:var(--accent)] hover:text-[color:var(--accent)] disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
    >
      {children}
    </button>
  );
}
