/**
 * Wordmark officiel vulu (couleurs figées #9789c0 / #f9e37f).
 * Indépendant du thème : rendu via <img>, les fills du SVG ne suivent pas --color-primary.
 */
export function VuluLogo({ height = 28, className = "" }: { height?: number; className?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src="/vulu-logo.svg" alt="vulu" height={height} style={{ height }} className={`w-auto ${className}`} />
  );
}
