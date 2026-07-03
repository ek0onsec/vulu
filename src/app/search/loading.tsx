export default function Loading() {
  return (
    <div className="space-y-3 p-1">
      <div className="h-11 animate-pulse rounded-full bg-[var(--color-border)]" />
      <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
        {[0, 1, 2, 3, 4, 5].map((i) => <div key={i} className="aspect-[2/3] animate-pulse rounded-xl bg-[var(--color-border)]" />)}
      </div>
    </div>
  );
}
