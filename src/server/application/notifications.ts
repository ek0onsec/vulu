import type { Deps } from "@/server/container";
import type { User } from "@/server/domain/entities";
import { NotFoundError } from "@/server/domain/errors";

export interface NotifActor { username: string; displayName: string; avatarUrl: string | null }
export interface Notification {
  id: string;
  kind: "like" | "comment" | "follow";
  actors: NotifActor[];      // jusqu'à 3, les plus récents
  totalActors: number;
  work?: { id: string; title: string };
  entryId?: string;
  createdAt: string;         // ISO, événement le plus récent du groupe
  unread: boolean;
}

export async function buildNotifications(deps: Deps, userId: string): Promise<Notification[]> {
  const [me, myEntries, followers] = await Promise.all([
    deps.users.findById(userId),
    deps.entries.listByUser(userId, {}),
    deps.follows.listFollowers(userId).then((fs) => fs.filter((f) => f.followerId !== userId)),
  ]);
  const seenAt = me?.notificationsSeenAt ?? null;

  // Toutes les œuvres, tous les likes et tous les commentaires des entrées en 3 requêtes batch,
  // au lieu de 3 requêtes par entrée. Ce chemin est appelé à chaque page (badge de notifications).
  const entryIds = myEntries.map((e) => e.id);
  const [worksList, allLikes, allComments] = await Promise.all([
    deps.works.findByIds([...new Set(myEntries.map((e) => e.workId))]),
    deps.likes.listByEntries(entryIds),
    deps.comments.listByEntries(entryIds),
  ]);
  const worksById = new Map(worksList.map((w) => [w.id, w]));
  const likesByEntry = new Map<string, typeof allLikes>();
  for (const l of allLikes) if (l.userId !== userId) (likesByEntry.get(l.entryId) ?? likesByEntry.set(l.entryId, []).get(l.entryId)!).push(l);
  const commentsByEntry = new Map<string, typeof allComments>();
  for (const c of allComments) if (c.userId !== userId) (commentsByEntry.get(c.entryId) ?? commentsByEntry.set(c.entryId, []).get(c.entryId)!).push(c);

  // Un seul chargement batch de tous les acteurs (likers, commentateurs, followers).
  const actorIds = [...new Set([
    ...allLikes.map((l) => l.userId),
    ...allComments.map((c) => c.userId),
    ...followers.map((f) => f.followerId),
  ])];
  const actorsById = new Map((await deps.users.findByIds(actorIds)).map((u) => [u.id, u]));
  const actors = (ids: string[]): NotifActor[] =>
    ids.map((id) => actorsById.get(id)).filter((u): u is NonNullable<typeof u> => u !== undefined)
      .map((u) => ({ username: u.username, displayName: u.displayName, avatarUrl: u.avatarUrl }));

  const notifs: Omit<Notification, "unread">[] = [];

  for (const entry of myEntries) {
    const work = worksById.get(entry.workId);
    const workDto = work ? { id: work.id, title: work.title } : undefined;

    const likes = (likesByEntry.get(entry.id) ?? []).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    if (likes.length > 0) {
      notifs.push({
        id: `like:${entry.id}`, kind: "like",
        actors: actors(likes.slice(0, 3).map((l) => l.userId)),
        totalActors: likes.length, work: workDto, entryId: entry.id,
        createdAt: likes[0]!.createdAt.toISOString(),
      });
    }

    const comments = commentsByEntry.get(entry.id) ?? [];
    if (comments.length > 0) {
      const recent = [...comments].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
      const distinct = [...new Set(recent.map((c) => c.userId))];
      notifs.push({
        id: `comment:${entry.id}`, kind: "comment",
        actors: actors(distinct.slice(0, 3)),
        totalActors: distinct.length, work: workDto, entryId: entry.id,
        createdAt: recent[0]!.createdAt.toISOString(),
      });
    }
  }

  if (followers.length > 0) {
    notifs.push({
      id: "follow", kind: "follow",
      actors: actors(followers.slice(0, 3).map((f) => f.followerId)),
      totalActors: followers.length,
      createdAt: followers[0]!.createdAt.toISOString(),
    });
  }

  const seenIso = seenAt ? seenAt.toISOString() : null;
  return notifs
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 40)
    .map((n) => ({ ...n, unread: seenIso === null || n.createdAt > seenIso }));
}

export async function markNotificationsSeen(deps: Deps, userId: string): Promise<void> {
  const user = await deps.users.findById(userId);
  if (!user) throw new NotFoundError("Utilisateur introuvable");
  const updated: User = { ...user, notificationsSeenAt: deps.clock.now() };
  await deps.users.update(updated);
}

export async function countUnreadNotifications(deps: Deps, userId: string): Promise<number> {
  return (await buildNotifications(deps, userId)).filter((n) => n.unread).length;
}
