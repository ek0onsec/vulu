import { describe, it, expect, beforeEach } from "vitest";
import { makeInMemoryDeps, type Deps } from "@/server/container";
import { FakeCatalog } from "../helpers/fake-catalog";
import { registerUser } from "@/server/application/register-user";
import { rateOrReviewWork } from "@/server/application/library-entry";
import { followUser } from "@/server/application/social";
import { likeEntry } from "@/server/application/engagement";
import { buildFeed, getWorkReviews } from "@/server/application/feed";

let deps: Deps; let me: string; let friend: string; let stranger: string;
const tastes = { filmGenreIds: [878, 18, 35], people: [] };
beforeEach(async () => {
  deps = makeInMemoryDeps(new FakeCatalog());
  me = (await registerUser(deps, { email: "me@x.io", username: "me", displayName: "Me", password: "password1", activeTabs: ["films"], tastes })).id;
  friend = (await registerUser(deps, { email: "f@x.io", username: "friend", displayName: "F", password: "password1", activeTabs: ["films"], tastes })).id;
  stranger = (await registerUser(deps, { email: "s@x.io", username: "stranger", displayName: "S", password: "password1", activeTabs: ["films"], tastes })).id;
  await followUser(deps, me, friend);
});

describe("buildFeed", () => {
  it("inclut public + cercle, enrichit auteur & œuvre & compteurs", async () => {
    const ref = { source: "tmdb" as const, externalId: "603", type: "movie" as const };
    const fe = await rateOrReviewWork(deps, friend, ref, { rating: 4.2, text: "circle", audiences: { public: false, circle: true, communityIds: [] } });
    await rateOrReviewWork(deps, stranger, ref, { rating: 3, text: "public", audiences: { public: true, circle: true, communityIds: [] } });
    await likeEntry(deps, me, fe.id);

    const items = await buildFeed(deps, me, { scope: "foryou", cursor: null, limit: 10 });
    expect(items).toHaveLength(2);
    const circleItem = items.find((i) => !i.entry.audiences.public)!;
    expect(circleItem.author.username).toBe("friend");
    expect(circleItem.work.title).toBe("The Matrix");
    expect(circleItem.likeCount).toBe(1);
    expect(circleItem.likedByMe).toBe(true);
  });
  it("exclut les entrées 'circle' d'un inconnu", async () => {
    const ref = { source: "tmdb" as const, externalId: "603", type: "movie" as const };
    await rateOrReviewWork(deps, stranger, ref, { rating: 3, text: "hidden", audiences: { public: false, circle: true, communityIds: [] } });
    const items = await buildFeed(deps, me, { scope: "foryou", cursor: null, limit: 10 });
    expect(items).toHaveLength(0);
  });
  it("scope 'following' : montre le public d'un suivi, masque un non-suivi", async () => {
    const ref = { source: "tmdb" as const, externalId: "603", type: "movie" as const };
    await rateOrReviewWork(deps, friend, ref, { rating: 4, text: "suivi public", audiences: { public: true, circle: true, communityIds: [] } });
    await rateOrReviewWork(deps, stranger, ref, { rating: 3, text: "non suivi", audiences: { public: true, circle: true, communityIds: [] } });
    const items = await buildFeed(deps, me, { scope: "following", cursor: null, limit: 10 });
    expect(items.map((i) => i.author.username)).toEqual(["friend"]);
  });

  it("scope 'following' : un post 'cercle' d'un compte suivi est visible (suivre = être dans son cercle)", async () => {
    const ref = { source: "tmdb" as const, externalId: "603", type: "movie" as const };
    // me suit friend → me ∈ cercle de friend → son post cercle est visible en 'following'
    await rateOrReviewWork(deps, friend, ref, { rating: 4, text: "cercle", audiences: { public: false, circle: true, communityIds: [] } });
    // stranger non suivi : son post cercle reste masqué
    await rateOrReviewWork(deps, stranger, ref, { rating: 3, text: "cercle inconnu", audiences: { public: false, circle: true, communityIds: [] } });
    const items = await buildFeed(deps, me, { scope: "following", cursor: null, limit: 10 });
    expect(items.map((i) => i.author.username)).toEqual(["friend"]);
  });

  it("une entrée multi-cibles (public + cercle) n'apparaît qu'une fois en Pour vous", async () => {
    const ref = { source: "tmdb" as const, externalId: "603", type: "movie" as const };
    await rateOrReviewWork(deps, friend, ref, { rating: 4, text: "multi", audiences: { public: true, circle: true, communityIds: [] } });
    const items = await buildFeed(deps, me, { scope: "foryou", cursor: null, limit: 50 });
    expect(items.filter((i) => i.author.id === friend)).toHaveLength(1);
  });
  it("enrichEntries résout les communautés d'origine d'une entrée", async () => {
    const ref = { source: "tmdb" as const, externalId: "603", type: "movie" as const };
    const now = new Date();
    await deps.communities.create({ id: "c1", name: "Ciné Club", slug: "cine-club", description: null, bannerUrl: null, visibility: "public", ownerId: friend, createdAt: now });
    await deps.memberships.add({ communityId: "c1", userId: friend, pinned: false, role: "owner", createdAt: now });
    await rateOrReviewWork(deps, friend, ref, { rating: 4, text: "x", audiences: { public: false, circle: false, communityIds: ["c1"] } });
    const items = await buildFeed(deps, friend, { scope: "foryou", cursor: null, limit: 50 });
    const mine = items.find((i) => i.author.id === friend);
    expect(mine?.communities).toEqual([{ id: "c1", name: "Ciné Club" }]);
  });
});

describe("getWorkReviews", () => {
  const ref = { source: "tmdb" as const, externalId: "603", type: "movie" as const };
  it("montre les avis des autres (public/cercle) mais pas le sien", async () => {
    await rateOrReviewWork(deps, me, ref, { rating: 4, text: "le mien", audiences: { public: true, circle: true, communityIds: [] } });
    await rateOrReviewWork(deps, friend, ref, { rating: 5, text: "cercle", audiences: { public: false, circle: true, communityIds: [] } });
    await rateOrReviewWork(deps, stranger, ref, { rating: 3, text: "public", audiences: { public: true, circle: true, communityIds: [] } });
    const work = await deps.works.findByExternal("tmdb", "603");
    const reviews = await getWorkReviews(deps, me, work!.id);
    expect(reviews.map((r) => r.author.username).sort()).toEqual(["friend", "stranger"]);
  });
  it("cache l'avis cercle d'un inconnu", async () => {
    await rateOrReviewWork(deps, stranger, ref, { rating: 3, text: "secret", audiences: { public: false, circle: true, communityIds: [] } });
    const work = await deps.works.findByExternal("tmdb", "603");
    expect(await getWorkReviews(deps, me, work!.id)).toHaveLength(0);
  });
});
