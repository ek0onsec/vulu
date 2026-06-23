import { describe, it, expect, beforeEach } from "vitest";
import { makeInMemoryDeps, type Deps } from "@/server/container";
import { FakeCatalog } from "../helpers/fake-catalog";
import { registerUser } from "@/server/application/register-user";
import { rateOrReviewWork } from "@/server/application/library-entry";
import { followUser } from "@/server/application/social";
import { discover } from "@/server/application/discover";

const tastes = { filmGenreIds: [1, 2, 3], people: [] };
const ref = { source: "tmdb" as const, externalId: "603", type: "movie" as const };

let deps: Deps; let me: string; let alice: string;
beforeEach(async () => {
  deps = makeInMemoryDeps(new FakeCatalog());
  me = (await registerUser(deps, { email: "me@x.io", username: "me", displayName: "Me", password: "password1", activeTabs: ["films"], tastes })).id;
  alice = (await registerUser(deps, { email: "a@x.io", username: "alice", displayName: "Alice", password: "password1", activeTabs: ["films"], tastes })).id;
});

describe("discover", () => {
  it("suggère les utilisateurs non suivis (hors soi)", async () => {
    const res = await discover(deps, me);
    expect(res.suggestions.map((s) => s.id)).toContain(alice);
    expect(res.suggestions.map((s) => s.id)).not.toContain(me);
  });
  it("exclut les déjà suivis", async () => {
    await followUser(deps, me, alice);
    const res = await discover(deps, me);
    expect(res.suggestions.map((s) => s.id)).not.toContain(alice);
  });
  it("classe les tendances par nombre d'avis publics", async () => {
    await rateOrReviewWork(deps, alice, ref, { rating: 5, text: "top", audiences: { public: true, circle: true, communityIds: [] } });
    const res = await discover(deps, me);
    expect(res.trending[0]?.work.title).toBe("The Matrix");
    expect(res.trending[0]?.reviews).toBe(1);
  });
});
