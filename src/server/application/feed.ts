import type { Deps } from "@/server/container";
import type { LibraryEntry, User, Work } from "@/server/domain/entities";
import { NotFoundError } from "@/server/domain/errors";
import { getCircle } from "./social";

export interface FeedItem {
  entry: LibraryEntry;
  author: Pick<User, "id" | "username" | "displayName" | "avatarUrl">;
  work: Pick<Work, "id" | "title" | "year" | "posterUrl" | "type">;
  likeCount: number;
  commentCount: number;
  likedByMe: boolean;
}

export async function buildFeed(
  deps: Deps, viewerId: string, opts: { cursor: { createdAt: Date; id: string } | null; limit: number },
): Promise<FeedItem[]> {
  const viewer = await deps.users.findById(viewerId);
  if (!viewer) throw new NotFoundError("Utilisateur introuvable");
  const circle = await getCircle(deps, viewerId);

  const entries = await deps.entries.feed({
    circleUserIds: [...circle],
    viewerId,
    domains: viewer.activeTabs,
    cursor: opts.cursor,
    limit: opts.limit,
  });

  const liked = new Set(await deps.likes.likedEntryIds(viewerId, entries.map((e) => e.id)));

  return Promise.all(entries.map(async (entry) => {
    const [author, work, likeCount, commentCount] = await Promise.all([
      deps.users.findById(entry.userId),
      deps.works.findById(entry.workId),
      deps.likes.countByEntry(entry.id),
      deps.comments.countByEntry(entry.id),
    ]);
    if (!author || !work) throw new NotFoundError("Données de feed incohérentes");
    return {
      entry,
      author: { id: author.id, username: author.username, displayName: author.displayName, avatarUrl: author.avatarUrl },
      work: { id: work.id, title: work.title, year: work.year, posterUrl: work.posterUrl, type: work.type },
      likeCount, commentCount, likedByMe: liked.has(entry.id),
    };
  }));
}
