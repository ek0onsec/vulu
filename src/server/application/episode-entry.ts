import type { Deps } from "@/server/container";
import type { EpisodeEntry, LibraryEntry, WorkSource, WorkType } from "@/server/domain/entities";
import { ValidationError } from "@/server/domain/errors";
import { getOrImportWork } from "./get-work";
import { loadOrCreateEntry, normalizeGrid, derivePosition, isValidRating } from "./library-entry";

type Ref = { source: WorkSource; externalId: string; type: WorkType };

export async function updateEpisode(
  deps: Deps, userId: string, ref: Ref, season: number, episode: number,
  input: { watched?: boolean; watchedAt?: Date | null; rating?: number | null; text?: string | null },
): Promise<EpisodeEntry> {
  if (!Number.isInteger(season) || season < 1 || !Number.isInteger(episode) || episode < 1) {
    throw new ValidationError("Saison/épisode invalide");
  }
  if (input.rating !== undefined && input.rating !== null && !isValidRating(input.rating)) {
    throw new ValidationError("Note invalide (0 à 5, par pas de 0,1)");
  }
  const work = await getOrImportWork(deps, ref);
  const now = deps.clock.now();
  const existing = await deps.episodeEntries.findOne(userId, work.id, season, episode);
  const base: EpisodeEntry = existing ?? {
    id: deps.ids.next(), userId, workId: work.id, season, episode,
    watched: false, watchedAt: null, rating: null, text: null,
    audiences: { public: false, circle: false, communityIds: [] }, activityAt: null,
    createdAt: now, updatedAt: now,
  };
  const next: EpisodeEntry = { ...base, updatedAt: now };
  if (input.watched !== undefined) {
    next.watched = input.watched;
    next.watchedAt = input.watched
      ? (input.watchedAt !== undefined ? input.watchedAt : (base.watchedAt ?? now))
      : null;
  } else if (input.watchedAt !== undefined) {
    next.watchedAt = input.watchedAt;
  }
  if (input.rating !== undefined) next.rating = input.rating;
  if (input.text !== undefined) next.text = input.text?.trim() ? input.text.trim() : null;
  await deps.episodeEntries.upsert(next);

  // Recalcule la progression de la LibraryEntry parente depuis les épisodes vus.
  const libEntry = await loadOrCreateEntry(deps, userId, ref);
  const all = await deps.episodeEntries.listByUserAndWork(userId, work.id);
  const grid: number[][] = [];
  for (const e of all) {
    if (!e.watched) continue;
    const idx = e.season - 1;
    while (grid.length <= idx) grid.push([]);
    grid[idx]!.push(e.episode);
  }
  const norm = normalizeGrid(grid, work.episodeCounts);
  const pos = derivePosition(norm);
  const hasAny = norm.some((s) => s.length);
  const updatedLib: LibraryEntry = {
    ...libEntry,
    status: libEntry.status === "planned" ? "in_progress" : libEntry.status,
    progress: { season: pos.season, episode: pos.episode, tome: null, page: null, watchedEpisodes: hasAny ? norm : null },
    updatedAt: now,
  };
  await deps.entries.upsert(updatedLib);
  return next;
}

export async function getEpisodeEntries(deps: Deps, userId: string, workId: string): Promise<EpisodeEntry[]> {
  return deps.episodeEntries.listByUserAndWork(userId, workId);
}
