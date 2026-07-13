import type { Db, Filter } from "mongodb";
import type {
  UserRepository, FollowRepository, FollowRequestRepository, WorkRepository, LibraryEntryRepository,
  ListRepository, LikeRepository, CommentRepository, CommunityRepository, MembershipRepository, CommunityRequestRepository, EpisodeCacheRepository, EpisodeEntryRepository, ImportJobRepository,
} from "@/server/ports/repositories";
import type { User, Follow, FollowRequest, Work, LibraryEntry, RatedEntry, List, Like, Comment, WorkSource, Community, Membership, CommunityRequest, CommunityRole, SeasonEpisodes, EpisodeEntry, WorkType, ImportJob } from "@/server/domain/entities";
import * as M from "./mappers";

export class MongoUserRepository implements UserRepository {
  constructor(private db: Db) {}
  private get col() { return this.db.collection<M.WithIdUser>("users"); }
  async create(u: User) { await this.col.insertOne(M.toUserDoc(u)); }
  async findById(id: string) { const d = await this.col.findOne({ _id: id }); return d ? M.fromUserDoc(d) : null; }
  async findByIds(ids: string[]) { if (!ids.length) return []; return (await this.col.find({ _id: { $in: ids } }).toArray()).map(M.fromUserDoc); }
  async findByEmail(email: string) { const d = await this.col.findOne({ email }); return d ? M.fromUserDoc(d) : null; }
  async findByUsername(username: string) { const d = await this.col.findOne({ username }); return d ? M.fromUserDoc(d) : null; }
  async update(u: User) { await this.col.replaceOne({ _id: u.id }, M.toUserDoc(u)); }
  async remove(id: string) { await this.col.deleteOne({ _id: id }); }
  async listRecent(limit: number) {
    return (await this.col.find({}).sort({ createdAt: -1 }).limit(limit).toArray()).map(M.fromUserDoc);
  }
  async searchByText(query: string, limit: number) {
    const q = query.trim();
    if (!q) return [];
    const esc = q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const rx = { $regex: esc, $options: "i" };
    return (await this.col.find({ $or: [{ username: rx }, { displayName: rx }] })
      .sort({ username: 1 }).limit(limit).toArray()).map(M.fromUserDoc);
  }
  async findByInviteCode(code: string) { const d = await this.col.findOne({ inviteCode: code }); return d ? M.fromUserDoc(d) : null; }
  async listByInviter(inviterId: string) { return (await this.col.find({ invitedBy: inviterId }).toArray()).map(M.fromUserDoc); }
}

export class MongoFollowRepository implements FollowRepository {
  constructor(private db: Db) {}
  private get col() { return this.db.collection<M.WithIdFollow>("follows"); }
  async add(f: Follow) { await this.col.updateOne({ _id: `${f.followerId}:${f.followeeId}` }, { $setOnInsert: M.toFollowDoc(f) }, { upsert: true }); }
  async remove(a: string, b: string) { await this.col.deleteOne({ _id: `${a}:${b}` }); }
  async exists(a: string, b: string) { return (await this.col.countDocuments({ _id: `${a}:${b}` })) > 0; }
  async followeeIdsOf(id: string) { return (await this.col.find({ followerId: id }).toArray()).map((d) => d.followeeId); }
  async followerIdsOf(id: string) { return (await this.col.find({ followeeId: id }).toArray()).map((d) => d.followerId); }
  async listFollowers(id: string) { return (await this.col.find({ followeeId: id }).sort({ createdAt: -1 }).toArray()).map(M.fromFollowDoc); }
  async countFollowers(id: string) { return this.col.countDocuments({ followeeId: id }); }
  async countFollowing(id: string) { return this.col.countDocuments({ followerId: id }); }
  async removeAllForUser(userId: string) { await this.col.deleteMany({ $or: [{ followerId: userId }, { followeeId: userId }] }); }
}

export class MongoFollowRequestRepository implements FollowRequestRepository {
  constructor(private db: Db) {}
  private get col() { return this.db.collection<M.WithIdFollowRequest>("follow_requests"); }
  async add(r: FollowRequest) { await this.col.updateOne({ requesterId: r.requesterId, targetId: r.targetId }, { $setOnInsert: M.toFollowRequestDoc(r) }, { upsert: true }); }
  async findById(id: string) { const d = await this.col.findOne({ _id: id }); return d ? M.fromFollowRequestDoc(d) : null; }
  async findPair(requesterId: string, targetId: string) { const d = await this.col.findOne({ requesterId, targetId }); return d ? M.fromFollowRequestDoc(d) : null; }
  async listForTarget(targetId: string) { return (await this.col.find({ targetId }).sort({ createdAt: -1 }).toArray()).map(M.fromFollowRequestDoc); }
  async countForTarget(targetId: string) { return this.col.countDocuments({ targetId }); }
  async remove(id: string) { await this.col.deleteOne({ _id: id }); }
  async removeAllForUser(userId: string) { await this.col.deleteMany({ $or: [{ requesterId: userId }, { targetId: userId }] }); }
}

export class MongoWorkRepository implements WorkRepository {
  constructor(private db: Db) {}
  private get col() { return this.db.collection<M.WithIdWork>("works"); }
  async upsert(w: Work) { await this.col.replaceOne({ _id: w.id }, M.toWorkDoc(w), { upsert: true }); }
  async findById(id: string) { const d = await this.col.findOne({ _id: id }); return d ? M.fromWorkDoc(d) : null; }
  async findByIds(ids: string[]) { if (!ids.length) return []; return (await this.col.find({ _id: { $in: ids } }).toArray()).map(M.fromWorkDoc); }
  async findByExternal(source: WorkSource, externalId: string, type: WorkType) { const d = await this.col.findOne({ source, externalId, type }); return d ? M.fromWorkDoc(d) : null; }
}

export class MongoEpisodeCache implements EpisodeCacheRepository {
  constructor(private db: Db) {}
  private get col() { return this.db.collection<M.WithIdSeasonEpisodes>("episode_cache"); }
  async find(source: WorkSource, externalId: string, season: number) {
    const d = await this.col.findOne({ source, externalId, season });
    return d ? M.fromSeasonEpisodesDoc(d) : null;
  }
  async upsert(entry: SeasonEpisodes) {
    await this.col.replaceOne({ _id: `${entry.source}:${entry.externalId}:${entry.season}` }, M.toSeasonEpisodesDoc(entry), { upsert: true });
  }
}

export class MongoEpisodeEntryRepository implements EpisodeEntryRepository {
  constructor(private db: Db) {}
  private get col() { return this.db.collection<M.WithIdEpisodeEntry>("episode_entries"); }
  async upsert(e: EpisodeEntry) { await this.col.replaceOne({ _id: e.id }, M.toEpisodeEntryDoc(e), { upsert: true }); }
  async findById(id: string) { const d = await this.col.findOne({ _id: id }); return d ? M.fromEpisodeEntryDoc(d) : null; }
  async findOne(userId: string, workId: string, season: number, episode: number) {
    const d = await this.col.findOne({ userId, workId, season, episode });
    return d ? M.fromEpisodeEntryDoc(d) : null;
  }
  async listByUserAndWork(userId: string, workId: string) {
    return (await this.col.find({ userId, workId }).toArray()).map(M.fromEpisodeEntryDoc);
  }
  async feed(opts: { scope: "foryou" | "following"; circleUserIds: string[]; followingUserIds: string[]; viewerId: string; cursor: { activityAt: Date; id: string } | null; limit: number }) {
    const visibility: Filter<M.WithIdEpisodeEntry> = opts.scope === "following"
      ? { userId: { $in: opts.followingUserIds }, $or: [
          { "audiences.public": true },
          { "audiences.circle": true, userId: { $in: opts.circleUserIds } },
        ] }
      : { $or: [
          { "audiences.public": true },
          { "audiences.communityIds.0": { $exists: true } },
          { "audiences.circle": true, userId: { $in: opts.circleUserIds } },
        ] };
    const q: Filter<M.WithIdEpisodeEntry> = opts.cursor
      ? { activityAt: { $ne: null, $lt: opts.cursor.activityAt }, ...visibility }
      : { activityAt: { $ne: null }, ...visibility };
    return (await this.col.find(q).sort({ activityAt: -1 }).limit(opts.limit).toArray()).map(M.fromEpisodeEntryDoc);
  }
}

export class MongoLibraryEntryRepository implements LibraryEntryRepository {
  constructor(private db: Db) {}
  private get col() { return this.db.collection<M.WithIdEntry>("entries"); }
  async upsert(e: LibraryEntry) { await this.col.replaceOne({ userId: e.userId, workId: e.workId }, M.toEntryDoc(e), { upsert: true }); }
  async findById(id: string) { const d = await this.col.findOne({ _id: id }); return d ? M.fromEntryDoc(d) : null; }
  async findByUserAndWork(userId: string, workId: string) { const d = await this.col.findOne({ userId, workId }); return d ? M.fromEntryDoc(d) : null; }
  async listByUser(userId: string, opts: { status?: "planned" | "in_progress" | "done"; domain?: string }) {
    const q: Filter<M.WithIdEntry> = { userId };
    if (opts.status) q.status = opts.status;
    if (opts.domain) q.domain = opts.domain as M.WithIdEntry["domain"];
    return (await this.col.find(q).sort({ createdAt: -1 }).toArray()).map(M.fromEntryDoc);
  }
  async listRatedByUser(userId: string): Promise<RatedEntry[]> {
    const docs = await this.col.find({ userId, rating: { $ne: null } }).sort({ createdAt: -1 }).toArray();
    return docs.map(M.fromEntryDoc).map((e) => ({
      workId: e.workId, domain: e.domain, rating: e.rating as number, audiences: e.audiences,
    }));
  }
  async remove(id: string) { await this.col.deleteOne({ _id: id }); }
  async removeAllForUser(userId: string) { await this.col.deleteMany({ userId }); }
  async feed(opts: { scope: "foryou" | "following"; circleUserIds: string[]; followingUserIds: string[]; viewerId: string; domains: string[]; cursor: { activityAt: Date; id: string } | null; limit: number; }) {
    const visibility: Filter<M.WithIdEntry> = opts.scope === "following"
      ? { userId: { $in: opts.followingUserIds }, $or: [
          { "audiences.public": true },
          { "audiences.circle": true, userId: { $in: opts.circleUserIds } },
        ] }
      : { $or: [
          { "audiences.public": true },
          { "audiences.communityIds.0": { $exists: true } },
          { "audiences.circle": true, userId: { $in: opts.circleUserIds } },
        ] };
    const and: Filter<M.WithIdEntry>[] = [
      visibility,
      { activityAt: { $ne: null } },
      { domain: { $in: opts.domains as M.WithIdEntry["domain"][] } },
    ];
    if (opts.cursor) and.push({ activityAt: { $lt: opts.cursor.activityAt } });
    return (await this.col.find({ $and: and }).sort({ activityAt: -1, _id: -1 }).limit(opts.limit).toArray()).map(M.fromEntryDoc);
  }
  async listRecentPublic(limit: number) {
    const q: Filter<M.WithIdEntry> = { "audiences.public": true, status: "done", $or: [{ rating: { $ne: null } }, { text: { $ne: null } }] };
    return (await this.col.find(q).sort({ createdAt: -1 }).limit(limit).toArray()).map(M.fromEntryDoc);
  }
  async listByWork(workId: string) {
    const q: Filter<M.WithIdEntry> = { workId, status: "done", $or: [{ rating: { $ne: null } }, { text: { $ne: null } }] };
    return (await this.col.find(q).sort({ createdAt: -1 }).toArray()).map(M.fromEntryDoc);
  }
  async feedByCommunity(communityId: string, cursor: { activityAt: Date; id: string } | null, limit: number) {
    const and: Filter<M.WithIdEntry>[] = [
      { "audiences.communityIds": communityId },
      { activityAt: { $ne: null } },
    ];
    if (cursor) and.push({ activityAt: { $lt: cursor.activityAt } });
    return (await this.col.find({ $and: and }).sort({ activityAt: -1, _id: -1 }).limit(limit).toArray()).map(M.fromEntryDoc);
  }
}

export class MongoCommunityRepository implements CommunityRepository {
  constructor(private db: Db) {}
  private get col() { return this.db.collection<M.WithIdCommunity>("communities"); }
  async create(c: Community) { await this.col.insertOne(M.toCommunityDoc(c)); }
  async update(c: Community) { await this.col.replaceOne({ _id: c.id }, M.toCommunityDoc(c)); }
  async findById(id: string) { const d = await this.col.findOne({ _id: id }); return d ? M.fromCommunityDoc(d) : null; }
  async findBySlug(slug: string) { const d = await this.col.findOne({ slug }); return d ? M.fromCommunityDoc(d) : null; }
  async listPublic(limit: number) { return (await this.col.find({}).sort({ createdAt: -1 }).limit(limit).toArray()).map(M.fromCommunityDoc); }
  async listByIds(ids: string[]) { return (await this.col.find({ _id: { $in: ids } }).toArray()).map(M.fromCommunityDoc); }
}

export class MongoMembershipRepository implements MembershipRepository {
  constructor(private db: Db) {}
  private get col() { return this.db.collection<M.WithIdMembership>("memberships"); }
  async add(m: Membership) { await this.col.updateOne({ _id: `${m.communityId}:${m.userId}` }, { $setOnInsert: M.toMembershipDoc(m) }, { upsert: true }); }
  async remove(communityId: string, userId: string) { await this.col.deleteOne({ _id: `${communityId}:${userId}` }); }
  async find(communityId: string, userId: string) { const d = await this.col.findOne({ _id: `${communityId}:${userId}` }); return d ? M.fromMembershipDoc(d) : null; }
  async listForUser(userId: string) { return (await this.col.find({ userId }).toArray()).map(M.fromMembershipDoc); }
  async setPinned(communityId: string, userId: string, pinned: boolean) { await this.col.updateOne({ _id: `${communityId}:${userId}` }, { $set: { pinned } }); }
  async countForCommunity(communityId: string) { return this.col.countDocuments({ communityId }); }
  async setRole(communityId: string, userId: string, role: CommunityRole) { await this.col.updateOne({ _id: `${communityId}:${userId}` }, { $set: { role } }); }
  async listForCommunity(communityId: string) { return (await this.col.find({ communityId }).toArray()).map(M.fromMembershipDoc); }
}

export class MongoCommunityRequestRepository implements CommunityRequestRepository {
  constructor(private db: Db) {}
  private get col() { return this.db.collection<M.WithIdCommunityRequest>("community_requests"); }
  async add(r: CommunityRequest) { await this.col.updateOne({ communityId: r.communityId, userId: r.userId }, { $setOnInsert: M.toCommunityRequestDoc(r) }, { upsert: true }); }
  async findById(id: string) { const d = await this.col.findOne({ _id: id }); return d ? M.fromCommunityRequestDoc(d) : null; }
  async findPair(communityId: string, userId: string) { const d = await this.col.findOne({ communityId, userId }); return d ? M.fromCommunityRequestDoc(d) : null; }
  async listForCommunity(communityId: string) { return (await this.col.find({ communityId, kind: "request" }).sort({ createdAt: -1 }).toArray()).map(M.fromCommunityRequestDoc); }
  async listInvitesForUser(userId: string) { return (await this.col.find({ userId, kind: "invite" }).sort({ createdAt: -1 }).toArray()).map(M.fromCommunityRequestDoc); }
  async remove(id: string) { await this.col.deleteOne({ _id: id }); }
  async removeAllForUser(userId: string) { await this.col.deleteMany({ userId }); }
  async removeAllForCommunity(communityId: string) { await this.col.deleteMany({ communityId }); }
}

export class MongoListRepository implements ListRepository {
  constructor(private db: Db) {}
  private get col() { return this.db.collection<M.WithIdList>("lists"); }
  async create(l: List) { await this.col.insertOne(M.toListDoc(l)); }
  async findById(id: string) { const d = await this.col.findOne({ _id: id }); return d ? M.fromListDoc(d) : null; }
  async listByUser(userId: string) {
    return (await this.col.find({ userId }).sort({ updatedAt: -1 }).toArray()).map(M.fromListDoc);
  }
  async update(l: List) { await this.col.replaceOne({ _id: l.id }, M.toListDoc(l)); }
  async remove(id: string) { await this.col.deleteOne({ _id: id }); }
  async removeAllForUser(userId: string) { await this.col.deleteMany({ userId }); }
}

export class MongoLikeRepository implements LikeRepository {
  constructor(private db: Db) {}
  private get col() { return this.db.collection<M.WithIdLike>("likes"); }
  async add(l: Like) { await this.col.updateOne({ _id: `${l.entryId}:${l.userId}` }, { $setOnInsert: M.toLikeDoc(l) }, { upsert: true }); }
  async remove(entryId: string, userId: string) { await this.col.deleteOne({ _id: `${entryId}:${userId}` }); }
  async exists(entryId: string, userId: string) { return (await this.col.countDocuments({ _id: `${entryId}:${userId}` })) > 0; }
  async countByEntry(entryId: string) { return this.col.countDocuments({ entryId }); }
  async countByEntries(entryIds: string[]) {
    if (!entryIds.length) return new Map<string, number>();
    const rows = await this.col.aggregate<{ _id: string; n: number }>([
      { $match: { entryId: { $in: entryIds } } },
      { $group: { _id: "$entryId", n: { $sum: 1 } } },
    ]).toArray();
    return new Map(rows.map((r) => [r._id, r.n]));
  }
  async listByEntry(entryId: string) { return (await this.col.find({ entryId }).sort({ createdAt: -1 }).toArray()).map(M.fromLikeDoc); }
  async listByEntries(entryIds: string[]) { if (!entryIds.length) return []; return (await this.col.find({ entryId: { $in: entryIds } }).sort({ createdAt: -1 }).toArray()).map(M.fromLikeDoc); }
  async likedEntryIds(userId: string, entryIds: string[]) {
    return (await this.col.find({ userId, entryId: { $in: entryIds } }).toArray()).map((d) => d.entryId);
  }
  async removeAllForUser(userId: string) { await this.col.deleteMany({ userId }); }
}

export class MongoCommentRepository implements CommentRepository {
  constructor(private db: Db) {}
  private get col() { return this.db.collection<M.WithIdComment>("comments"); }
  async add(c: Comment) { await this.col.insertOne(M.toCommentDoc(c)); }
  async findById(id: string) { const d = await this.col.findOne({ _id: id }); return d ? M.fromCommentDoc(d) : null; }
  async listByEntry(entryId: string) { return (await this.col.find({ entryId }).sort({ createdAt: 1 }).toArray()).map(M.fromCommentDoc); }
  async listByEntries(entryIds: string[]) { if (!entryIds.length) return []; return (await this.col.find({ entryId: { $in: entryIds } }).sort({ createdAt: 1 }).toArray()).map(M.fromCommentDoc); }
  async countByEntry(entryId: string) { return this.col.countDocuments({ entryId }); }
  async countByEntries(entryIds: string[]) {
    if (!entryIds.length) return new Map<string, number>();
    const rows = await this.col.aggregate<{ _id: string; n: number }>([
      { $match: { entryId: { $in: entryIds } } },
      { $group: { _id: "$entryId", n: { $sum: 1 } } },
    ]).toArray();
    return new Map(rows.map((r) => [r._id, r.n]));
  }
  async remove(id: string) { await this.col.deleteOne({ _id: id }); }
  async removeAllForUser(userId: string) { await this.col.deleteMany({ userId }); }
}

export class MongoImportJobRepository implements ImportJobRepository {
  constructor(private db: Db) {}
  private get col() { return this.db.collection<M.WithIdImportJob>("import_jobs"); }
  async create(j: ImportJob) { await this.col.insertOne(M.toImportJobDoc(j)); }
  async findById(id: string) { const d = await this.col.findOne({ _id: id }); return d ? M.fromImportJobDoc(d) : null; }
  async update(j: ImportJob) { await this.col.replaceOne({ _id: j.id }, M.toImportJobDoc(j)); }
}
