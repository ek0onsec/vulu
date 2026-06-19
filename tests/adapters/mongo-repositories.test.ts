import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { startTestMongo, type TestMongo } from "../helpers/mongo";
import { ensureIndexes } from "@/server/adapters/mongo/indexes";
import { MongoUserRepository, MongoLibraryEntryRepository } from "@/server/adapters/mongo/repositories";
import type { User, LibraryEntry } from "@/server/domain/entities";

let m: TestMongo;
beforeAll(async () => { m = await startTestMongo(); await ensureIndexes(m.db); }, 120_000);
afterAll(async () => { await m.stop(); });
beforeEach(async () => { await m.db.collection("users").deleteMany({}); await m.db.collection("entries").deleteMany({}); });

const user = (id: string, over: Partial<User> = {}): User => ({ id, email: `${id}@x.io`, passwordHash: "h",
  username: id, displayName: id, bio: null, avatarUrl: null, bannerUrl: null, activeTabs: ["films"],
  tastes: { filmGenreIds: [1, 2, 3], people: [] }, showcase: { movie: [], tv: [], book: [] }, plus: false, staff: false, private: false, twoFactorEnabled: false, deactivatedAt: null, notificationsSeenAt: null, createdAt: new Date(), ...over });
const entry = (id: string, over: Partial<LibraryEntry> = {}): LibraryEntry => ({ id, userId: "u1", workId: "w1",
  domain: "films", status: "done", rating: 4, text: "x", visibility: "public", communityId: null,
  createdAt: new Date(), updatedAt: new Date(), ...over });

describe("Mongo repositories", () => {
  it("UserRepository persiste et retrouve par email", async () => {
    const r = new MongoUserRepository(m.db);
    await r.create(user("u1", { email: "a@x.io" }));
    expect((await r.findByEmail("a@x.io"))?.id).toBe("u1");
  });
  it("entries: unicité (userId, workId) via upsert", async () => {
    const r = new MongoLibraryEntryRepository(m.db);
    await r.upsert(entry("e1", { rating: 3 }));
    await r.upsert(entry("e1", { rating: 5 }));
    expect((await r.findByUserAndWork("u1", "w1"))?.rating).toBe(5);
  });
  it("feed: public OU cercle, trié desc", async () => {
    const r = new MongoLibraryEntryRepository(m.db);
    await r.upsert(entry("e_pub", { userId: "stranger", visibility: "public", communityId: null, createdAt: new Date(2024, 0, 1) }));
    await r.upsert(entry("e_cir", { userId: "friend", visibility: "circle", createdAt: new Date(2024, 0, 2) }));
    const res = await r.feed({ scope: "foryou", circleUserIds: ["friend"], viewerId: "me", domains: ["films"], cursor: null, limit: 10 });
    expect(res.map((e) => e.id)).toEqual(["e_cir", "e_pub"]);
  });
});
