import { describe, it, expect, beforeEach } from "vitest";
import { makeInMemoryDeps, type Deps } from "@/server/container";
import { FakeCatalog } from "../helpers/fake-catalog";
import { rateOrReviewWork } from "@/server/application/library-entry";
import { followUser } from "@/server/application/social";
import { computeTasteMatch } from "@/server/application/taste-match";
import type { User } from "@/server/domain/entities";

const matrix = { source: "tmdb" as const, externalId: "603", type: "movie" as const };
const book = { source: "googlebooks" as const, externalId: "book-1", type: "book" as const };
const bb = { source: "tmdb" as const, externalId: "1396", type: "tv" as const };
const PUBLIC = { public: true, circle: true, communityIds: [] as string[] };

let deps: Deps;

async function makeUser(id: string, isPrivate = false): Promise<User> {
  const u: User = {
    id, email: `${id}@x.io`, passwordHash: "h", username: id, displayName: id,
    bio: null, avatarUrl: null, bannerUrl: null, activeTabs: ["films"],
    tastes: { filmGenreIds: [1, 2, 3], people: [] }, showcase: { movie: [], tv: [], book: [] },
    plus: false, staff: false, private: isPrivate, twoFactorEnabled: false,
    deactivatedAt: null, notificationsSeenAt: null, createdAt: new Date(),
  };
  await deps.users.create(u);
  return u;
}

beforeEach(() => { deps = makeInMemoryDeps(new FakeCatalog()); });

describe("computeTasteMatch", () => {
  it("croise les notes des œuvres co-notées et calcule le score + sample", async () => {
    const viewer = await makeUser("viewer");
    const target = await makeUser("target");
    for (const ref of [matrix, book, bb]) {
      await rateOrReviewWork(deps, viewer.id, ref, { rating: 5, text: null, audiences: PUBLIC });
      await rateOrReviewWork(deps, target.id, ref, { rating: 5, text: null, audiences: PUBLIC });
    }
    const r = await computeTasteMatch(deps, viewer.id, target);
    expect(r.score).toBe(100);
    expect(r.overlap).toBe(3);
    expect(r.sample).toHaveLength(3);
    expect(r.sample[0]).toMatchObject({ title: expect.any(String), workId: expect.any(String) });
  });

  it("ignore les œuvres notées d'un seul côté", async () => {
    const viewer = await makeUser("viewer");
    const target = await makeUser("target");
    await rateOrReviewWork(deps, viewer.id, matrix, { rating: 5, text: null, audiences: PUBLIC });
    await rateOrReviewWork(deps, target.id, book, { rating: 5, text: null, audiences: PUBLIC });
    const r = await computeTasteMatch(deps, viewer.id, target);
    expect(r.overlap).toBe(0);
  });

  it("self → résultat neutre", async () => {
    const viewer = await makeUser("viewer");
    await rateOrReviewWork(deps, viewer.id, matrix, { rating: 5, text: null, audiences: PUBLIC });
    expect(await computeTasteMatch(deps, viewer.id, viewer)).toEqual({ score: 0, overlap: 0, sample: [] });
  });

  it("profil privé hors cercle → résultat neutre, aucune fuite", async () => {
    const viewer = await makeUser("viewer");
    const target = await makeUser("target", true); // privé, pas de follow mutuel
    for (const ref of [matrix, book, bb]) {
      await rateOrReviewWork(deps, viewer.id, ref, { rating: 5, text: null, audiences: PUBLIC });
      await rateOrReviewWork(deps, target.id, ref, { rating: 5, text: null, audiences: PUBLIC });
    }
    expect(await computeTasteMatch(deps, viewer.id, target)).toEqual({ score: 0, overlap: 0, sample: [] });
  });

  it("ne compte pas les notes non publiques de la cible hors cercle", async () => {
    const viewer = await makeUser("viewer");
    const target = await makeUser("target");
    const PRIVATE_AUDIENCE = { public: false, circle: true, communityIds: [] as string[] };
    await rateOrReviewWork(deps, viewer.id, matrix, { rating: 5, text: null, audiences: PUBLIC });
    await rateOrReviewWork(deps, target.id, matrix, { rating: 5, text: null, audiences: PRIVATE_AUDIENCE });
    const r = await computeTasteMatch(deps, viewer.id, target);
    expect(r.overlap).toBe(0);
  });

  it("compte les notes cercle-only de la cible si le viewer est dans le cercle", async () => {
    const viewer = await makeUser("viewer");
    const target = await makeUser("target");
    await followUser(deps, viewer.id, target.id); // viewer suit target → cercle
    const CIRCLE_ONLY = { public: false, circle: true, communityIds: [] as string[] };
    for (const ref of [matrix, book, bb]) {
      await rateOrReviewWork(deps, viewer.id, ref, { rating: 4, text: null, audiences: PUBLIC });
      await rateOrReviewWork(deps, target.id, ref, { rating: 4, text: null, audiences: CIRCLE_ONLY });
    }
    const r = await computeTasteMatch(deps, viewer.id, target);
    expect(r.overlap).toBe(3);
    expect(r.score).toBe(100);
  });
});
