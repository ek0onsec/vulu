import type { User, Follow, FollowRequest, Work, LibraryEntry, RatedEntry, List, Like, Comment, WorkSource, Community, Membership, CommunityRequest, CommunityRole, SeasonEpisodes, EpisodeEntry, WorkType } from "@/server/domain/entities";

export interface UserRepository {
  create(user: User): Promise<void>;
  findById(id: string): Promise<User | null>;
  /** Chargement batch (une requête $in) — évite un findById par utilisateur dans le feed. */
  findByIds(ids: string[]): Promise<User[]>;
  findByEmail(email: string): Promise<User | null>;
  findByUsername(username: string): Promise<User | null>;
  update(user: User): Promise<void>;
  remove(id: string): Promise<void>;
  /** Utilisateurs récents (pour les suggestions « À suivre »). */
  listRecent(limit: number): Promise<User[]>;
  /** Recherche par username OU displayName (contains, insensible à la casse). */
  searchByText(query: string, limit: number): Promise<User[]>;
  /** Retrouve un utilisateur par son code d'invitation (déjà normalisé en majuscules). */
  findByInviteCode(code: string): Promise<User | null>;
  /** Liste les utilisateurs parrainés par `inviterId` (filleuls). */
  listByInviter(inviterId: string): Promise<User[]>;
}
export interface FollowRepository {
  add(follow: Follow): Promise<void>;
  remove(followerId: string, followeeId: string): Promise<void>;
  exists(followerId: string, followeeId: string): Promise<boolean>;
  followeeIdsOf(userId: string): Promise<string[]>;
  followerIdsOf(userId: string): Promise<string[]>;
  listFollowers(userId: string): Promise<Follow[]>;
  countFollowers(userId: string): Promise<number>;
  countFollowing(userId: string): Promise<number>;
  removeAllForUser(userId: string): Promise<void>;
}
export interface FollowRequestRepository {
  add(request: FollowRequest): Promise<void>;
  findById(id: string): Promise<FollowRequest | null>;
  findPair(requesterId: string, targetId: string): Promise<FollowRequest | null>;
  listForTarget(targetId: string): Promise<FollowRequest[]>;
  countForTarget(targetId: string): Promise<number>;
  remove(id: string): Promise<void>;
  removeAllForUser(userId: string): Promise<void>;
}
export interface WorkRepository {
  upsert(work: Work): Promise<void>;
  findById(id: string): Promise<Work | null>;
  findByIds(ids: string[]): Promise<Work[]>;
  findByExternal(source: WorkSource, externalId: string, type: WorkType): Promise<Work | null>;
}
export interface EpisodeCacheRepository {
  find(source: WorkSource, externalId: string, season: number): Promise<SeasonEpisodes | null>;
  upsert(entry: SeasonEpisodes): Promise<void>;
}
export interface EpisodeEntryRepository {
  upsert(entry: EpisodeEntry): Promise<void>;
  findById(id: string): Promise<EpisodeEntry | null>;
  findOne(userId: string, workId: string, season: number, episode: number): Promise<EpisodeEntry | null>;
  listByUserAndWork(userId: string, workId: string): Promise<EpisodeEntry[]>;
  feed(opts: { scope: "foryou" | "following"; circleUserIds: string[]; followingUserIds: string[]; viewerId: string; cursor: { activityAt: Date; id: string } | null; limit: number }): Promise<EpisodeEntry[]>;
}
export interface LibraryEntryRepository {
  upsert(entry: LibraryEntry): Promise<void>;
  findById(id: string): Promise<LibraryEntry | null>;
  findByUserAndWork(userId: string, workId: string): Promise<LibraryEntry | null>;
  listByUser(userId: string, opts: { status?: "planned" | "in_progress" | "done"; domain?: string }): Promise<LibraryEntry[]>;
  /** Œuvres notées (rating non nul) d'un utilisateur. Pour la compatibilité de goûts. */
  listRatedByUser(userId: string): Promise<RatedEntry[]>;
  remove(id: string): Promise<void>;
  removeAllForUser(userId: string): Promise<void>;
  feed(opts: {
    scope: "foryou" | "following";
    circleUserIds: string[];
    followingUserIds: string[];
    viewerId: string;
    domains: string[];
    cursor: { activityAt: Date; id: string } | null;
    limit: number;
  }): Promise<LibraryEntry[]>;
  /** Entrées publiques et publiables récentes (pour les tendances). */
  listRecentPublic(limit: number): Promise<LibraryEntry[]>;
  /** Entrées publiables (vues + notées/commentées) d'une œuvre, tous publics confondus. */
  listByWork(workId: string): Promise<LibraryEntry[]>;
  /** Fil d'une communauté : entrées publiables partagées dans cette communauté, paginé. */
  feedByCommunity(communityId: string, cursor: { activityAt: Date; id: string } | null, limit: number): Promise<LibraryEntry[]>;
}

export interface CommunityRepository {
  create(community: Community): Promise<void>;
  update(community: Community): Promise<void>;
  findById(id: string): Promise<Community | null>;
  findBySlug(slug: string): Promise<Community | null>;
  listPublic(limit: number): Promise<Community[]>;
  listByIds(ids: string[]): Promise<Community[]>;
}

export interface MembershipRepository {
  add(m: Membership): Promise<void>;
  remove(communityId: string, userId: string): Promise<void>;
  find(communityId: string, userId: string): Promise<Membership | null>;
  listForUser(userId: string): Promise<Membership[]>;
  setPinned(communityId: string, userId: string, pinned: boolean): Promise<void>;
  countForCommunity(communityId: string): Promise<number>;
  setRole(communityId: string, userId: string, role: CommunityRole): Promise<void>;
  listForCommunity(communityId: string): Promise<Membership[]>;
}

export interface CommunityRequestRepository {
  add(request: CommunityRequest): Promise<void>;
  findById(id: string): Promise<CommunityRequest | null>;
  findPair(communityId: string, userId: string): Promise<CommunityRequest | null>;
  listForCommunity(communityId: string): Promise<CommunityRequest[]>;   // kind:"request"
  listInvitesForUser(userId: string): Promise<CommunityRequest[]>;      // kind:"invite"
  remove(id: string): Promise<void>;
  removeAllForUser(userId: string): Promise<void>;
  removeAllForCommunity(communityId: string): Promise<void>;
}
export interface ListRepository {
  create(list: List): Promise<void>;
  findById(id: string): Promise<List | null>;
  listByUser(userId: string): Promise<List[]>;
  update(list: List): Promise<void>;
  remove(id: string): Promise<void>;
  removeAllForUser(userId: string): Promise<void>;
}
export interface LikeRepository {
  add(like: Like): Promise<void>;
  remove(entryId: string, userId: string): Promise<void>;
  exists(entryId: string, userId: string): Promise<boolean>;
  countByEntry(entryId: string): Promise<number>;
  /** Compteurs batch par entrée (une agrégation) — évite un countByEntry par item de feed. */
  countByEntries(entryIds: string[]): Promise<Map<string, number>>;
  listByEntry(entryId: string): Promise<Like[]>;
  /** Likes de plusieurs entrées en une requête (pour agréger les notifications). */
  listByEntries(entryIds: string[]): Promise<Like[]>;
  likedEntryIds(userId: string, entryIds: string[]): Promise<string[]>;
  removeAllForUser(userId: string): Promise<void>;
}
export interface CommentRepository {
  add(comment: Comment): Promise<void>;
  findById(id: string): Promise<Comment | null>;
  listByEntry(entryId: string): Promise<Comment[]>;
  /** Commentaires de plusieurs entrées en une requête (pour agréger les notifications). */
  listByEntries(entryIds: string[]): Promise<Comment[]>;
  countByEntry(entryId: string): Promise<number>;
  /** Compteurs batch par entrée (une agrégation) — évite un countByEntry par item de feed. */
  countByEntries(entryIds: string[]): Promise<Map<string, number>>;
  remove(id: string): Promise<void>;
  removeAllForUser(userId: string): Promise<void>;
}
