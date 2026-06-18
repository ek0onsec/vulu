import type { User, Follow, FollowRequest, Work, LibraryEntry, List, Like, Comment } from "@/server/domain/entities";

type WithId<T> = T & { _id: string };
const strip = <T>(d: WithId<T>): T => { const { _id, ...rest } = d as WithId<T> & Record<string, unknown>; void _id; return rest as T; };

export type WithIdUser = WithId<User>;
export type WithIdFollow = WithId<Follow>;
export type WithIdWork = WithId<Work>;
export type WithIdEntry = WithId<LibraryEntry>;
export type WithIdList = WithId<List>;
export type WithIdLike = WithId<Like>;
export type WithIdComment = WithId<Comment>;
export type WithIdFollowRequest = WithId<FollowRequest>;

export const toUserDoc = (u: User): WithIdUser => ({ _id: u.id, ...u });
export const fromUserDoc = (d: WithIdUser): User => strip(d);

export const toFollowDoc = (f: Follow): WithIdFollow => ({ _id: `${f.followerId}:${f.followeeId}`, ...f });
export const fromFollowDoc = (d: WithIdFollow): Follow => strip(d);

export const toFollowRequestDoc = (r: FollowRequest): WithIdFollowRequest => ({ _id: r.id, ...r });
export const fromFollowRequestDoc = (d: WithIdFollowRequest): FollowRequest => strip(d);

export const toWorkDoc = (w: Work): WithIdWork => ({ _id: w.id, ...w });
export const fromWorkDoc = (d: WithIdWork): Work => strip(d);

export const toEntryDoc = (e: LibraryEntry): WithIdEntry => ({ _id: e.id, ...e });
export const fromEntryDoc = (d: WithIdEntry): LibraryEntry => strip(d);

export const toListDoc = (l: List): WithIdList => ({ _id: l.id, ...l });
export const fromListDoc = (d: WithIdList): List => strip(d);

export const toLikeDoc = (l: Like): WithIdLike => ({ _id: `${l.entryId}:${l.userId}`, ...l });
export const fromLikeDoc = (d: WithIdLike): Like => strip(d);

export const toCommentDoc = (c: Comment): WithIdComment => ({ _id: c.id, ...c });
export const fromCommentDoc = (d: WithIdComment): Comment => strip(d);
