import type { Db, Filter } from "mongodb";
import type {
  UserRepository, FollowRepository, FollowRequestRepository, WorkRepository, LibraryEntryRepository,
  ListRepository, LikeRepository, CommentRepository,
} from "@/server/ports/repositories";
import type { User, Follow, FollowRequest, Work, LibraryEntry, List, Like, Comment, WorkSource } from "@/server/domain/entities";
import * as M from "./mappers";

export class MongoUserRepository implements UserRepository {
  constructor(private db: Db) {}
  private get col() { return this.db.collection<M.WithIdUser>("users"); }
  async create(u: User) { await this.col.insertOne(M.toUserDoc(u)); }
  async findById(id: string) { const d = await this.col.findOne({ _id: id }); return d ? M.fromUserDoc(d) : null; }
  async findByEmail(email: string) { const d = await this.col.findOne({ email }); return d ? M.fromUserDoc(d) : null; }
  async findByUsername(username: string) { const d = await this.col.findOne({ username }); return d ? M.fromUserDoc(d) : null; }
  async update(u: User) { await this.col.replaceOne({ _id: u.id }, M.toUserDoc(u)); }
  async remove(id: string) { await this.col.deleteOne({ _id: id }); }
  async listRecent(limit: number) {
    return (await this.col.find({}).sort({ createdAt: -1 }).limit(limit).toArray()).map(M.fromUserDoc);
  }
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
  async findByExternal(source: WorkSource, externalId: string) { const d = await this.col.findOne({ source, externalId }); return d ? M.fromWorkDoc(d) : null; }
}

export class MongoLibraryEntryRepository implements LibraryEntryRepository {
  constructor(private db: Db) {}
  private get col() { return this.db.collection<M.WithIdEntry>("entries"); }
  async upsert(e: LibraryEntry) { await this.col.replaceOne({ userId: e.userId, workId: e.workId }, M.toEntryDoc(e), { upsert: true }); }
  async findById(id: string) { const d = await this.col.findOne({ _id: id }); return d ? M.fromEntryDoc(d) : null; }
  async findByUserAndWork(userId: string, workId: string) { const d = await this.col.findOne({ userId, workId }); return d ? M.fromEntryDoc(d) : null; }
  async listByUser(userId: string, opts: { status?: "planned" | "done"; domain?: string }) {
    const q: Filter<M.WithIdEntry> = { userId };
    if (opts.status) q.status = opts.status;
    if (opts.domain) q.domain = opts.domain as M.WithIdEntry["domain"];
    return (await this.col.find(q).sort({ createdAt: -1 }).toArray()).map(M.fromEntryDoc);
  }
  async remove(id: string) { await this.col.deleteOne({ _id: id }); }
  async removeAllForUser(userId: string) { await this.col.deleteMany({ userId }); }
  async feed(opts: { scope: "foryou" | "circle"; circleUserIds: string[]; viewerId: string; domains: string[]; cursor: { createdAt: Date; id: string } | null; limit: number; }) {
    const visibility: Filter<M.WithIdEntry> = opts.scope === "circle"
      ? { userId: { $in: opts.circleUserIds } }
      : { $or: [{ visibility: "public" }, { userId: { $in: opts.circleUserIds } }] };
    const and: Filter<M.WithIdEntry>[] = [
      visibility,
      { status: "done", $or: [{ rating: { $ne: null } }, { text: { $ne: null } }] },
      { domain: { $in: opts.domains as M.WithIdEntry["domain"][] } },
    ];
    if (opts.cursor) and.push({ createdAt: { $lt: opts.cursor.createdAt } });
    return (await this.col.find({ $and: and }).sort({ createdAt: -1, _id: -1 }).limit(opts.limit).toArray()).map(M.fromEntryDoc);
  }
  async listRecentPublic(limit: number) {
    const q: Filter<M.WithIdEntry> = { visibility: "public", status: "done", $or: [{ rating: { $ne: null } }, { text: { $ne: null } }] };
    return (await this.col.find(q).sort({ createdAt: -1 }).limit(limit).toArray()).map(M.fromEntryDoc);
  }
  async listByWork(workId: string) {
    const q: Filter<M.WithIdEntry> = { workId, status: "done", $or: [{ rating: { $ne: null } }, { text: { $ne: null } }] };
    return (await this.col.find(q).sort({ createdAt: -1 }).toArray()).map(M.fromEntryDoc);
  }
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
  async listByEntry(entryId: string) { return (await this.col.find({ entryId }).sort({ createdAt: -1 }).toArray()).map(M.fromLikeDoc); }
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
  async countByEntry(entryId: string) { return this.col.countDocuments({ entryId }); }
  async remove(id: string) { await this.col.deleteOne({ _id: id }); }
  async removeAllForUser(userId: string) { await this.col.deleteMany({ userId }); }
}
