import { describe, it, expect, beforeEach } from "vitest";
import { makeInMemoryDeps, type Deps } from "@/server/container";
import { FakeCatalog } from "../helpers/fake-catalog";
import { registerUser } from "@/server/application/register-user";
import { rateOrReviewWork } from "@/server/application/library-entry";
import { likeEntry, unlikeEntry, commentOnEntry, deleteComment, listComments } from "@/server/application/engagement";
import { ForbiddenError } from "@/server/domain/errors";

let deps: Deps; let me: string; let other: string;
const tastes = { filmGenreIds: [878, 18, 35], people: [] };
const ref = { source: "tmdb" as const, externalId: "603", type: "movie" as const };
beforeEach(async () => {
  deps = makeInMemoryDeps(new FakeCatalog());
  me = (await registerUser(deps, { email: "me@x.io", username: "me", displayName: "Me", password: "password1", activeTabs: ["films"], tastes })).id;
  other = (await registerUser(deps, { email: "o@x.io", username: "other", displayName: "O", password: "password1", activeTabs: ["films"], tastes })).id;
});

describe("engagement", () => {
  it("like public idempotent + unlike", async () => {
    const e = await rateOrReviewWork(deps, other, ref, { rating: 4, text: null, audiences: { public: true, circle: true, communityIds: [] } });
    await likeEntry(deps, me, e.id);
    await likeEntry(deps, me, e.id);
    expect(await deps.likes.countByEntry(e.id)).toBe(1);
    await unlikeEntry(deps, me, e.id);
    expect(await deps.likes.countByEntry(e.id)).toBe(0);
  });
  it("interdit de liker une entrée 'circle' d'un inconnu", async () => {
    const e = await rateOrReviewWork(deps, other, ref, { rating: 4, text: null, audiences: { public: false, circle: true, communityIds: [] } });
    await expect(likeEntry(deps, me, e.id)).rejects.toThrow(ForbiddenError);
  });
  it("commente puis liste", async () => {
    const e = await rateOrReviewWork(deps, other, ref, { rating: 4, text: null, audiences: { public: true, circle: true, communityIds: [] } });
    await commentOnEntry(deps, me, e.id, "bien vu");
    expect(await listComments(deps, me, e.id)).toHaveLength(1);
  });
  it("seul l'auteur supprime son commentaire", async () => {
    const e = await rateOrReviewWork(deps, other, ref, { rating: 4, text: null, audiences: { public: true, circle: true, communityIds: [] } });
    const c = await commentOnEntry(deps, me, e.id, "x");
    await expect(deleteComment(deps, other, c.id)).rejects.toThrow(ForbiddenError);
    await deleteComment(deps, me, c.id);
    expect(await listComments(deps, me, e.id)).toHaveLength(0);
  });
});
