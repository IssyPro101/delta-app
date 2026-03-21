import clsx from "clsx";
import Link from "next/link";

export function Panel({
  children,
  className,
}: Readonly<{ children: React.ReactNode; className?: string }>) {
  return (
    <section
      className={clsx(
        "rounded-[28px] border border-[color:var(--line)] bg-[color:var(--panel)] p-6 shadow-[var(--shadow)] backdrop-blur",
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
      <div className="space-y-2">
        {eyebrow ? (
          <p className="font-[var(--font-mono)] text-[11px] uppercase tracking-[0.28em] text-[color:var(--muted)]">
            {eyebrow}
          </p>
        ) : null}
        <h2 className="text-xl font-semibold tracking-[-0.04em] text-[color:var(--text)]">{title}</h2>
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
        "rounded-full border px-4 py-2 text-sm transition",
        active
          ? "border-transparent bg-[color:var(--text)] text-white"
          : "border-[color:var(--line)] bg-white/60 text-[color:var(--muted)] hover:border-[color:var(--accent)] hover:text-[color:var(--text)]",
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
    <Panel className="border-dashed bg-white/55 text-center">
      <div className="mx-auto max-w-2xl space-y-3 py-8">
        <p className="font-[var(--font-mono)] text-[11px] uppercase tracking-[0.28em] text-[color:var(--muted)]">
          Waiting On Signal
        </p>
        <h3 className="text-2xl font-semibold tracking-[-0.04em]">{title}</h3>
        <p className="text-sm leading-7 text-[color:var(--muted)]">{description}</p>
        {action ? <div className="pt-2">{action}</div> : null}
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
        "rounded-full bg-[color:var(--text)] px-4 py-2 text-sm font-medium text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60",
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
        "rounded-full border border-[color:var(--line)] bg-white/70 px-4 py-2 text-sm font-medium text-[color:var(--text)] transition hover:border-[color:var(--accent)] disabled:cursor-not-allowed disabled:opacity-60",
        className,
      )}
    >
      {children}
    </button>
  );
}
