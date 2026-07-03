import type { Deps } from "@/server/container";
import type { Domain, Work, WorkSource, WorkType } from "@/server/domain/entities";
import { NotFoundError } from "@/server/domain/errors";

export function domainOf(type: WorkType): Domain {
  return type === "book" ? "books" : "films";
}

/** Re-récupère le runtime d'un film/série dont il manque (import antérieur), et le persiste. */
export async function backfillRuntime(deps: Deps, work: Work): Promise<Work> {
  if (work.type === "book" || work.runtime !== null) return work;
  try {
    const details = await deps.catalog.getWork(work.externalId, work.type);
    if (!details || details.runtime === null || details.runtime === undefined) return work;
    const updated: Work = {
      ...work,
      runtime: details.runtime,
      episodeCounts: details.episodeCounts ?? work.episodeCounts,
      cachedAt: deps.clock.now(),
    };
    await deps.works.upsert(updated);
    return updated;
  } catch {
    return work;
  }
}

export async function getOrImportWork(
  deps: Deps, ref: { source: WorkSource; externalId: string; type: WorkType },
): Promise<Work> {
  const cached = await deps.works.findByExternal(ref.source, ref.externalId);
  if (cached) return backfillRuntime(deps, cached);
  const details = await deps.catalog.getWork(ref.externalId, ref.type);
  if (!details) throw new NotFoundError("Œuvre introuvable dans le catalogue");
  const work: Work = {
    id: deps.ids.next(),
    source: ref.source,
    externalId: details.externalId,
    type: details.type,
    domain: domainOf(details.type),
    title: details.title,
    year: details.year,
    posterUrl: details.posterUrl,
    backdropUrl: details.backdropUrl,
    overview: details.overview,
    genres: details.genres,
    people: details.people,
    externalRating: details.externalRating,
    watchProviders: details.watchProviders,
    episodeCounts: details.episodeCounts ?? null,
    pageCount: details.pageCount ?? null,
    runtime: details.runtime ?? null,
    cachedAt: deps.clock.now(),
  };
  await deps.works.upsert(work);
  return work;
}
