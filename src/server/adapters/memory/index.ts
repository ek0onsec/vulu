import type {
  UserRepository, FollowRepository, WorkRepository, LibraryEntryRepository,
  ListRepository, LikeRepository, CommentRepository,
} from "@/server/ports/repositories";
import type { User, Follow, Work, LibraryEntry, List, Like, Comment } from "@/server/domain/entities";
import { isPublishable } from "@/server/domain/feed-rules";

export class InMemoryUserRepository implements UserRepository {
  private byId = new Map<string, User>();
  async create(u: User) { this.byId.set(u.id, u); }
  async findById(id: string) { return this.byId.get(id) ?? null; }
  async findByEmail(email: string) { return [...this.byId.values()].find((u) => u.email === email) ?? null; }
  async findByUsername(username: string) { return [...this.byId.values()].find((u) => u.username === username) ?? null; }
  async update(u: User) { this.byId.set(u.id, u); }
}

export class InMemoryFollowRepository implements FollowRepository {
  private edges: Follow[] = [];
  async add(f: Follow) { if (!(await this.exists(f.followerId, f.followeeId))) this.edges.push(f); }
  async remove(a: string, b: string) { this.edges = this.edges.filter((e) => !(e.followerId === a && e.followeeId === b)); }
  async exists(a: string, b: string) { return this.edges.some((e) => e.followerId === a && e.followeeId === b); }
  async followeeIdsOf(id: string) { return this.edges.filter((e) => e.followerId === id).map((e) => e.followeeId); }
  async followerIdsOf(id: string) { return this.edges.filter((e) => e.followeeId === id).map((e) => e.followerId); }
  async countFollowers(id: string) { return (await this.followerIdsOf(id)).length; }
  async countFollowing(id: string) { return (await this.followeeIdsOf(id)).length; }
}

export class InMemoryWorkRepository implements WorkRepository {
  private byId = new Map<string, Work>();
  async upsert(w: Work) { this.byId.set(w.id, w); }
  async findById(id: string) { return this.byId.get(id) ?? null; }
  async findByExternal(source: "tmdb", externalId: string) {
    return [...this.byId.values()].find((w) => w.source === source && w.externalId === externalId) ?? null;
  }
}

export class InMemoryLibraryEntryRepository implements LibraryEntryRepository {
  private byId = new Map<string, LibraryEntry>();
  async upsert(e: LibraryEntry) { this.byId.set(e.id, e); }
  async findById(id: string) { return this.byId.get(id) ?? null; }
  async findByUserAndWork(userId: string, workId: string) {
    return [...this.byId.values()].find((e) => e.userId === userId && e.workId === workId) ?? null;
  }
  async listByUser(userId: string, opts: { status?: "planned" | "done"; domain?: string }) {
    return [...this.byId.values()].filter((e) =>
      e.userId === userId &&
      (opts.status ? e.status === opts.status : true) &&
      (opts.domain ? e.domain === opts.domain : true),
    ).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }
  async remove(id: string) { this.byId.delete(id); }
  async feed(opts: { circleUserIds: string[]; viewerId: string; domains: string[]; cursor: { createdAt: Date; id: string } | null; limit: number; }) {
    const circle = new Set(opts.circleUserIds);
    return [...this.byId.values()]
      .filter((e) => isPublishable(e))
      .filter((e) => opts.domains.includes(e.domain))
      .filter((e) => e.visibility === "public" || circle.has(e.userId))
      .filter((e) => !opts.cursor || e.createdAt.getTime() < opts.cursor.createdAt.getTime())
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, opts.limit);
  }
}

export class InMemoryListRepository implements ListRepository {
  private byId = new Map<string, List>();
  async create(l: List) { this.byId.set(l.id, l); }
  async findById(id: string) { return this.byId.get(id) ?? null; }
  async listByUser(userId: string, domain?: string) {
    return [...this.byId.values()].filter((l) => l.userId === userId && (domain ? l.domain === domain : true));
  }
  async update(l: List) { this.byId.set(l.id, l); }
  async remove(id: string) { this.byId.delete(id); }
}

export class InMemoryLikeRepository implements LikeRepository {
  private likes: Like[] = [];
  async add(l: Like) { if (!(await this.exists(l.entryId, l.userId))) this.likes.push(l); }
  async remove(entryId: string, userId: string) { this.likes = this.likes.filter((l) => !(l.entryId === entryId && l.userId === userId)); }
  async exists(entryId: string, userId: string) { return this.likes.some((l) => l.entryId === entryId && l.userId === userId); }
  async countByEntry(entryId: string) { return this.likes.filter((l) => l.entryId === entryId).length; }
  async likedEntryIds(userId: string, entryIds: string[]) {
    const s = new Set(entryIds);
    return this.likes.filter((l) => l.userId === userId && s.has(l.entryId)).map((l) => l.entryId);
  }
}

export class InMemoryCommentRepository implements CommentRepository {
  private byId = new Map<string, Comment>();
  async add(c: Comment) { this.byId.set(c.id, c); }
  async findById(id: string) { return this.byId.get(id) ?? null; }
  async listByEntry(entryId: string) {
    return [...this.byId.values()].filter((c) => c.entryId === entryId).sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  }
  async countByEntry(entryId: string) { return [...this.byId.values()].filter((c) => c.entryId === entryId).length; }
  async remove(id: string) { this.byId.delete(id); }
}
