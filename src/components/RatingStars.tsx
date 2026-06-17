export function RatingStars({ value, size = 18 }: { value: number; size?: number }) {
  const pct = Math.max(0, Math.min(100, (value / 5) * 100));
  return (
    <span className="relative inline-block leading-none" style={{ fontSize: size }} aria-hidden>
      <span className="text-[var(--color-border)]">★★★★★</span>
      <span
        className="absolute left-0 top-0 overflow-hidden whitespace-nowrap text-[var(--color-accent)]"
        style={{ width: `${pct}%` }}
      >
        ★★★★★
      </span>
    </span>
  );
}
