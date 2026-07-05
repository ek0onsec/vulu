import type { Deps } from "@/server/container";
import type { EpisodeSummary, WorkSource, WorkType } from "@/server/domain/entities";

const EPISODE_CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 jours

export async function getSeasonEpisodes(
  deps: Deps,
  ref: { source: WorkSource; externalId: string; type: WorkType },
  season: number,
): Promise<EpisodeSummary[]> {
  if (ref.type !== "tv" || !Number.isInteger(season) || season < 1) return [];

  const cached = await deps.episodeCache.find(ref.source, ref.externalId, season);
  const now = deps.clock.now();
  if (cached && now.getTime() - cached.cachedAt.getTime() < EPISODE_CACHE_TTL_MS) {
    return cached.episodes;
  }

  try {
    const episodes = await deps.catalog.getSeasonEpisodes(ref.externalId, season);
    await deps.episodeCache.upsert({ source: ref.source, externalId: ref.externalId, season, episodes, cachedAt: now });
    return episodes;
  } catch {
    if (cached) return cached.episodes; // fallback sur cache périmé
    return [];
  }
}
