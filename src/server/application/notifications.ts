import type { Deps } from "@/server/container";

export interface NotifActor { username: string; displayName: string; avatarUrl: string | null }
export interface Notification {
  id: string;
  kind: "like" | "comment" | "follow";
  actors: NotifActor[];      // jusqu'à 3, les plus récents
  totalActors: number;
  work?: { id: string; title: string };
  entryId?: string;
  createdAt: string;         // ISO, événement le plus récent du groupe
}

export async function buildNotifications(deps: Deps, userId: string): Promise<Notification[]> {
  const myEntries = await deps.entries.listByUser(userId, {});
  const cache = new Map<string, NotifActor | null>();
  async function actor(id: string): Promise<NotifActor | null> {
    if (cache.has(id)) return cache.get(id)!;
    const u = await deps.users.findById(id);
    const a = u ? { username: u.username, displayName: u.displayName, avatarUrl: u.avatarUrl } : null;
    cache.set(id, a);
    return a;
  }
  async function actors(ids: string[]): Promise<NotifActor[]> {
    return (await Promise.all(ids.map(actor))).filter((a): a is NotifActor => a !== null);
  }

  const notifs: Notification[] = [];

  for (const entry of myEntries) {
    const work = await deps.works.findById(entry.workId);
    const workDto = work ? { id: work.id, title: work.title } : undefined;

    const likes = (await deps.likes.listByEntry(entry.id)).filter((l) => l.userId !== userId);
    if (likes.length > 0) {
      notifs.push({
        id: `like:${entry.id}`, kind: "like",
        actors: await actors(likes.slice(0, 3).map((l) => l.userId)),
        totalActors: likes.length, work: workDto, entryId: entry.id,
        createdAt: likes[0]!.createdAt.toISOString(),
      });
    }

    const comments = (await deps.comments.listByEntry(entry.id)).filter((c) => c.userId !== userId);
    if (comments.length > 0) {
      const recent = [...comments].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
      const distinct = [...new Set(recent.map((c) => c.userId))];
      notifs.push({
        id: `comment:${entry.id}`, kind: "comment",
        actors: await actors(distinct.slice(0, 3)),
        totalActors: distinct.length, work: workDto, entryId: entry.id,
        createdAt: recent[0]!.createdAt.toISOString(),
      });
    }
  }

  const followers = (await deps.follows.listFollowers(userId)).filter((f) => f.followerId !== userId);
  if (followers.length > 0) {
    notifs.push({
      id: "follow", kind: "follow",
      actors: await actors(followers.slice(0, 3).map((f) => f.followerId)),
      totalActors: followers.length,
      createdAt: followers[0]!.createdAt.toISOString(),
    });
  }

  return notifs.sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 40);
}
