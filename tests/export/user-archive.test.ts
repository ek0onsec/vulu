import { describe, it, expect, beforeEach } from "vitest";
import { makeInMemoryDeps, type Deps } from "@/server/container";
import { FakeCatalog } from "../helpers/fake-catalog";
import { buildUserArchive } from "@/server/export/user-archive";
import { strFromU8 } from "fflate";

let deps: Deps;
const U = "u1";
beforeEach(async () => {
  deps = makeInMemoryDeps(new FakeCatalog());
  const now = new Date();
  await deps.users.create({
    id: U, email: "u1@test.local", passwordHash: "SECRET-HASH", username: "alice", displayName: "Alice",
    bio: null, avatarUrl: null, bannerUrl: null, activeTabs: ["films"],
    tastes: { filmGenreIds: [], bookGenreIds: [], people: [] }, showcase: { movie: [], tv: [], book: [] },
    plus: false, staff: false, private: false, twoFactorEnabled: false, twoFactorSecret: "TOTP-SECRET",
    twoFactorBackupCodes: ["CODE"], deactivatedAt: null, notificationsSeenAt: null, tourCompletedAt: null,
    createdAt: now, inviteCode: "INV", invitedBy: null,
  } as Parameters<typeof deps.users.create>[0]);
  await deps.works.upsert({ id: "w1", source: "tmdb", externalId: "603", type: "movie", domain: "films", title: "The Matrix", year: 1999, posterUrl: null, backdropUrl: null, overview: null, genres: [], people: [], externalRating: null, watchProviders: [], episodeCounts: null, pageCount: null, runtime: null, cachedAt: now } as Parameters<typeof deps.works.upsert>[0]);
  await deps.entries.upsert({ id: "en1", userId: U, workId: "w1", domain: "films", status: "done", rating: 5, text: null, audiences: { public: false, circle: false, communityIds: [] }, completedAt: now, progress: null, activityAt: null, createdAt: now, updatedAt: now } as Parameters<typeof deps.entries.upsert>[0]);
  await deps.users.create({ id: "u2", email: "u2@test.local", passwordHash: "x", username: "bob", displayName: "Bob", bio: null, avatarUrl: null, bannerUrl: null, activeTabs: ["films"], tastes: { filmGenreIds: [], bookGenreIds: [], people: [] }, showcase: { movie: [], tv: [], book: [] }, plus: false, staff: false, private: false, twoFactorEnabled: false, twoFactorSecret: null, twoFactorBackupCodes: [], deactivatedAt: null, notificationsSeenAt: null, tourCompletedAt: null, createdAt: now, inviteCode: "INV2", invitedBy: null } as Parameters<typeof deps.users.create>[0]);
  await deps.follows.add({ followerId: U, followeeId: "u2", createdAt: now });
});

describe("buildUserArchive", () => {
  it("produit toutes les entrées attendues", async () => {
    const files = await buildUserArchive(deps, U);
    for (const k of ["README.txt", "profile.json", "library.json", "library.csv", "episodes.json", "lists.json", "social.json", "likes.json", "comments.json"]) {
      expect(files[k]).toBeDefined();
    }
  });
  it("profile.json ne contient aucun secret", async () => {
    const files = await buildUserArchive(deps, U);
    const profile = strFromU8(files["profile.json"]!);
    expect(profile).not.toContain("SECRET-HASH");
    expect(profile).not.toContain("TOTP-SECRET");
    expect(profile).toContain("alice");
  });
  it("library.csv contient le titre de l'œuvre", async () => {
    const files = await buildUserArchive(deps, U);
    expect(strFromU8(files["library.csv"]!)).toContain("The Matrix");
  });
  it("social.json liste les pseudos suivis", async () => {
    const files = await buildUserArchive(deps, U);
    expect(strFromU8(files["social.json"]!)).toContain("bob");
  });
  it("inclut l'avatar si présent et lisible", async () => {
    const url = await deps.media.save(new Uint8Array([9, 9, 9]), "png");
    const u = (await deps.users.findById(U))!;
    await deps.users.update({ ...u, avatarUrl: url });
    const files = await buildUserArchive(deps, U);
    expect(Object.keys(files).some((k) => k.startsWith("media/avatar."))).toBe(true);
  });
});
