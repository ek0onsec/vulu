export default function Loading() {
  return (
    <div className="space-y-3 p-1">
      {[0, 1, 2, 3].map((i) => <div key={i} className="h-40 animate-pulse rounded-2xl bg-[var(--color-border)]" />)}
    </div>
  );
}
