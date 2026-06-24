import type { Deps } from "@/server/container";
import type { LibraryEntry, User, Work } from "@/server/domain/entities";
import { NotFoundError } from "@/server/domain/errors";
import { getCircle } from "./social";

export interface FeedItem {
  entry: LibraryEntry;
  author: Pick<User, "id" | "username" | "displayName" | "avatarUrl" | "plus" | "staff">;
  work: Pick<Work, "id" | "title" | "year" | "posterUrl" | "type" | "episodeCounts" | "pageCount">;
  likeCount: number;
  commentCount: number;
  likedByMe: boolean;
  communities: { id: string; name: string }[];
}

/** Enrichit des entrées brutes en items de feed (auteur, œuvre, compteurs, likedByMe). */
export async function enrichEntries(deps: Deps, viewerId: string, entries: LibraryEntry[]): Promise<FeedItem[]> {
  const liked = new Set(await deps.likes.likedEntryIds(viewerId, entries.map((e) => e.id)));
  return Promise.all(entries.map(async (entry) => {
    const [author, work, likeCount, commentCount, communities] = await Promise.all([
      deps.users.findById(entry.userId),
      deps.works.findById(entry.workId),
      deps.likes.countByEntry(entry.id),
      deps.comments.countByEntry(entry.id),
      entry.audiences.communityIds.length > 0
        ? deps.communities.listByIds(entry.audiences.communityIds)
        : Promise.resolve([]),
    ]);
    if (!author || !work) throw new NotFoundError("Données de feed incohérentes");
    return {
      entry,
      author: { id: author.id, username: author.username, displayName: author.displayName, avatarUrl: author.avatarUrl, plus: author.plus, staff: author.staff },
      work: { id: work.id, title: work.title, year: work.year, posterUrl: work.posterUrl, type: work.type, episodeCounts: work.episodeCounts, pageCount: work.pageCount },
      likeCount, commentCount, likedByMe: liked.has(entry.id),
      communities: communities.map((c) => ({ id: c.id, name: c.name })),
    };
  }));
}

export async function buildFeed(
  deps: Deps, viewerId: string, opts: { scope: "foryou" | "following"; cursor: { activityAt: Date; id: string } | null; limit: number },
): Promise<FeedItem[]> {
  const viewer = await deps.users.findById(viewerId);
  if (!viewer) throw new NotFoundError("Utilisateur introuvable");
  const [circle, following] = await Promise.all([
    getCircle(deps, viewerId),
    deps.follows.followeeIdsOf(viewerId),
  ]);

  const entries = await deps.entries.feed({
    scope: opts.scope,
    circleUserIds: [...circle],
    followingUserIds: following,
    viewerId,
    domains: viewer.activeTabs,
    cursor: opts.cursor,
    limit: opts.limit,
  });

  return enrichEntries(deps, viewerId, entries);
}

/** Un post (entrée) enrichi, visible pour le viewer (public, cercle, ou le sien). */
export async function getEntryItem(deps: Deps, viewerId: string, entryId: string): Promise<FeedItem> {
  const entry = await deps.entries.findById(entryId);
  if (!entry) throw new NotFoundError("Publication introuvable");
  if (entry.userId !== viewerId && !entry.audiences.public) {
    const circle = await getCircle(deps, viewerId);
    if (!circle.has(entry.userId)) throw new NotFoundError("Publication introuvable");
  }
  const [item] = await enrichEntries(deps, viewerId, [entry]);
  if (!item) throw new NotFoundError("Publication introuvable");
  return item;
}

/** Avis d'autres membres sur une œuvre, visibles pour le viewer (public ou cercle), hors soi. */
export async function getWorkReviews(deps: Deps, viewerId: string, workId: string): Promise<FeedItem[]> {
  const circle = await getCircle(deps, viewerId);
  const entries = (await deps.entries.listByWork(workId)).filter(
    (e) => e.userId !== viewerId && (e.audiences.public || circle.has(e.userId)),
  );
  return enrichEntries(deps, viewerId, entries);
}
