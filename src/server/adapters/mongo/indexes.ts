import type { Db } from "mongodb";

export async function ensureIndexes(db: Db): Promise<void> {
  await db.collection("users").createIndexes([
    { key: { email: 1 }, unique: true, name: "uniq_email" },
    { key: { username: 1 }, unique: true, name: "uniq_username" },
  ]);
  await db.collection("follows").createIndexes([
    { key: { followerId: 1, followeeId: 1 }, unique: true, name: "uniq_edge" },
    { key: { followeeId: 1 }, name: "by_followee" },
  ]);
  await db.collection("works").createIndex({ source: 1, externalId: 1 }, { unique: true, name: "uniq_external" });
  await db.collection("entries").createIndexes([
    { key: { userId: 1, workId: 1 }, unique: true, name: "uniq_user_work" },
    { key: { visibility: 1, domain: 1, createdAt: -1 }, name: "feed" },
    { key: { userId: 1, status: 1 }, name: "by_user_status" },
    { key: { userId: 1, createdAt: -1 }, name: "by_user_date" },
  ]);
  await db.collection("follow_requests").createIndexes([
    { key: { requesterId: 1, targetId: 1 }, unique: true, name: "uniq_request" },
    { key: { targetId: 1, createdAt: -1 }, name: "by_target" },
  ]);
  await db.collection("lists").createIndex({ userId: 1 }, { name: "by_user" });
  await db.collection("likes").createIndex({ entryId: 1, userId: 1 }, { unique: true, name: "uniq_like" });
  await db.collection("comments").createIndex({ entryId: 1, createdAt: 1 }, { name: "by_entry" });
}
