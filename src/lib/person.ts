export interface PersonRef { source: "tmdb" | "book"; externalId: number }

export function parsePersonId(id: string): PersonRef | null {
  const m = /^(tmdb|book)-(\d+)$/.exec(id);
  if (!m) return null;
  return { source: m[1] as "tmdb" | "book", externalId: Number(m[2]) };
}

export function personHref(p: { tmdbId: number; name: string }, source: "tmdb" | "book"): string {
  return `/personne/${source}-${p.tmdbId}?name=${encodeURIComponent(p.name)}`;
}
