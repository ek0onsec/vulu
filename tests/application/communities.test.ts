import { describe, it, expect, beforeEach } from "vitest";
import { makeInMemoryDeps, type Deps } from "@/server/container";
import { FakeCatalog } from "../helpers/fake-catalog";
import {
  createCommunity, joinCommunity, leaveCommunity, setCommunityPinned,
  myCommunities, pinnedCommunities, communityFeed, getCommunity,
} from "@/server/application/communities";
import { rateOrReviewWork } from "@/server/application/library-entry";
import { registerUser } from "@/server/application/register-user";
import { ValidationError, ForbiddenError } from "@/server/domain/errors";

let deps: Deps; let u1: string; let u2: string;
const ref = { source: "tmdb" as const, externalId: "603", type: "movie" as const };
const tastes = { filmGenreIds: [878, 18, 35], people: [] };
beforeEach(async () => {
  deps = makeInMemoryDeps(new FakeCatalog());
  u1 = (await registerUser(deps, { email: "u1@x.io", username: "user1", displayName: "U1", password: "password1", activeTabs: ["films"], tastes })).id;
  u2 = (await registerUser(deps, { email: "u2@x.io", username: "user2", displayName: "U2", password: "password1", activeTabs: ["films"], tastes })).id;
});

describe("communautés", () => {
  it("createCommunity slugifie, rejoint le créateur et l'épingle", async () => {
    const c = await createCommunity(deps, u1, { name: "Cinéphiles SF", description: "Science-fiction" });
    expect(c.slug).toBe("cinephiles-sf");
    expect(c.ownerId).toBe(u1);
    const m = await deps.memberships.find(c.id, u1);
    expect(m?.pinned).toBe(true);
  });

  it("rejette un nom trop court", async () => {
    await expect(createCommunity(deps, u1, { name: "x", description: null })).rejects.toThrow(ValidationError);
  });

  it("dé-duplique les slugs identiques", async () => {
    const a = await createCommunity(deps, u1, { name: "SF", description: null });
    const b = await createCommunity(deps, u2, { name: "SF", description: null });
    expect(a.slug).toBe("sf");
    expect(b.slug).toBe("sf-2");
  });

  it("join puis leave met à jour l'appartenance", async () => {
    const c = await createCommunity(deps, u1, { name: "Cinéphiles", description: null });
    await joinCommunity(deps, u2, c.id);
    expect((await getCommunity(deps, u2, c.id)).isMember).toBe(true);
    expect((await getCommunity(deps, u2, c.id)).memberCount).toBe(2);
    await leaveCommunity(deps, u2, c.id);
    expect((await getCommunity(deps, u2, c.id)).isMember).toBe(false);
  });

  it("setCommunityPinned exige d'être membre", async () => {
    const c = await createCommunity(deps, u1, { name: "Cinéphiles", description: null });
    await expect(setCommunityPinned(deps, u2, c.id, true)).rejects.toThrow(ForbiddenError);
  });

  it("myCommunities et pinnedCommunities reflètent l'épinglage", async () => {
    const c = await createCommunity(deps, u1, { name: "Cinéphiles", description: null });
    await joinCommunity(deps, u2, c.id);
    expect((await myCommunities(deps, u2)).map((x) => x.id)).toContain(c.id);
    expect((await pinnedCommunities(deps, u2)).map((x) => x.id)).not.toContain(c.id);
    await setCommunityPinned(deps, u2, c.id, true);
    expect((await pinnedCommunities(deps, u2)).map((x) => x.id)).toContain(c.id);
  });

  it("partager dans une communauté exige d'en être membre", async () => {
    const c = await createCommunity(deps, u1, { name: "Cinéphiles", description: null });
    await expect(
      rateOrReviewWork(deps, u2, ref, { rating: 4, text: "top", visibility: "public", communityId: c.id }),
    ).rejects.toThrow(ForbiddenError);
  });

  it("le fil de communauté ne contient que les avis qui y sont partagés", async () => {
    const c = await createCommunity(deps, u1, { name: "Cinéphiles", description: null });
    await rateOrReviewWork(deps, u1, ref, { rating: 4, text: "partagé", visibility: "public", communityId: c.id });
    await rateOrReviewWork(deps, u1, { source: "googlebooks", externalId: "book-1", type: "book" }, { rating: 3, text: "hors comm", visibility: "public", communityId: null });
    const feed = await communityFeed(deps, u1, c.id, null);
    expect(feed).toHaveLength(1);
    expect(feed[0]?.entry.text).toBe("partagé");
  });
});
