// Affichage seul par défaut (aria-hidden). Passer `onSelect` rend les étoiles cliquables :
// chaque étoile note de 1 à 5, en réutilisant le même canal de commit que le curseur.
export function RatingStars({ value, size = 18, onSelect }: { value: number; size?: number; onSelect?: (v: number) => void }) {
  const pct = Math.max(0, Math.min(100, (value / 5) * 100));
  return (
    <span className="relative inline-block leading-none" style={{ fontSize: size }} aria-hidden={onSelect ? undefined : true}>
      <span className="text-[var(--color-border)]">★★★★★</span>
      <span
        className="absolute left-0 top-0 overflow-hidden whitespace-nowrap text-[var(--color-accent)]"
        style={{ width: `${pct}%` }}
      >
        ★★★★★
      </span>
      {onSelect && (
        <span className="absolute inset-0 flex">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              aria-label={`Noter ${n} sur 5`}
              onClick={() => onSelect(n)}
              className="h-full flex-1 cursor-pointer"
            />
          ))}
        </span>
      )}
    </span>
  );
}
