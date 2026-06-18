/** Badge équipe Vulu (membre du staff). Distinct du badge certifié vulu+. */
export function StaffBadge({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className="inline-block align-text-bottom" aria-label="Équipe Vulu">
      <path d="M12 2.5 4.5 5.2v6c0 4.4 3.1 8.2 7.5 9.8 4.4-1.6 7.5-5.4 7.5-9.8v-6L12 2.5Z" fill="var(--color-accent)" stroke="var(--color-primary)" strokeWidth="1" />
      <text x="12" y="14.5" textAnchor="middle" fontSize="9" fontWeight="800" fill="var(--color-primary)" fontFamily="Georgia, serif">V</text>
    </svg>
  );
}
