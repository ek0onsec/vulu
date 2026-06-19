import type { Deps } from "@/server/container";
import type { Domain, Work, WorkSource, WorkType } from "@/server/domain/entities";
import { NotFoundError } from "@/server/domain/errors";

export function domainOf(type: WorkType): Domain {
  return type === "book" ? "books" : "films";
}

export async function getOrImportWork(
  deps: Deps, ref: { source: WorkSource; externalId: string; type: WorkType },
): Promise<Work> {
  const cached = await deps.works.findByExternal(ref.source, ref.externalId);
  if (cached) return cached;
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
    episodeCounts: null,
    pageCount: null,
    cachedAt: deps.clock.now(),
  };
  await deps.works.upsert(work);
  return work;
}
