import type { Deps } from "@/server/container";
import type { EntryStatus, WorkSource, WorkType } from "@/server/domain/entities";

export interface PersonWork {
  workId: string; source: WorkSource; externalId: string; title: string; posterUrl: string | null;
  type: WorkType; status: EntryStatus; rating: number | null;
}
export interface DiscoveryWork {
  source: WorkSource; externalId: string; title: string; posterUrl: string | null; type: WorkType;
}
export interface PersonProfile { name: string; library: PersonWork[]; discovery: DiscoveryWork[] }

export async function getPersonProfile(
  deps: Deps, userId: string, input: { source: "tmdb" | "book"; externalId: number; name: string },
): Promise<PersonProfile> {
  const entries = await deps.entries.listByUser(userId, {});
  const worksById = new Map((await deps.works.findByIds([...new Set(entries.map((e) => e.workId))])).map((w) => [w.id, w]));
  const library: PersonWork[] = entries
    .map((e) => ({ e, w: worksById.get(e.workId) }))
    .filter((x): x is { e: typeof x.e; w: NonNullable<typeof x.w> } => x.w !== undefined && x.w.people.some((p) => p.tmdbId === input.externalId))
    .map(({ e, w }) => ({
      workId: w.id, source: w.source, externalId: w.externalId, title: w.title,
      posterUrl: w.posterUrl, type: w.type, status: e.status, rating: e.rating,
    }));

  const owned = new Set(library.map((x) => x.externalId));
  const credits = input.source === "tmdb"
    ? await deps.catalog.getPersonCredits(String(input.externalId))
    : await deps.catalog.searchWorks(`inauthor:${input.name}`, "books");
  const discovery: DiscoveryWork[] = credits
    .filter((c) => !owned.has(c.externalId))
    .slice(0, 20)
    .map((c) => ({ source: c.source, externalId: c.externalId, title: c.title, posterUrl: c.posterUrl, type: c.type }));

  return { name: input.name, library, discovery };
}
