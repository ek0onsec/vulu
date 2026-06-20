import type { Deps } from "@/server/container";
import type { LibraryEntry, PersonRole, WorkType } from "@/server/domain/entities";
import { NotFoundError } from "@/server/domain/errors";

export interface LibraryPoster { id: string; workId: string; title: string; posterUrl: string | null; type: WorkType; rating: number | null; peopleIds: number[] }
export interface LibraryPlaylist { id: string; name: string; kind: "films" | "books" | "mixed"; description: string | null; bannerUrl: string | null; visibility: "public" | "private"; count: number; covers: string[] }
export interface Library { playlists: LibraryPlaylist[]; watchlist: LibraryPoster[]; seen: LibraryPoster[]; people: { id: number; name: string; role: PersonRole }[] }

export async function getLibrary(deps: Deps, userId: string): Promise<Library> {
  const user = await deps.users.findById(userId);
  if (!user) throw new NotFoundError("Utilisateur introuvable");

  async function posters(entries: LibraryEntry[]): Promise<LibraryPoster[]> {
    const resolved = await Promise.all(entries.map(async (e) => ({ e, w: await deps.works.findById(e.workId) })));
    return resolved
      .filter((x) => x.w !== null)
      .map(({ e, w }) => ({ id: e.id, workId: w!.id, title: w!.title, posterUrl: w!.posterUrl, type: w!.type, rating: e.rating, peopleIds: w!.people.map((p) => p.tmdbId) }));
  }

  const [watchlist, seen, lists] = await Promise.all([
    deps.entries.listByUser(userId, { status: "planned" }).then(posters),
    deps.entries.listByUser(userId, { status: "done" }).then(posters),
    deps.lists.listByUser(userId),
  ]);

  const playlists: LibraryPlaylist[] = await Promise.all(
    lists.map(async (l) => {
      const coverWorks = await Promise.all(l.workIds.slice(0, 4).map((id) => deps.works.findById(id)));
      const covers = coverWorks.map((w) => w?.posterUrl).filter((u): u is string => Boolean(u));
      return { id: l.id, name: l.name, kind: l.kind, description: l.description, bannerUrl: l.bannerUrl, visibility: l.visibility, count: l.workIds.length, covers };
    }),
  );

  const ownedWorkIds = new Set([...watchlist, ...seen].map((p) => p.workId));
  const peopleMap = new Map<number, { id: number; name: string; role: PersonRole }>();
  for (const id of ownedWorkIds) {
    const w = await deps.works.findById(id);
    for (const p of w?.people ?? []) if (!peopleMap.has(p.tmdbId)) peopleMap.set(p.tmdbId, { id: p.tmdbId, name: p.name, role: p.role });
  }
  const people = [...peopleMap.values()].sort((a, b) => a.name.localeCompare(b.name));

  return { playlists, watchlist, seen, people };
}
