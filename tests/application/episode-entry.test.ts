import { describe, it, expect, beforeEach } from "vitest";
import { makeInMemoryDeps, type Deps } from "@/server/container";
import { FakeCatalog } from "../helpers/fake-catalog";
import { updateEpisode, getEpisodeEntries } from "@/server/application/episode-entry";
import { ValidationError } from "@/server/domain/errors";

const tv = { source: "tmdb" as const, externalId: "1396", type: "tv" as const };
let deps: Deps;
beforeEach(() => { deps = makeInMemoryDeps(new FakeCatalog()); });

async function workId() {
  const { getOrImportWork } = await import("@/server/application/get-work");
  return (await getOrImportWork(deps, tv)).id;
}

describe("updateEpisode", () => {
  it("coche vu → watchedAt auto, LibraryEntry in_progress, progress dérivé", async () => {
    const e = await updateEpisode(deps, "u1", tv, 1, 3, { watched: true });
    expect(e.watched).toBe(true);
    expect(e.watchedAt).not.toBeNull();
    const lib = await deps.entries.findByUserAndWork("u1", await workId());
    expect(lib?.status).toBe("in_progress");
    expect(lib?.progress?.watchedEpisodes).toEqual([[3]]);
    expect(lib?.progress?.season).toBe(1);
    expect(lib?.progress?.episode).toBe(3);
  });
  it("décoche → watchedAt null, grille recalculée", async () => {
    await updateEpisode(deps, "u1", tv, 1, 3, { watched: true });
    const e = await updateEpisode(deps, "u1", tv, 1, 3, { watched: false });
    expect(e.watchedAt).toBeNull();
    const lib = await deps.entries.findByUserAndWork("u1", await workId());
    expect(lib?.progress?.watchedEpisodes).toBeNull();
  });
  it("watchedAt fourni respecté", async () => {
    const d = new Date("2008-01-20T00:00:00Z");
    const e = await updateEpisode(deps, "u1", tv, 1, 1, { watched: true, watchedAt: d });
    expect(e.watchedAt?.toISOString()).toBe(d.toISOString());
  });
  it("note et commentaire persistés, autres champs inchangés", async () => {
    await updateEpisode(deps, "u1", tv, 1, 1, { watched: true });
    const e = await updateEpisode(deps, "u1", tv, 1, 1, { rating: 4.5, text: "  génial  " });
    expect(e.rating).toBe(4.5);
    expect(e.text).toBe("génial");
    expect(e.watched).toBe(true); // inchangé
  });
  it("rejette saison/épisode < 1 et note invalide", async () => {
    await expect(updateEpisode(deps, "u1", tv, 0, 1, { watched: true })).rejects.toThrow(ValidationError);
    await expect(updateEpisode(deps, "u1", tv, 1, 1, { rating: 4.05 })).rejects.toThrow(ValidationError);
  });
  it("initialise audiences vides et activityAt null à la création", async () => {
    const e = await updateEpisode(deps, "u1", tv, 1, 1, { watched: true });
    expect(e.audiences).toEqual({ public: false, circle: false, communityIds: [] });
    expect(e.activityAt).toBeNull();
  });
  it("partage : audiences + activityAt posés (exige note ou texte)", async () => {
    await updateEpisode(deps, "u1", tv, 1, 1, { rating: 3.2 });
    const e = await updateEpisode(deps, "u1", tv, 1, 1, { audiences: { public: true, circle: false, communityIds: [] } });
    expect(e.audiences.public).toBe(true);
    expect(e.activityAt).not.toBeNull();
  });
  it("partage sans note ni texte → ValidationError", async () => {
    await expect(updateEpisode(deps, "u1", tv, 1, 2, { audiences: { public: true, circle: false, communityIds: [] } }))
      .rejects.toThrow(ValidationError);
  });
  it("« gardé pour moi » (aucune destination) → activityAt null", async () => {
    await updateEpisode(deps, "u1", tv, 1, 1, { rating: 3.2, audiences: { public: true, circle: false, communityIds: [] } });
    const e = await updateEpisode(deps, "u1", tv, 1, 1, { audiences: { public: false, circle: false, communityIds: [] } });
    expect(e.activityAt).toBeNull();
  });
  it("getEpisodeEntries renvoie les entrées de l'utilisateur", async () => {
    await updateEpisode(deps, "u1", tv, 1, 1, { watched: true });
    await updateEpisode(deps, "u1", tv, 1, 2, { watched: true });
    expect(await getEpisodeEntries(deps, "u1", await workId())).toHaveLength(2);
  });
});
