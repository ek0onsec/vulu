import type { Deps } from "@/server/container";
import type { EntryProgress, EntryStatus, LibraryEntry, EntryAudiences, WorkSource, WorkType } from "@/server/domain/entities";
import { ForbiddenError, NotFoundError, ValidationError } from "@/server/domain/errors";
import { getOrImportWork } from "./get-work";

type Ref = { source: WorkSource; externalId: string; type: WorkType };

function isValidRating(r: number): boolean {
  if (r < 0 || r > 5) return false;
  return Math.round(r * 10) === r * 10; // pas de 0,1
}

async function loadOrCreateEntry(deps: Deps, userId: string, ref: Ref): Promise<LibraryEntry> {
  const work = await getOrImportWork(deps, ref);
  const existing = await deps.entries.findByUserAndWork(userId, work.id);
  if (existing) return existing;
  const now = deps.clock.now();
  // Défaut « gardé pour soi » : un ajout de statut sans note ni commentaire reste privé
  // (invisible au feed et aux avis d'œuvre) tant que l'utilisateur ne choisit pas de partager.
  return { id: deps.ids.next(), userId, workId: work.id, domain: work.domain,
    status: "planned", rating: null, text: null, audiences: { public: false, circle: false, communityIds: [] },
    completedAt: null, progress: null, activityAt: null, createdAt: now, updatedAt: now };
}

export async function setEntryStatus(deps: Deps, userId: string, ref: Ref, status: EntryStatus, completedAt?: Date | null): Promise<LibraryEntry> {
  const entry = await loadOrCreateEntry(deps, userId, ref);
  const resolvedCompletedAt = completedAt !== undefined ? completedAt : (status === "done" ? entry.completedAt ?? deps.clock.now() : entry.completedAt);
  const updated: LibraryEntry = { ...entry, status, completedAt: resolvedCompletedAt, updatedAt: deps.clock.now() };
  await deps.entries.upsert(updated);
  return updated;
}

export async function rateOrReviewWork(
  deps: Deps, userId: string, ref: Ref,
  input: { rating: number | null; text: string | null; completedAt?: Date | null; audiences: EntryAudiences },
): Promise<LibraryEntry> {
  if (input.rating === null && (input.text === null || input.text.trim() === "")) {
    throw new ValidationError("Ajoute une note ou un commentaire");
  }
  if (input.rating !== null && !isValidRating(input.rating)) {
    throw new ValidationError("Note invalide (0 à 5, par pas de 0,1)");
  }
  const { audiences } = input;
  // Aucune destination = entrée « gardée pour soi » (note/avis privé, hors feed) : autorisé.
  // Pour chaque communauté ciblée, l'auteur doit en être membre.
  for (const communityId of audiences.communityIds) {
    const member = await deps.memberships.find(communityId, userId);
    if (!member) throw new ForbiddenError("Tu n'es pas membre de cette communauté");
  }
  const entry = await loadOrCreateEntry(deps, userId, ref);
  const updated: LibraryEntry = { ...entry, status: "done", rating: input.rating,
    text: input.text?.trim() ? input.text.trim() : null, audiences,
    completedAt: input.completedAt !== undefined ? input.completedAt : (entry.completedAt ?? deps.clock.now()),
    activityAt: deps.clock.now(), updatedAt: deps.clock.now() };
  await deps.entries.upsert(updated);
  return updated;
}

function clampPositive(n: number | null | undefined, max: number | null): number | null {
  if (n === null || n === undefined) return null;
  const v = Math.max(1, Math.floor(n));
  return max && max > 0 ? Math.min(v, max) : v;
}

function normalizeGrid(grid: number[][] | null | undefined, counts: number[] | null): number[][] {
  if (!grid) return [];
  const out: number[][] = [];
  for (let i = 0; i < grid.length; i++) {
    if (counts && i >= counts.length) continue; // saison inexistante
    const max = counts?.[i] ?? null;
    out[i] = [...new Set(grid[i] ?? [])]
      .filter((n) => Number.isInteger(n) && n >= 1 && (max === null || n <= max))
      .sort((a, b) => a - b);
  }
  return out;
}

function derivePosition(grid: number[][]): { season: number | null; episode: number | null } {
  for (let i = grid.length - 1; i >= 0; i--) {
    const eps = grid[i];
    if (eps && eps.length) return { season: i + 1, episode: Math.max(...eps) };
  }
  return { season: null, episode: null };
}

function gridWithEpisode(grid: number[][] | null | undefined, season: number, episode: number): number[][] {
  const out = (grid ?? []).map((s) => [...(s ?? [])]);
  const idx = season - 1;
  while (out.length <= idx) out.push([]);
  const seasonEps = out[idx]!;
  if (!seasonEps.includes(episode)) seasonEps.push(episode);
  return out;
}

export async function updateProgress(
  deps: Deps, userId: string, ref: Ref,
  input: { season?: number | null; episode?: number | null; tome?: number | null; page?: number | null; watchedEpisodes?: number[][] | null },
): Promise<LibraryEntry> {
  for (const v of [input.season, input.episode, input.tome, input.page]) {
    if (v !== null && v !== undefined && (!Number.isInteger(v) || v < 1)) {
      throw new ValidationError("Progression invalide (entier ≥ 1)");
    }
  }
  const work = await getOrImportWork(deps, ref);
  const existing = await deps.entries.findByUserAndWork(userId, work.id);
  const base = existing ?? await loadOrCreateEntry(deps, userId, ref);

  let progress: EntryProgress | null = null;
  if (work.type === "tv") {
    const counts = work.episodeCounts;
    let grid: number[][];
    if (input.watchedEpisodes !== undefined && input.watchedEpisodes !== null) {
      grid = normalizeGrid(input.watchedEpisodes, counts);
    } else {
      const s = clampPositive(input.season, null) ?? base.progress?.season ?? 1;
      const epMax = counts?.[s - 1] ?? null;
      const e = clampPositive(input.episode, epMax);
      const start = base.progress?.watchedEpisodes ?? [];
      grid = normalizeGrid(e !== null ? gridWithEpisode(start, s, e) : start, counts);
    }
    const pos = derivePosition(grid);
    progress = { season: pos.season, episode: pos.episode, tome: null, page: null, watchedEpisodes: grid.some((s) => s.length) ? grid : null };
  } else if (work.type === "book") {
    progress = {
      season: null, episode: null,
      tome: clampPositive(input.tome, null) ?? base.progress?.tome ?? null,
      page: clampPositive(input.page, work.pageCount) ?? base.progress?.page ?? null,
      watchedEpisodes: null,
    };
  } // film : progress reste null

  const updated: LibraryEntry = { ...base, status: "in_progress", progress, updatedAt: deps.clock.now() };
  await deps.entries.upsert(updated);
  return updated;
}

export async function shareMilestone(deps: Deps, userId: string, entryId: string): Promise<LibraryEntry> {
  const entry = await deps.entries.findById(entryId);
  if (!entry) throw new NotFoundError("Entrée introuvable");
  if (entry.userId !== userId) throw new ForbiddenError("Action non autorisée");
  const updated: LibraryEntry = { ...entry, activityAt: deps.clock.now(), updatedAt: deps.clock.now() };
  await deps.entries.upsert(updated);
  return updated;
}

export async function removeEntry(deps: Deps, userId: string, entryId: string): Promise<void> {
  const entry = await deps.entries.findById(entryId);
  if (!entry) throw new NotFoundError("Entrée introuvable");
  if (entry.userId !== userId) throw new ForbiddenError("Action non autorisée");
  await deps.entries.remove(entryId);
}
