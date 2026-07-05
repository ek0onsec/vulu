import { describe, it, expect, beforeEach } from "vitest";
import { makeInMemoryDeps, type Deps } from "@/server/container";
import { FakeCatalog } from "../helpers/fake-catalog";
import { setEntryStatus, rateOrReviewWork, removeEntry } from "@/server/application/library-entry";
import { ValidationError, ForbiddenError } from "@/server/domain/errors";

let deps: Deps; const ref = { source: "tmdb" as const, externalId: "603", type: "movie" as const };
beforeEach(() => { deps = makeInMemoryDeps(new FakeCatalog()); });

describe("library entry", () => {
  it("setEntryStatus 'planned' crée une watchlist sans note, gardée pour soi (privée)", async () => {
    const e = await setEntryStatus(deps, "u1", ref, "planned");
    expect(e.status).toBe("planned");
    expect(e.rating).toBeNull();
    expect(e.audiences).toEqual({ public: false, circle: false, communityIds: [] });
  });
  it("rateOrReview pose completedAt = maintenant par défaut", async () => {
    const e = await rateOrReviewWork(deps, "u1", ref, { rating: 4, text: null, audiences: { public: false, circle: false, communityIds: [] } });
    expect(e.completedAt).not.toBeNull();
  });
  it("rateOrReview respecte un completedAt explicite", async () => {
    const d = new Date("2024-01-02T00:00:00.000Z");
    const e = await rateOrReviewWork(deps, "u1", ref, { rating: 4, text: null, completedAt: d, audiences: { public: false, circle: false, communityIds: [] } });
    expect(e.completedAt?.toISOString()).toBe(d.toISOString());
  });
  it("rateOrReview « gardé pour moi » : note enregistrée, audiences privées", async () => {
    const e = await rateOrReviewWork(deps, "u1", ref, { rating: 4, text: null, audiences: { public: false, circle: false, communityIds: [] } });
    expect(e.status).toBe("done");
    expect(e.rating).toBe(4);
    expect(e.audiences).toEqual({ public: false, circle: false, communityIds: [] });
  });
  it("rateOrReview force done et enregistre note + visibilité", async () => {
    const e = await rateOrReviewWork(deps, "u1", ref, { rating: 4.2, text: "top", audiences: { public: false, circle: true, communityIds: [] } });
    expect(e.status).toBe("done");
    expect(e.rating).toBe(4.2);
    expect(e.audiences).toEqual({ public: false, circle: true, communityIds: [] });
  });
  it("réutilise la même entrée (unicité user+work)", async () => {
    const a = await setEntryStatus(deps, "u1", ref, "planned");
    const b = await rateOrReviewWork(deps, "u1", ref, { rating: 3, text: null, audiences: { public: true, circle: true, communityIds: [] } });
    expect(b.id).toBe(a.id);
  });
  it("rejette une note hors bornes ou non multiple de 0,1", async () => {
    await expect(rateOrReviewWork(deps, "u1", ref, { rating: 5.5, text: null, audiences: { public: true, circle: true, communityIds: [] } })).rejects.toThrow(ValidationError);
    await expect(rateOrReviewWork(deps, "u1", ref, { rating: 2.73, text: null, audiences: { public: true, circle: true, communityIds: [] } })).rejects.toThrow(ValidationError);
  });
  it("rejette ni note ni texte", async () => {
    await expect(rateOrReviewWork(deps, "u1", ref, { rating: null, text: null, audiences: { public: true, circle: true, communityIds: [] } })).rejects.toThrow(ValidationError);
  });
  it("removeEntry interdit à un autre que le propriétaire", async () => {
    const e = await setEntryStatus(deps, "u1", ref, "planned");
    await expect(removeEntry(deps, "u2", e.id)).rejects.toThrow(ForbiddenError);
    await removeEntry(deps, "u1", e.id);
    expect(await deps.entries.findById(e.id)).toBeNull();
  });

  it("noter une série partiellement vue ne la passe pas en done", async () => {
    const tv = { source: "tmdb" as const, externalId: "1396", type: "tv" as const };
    const { updateEpisode } = await import("@/server/application/episode-entry");
    await updateEpisode(deps, "u1", tv, 1, 1, { watched: true }); // 1/20 → in_progress
    const e = await rateOrReviewWork(deps, "u1", tv, { rating: 5, text: null, audiences: { public: true, circle: true, communityIds: [] } });
    expect(e.status).toBe("in_progress");
    expect(e.rating).toBe(5);
  });
});
