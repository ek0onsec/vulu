import type { Db } from "mongodb";

export async function ensureIndexes(db: Db): Promise<void> {
  await db.collection("users").createIndexes([
    { key: { email: 1 }, unique: true, name: "uniq_email" },
    { key: { username: 1 }, unique: true, name: "uniq_username" },
    { key: { inviteCode: 1 }, unique: true, sparse: true, name: "uniq_invite_code" },
  ]);
  await db.collection("users").createIndex({ invitedBy: 1 }, { name: "by_inviter" });
  await db.collection("follows").createIndexes([
    { key: { followerId: 1, followeeId: 1 }, unique: true, name: "uniq_edge" },
    { key: { followeeId: 1 }, name: "by_followee" },
  ]);
  await db.collection("works").createIndex({ source: 1, externalId: 1 }, { unique: true, name: "uniq_external" });
  await db.collection("entries").createIndexes([
    { key: { userId: 1, workId: 1 }, unique: true, name: "uniq_user_work" },
    { key: { "audiences.public": 1, domain: 1, createdAt: -1 }, name: "feed" },
    { key: { activityAt: -1, _id: -1 }, name: "feed_activity" },
    { key: { userId: 1, status: 1 }, name: "by_user_status" },
    { key: { userId: 1, createdAt: -1 }, name: "by_user_date" },
  ]);
  await db.collection("follow_requests").createIndexes([
    { key: { requesterId: 1, targetId: 1 }, unique: true, name: "uniq_request" },
    { key: { targetId: 1, createdAt: -1 }, name: "by_target" },
  ]);
  await db.collection("communities").createIndex({ slug: 1 }, { unique: true, name: "uniq_slug" });
  await db.collection("memberships").createIndexes([
    { key: { communityId: 1, userId: 1 }, unique: true, name: "uniq_member" },
    { key: { userId: 1 }, name: "by_user" },
  ]);
  await db.collection("community_requests").createIndexes([
    { key: { communityId: 1, userId: 1 }, unique: true, name: "uniq_comm_request" },
    { key: { userId: 1, kind: 1 }, name: "by_user_kind" },
    { key: { communityId: 1, kind: 1 }, name: "by_comm_kind" },
  ]);
  await db.collection("entries").createIndex({ "audiences.communityIds": 1, activityAt: -1 }, { name: "by_community" });
  await db.collection("lists").createIndex({ userId: 1 }, { name: "by_user" });
  await db.collection("likes").createIndex({ entryId: 1, userId: 1 }, { unique: true, name: "uniq_like" });
  await db.collection("comments").createIndex({ entryId: 1, createdAt: 1 }, { name: "by_entry" });
}
