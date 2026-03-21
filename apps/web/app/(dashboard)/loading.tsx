export default function DashboardLoading() {
  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_360px]">
      <div className="space-y-4">
        {Array.from({ length: 3 }).map((_, index) => (
          <div
            key={index}
            className="h-40 animate-pulse rounded-2xl border border-[color:var(--line)] bg-[color:var(--panel)]"
          />
        ))}
      </div>
      <div className="h-[520px] animate-pulse rounded-2xl border border-[color:var(--line)] bg-[color:var(--panel)]" />
    </div>
  );
}
