import type { Deps } from "@/server/container";
import type { User, Work } from "@/server/domain/entities";

export interface DiscoverResult {
  suggestions: Pick<User, "id" | "username" | "displayName" | "avatarUrl">[];
  trending: { work: Pick<Work, "id" | "title" | "year" | "posterUrl" | "type">; reviews: number }[];
}

export async function discover(deps: Deps, viewerId: string): Promise<DiscoverResult> {
  const following = new Set(await deps.follows.followeeIdsOf(viewerId));

  const recent = await deps.users.listRecent(30);
  const suggestions = recent
    .filter((u) => u.id !== viewerId && !following.has(u.id))
    .slice(0, 5)
    .map((u) => ({ id: u.id, username: u.username, displayName: u.displayName, avatarUrl: u.avatarUrl }));

  const entries = await deps.entries.listRecentPublic(100);
  const counts = new Map<string, number>();
  for (const e of entries) counts.set(e.workId, (counts.get(e.workId) ?? 0) + 1);
  const topIds = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
  const trending = (
    await Promise.all(
      topIds.map(async ([workId, reviews]) => {
        const work = await deps.works.findById(workId);
        return work
          ? { work: { id: work.id, title: work.title, year: work.year, posterUrl: work.posterUrl, type: work.type }, reviews }
          : null;
      }),
    )
  ).filter((x): x is NonNullable<typeof x> => x !== null);

  return { suggestions, trending };
}
