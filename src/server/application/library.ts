import type { Deps } from "@/server/container";
import type { EntryProgress, LibraryEntry, PersonRole, Work, WorkSource, WorkType } from "@/server/domain/entities";
import { NotFoundError } from "@/server/domain/errors";

export interface LibraryPoster { id: string; workId: string; title: string; posterUrl: string | null; type: WorkType; rating: number | null; peopleIds: number[] }
export interface LibraryPlaylist { id: string; name: string; kind: "films" | "books" | "mixed"; description: string | null; bannerUrl: string | null; visibility: "public" | "private"; count: number; covers: string[] }
export interface LibraryInProgress { entryId: string; workId: string; source: WorkSource; externalId: string; title: string; posterUrl: string | null; type: WorkType; episodeCounts: number[] | null; pageCount: number | null; progress: EntryProgress | null; peopleIds: number[] }
export interface Library { playlists: LibraryPlaylist[]; watchlist: LibraryPoster[]; seen: LibraryPoster[]; inProgress: LibraryInProgress[]; people: { id: number; name: string; role: PersonRole }[] }

export async function getLibrary(deps: Deps, userId: string): Promise<Library> {
  const user = await deps.users.findById(userId);
  if (!user) throw new NotFoundError("Utilisateur introuvable");

  const [plannedEntries, doneEntries, inProgressEntries, lists] = await Promise.all([
    deps.entries.listByUser(userId, { status: "planned" }),
    deps.entries.listByUser(userId, { status: "done" }),
    deps.entries.listByUser(userId, { status: "in_progress" }),
    deps.lists.listByUser(userId),
  ]);

  // Toutes les œuvres nécessaires (entrées + couvertures de collections) sont chargées en UNE
  // seule requête batch ($in), au lieu d'un findById par œuvre (N+1 qui rendait la page très lente).
  const coverIds = lists.flatMap((l) => l.workIds.slice(0, 4));
  const neededWorkIds = [...new Set([
    ...plannedEntries.map((e) => e.workId),
    ...doneEntries.map((e) => e.workId),
    ...inProgressEntries.map((e) => e.workId),
    ...coverIds,
  ])];
  const worksById = new Map<string, Work>();
  for (const w of await deps.works.findByIds(neededWorkIds)) worksById.set(w.id, w);

  const toPoster = (e: LibraryEntry): LibraryPoster | null => {
    const w = worksById.get(e.workId);
    return w ? { id: e.id, workId: w.id, title: w.title, posterUrl: w.posterUrl, type: w.type, rating: e.rating, peopleIds: w.people.map((p) => p.tmdbId) } : null;
  };
  const watchlist = plannedEntries.map(toPoster).filter((x): x is LibraryPoster => x !== null);
  const seen = doneEntries.map(toPoster).filter((x): x is LibraryPoster => x !== null);

  const inProgress: LibraryInProgress[] = inProgressEntries.map((e) => {
    const w = worksById.get(e.workId);
    return w ? {
      entryId: e.id, workId: w.id, source: w.source, externalId: w.externalId,
      title: w.title, posterUrl: w.posterUrl, type: w.type,
      episodeCounts: w.episodeCounts, pageCount: w.pageCount,
      progress: e.progress, peopleIds: w.people.map((p) => p.tmdbId),
    } : null;
  }).filter((x): x is LibraryInProgress => x !== null);

  const playlists: LibraryPlaylist[] = lists.map((l) => {
    const covers = l.workIds.slice(0, 4).map((id) => worksById.get(id)?.posterUrl).filter((u): u is string => Boolean(u));
    return { id: l.id, name: l.name, kind: l.kind, description: l.description, bannerUrl: l.bannerUrl, visibility: l.visibility, count: l.workIds.length, covers };
  });

  // Personnes : depuis la map déjà chargée (planned + seen), sans boucle séquentielle ni re-fetch.
  const ownedWorkIds = new Set([...watchlist, ...seen].map((p) => p.workId));
  const peopleMap = new Map<number, { id: number; name: string; role: PersonRole }>();
  for (const id of ownedWorkIds) {
    const w = worksById.get(id);
    for (const p of w?.people ?? []) if (!peopleMap.has(p.tmdbId)) peopleMap.set(p.tmdbId, { id: p.tmdbId, name: p.name, role: p.role });
  }
  const people = [...peopleMap.values()].sort((a, b) => a.name.localeCompare(b.name));

  return { playlists, watchlist, seen, inProgress, people };
}
