export default function Loading() {
  return (
    <div className="space-y-4 p-1">
      <div className="h-24 animate-pulse rounded-2xl bg-[var(--color-border)]" />
      <div className="flex items-end gap-3">
        <div className="h-20 w-20 animate-pulse rounded-full bg-[var(--color-border)]" />
        <div className="h-6 w-40 animate-pulse rounded-full bg-[var(--color-border)]" />
      </div>
      <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5">
        {Array.from({ length: 10 }).map((_, i) => <div key={i} className="aspect-[2/3] animate-pulse rounded-xl bg-[var(--color-border)]" />)}
      </div>
    </div>
  );
}
