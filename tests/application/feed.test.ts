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
    const fe = await rateOrReviewWork(deps, friend, ref, { rating: 4.2, text: "circle", visibility: "circle" });
    await rateOrReviewWork(deps, stranger, ref, { rating: 3, text: "public", visibility: "public" });
    await likeEntry(deps, me, fe.id);

    const items = await buildFeed(deps, me, { scope: "foryou", cursor: null, limit: 10 });
    expect(items).toHaveLength(2);
    const circleItem = items.find((i) => i.entry.visibility === "circle")!;
    expect(circleItem.author.username).toBe("friend");
    expect(circleItem.work.title).toBe("The Matrix");
    expect(circleItem.likeCount).toBe(1);
    expect(circleItem.likedByMe).toBe(true);
  });
  it("exclut les entrées 'circle' d'un inconnu", async () => {
    const ref = { source: "tmdb" as const, externalId: "603", type: "movie" as const };
    await rateOrReviewWork(deps, stranger, ref, { rating: 3, text: "hidden", visibility: "circle" });
    const items = await buildFeed(deps, me, { scope: "foryou", cursor: null, limit: 10 });
    expect(items).toHaveLength(0);
  });
});

describe("getWorkReviews", () => {
  const ref = { source: "tmdb" as const, externalId: "603", type: "movie" as const };
  it("montre les avis des autres (public/cercle) mais pas le sien", async () => {
    await rateOrReviewWork(deps, me, ref, { rating: 4, text: "le mien", visibility: "public" });
    await rateOrReviewWork(deps, friend, ref, { rating: 5, text: "cercle", visibility: "circle" });
    await rateOrReviewWork(deps, stranger, ref, { rating: 3, text: "public", visibility: "public" });
    const work = await deps.works.findByExternal("tmdb", "603");
    const reviews = await getWorkReviews(deps, me, work!.id);
    expect(reviews.map((r) => r.author.username).sort()).toEqual(["friend", "stranger"]);
  });
  it("cache l'avis cercle d'un inconnu", async () => {
    await rateOrReviewWork(deps, stranger, ref, { rating: 3, text: "secret", visibility: "circle" });
    const work = await deps.works.findByExternal("tmdb", "603");
    expect(await getWorkReviews(deps, me, work!.id)).toHaveLength(0);
  });
});
