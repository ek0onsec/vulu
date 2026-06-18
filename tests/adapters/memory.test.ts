import { describe, it, expect } from "vitest";
import { InMemoryUserRepository, InMemoryFollowRepository, InMemoryLibraryEntryRepository } from "@/server/adapters/memory";
import type { User, LibraryEntry } from "@/server/domain/entities";

function user(id: string, over: Partial<User> = {}): User {
  return { id, email: `${id}@x.io`, passwordHash: "h", username: id, displayName: id,
    bio: null, avatarUrl: null, bannerUrl: null, activeTabs: ["films"], tastes: { filmGenreIds: [], people: [] }, plus: false, staff: false, private: false, twoFactorEnabled: false, deactivatedAt: null,
    createdAt: new Date(), ...over };
}
function entry(id: string, over: Partial<LibraryEntry> = {}): LibraryEntry {
  return { id, userId: "u1", workId: "w1", domain: "films", status: "done", rating: 4,
    text: null, visibility: "public", createdAt: new Date(), updatedAt: new Date(), ...over };
}

describe("InMemory repos", () => {
  it("UserRepository find by email/username", async () => {
    const r = new InMemoryUserRepository();
    await r.create(user("u1", { email: "a@x.io", username: "alice" }));
    expect((await r.findByEmail("a@x.io"))?.id).toBe("u1");
    expect((await r.findByUsername("alice"))?.id).toBe("u1");
    expect(await r.findByEmail("none@x.io")).toBeNull();
  });

  it("FollowRepository union directions", async () => {
    const r = new InMemoryFollowRepository();
    await r.add({ followerId: "u1", followeeId: "u2", createdAt: new Date() });
    expect(await r.followeeIdsOf("u1")).toEqual(["u2"]);
    expect(await r.followerIdsOf("u2")).toEqual(["u1"]);
    expect(await r.exists("u1", "u2")).toBe(true);
  });

  it("feed: publiables, public OU cercle, filtré domaine, trié desc", async () => {
    const r = new InMemoryLibraryEntryRepository();
    const t0 = new Date(2024, 0, 1), t1 = new Date(2024, 0, 2), t2 = new Date(2024, 0, 3);
    await r.upsert(entry("e_pub", { userId: "stranger", visibility: "public", createdAt: t0 }));
    await r.upsert(entry("e_circle", { userId: "friend", visibility: "circle", createdAt: t1 }));
    await r.upsert(entry("e_hidden", { userId: "stranger", visibility: "circle", createdAt: t2 }));
    await r.upsert(entry("e_planned", { userId: "friend", status: "planned", rating: null, text: null, createdAt: t2 }));
    const res = await r.feed({ scope: "foryou", circleUserIds: ["friend"], viewerId: "me", domains: ["films"], cursor: null, limit: 10 });
    expect(res.map((e) => e.id)).toEqual(["e_circle", "e_pub"]);
  });
});
