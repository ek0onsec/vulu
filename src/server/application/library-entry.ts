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
  return { id: deps.ids.next(), userId, workId: work.id, domain: work.domain,
    status: "planned", rating: null, text: null, audiences: { public: false, circle: true, communityIds: [] },
    progress: null, activityAt: null, createdAt: now, updatedAt: now };
}

export async function setEntryStatus(deps: Deps, userId: string, ref: Ref, status: EntryStatus): Promise<LibraryEntry> {
  const entry = await loadOrCreateEntry(deps, userId, ref);
  const updated: LibraryEntry = { ...entry, status, updatedAt: deps.clock.now() };
  await deps.entries.upsert(updated);
  return updated;
}

export async function rateOrReviewWork(
  deps: Deps, userId: string, ref: Ref,
  input: { rating: number | null; text: string | null; audiences: EntryAudiences },
): Promise<LibraryEntry> {
  if (input.rating === null && (input.text === null || input.text.trim() === "")) {
    throw new ValidationError("Ajoute une note ou un commentaire");
  }
  if (input.rating !== null && !isValidRating(input.rating)) {
    throw new ValidationError("Note invalide (0 à 5, par pas de 0,1)");
  }
  const { audiences } = input;
  if (!audiences.public && !audiences.circle && audiences.communityIds.length === 0) {
    throw new ValidationError("Choisis au moins une destination");
  }
  // Pour chaque communauté ciblée, l'auteur doit en être membre.
  for (const communityId of audiences.communityIds) {
    const member = await deps.memberships.find(communityId, userId);
    if (!member) throw new ForbiddenError("Tu n'es pas membre de cette communauté");
  }
  const entry = await loadOrCreateEntry(deps, userId, ref);
  const updated: LibraryEntry = { ...entry, status: "done", rating: input.rating,
    text: input.text?.trim() ? input.text.trim() : null, audiences,
    activityAt: deps.clock.now(), updatedAt: deps.clock.now() };
  await deps.entries.upsert(updated);
  return updated;
}

function clampPositive(n: number | null | undefined, max: number | null): number | null {
  if (n === null || n === undefined) return null;
  const v = Math.max(1, Math.floor(n));
  return max && max > 0 ? Math.min(v, max) : v;
}

export async function updateProgress(
  deps: Deps, userId: string, ref: Ref,
  input: { season?: number | null; episode?: number | null; tome?: number | null; page?: number | null },
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
    const season = clampPositive(input.season, null) ?? base.progress?.season ?? 1;
    const epMax = work.episodeCounts?.[season - 1] ?? null;
    progress = { season, episode: clampPositive(input.episode, epMax) ?? base.progress?.episode ?? 1, tome: null, page: null };
  } else if (work.type === "book") {
    progress = {
      season: null, episode: null,
      tome: clampPositive(input.tome, null) ?? base.progress?.tome ?? null,
      page: clampPositive(input.page, work.pageCount) ?? base.progress?.page ?? null,
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
