import type {
  UserRepository, FollowRepository, FollowRequestRepository, WorkRepository, LibraryEntryRepository,
  ListRepository, LikeRepository, CommentRepository, CommunityRepository, MembershipRepository, CommunityRequestRepository, EpisodeCacheRepository, EpisodeEntryRepository,
} from "@/server/ports/repositories";
import type { User, Follow, FollowRequest, Work, LibraryEntry, RatedEntry, List, Like, Comment, WorkSource, Community, Membership, CommunityRequest, CommunityRole, SeasonEpisodes, EpisodeEntry } from "@/server/domain/entities";
import { isPublishable, isFeedVisible } from "@/server/domain/feed-rules";

export class InMemoryUserRepository implements UserRepository {
  private byId = new Map<string, User>();
  async create(u: User) { this.byId.set(u.id, u); }
  async findById(id: string) { return this.byId.get(id) ?? null; }
  async findByIds(ids: string[]) { return ids.map((id) => this.byId.get(id)).filter((u): u is User => u !== undefined); }
  async findByEmail(email: string) { return [...this.byId.values()].find((u) => u.email === email) ?? null; }
  async findByUsername(username: string) { return [...this.byId.values()].find((u) => u.username === username) ?? null; }
  async update(u: User) { this.byId.set(u.id, u); }
  async remove(id: string) { this.byId.delete(id); }
  async listRecent(limit: number) {
    return [...this.byId.values()].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()).slice(0, limit);
  }
  async searchByText(query: string, limit: number) {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return [...this.byId.values()]
      .filter((u) => u.username.toLowerCase().includes(q) || u.displayName.toLowerCase().includes(q))
      .sort((a, b) => a.username.localeCompare(b.username))
      .slice(0, limit);
  }
  async findByInviteCode(code: string) { return [...this.byId.values()].find((u) => u.inviteCode === code) ?? null; }
  async listByInviter(inviterId: string) { return [...this.byId.values()].filter((u) => u.invitedBy === inviterId); }
}

export class InMemoryFollowRepository implements FollowRepository {
  private edges: Follow[] = [];
  async add(f: Follow) { if (!(await this.exists(f.followerId, f.followeeId))) this.edges.push(f); }
  async remove(a: string, b: string) { this.edges = this.edges.filter((e) => !(e.followerId === a && e.followeeId === b)); }
  async exists(a: string, b: string) { return this.edges.some((e) => e.followerId === a && e.followeeId === b); }
  async followeeIdsOf(id: string) { return this.edges.filter((e) => e.followerId === id).map((e) => e.followeeId); }
  async followerIdsOf(id: string) { return this.edges.filter((e) => e.followeeId === id).map((e) => e.followerId); }
  async listFollowers(id: string) { return this.edges.filter((e) => e.followeeId === id).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()); }
  async countFollowers(id: string) { return (await this.followerIdsOf(id)).length; }
  async countFollowing(id: string) { return (await this.followeeIdsOf(id)).length; }
  async removeAllForUser(userId: string) { this.edges = this.edges.filter((e) => e.followerId !== userId && e.followeeId !== userId); }
}

export class InMemoryFollowRequestRepository implements FollowRequestRepository {
  private reqs: FollowRequest[] = [];
  async add(r: FollowRequest) { if (!(await this.findPair(r.requesterId, r.targetId))) this.reqs.push(r); }
  async findById(id: string) { return this.reqs.find((r) => r.id === id) ?? null; }
  async findPair(requesterId: string, targetId: string) { return this.reqs.find((r) => r.requesterId === requesterId && r.targetId === targetId) ?? null; }
  async listForTarget(targetId: string) { return this.reqs.filter((r) => r.targetId === targetId).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()); }
  async countForTarget(targetId: string) { return this.reqs.filter((r) => r.targetId === targetId).length; }
  async remove(id: string) { this.reqs = this.reqs.filter((r) => r.id !== id); }
  async removeAllForUser(userId: string) { this.reqs = this.reqs.filter((r) => r.requesterId !== userId && r.targetId !== userId); }
}

export class InMemoryWorkRepository implements WorkRepository {
  private byId = new Map<string, Work>();
  async upsert(w: Work) { this.byId.set(w.id, w); }
  async findById(id: string) { return this.byId.get(id) ?? null; }
  async findByIds(ids: string[]) { return ids.map((id) => this.byId.get(id)).filter((w): w is Work => w !== undefined); }
  async findByExternal(source: WorkSource, externalId: string) {
    return [...this.byId.values()].find((w) => w.source === source && w.externalId === externalId) ?? null;
  }
}

export class InMemoryEpisodeCache implements EpisodeCacheRepository {
  private byKey = new Map<string, SeasonEpisodes>();
  private key(source: WorkSource, externalId: string, season: number) { return `${source}:${externalId}:${season}`; }
  async find(source: WorkSource, externalId: string, season: number) { return this.byKey.get(this.key(source, externalId, season)) ?? null; }
  async upsert(entry: SeasonEpisodes) { this.byKey.set(this.key(entry.source, entry.externalId, entry.season), entry); }
}

export class InMemoryEpisodeEntryRepository implements EpisodeEntryRepository {
  private byId = new Map<string, EpisodeEntry>();
  async upsert(e: EpisodeEntry) { this.byId.set(e.id, e); }
  async findById(id: string) { return this.byId.get(id) ?? null; }
  async findOne(userId: string, workId: string, season: number, episode: number) {
    return [...this.byId.values()].find((e) => e.userId === userId && e.workId === workId && e.season === season && e.episode === episode) ?? null;
  }
  async listByUserAndWork(userId: string, workId: string) {
    return [...this.byId.values()].filter((e) => e.userId === userId && e.workId === workId);
  }
  async feed(opts: { scope: "foryou" | "following"; circleUserIds: string[]; followingUserIds: string[]; viewerId: string; cursor: { activityAt: Date; id: string } | null; limit: number }) {
    const circle = new Set(opts.circleUserIds);
    const following = new Set(opts.followingUserIds);
    return [...this.byId.values()]
      .filter((e) => e.activityAt !== null)
      .filter((e) => opts.scope === "following"
        ? (following.has(e.userId) && (e.audiences.public || (e.audiences.circle && circle.has(e.userId))))
        : (e.audiences.public || e.audiences.communityIds.length > 0 || (e.audiences.circle && circle.has(e.userId))))
      .filter((e) => !opts.cursor || e.activityAt!.getTime() < opts.cursor.activityAt.getTime())
      .sort((a, b) => b.activityAt!.getTime() - a.activityAt!.getTime())
      .slice(0, opts.limit);
  }
}

export class InMemoryLibraryEntryRepository implements LibraryEntryRepository {
  private byId = new Map<string, LibraryEntry>();
  async upsert(e: LibraryEntry) { this.byId.set(e.id, e); }
  async findById(id: string) { return this.byId.get(id) ?? null; }
  async findByUserAndWork(userId: string, workId: string) {
    return [...this.byId.values()].find((e) => e.userId === userId && e.workId === workId) ?? null;
  }
  async listByUser(userId: string, opts: { status?: "planned" | "in_progress" | "done"; domain?: string }) {
    return [...this.byId.values()].filter((e) =>
      e.userId === userId &&
      (opts.status ? e.status === opts.status : true) &&
      (opts.domain ? e.domain === opts.domain : true),
    ).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }
  async listRatedByUser(userId: string): Promise<RatedEntry[]> {
    return [...this.byId.values()]
      .filter((e) => e.userId === userId && e.rating !== null)
      .map((e) => ({ workId: e.workId, domain: e.domain, rating: e.rating as number, audiences: e.audiences }));
  }
  async remove(id: string) { this.byId.delete(id); }
  async removeAllForUser(userId: string) { for (const [k, e] of this.byId) if (e.userId === userId) this.byId.delete(k); }
  async feed(opts: { scope: "foryou" | "following"; circleUserIds: string[]; followingUserIds: string[]; viewerId: string; domains: string[]; cursor: { activityAt: Date; id: string } | null; limit: number; }) {
    const circle = new Set(opts.circleUserIds);
    const following = new Set(opts.followingUserIds);
    return [...this.byId.values()]
      .filter((e) => isFeedVisible(e))
      .filter((e) => opts.domains.includes(e.domain))
      .filter((e) => opts.scope === "following"
        ? (following.has(e.userId) && (e.audiences.public || (e.audiences.circle && circle.has(e.userId))))
        : (e.audiences.public || e.audiences.communityIds.length > 0 || (e.audiences.circle && circle.has(e.userId))))
      .filter((e) => !opts.cursor || e.activityAt!.getTime() < opts.cursor.activityAt.getTime())
      .sort((a, b) => b.activityAt!.getTime() - a.activityAt!.getTime())
      .slice(0, opts.limit);
  }
  async listRecentPublic(limit: number) {
    return [...this.byId.values()]
      .filter((e) => e.audiences.public && isPublishable(e))
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, limit);
  }
  async listByWork(workId: string) {
    return [...this.byId.values()]
      .filter((e) => e.workId === workId && isPublishable(e))
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }
  async feedByCommunity(communityId: string, cursor: { activityAt: Date; id: string } | null, limit: number) {
    return [...this.byId.values()]
      .filter((e) => e.audiences.communityIds.includes(communityId) && isFeedVisible(e))
      .filter((e) => !cursor || e.activityAt!.getTime() < cursor.activityAt.getTime())
      .sort((a, b) => b.activityAt!.getTime() - a.activityAt!.getTime())
      .slice(0, limit);
  }
}

export class InMemoryCommunityRepository implements CommunityRepository {
  private byId = new Map<string, Community>();
  async create(c: Community) { this.byId.set(c.id, c); }
  async update(c: Community) { this.byId.set(c.id, c); }
  async findById(id: string) { return this.byId.get(id) ?? null; }
  async findBySlug(slug: string) { return [...this.byId.values()].find((c) => c.slug === slug) ?? null; }
  async listPublic(limit: number) { return [...this.byId.values()].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()).slice(0, limit); }
  async listByIds(ids: string[]) { const s = new Set(ids); return [...this.byId.values()].filter((c) => s.has(c.id)); }
}

export class InMemoryMembershipRepository implements MembershipRepository {
  private rows: Membership[] = [];
  async add(m: Membership) { if (!(await this.find(m.communityId, m.userId))) this.rows.push(m); }
  async remove(communityId: string, userId: string) { this.rows = this.rows.filter((m) => !(m.communityId === communityId && m.userId === userId)); }
  async find(communityId: string, userId: string) { return this.rows.find((m) => m.communityId === communityId && m.userId === userId) ?? null; }
  async listForUser(userId: string) { return this.rows.filter((m) => m.userId === userId); }
  async setPinned(communityId: string, userId: string, pinned: boolean) { const m = await this.find(communityId, userId); if (m) m.pinned = pinned; }
  async countForCommunity(communityId: string) { return this.rows.filter((m) => m.communityId === communityId).length; }
  async setRole(communityId: string, userId: string, role: CommunityRole) { const m = await this.find(communityId, userId); if (m) m.role = role; }
  async listForCommunity(communityId: string) { return this.rows.filter((m) => m.communityId === communityId); }
}

export class InMemoryCommunityRequestRepository implements CommunityRequestRepository {
  private reqs: CommunityRequest[] = [];
  async add(r: CommunityRequest) { if (!(await this.findPair(r.communityId, r.userId))) this.reqs.push(r); }
  async findById(id: string) { return this.reqs.find((r) => r.id === id) ?? null; }
  async findPair(communityId: string, userId: string) { return this.reqs.find((r) => r.communityId === communityId && r.userId === userId) ?? null; }
  async listForCommunity(communityId: string) { return this.reqs.filter((r) => r.communityId === communityId && r.kind === "request").sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()); }
  async listInvitesForUser(userId: string) { return this.reqs.filter((r) => r.userId === userId && r.kind === "invite").sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()); }
  async remove(id: string) { this.reqs = this.reqs.filter((r) => r.id !== id); }
  async removeAllForUser(userId: string) { this.reqs = this.reqs.filter((r) => r.userId !== userId); }
  async removeAllForCommunity(communityId: string) { this.reqs = this.reqs.filter((r) => r.communityId !== communityId); }
}

export class InMemoryListRepository implements ListRepository {
  private byId = new Map<string, List>();
  async create(l: List) { this.byId.set(l.id, l); }
  async findById(id: string) { return this.byId.get(id) ?? null; }
  async listByUser(userId: string) {
    return [...this.byId.values()]
      .filter((l) => l.userId === userId)
      .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
  }
  async update(l: List) { this.byId.set(l.id, l); }
  async remove(id: string) { this.byId.delete(id); }
  async removeAllForUser(userId: string) { for (const [k, l] of this.byId) if (l.userId === userId) this.byId.delete(k); }
}

export class InMemoryLikeRepository implements LikeRepository {
  private likes: Like[] = [];
  async add(l: Like) { if (!(await this.exists(l.entryId, l.userId))) this.likes.push(l); }
  async remove(entryId: string, userId: string) { this.likes = this.likes.filter((l) => !(l.entryId === entryId && l.userId === userId)); }
  async exists(entryId: string, userId: string) { return this.likes.some((l) => l.entryId === entryId && l.userId === userId); }
  async countByEntry(entryId: string) { return this.likes.filter((l) => l.entryId === entryId).length; }
  async countByEntries(entryIds: string[]) {
    const s = new Set(entryIds);
    const counts = new Map<string, number>();
    for (const l of this.likes) if (s.has(l.entryId)) counts.set(l.entryId, (counts.get(l.entryId) ?? 0) + 1);
    return counts;
  }
  async listByEntry(entryId: string) { return this.likes.filter((l) => l.entryId === entryId).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()); }
  async listByEntries(entryIds: string[]) { const s = new Set(entryIds); return this.likes.filter((l) => s.has(l.entryId)).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()); }
  async likedEntryIds(userId: string, entryIds: string[]) {
    const s = new Set(entryIds);
    return this.likes.filter((l) => l.userId === userId && s.has(l.entryId)).map((l) => l.entryId);
  }
  async removeAllForUser(userId: string) { this.likes = this.likes.filter((l) => l.userId !== userId); }
}

export class InMemoryCommentRepository implements CommentRepository {
  private byId = new Map<string, Comment>();
  async add(c: Comment) { this.byId.set(c.id, c); }
  async findById(id: string) { return this.byId.get(id) ?? null; }
  async listByEntry(entryId: string) {
    return [...this.byId.values()].filter((c) => c.entryId === entryId).sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  }
  async listByEntries(entryIds: string[]) {
    const s = new Set(entryIds);
    return [...this.byId.values()].filter((c) => s.has(c.entryId)).sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  }
  async countByEntry(entryId: string) { return [...this.byId.values()].filter((c) => c.entryId === entryId).length; }
  async countByEntries(entryIds: string[]) {
    const s = new Set(entryIds);
    const counts = new Map<string, number>();
    for (const c of this.byId.values()) if (s.has(c.entryId)) counts.set(c.entryId, (counts.get(c.entryId) ?? 0) + 1);
    return counts;
  }
  async remove(id: string) { this.byId.delete(id); }
  async removeAllForUser(userId: string) { for (const [k, c] of this.byId) if (c.userId === userId) this.byId.delete(k); }
}
