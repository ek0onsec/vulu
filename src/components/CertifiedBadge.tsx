/** Badge certifié vulu+ (affiché à côté du nom des abonnés). */
export function CertifiedBadge({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className="inline-block align-text-bottom" role="img" aria-label="Compte certifié vulu+">
      <title>Compte certifié vulu+</title>
      <path
        d="M12 2.2 14.3 4l2.8-.2 1 2.6 2.4 1.5-.8 2.7.8 2.7-2.4 1.5-1 2.6-2.8-.2L12 21.8 9.7 20l-2.8.2-1-2.6-2.4-1.5.8-2.7-.8-2.7 2.4-1.5 1-2.6 2.8.2L12 2.2Z"
        fill="var(--color-primary)"
      />
      <path d="m8.5 12 2.2 2.2 4.8-4.8" fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
