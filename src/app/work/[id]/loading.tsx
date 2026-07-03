export default function Loading() {
  return (
    <div className="space-y-4 p-1">
      <div className="h-40 animate-pulse rounded-2xl bg-[var(--color-border)]" />
      <div className="flex gap-4">
        <div className="aspect-[2/3] w-32 animate-pulse rounded-xl bg-[var(--color-border)]" />
        <div className="flex-1 space-y-2">
          <div className="h-6 w-3/4 animate-pulse rounded-full bg-[var(--color-border)]" />
          <div className="h-4 w-1/2 animate-pulse rounded-full bg-[var(--color-border)]" />
        </div>
      </div>
    </div>
  );
}
