import type { Deps } from "@/server/container";
import type { LibraryEntry, Work } from "@/server/domain/entities";

/** Épisodes cumulés vus jusqu'à (saison, épisode) courant, d'après le découpage par saison. */
function episodesSeen(entry: LibraryEntry, work: Work): number {
  const counts = work.episodeCounts ?? [];
  if (entry.status === "done") return counts.reduce((a, b) => a + b, 0);
  const season = entry.progress?.season ?? 1;
  const episode = entry.progress?.episode ?? 0;
  let total = 0;
  for (let i = 0; i < season - 1 && i < counts.length; i++) total += counts[i]!;
  return total + Math.min(episode, counts[season - 1] ?? episode);
}

/** Temps total de visionnage (films + séries), en minutes, pour un utilisateur. */
export async function computeWatchMinutes(deps: Deps, userId: string): Promise<number> {
  const entries = await deps.entries.listByUser(userId, {});
  let minutes = 0;
  for (const entry of entries) {
    if (entry.status === "planned") continue;
    const work = await deps.works.findById(entry.workId);
    if (!work || work.runtime === null) continue;
    if (work.type === "movie") {
      if (entry.status === "done") minutes += work.runtime;
    } else if (work.type === "tv") {
      minutes += episodesSeen(entry, work) * work.runtime;
    }
  }
  return minutes;
}
