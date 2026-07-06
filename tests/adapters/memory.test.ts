import { describe, it, expect } from "vitest";
import { InMemoryUserRepository, InMemoryFollowRepository, InMemoryLibraryEntryRepository, InMemoryMembershipRepository, InMemoryCommunityRequestRepository, InMemoryWorkRepository } from "@/server/adapters/memory";
import type { User, LibraryEntry, Work } from "@/server/domain/entities";

function work(id: string): Work {
  return { id, source: "tmdb", externalId: id, type: "movie", domain: "films", title: id, year: null, posterUrl: null, backdropUrl: null, overview: null, genres: [], people: [], externalRating: null, watchProviders: [], episodeCounts: null, pageCount: null, runtime: null, cachedAt: new Date() };
}

function user(id: string, over: Partial<User> = {}): User {
  return { id, email: `${id}@x.io`, passwordHash: "h", username: id, displayName: id,
    bio: null, avatarUrl: null, bannerUrl: null, activeTabs: ["films"], tastes: { filmGenreIds: [], people: [] }, showcase: { movie: [], tv: [], book: [] }, plus: false, staff: false, private: false, twoFactorEnabled: false, twoFactorSecret: null, twoFactorBackupCodes: [], deactivatedAt: null, notificationsSeenAt: null, tourCompletedAt: null,
    createdAt: new Date(), ...over };
}
function entry(id: string, over: Partial<LibraryEntry> = {}): LibraryEntry {
  return { id, userId: "u1", workId: "w1", domain: "films", status: "done", rating: 4,
    text: null, audiences: { public: true, circle: true, communityIds: [] }, completedAt: null, progress: null, activityAt: null, createdAt: new Date(), updatedAt: new Date(), ...over };
}

describe("InMemory repos", () => {
  it("WorkRepository.findByIds renvoie les œuvres présentes (ignore les absentes)", async () => {
    const r = new InMemoryWorkRepository();
    await r.upsert(work("w1"));
    await r.upsert(work("w2"));
    const found = await r.findByIds(["w1", "absent", "w2"]);
    expect(found.map((w) => w.id).sort()).toEqual(["w1", "w2"]);
    expect(await r.findByIds([])).toEqual([]);
  });

  it("UserRepository find by email/username", async () => {
    const r = new InMemoryUserRepository();
    await r.create(user("u1", { email: "a@x.io", username: "alice" }));
    expect((await r.findByEmail("a@x.io"))?.id).toBe("u1");
    expect((await r.findByUsername("alice"))?.id).toBe("u1");
    expect(await r.findByEmail("none@x.io")).toBeNull();
  });

  it("UserRepository.searchByText matche username/displayName, insensible casse, respecte limit", async () => {
    const r = new InMemoryUserRepository();
    await r.create(user("u1", { username: "tom_92", displayName: "Thomas" }));
    await r.create(user("u2", { username: "alice", displayName: "Alice T" }));
    await r.create(user("u3", { username: "bob", displayName: "Bob" }));
    expect((await r.searchByText("TOM", 10)).map((u) => u.id)).toEqual(["u1"]);
    expect((await r.searchByText("alice", 10)).map((u) => u.id)).toEqual(["u2"]);
    expect((await r.searchByText("o", 1)).length).toBe(1);
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
    await r.upsert(entry("e_pub", { userId: "stranger", audiences: { public: true, circle: true, communityIds: [] }, createdAt: t0, activityAt: t0 }));
    await r.upsert(entry("e_circle", { userId: "friend", audiences: { public: false, circle: true, communityIds: [] }, createdAt: t1, activityAt: t1 }));
    await r.upsert(entry("e_hidden", { userId: "stranger", audiences: { public: false, circle: true, communityIds: [] }, createdAt: t2, activityAt: t2 }));
    await r.upsert(entry("e_planned", { userId: "friend", status: "planned", rating: null, text: null, createdAt: t2, activityAt: null }));
    const res = await r.feed({ scope: "foryou", circleUserIds: ["friend"], followingUserIds: [], viewerId: "me", domains: ["films"], cursor: null, limit: 10 });
    expect(res.map((e) => e.id)).toEqual(["e_circle", "e_pub"]);
  });

  it("feed scope 'following' filtre par followingUserIds + visibilité", async () => {
    const r = new InMemoryLibraryEntryRepository();
    const t0 = new Date(2024, 0, 1), t1 = new Date(2024, 0, 2), t2 = new Date(2024, 0, 3);
    await r.upsert(entry("pub_followed", { userId: "followed", audiences: { public: true, circle: true, communityIds: [] }, createdAt: t0, activityAt: t0 }));
    await r.upsert(entry("cir_mutual", { userId: "mutual", audiences: { public: false, circle: true, communityIds: [] }, createdAt: t1, activityAt: t1 }));
    await r.upsert(entry("pub_other", { userId: "stranger", audiences: { public: true, circle: true, communityIds: [] }, createdAt: t2, activityAt: t2 }));
    const res = await r.feed({ scope: "following", circleUserIds: ["mutual"], followingUserIds: ["followed", "mutual"], viewerId: "me", domains: ["films"], cursor: null, limit: 10 });
    expect(res.map((e) => e.id).sort()).toEqual(["cir_mutual", "pub_followed"]);
  });

  it("listRatedByUser ne remonte que les entries notées, projetées avec audiences", async () => {
    const r = new InMemoryLibraryEntryRepository();
    await r.upsert(entry("e1", { userId: "u1", workId: "w1", rating: 4.5 }));
    await r.upsert(entry("e2", { userId: "u1", workId: "w2", rating: null }));
    await r.upsert(entry("e3", { userId: "other", workId: "w1", rating: 3 }));
    expect(await r.listRatedByUser("u1")).toEqual([
      { workId: "w1", domain: "films", rating: 4.5, audiences: { public: true, circle: true, communityIds: [] } },
    ]);
  });
});

describe("InMemoryLibraryEntryRepository — feed activityAt", () => {
  const mk = (id: string, activityAt: Date | null, over: Partial<LibraryEntry> = {}): LibraryEntry => ({
    id, userId: "u", workId: "w-" + id, domain: "films", status: "done",
    rating: 4, text: null, audiences: { public: true, circle: true, communityIds: [] }, completedAt: null, progress: null,
    activityAt, createdAt: new Date(2020, 0, 1), updatedAt: new Date(2020, 0, 1), ...over,
  });
  it("exclut les entrées sans activityAt et trie par activityAt desc", async () => {
    const repo = new InMemoryLibraryEntryRepository();
    await repo.upsert(mk("a", new Date(2021, 0, 1)));
    await repo.upsert(mk("b", new Date(2023, 0, 1)));
    await repo.upsert(mk("c", null, { status: "in_progress", rating: null }));
    const out = await repo.feed({ scope: "foryou", circleUserIds: [], followingUserIds: [], viewerId: "u", domains: ["films"], cursor: null, limit: 10 });
    expect(out.map((e) => e.id)).toEqual(["b", "a"]);
  });
  it("pagine via le curseur activityAt", async () => {
    const repo = new InMemoryLibraryEntryRepository();
    await repo.upsert(mk("a", new Date(2021, 0, 1)));
    await repo.upsert(mk("b", new Date(2023, 0, 1)));
    const out = await repo.feed({ scope: "foryou", circleUserIds: [], followingUserIds: [], viewerId: "u", domains: ["films"], cursor: { activityAt: new Date(2023, 0, 1), id: "b" }, limit: 10 });
    expect(out.map((e) => e.id)).toEqual(["a"]);
  });
});

describe("InMemoryMembershipRepository — rôles", () => {
  it("setRole et listForCommunity", async () => {
    const r = new InMemoryMembershipRepository();
    await r.add({ communityId: "c", userId: "u1", pinned: true, role: "owner", createdAt: new Date() });
    await r.add({ communityId: "c", userId: "u2", pinned: false, role: "member", createdAt: new Date() });
    await r.setRole("c", "u2", "moderator");
    const members = await r.listForCommunity("c");
    expect(members).toHaveLength(2);
    expect((await r.find("c", "u2"))?.role).toBe("moderator");
  });
});

describe("InMemoryCommunityRequestRepository", () => {
  it("add idempotent par couple + listForCommunity (requests) + listInvitesForUser", async () => {
    const r = new InMemoryCommunityRequestRepository();
    await r.add({ id: "r1", communityId: "c", userId: "u1", kind: "request", createdAt: new Date() });
    await r.add({ id: "r1b", communityId: "c", userId: "u1", kind: "request", createdAt: new Date() }); // doublon couple → ignoré
    await r.add({ id: "r2", communityId: "c", userId: "u2", kind: "invite", createdAt: new Date() });
    expect((await r.listForCommunity("c")).map((x) => x.id)).toEqual(["r1"]);
    expect((await r.listInvitesForUser("u2")).map((x) => x.id)).toEqual(["r2"]);
    expect((await r.findPair("c", "u1"))?.id).toBe("r1");
  });
});
