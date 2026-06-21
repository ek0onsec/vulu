import { describe, it, expect } from "vitest";
import { toUserDoc, fromUserDoc, toEntryDoc, fromEntryDoc, fromWorkDoc, fromCommunityDoc, fromMembershipDoc } from "@/server/adapters/mongo/mappers";
import type { User, LibraryEntry } from "@/server/domain/entities";

const user: User = { id: "u1", email: "a@x.io", passwordHash: "h", username: "alice",
  displayName: "Alice", bio: null, avatarUrl: null, bannerUrl: null, activeTabs: ["films"],
  tastes: { filmGenreIds: [1, 2, 3], people: [] }, showcase: { movie: [], tv: [], book: [] }, plus: false, staff: false, private: false, twoFactorEnabled: false, deactivatedAt: null, notificationsSeenAt: null, createdAt: new Date("2024-01-01") };
const entry: LibraryEntry = { id: "e1", userId: "u1", workId: "w1", domain: "films",
  status: "done", rating: 4.2, text: "top", visibility: "public", communityId: null,
  progress: null, activityAt: new Date("2024-01-02"),
  createdAt: new Date("2024-01-02"), updatedAt: new Date("2024-01-03") };

describe("mongo mappers", () => {
  it("user round-trip", () => { expect(fromUserDoc(toUserDoc(user))).toEqual(user); });
  it("entry round-trip", () => { expect(fromEntryDoc(toEntryDoc(entry))).toEqual(entry); });
  it("user doc utilise _id = id", () => { expect(toUserDoc(user)._id).toBe("u1"); });
});

describe("mappers — rétro-compat progression", () => {
  it("fromEntryDoc backfille un ancien doc (avis) avec activityAt = createdAt", () => {
    const created = new Date("2025-01-01");
    // @ts-expect-error doc legacy sans progress/activityAt
    const e = fromEntryDoc({ _id: "e", id: "e", userId: "u", workId: "w", domain: "films",
      status: "done", rating: 4, text: null, visibility: "public", communityId: null,
      createdAt: created, updatedAt: created });
    expect(e.progress).toBeNull();
    expect(e.activityAt).toEqual(created);
  });
  it("fromEntryDoc laisse activityAt null pour un ancien doc non publiable", () => {
    const created = new Date("2025-01-01");
    // @ts-expect-error doc legacy
    const e = fromEntryDoc({ _id: "e", id: "e", userId: "u", workId: "w", domain: "films",
      status: "planned", rating: null, text: null, visibility: "circle", communityId: null,
      createdAt: created, updatedAt: created });
    expect(e.activityAt).toBeNull();
  });
  it("fromWorkDoc backfille episodeCounts/pageCount à null", () => {
    // @ts-expect-error doc legacy
    const w = fromWorkDoc({ _id: "w", id: "w", source: "tmdb", externalId: "1", type: "movie",
      domain: "films", title: "X", year: 2000, posterUrl: null, backdropUrl: null, overview: null,
      genres: [], people: [], externalRating: null, watchProviders: [], cachedAt: new Date() });
    expect(w.episodeCounts).toBeNull();
    expect(w.pageCount).toBeNull();
  });
});

describe("mappers — rétro-compat communautés privées", () => {
  it("fromCommunityDoc backfille visibility public", () => {
    // @ts-expect-error doc legacy sans visibility
    const c = fromCommunityDoc({ _id: "c", id: "c", name: "X", slug: "x", description: null, bannerUrl: null, ownerId: "u", createdAt: new Date() });
    expect(c.visibility).toBe("public");
  });
  it("fromMembershipDoc backfille role member", () => {
    // @ts-expect-error doc legacy sans role
    const m = fromMembershipDoc({ _id: "c:u", communityId: "c", userId: "u", pinned: false, createdAt: new Date() });
    expect(m.role).toBe("member");
  });
});
