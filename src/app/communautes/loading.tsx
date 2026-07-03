export default function Loading() {
  return (
    <div className="space-y-3 p-1">
      <div className="h-8 w-40 animate-pulse rounded-full bg-[var(--color-border)]" />
      {[0, 1, 2].map((i) => <div key={i} className="h-24 animate-pulse rounded-2xl bg-[var(--color-border)]" />)}
    </div>
  );
}
