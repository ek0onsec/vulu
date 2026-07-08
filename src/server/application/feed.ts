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

/**
 * Charge en batch tout ce qui enrichit un lot d'entrées (auteurs, œuvres, compteurs likes/comments,
 * likedByMe, communautés). Remplace ~5 requêtes par entrée par un nombre constant de requêtes,
 * quel que soit le nombre d'items — clé de la fluidité du feed.
 */
async function loadEnrichment(
  deps: Deps, viewerId: string, entries: { id: string; userId: string; workId: string; audiences: EntryAudiences }[],
) {
  const entryIds = entries.map((e) => e.id);
  const userIds = [...new Set(entries.map((e) => e.userId))];
  const workIds = [...new Set(entries.map((e) => e.workId))];
  const communityIds = [...new Set(entries.flatMap((e) => e.audiences.communityIds))];
  const [users, works, likeCounts, commentCounts, likedIds, communities] = await Promise.all([
    deps.users.findByIds(userIds),
    deps.works.findByIds(workIds),
    deps.likes.countByEntries(entryIds),
    deps.comments.countByEntries(entryIds),
    deps.likes.likedEntryIds(viewerId, entryIds),
    communityIds.length > 0 ? deps.communities.listByIds(communityIds) : Promise.resolve([]),
  ]);
  const usersById = new Map(users.map((u) => [u.id, u]));
  const worksById = new Map(works.map((w) => [w.id, w]));
  const communitiesById = new Map(communities.map((c) => [c.id, c]));
  const liked = new Set(likedIds);
  return {
    author(userId: string): AuthorLite {
      const author = usersById.get(userId);
      if (!author) throw new NotFoundError("Données de feed incohérentes");
      return { id: author.id, username: author.username, displayName: author.displayName, avatarUrl: author.avatarUrl, plus: author.plus, staff: author.staff };
    },
    work(workId: string): Work {
      const work = worksById.get(workId);
      if (!work) throw new NotFoundError("Données de feed incohérentes");
      return work;
    },
    likeCount: (id: string) => likeCounts.get(id) ?? 0,
    commentCount: (id: string) => commentCounts.get(id) ?? 0,
    likedByMe: (id: string) => liked.has(id),
    communities: (ids: string[]) => ids.map((id) => communitiesById.get(id)).filter((c): c is NonNullable<typeof c> => Boolean(c)).map((c) => ({ id: c.id, name: c.name })),
  };
}

const toWorkLite = (work: Work): WorkLite =>
  ({ id: work.id, title: work.title, year: work.year, posterUrl: work.posterUrl, type: work.type, episodeCounts: work.episodeCounts, pageCount: work.pageCount });

/** Enrichit des entrées brutes en items de feed (auteur, œuvre, compteurs, likedByMe). */
export async function enrichEntries(deps: Deps, viewerId: string, entries: LibraryEntry[]): Promise<WorkFeedItem[]> {
  const enrich = await loadEnrichment(deps, viewerId, entries);
  return entries.map((entry) => ({
    kind: "work" as const,
    entry,
    author: enrich.author(entry.userId),
    work: toWorkLite(enrich.work(entry.workId)),
    likeCount: enrich.likeCount(entry.id),
    commentCount: enrich.commentCount(entry.id),
    likedByMe: enrich.likedByMe(entry.id),
    communities: enrich.communities(entry.audiences.communityIds),
  }));
}

export async function enrichEpisodeEntries(deps: Deps, viewerId: string, entries: EpisodeEntry[]): Promise<EpisodeFeedItem[]> {
  const enrich = await loadEnrichment(deps, viewerId, entries);
  return Promise.all(entries.map(async (ee) => {
    const work = enrich.work(ee.workId);
    let title: string | null = null;
    try {
      const eps = await getSeasonEpisodes(deps, { source: work.source, externalId: work.externalId, type: work.type }, ee.season);
      title = eps.find((e) => e.number === ee.episode)?.title ?? null;
    } catch { title = null; }
    return {
      kind: "episode" as const, episodeEntry: ee,
      author: enrich.author(ee.userId),
      work: toWorkLite(work),
      season: ee.season, episode: ee.episode, title,
      likeCount: enrich.likeCount(ee.id),
      commentCount: enrich.commentCount(ee.id),
      likedByMe: enrich.likedByMe(ee.id),
      communities: enrich.communities(ee.audiences.communityIds),
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
