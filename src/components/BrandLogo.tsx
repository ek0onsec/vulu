export type Brand = "discord" | "instagram" | "x";

/** Logos de marque officiels (glyphes simplifiés). */
export function BrandLogo({ brand, size = 20 }: { brand: Brand; size?: number }) {
  if (brand === "discord") {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="#5865F2" aria-hidden>
        <path d="M19.6 5.3A17 17 0 0 0 15.4 4l-.2.4a13 13 0 0 1 3.7 1.9 12 12 0 0 0-10-.4 12 12 0 0 0-1.9.4A13 13 0 0 1 8.7 4.4L8.5 4a17 17 0 0 0-4.1 1.3C1.9 9 1.2 12.6 1.5 16.1a17 17 0 0 0 5.2 2.6l.6-1a11 11 0 0 1-1.8-.9l.4-.3a8.6 8.6 0 0 0 7.3 0l.4.3a11 11 0 0 1-1.8.9l.6 1a17 17 0 0 0 5.2-2.6c.4-4-.7-7.6-3.3-10.8ZM8.9 14.1c-1 0-1.8-.9-1.8-2s.8-2 1.8-2 1.8.9 1.8 2-.8 2-1.8 2Zm6.2 0c-1 0-1.8-.9-1.8-2s.8-2 1.8-2 1.8.9 1.8 2-.8 2-1.8 2Z" />
      </svg>
    );
  }
  if (brand === "instagram") {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="#E1306C" strokeWidth="1.8" aria-hidden>
        <rect x="3" y="3" width="18" height="18" rx="5" />
        <circle cx="12" cy="12" r="4" />
        <circle cx="17" cy="7" r="1.2" fill="#E1306C" stroke="none" />
      </svg>
    );
  }
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M17.5 3h3l-7 8 8.2 10h-6.4l-5-6.1L3.9 21H.9l7.5-8.6L1 3h6.6l4.5 5.6L17.5 3Zm-1.1 16h1.7L7.4 4.8H5.6L16.4 19Z" />
    </svg>
  );
}
