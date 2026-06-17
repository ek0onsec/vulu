import type { User, Follow, Work, LibraryEntry, List, Like, Comment } from "@/server/domain/entities";

export interface UserRepository {
  create(user: User): Promise<void>;
  findById(id: string): Promise<User | null>;
  findByEmail(email: string): Promise<User | null>;
  findByUsername(username: string): Promise<User | null>;
  update(user: User): Promise<void>;
  /** Utilisateurs récents (pour les suggestions « À suivre »). */
  listRecent(limit: number): Promise<User[]>;
}
export interface FollowRepository {
  add(follow: Follow): Promise<void>;
  remove(followerId: string, followeeId: string): Promise<void>;
  exists(followerId: string, followeeId: string): Promise<boolean>;
  followeeIdsOf(userId: string): Promise<string[]>;
  followerIdsOf(userId: string): Promise<string[]>;
  countFollowers(userId: string): Promise<number>;
  countFollowing(userId: string): Promise<number>;
}
export interface WorkRepository {
  upsert(work: Work): Promise<void>;
  findById(id: string): Promise<Work | null>;
  findByExternal(source: "tmdb", externalId: string): Promise<Work | null>;
}
export interface LibraryEntryRepository {
  upsert(entry: LibraryEntry): Promise<void>;
  findById(id: string): Promise<LibraryEntry | null>;
  findByUserAndWork(userId: string, workId: string): Promise<LibraryEntry | null>;
  listByUser(userId: string, opts: { status?: "planned" | "done"; domain?: string }): Promise<LibraryEntry[]>;
  remove(id: string): Promise<void>;
  feed(opts: {
    circleUserIds: string[];
    viewerId: string;
    domains: string[];
    cursor: { createdAt: Date; id: string } | null;
    limit: number;
  }): Promise<LibraryEntry[]>;
  /** Entrées publiques et publiables récentes (pour les tendances). */
  listRecentPublic(limit: number): Promise<LibraryEntry[]>;
}
export interface ListRepository {
  create(list: List): Promise<void>;
  findById(id: string): Promise<List | null>;
  listByUser(userId: string, domain?: string): Promise<List[]>;
  update(list: List): Promise<void>;
  remove(id: string): Promise<void>;
}
export interface LikeRepository {
  add(like: Like): Promise<void>;
  remove(entryId: string, userId: string): Promise<void>;
  exists(entryId: string, userId: string): Promise<boolean>;
  countByEntry(entryId: string): Promise<number>;
  likedEntryIds(userId: string, entryIds: string[]): Promise<string[]>;
}
export interface CommentRepository {
  add(comment: Comment): Promise<void>;
  findById(id: string): Promise<Comment | null>;
  listByEntry(entryId: string): Promise<Comment[]>;
  countByEntry(entryId: string): Promise<number>;
  remove(id: string): Promise<void>;
}
