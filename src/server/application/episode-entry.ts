import type { Deps } from "@/server/container";
import type { EpisodeEntry, EntryAudiences, LibraryEntry, Work, WorkSource, WorkType } from "@/server/domain/entities";
import { ForbiddenError, ValidationError } from "@/server/domain/errors";
import { getOrImportWork } from "./get-work";
import { loadOrCreateEntry, normalizeGrid, derivePosition, isValidRating } from "./library-entry";
import { deriveSeriesStatus } from "./series-status";

type Ref = { source: WorkSource; externalId: string; type: WorkType };

export async function recomputeSeriesEntry(deps: Deps, userId: string, ref: Ref, work: Work): Promise<void> {
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
  const status = deriveSeriesStatus(hasAny ? norm : null, work.episodeCounts);
  const now = deps.clock.now();
  const completedAt = status === "done" ? (libEntry.completedAt ?? now) : null;
  const updatedLib: LibraryEntry = {
    ...libEntry, status, completedAt,
    progress: { season: pos.season, episode: pos.episode, tome: null, page: null, watchedEpisodes: hasAny ? norm : null },
    updatedAt: now,
  };
  await deps.entries.upsert(updatedLib);
}

export async function markAllEpisodes(deps: Deps, userId: string, ref: Ref, watched: boolean): Promise<void> {
  const work = await getOrImportWork(deps, ref);
  const now = deps.clock.now();
  const counts = work.episodeCounts ?? [];
  for (let si = 0; si < counts.length; si++) {
    const count = counts[si]!;
    for (let ep = 1; ep <= count; ep++) {
      const existing = await deps.episodeEntries.findOne(userId, work.id, si + 1, ep);
      const base = existing ?? {
        id: deps.ids.next(), userId, workId: work.id, season: si + 1, episode: ep,
        watched: false, watchedAt: null, rating: null, text: null,
        audiences: { public: false, circle: false, communityIds: [] }, activityAt: null,
        createdAt: now, updatedAt: now,
      };
      await deps.episodeEntries.upsert({ ...base, watched, watchedAt: watched ? (base.watchedAt ?? now) : null, updatedAt: now });
    }
  }
  await recomputeSeriesEntry(deps, userId, ref, work);
}

export async function updateEpisode(
  deps: Deps, userId: string, ref: Ref, season: number, episode: number,
  input: { watched?: boolean; watchedAt?: Date | null; rating?: number | null; text?: string | null; audiences?: EntryAudiences },
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
  if (input.audiences !== undefined) {
    const hasContent = next.rating !== null || (next.text !== null && next.text.trim() !== "");
    const anyDest = input.audiences.public || input.audiences.circle || input.audiences.communityIds.length > 0;
    if (anyDest && !hasContent) throw new ValidationError("Ajoute une note ou un commentaire");
    for (const communityId of input.audiences.communityIds) {
      const member = await deps.memberships.find(communityId, userId);
      if (!member) throw new ForbiddenError("Tu n'es pas membre de cette communauté");
    }
    next.audiences = input.audiences;
    next.activityAt = anyDest ? now : null;
  }
  await deps.episodeEntries.upsert(next);

  // Recalcule la progression + le statut dérivé de la LibraryEntry parente.
  await recomputeSeriesEntry(deps, userId, ref, work);
  return next;
}

export async function getEpisodeEntries(deps: Deps, userId: string, workId: string): Promise<EpisodeEntry[]> {
  return deps.episodeEntries.listByUserAndWork(userId, workId);
}
