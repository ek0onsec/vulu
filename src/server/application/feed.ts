import type { Deps } from "@/server/container";
import type { EpisodeEntry, EntryAudiences, LibraryEntry, User, Work } from "@/server/domain/entities";
import { NotFoundError } from "@/server/domain/errors";
import { getCircle } from "./social";
import { getSeasonEpisodes } from "./get-episodes";

export type AuthorLite = Pick<User, "id" | "username" | "displayName" | "avatarUrl" | "plus" | "staff">;
export type WorkLite = Pick<Work, "id" | "title" | "year" | "posterUrl" | "type" | "episodeCounts" | "pageCount">;

export interface WorkFeedItem {
  kind: "work";
  entry: LibraryEntry;
  author: AuthorLite;
  work: WorkLite;
  likeCount: number;
  commentCount: number;
  likedByMe: boolean;
  communities: { id: string; name: string }[];
}
export interface EpisodeFeedItem {
  kind: "episode";
  episodeEntry: EpisodeEntry;
  author: AuthorLite;
  work: WorkLite;
  season: number;
  episode: number;
  title: string | null;
  likeCount: number;
  commentCount: number;
  likedByMe: boolean;
  communities: { id: string; name: string }[];
}
export type FeedItem = WorkFeedItem | EpisodeFeedItem;

export function feedCursor(item: FeedItem): { activityAt: Date; id: string } {
  return item.kind === "episode"
    ? { activityAt: item.episodeEntry.activityAt ?? item.episodeEntry.updatedAt, id: item.episodeEntry.id }
    : { activityAt: item.entry.activityAt ?? item.entry.createdAt, id: item.entry.id };
}
export function feedKey(item: FeedItem): string {
  return item.kind === "episode" ? `ep:${item.episodeEntry.id}` : `wk:${item.entry.id}`;
}

/** Enrichit des entrées brutes en items de feed (auteur, œuvre, compteurs, likedByMe). */
export async function enrichEntries(deps: Deps, viewerId: string, entries: LibraryEntry[]): Promise<WorkFeedItem[]> {
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
      kind: "work" as const,
      entry,
      author: { id: author.id, username: author.username, displayName: author.displayName, avatarUrl: author.avatarUrl, plus: author.plus, staff: author.staff },
      work: { id: work.id, title: work.title, year: work.year, posterUrl: work.posterUrl, type: work.type, episodeCounts: work.episodeCounts, pageCount: work.pageCount },
      likeCount, commentCount, likedByMe: liked.has(entry.id),
      communities: communities.map((c) => ({ id: c.id, name: c.name })),
    };
  }));
}

export async function enrichEpisodeEntries(deps: Deps, viewerId: string, entries: EpisodeEntry[]): Promise<EpisodeFeedItem[]> {
  const liked = new Set(await deps.likes.likedEntryIds(viewerId, entries.map((e) => e.id)));
  return Promise.all(entries.map(async (ee) => {
    const [author, work, likeCount, commentCount, communities] = await Promise.all([
      deps.users.findById(ee.userId),
      deps.works.findById(ee.workId),
      deps.likes.countByEntry(ee.id),
      deps.comments.countByEntry(ee.id),
      ee.audiences.communityIds.length > 0 ? deps.communities.listByIds(ee.audiences.communityIds) : Promise.resolve([]),
    ]);
    if (!author || !work) throw new NotFoundError("Données de feed incohérentes");
    let title: string | null = null;
    try {
      const eps = await getSeasonEpisodes(deps, { source: work.source, externalId: work.externalId, type: work.type }, ee.season);
      title = eps.find((e) => e.number === ee.episode)?.title ?? null;
    } catch { title = null; }
    return {
      kind: "episode" as const, episodeEntry: ee,
      author: { id: author.id, username: author.username, displayName: author.displayName, avatarUrl: author.avatarUrl, plus: author.plus, staff: author.staff },
      work: { id: work.id, title: work.title, year: work.year, posterUrl: work.posterUrl, type: work.type, episodeCounts: work.episodeCounts, pageCount: work.pageCount },
      season: ee.season, episode: ee.episode, title,
      likeCount, commentCount, likedByMe: liked.has(ee.id),
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

  const [workEntries, epEntries] = await Promise.all([
    deps.entries.feed({
      scope: opts.scope, circleUserIds: [...circle], followingUserIds: following,
      viewerId, domains: viewer.activeTabs, cursor: opts.cursor, limit: opts.limit,
    }),
    deps.episodeEntries.feed({
      scope: opts.scope, circleUserIds: [...circle], followingUserIds: following,
      viewerId, cursor: opts.cursor, limit: opts.limit,
    }),
  ]);
  const [workItems, epItems] = await Promise.all([
    enrichEntries(deps, viewerId, workEntries),
    enrichEpisodeEntries(deps, viewerId, epEntries),
  ]);
  return [...workItems, ...epItems]
    .sort((a, b) => feedCursor(b).activityAt.getTime() - feedCursor(a).activityAt.getTime())
    .slice(0, opts.limit);
}

/**
 * Une entrée est visible d'un viewer ssi : c'est la sienne, OU elle est publique,
 * OU elle cible le cercle (audiences.circle) et le viewer est dans le cercle de l'auteur,
 * OU elle cible une communauté dont le viewer est membre. Une entrée « gardée pour soi »
 * (public:false, circle:false, communityIds:[]) n'est visible que de son auteur.
 */
export function isEntryVisibleTo(
  target: { userId: string; audiences: EntryAudiences }, viewerId: string, circle: Set<string>, viewerCommunityIds: Set<string>,
): boolean {
  if (target.userId === viewerId) return true;
  if (target.audiences.public) return true;
  if (target.audiences.circle && circle.has(target.userId)) return true;
  return target.audiences.communityIds.some((id) => viewerCommunityIds.has(id));
}

async function viewerCommunityIdSet(deps: Deps, viewerId: string): Promise<Set<string>> {
  const memberships = await deps.memberships.listForUser(viewerId);
  return new Set(memberships.map((m) => m.communityId));
}

/** Un post (entrée) enrichi, visible pour le viewer (public, cercle, communauté, ou le sien). */
export async function getPostItem(deps: Deps, viewerId: string, id: string): Promise<WorkFeedItem | EpisodeFeedItem> {
  const entry = await deps.entries.findById(id);
  if (entry) {
    if (entry.userId !== viewerId) {
      const [circle, communityIds] = await Promise.all([getCircle(deps, viewerId), viewerCommunityIdSet(deps, viewerId)]);
      if (!isEntryVisibleTo(entry, viewerId, circle, communityIds)) throw new NotFoundError("Publication introuvable");
    }
    const [item] = await enrichEntries(deps, viewerId, [entry]);
    if (!item) throw new NotFoundError("Publication introuvable");
    return item;
  }
  const ep = await deps.episodeEntries.findById(id);
  if (ep) {
    if (ep.userId !== viewerId) {
      const [circle, communityIds] = await Promise.all([getCircle(deps, viewerId), viewerCommunityIdSet(deps, viewerId)]);
      if (!isEntryVisibleTo(ep, viewerId, circle, communityIds)) throw new NotFoundError("Publication introuvable");
    }
    const [item] = await enrichEpisodeEntries(deps, viewerId, [ep]);
    if (!item) throw new NotFoundError("Publication introuvable");
    return item;
  }
  throw new NotFoundError("Publication introuvable");
}

/** Ton propre avis sur une œuvre, s'il est publishable ET partagé (sinon null). */
export async function getMyWorkReview(deps: Deps, viewerId: string, workId: string): Promise<WorkFeedItem | null> {
  const entry = await deps.entries.findByUserAndWork(viewerId, workId);
  if (!entry) return null;
  const publishable = entry.status === "done" && (entry.rating !== null || entry.text !== null);
  const shared = entry.audiences.public || entry.audiences.circle || entry.audiences.communityIds.length > 0;
  if (!publishable || !shared) return null;
  const [item] = await enrichEntries(deps, viewerId, [entry]);
  return item ?? null;
}

/** Avis d'autres membres sur une œuvre, visibles pour le viewer (public, cercle, communauté), hors soi. */
export async function getWorkReviews(deps: Deps, viewerId: string, workId: string): Promise<WorkFeedItem[]> {
  const [circle, communityIds] = await Promise.all([getCircle(deps, viewerId), viewerCommunityIdSet(deps, viewerId)]);
  const entries = (await deps.entries.listByWork(workId)).filter(
    (e) => e.userId !== viewerId && isEntryVisibleTo(e, viewerId, circle, communityIds),
  );
  return enrichEntries(deps, viewerId, entries);
}
