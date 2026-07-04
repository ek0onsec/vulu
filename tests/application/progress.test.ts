import { describe, it, expect, beforeEach } from "vitest";
import { makeInMemoryDeps, type Deps } from "@/server/container";
import { FakeCatalog } from "../helpers/fake-catalog";
import { updateProgress, shareMilestone } from "@/server/application/library-entry";
import { ValidationError, ForbiddenError } from "@/server/domain/errors";

let deps: Deps;
const tv = { source: "tmdb" as const, externalId: "1396", type: "tv" as const };
const book = { source: "googlebooks" as const, externalId: "book-1", type: "book" as const };
const movie = { source: "tmdb" as const, externalId: "603", type: "movie" as const };
beforeEach(() => { deps = makeInMemoryDeps(new FakeCatalog()); });

describe("updateProgress", () => {
  it("série : enregistre saison/épisode et passe en in_progress sans activityAt", async () => {
    const e = await updateProgress(deps, "u1", tv, { season: 1, episode: 5 });
    expect(e.status).toBe("in_progress");
    expect(e.progress).toEqual({ season: 1, episode: 5, tome: null, page: null, watchedEpisodes: [[5]] });
    expect(e.activityAt).toBeNull();
  });
  it("livre : enregistre tome/page", async () => {
    const e = await updateProgress(deps, "u1", book, { tome: 3, page: 120 });
    expect(e.progress).toEqual({ season: null, episode: null, tome: 3, page: 120, watchedEpisodes: null });
  });
  it("film : in_progress sans détail (progress null)", async () => {
    const e = await updateProgress(deps, "u1", movie, {});
    expect(e.status).toBe("in_progress");
    expect(e.progress).toBeNull();
  });
  it("clampe l'épisode au total connu de la saison", async () => {
    const e = await updateProgress(deps, "u1", tv, { season: 1, episode: 99 });
    expect(e.progress?.episode).toBe(7); // saison 1 = 7 épisodes
  });
  it("clampe la page au pageCount connu", async () => {
    const e = await updateProgress(deps, "u1", book, { page: 9999 });
    expect(e.progress?.page).toBe(271);
  });
  it("rejette un nombre < 1", async () => {
    await expect(updateProgress(deps, "u1", tv, { season: 0, episode: 1 })).rejects.toThrow(ValidationError);
  });
  it("série grille : stocke watchedEpisodes normalisé (trié, dédoublonné, borné)", async () => {
    const e = await updateProgress(deps, "u1", tv, { watchedEpisodes: [[3, 1, 1, 2, 99], [5]] });
    // saison 1 = 7 épisodes → 99 filtré ; saison 2 = 13 épisodes → 5 gardé
    expect(e.progress?.watchedEpisodes).toEqual([[1, 2, 3], [5]]);
  });
  it("série grille : season/episode dérivés = saison la plus avancée + max épisode (coche libre)", async () => {
    const e = await updateProgress(deps, "u1", tv, { watchedEpisodes: [[1, 2], [5]] });
    expect(e.progress?.season).toBe(2);
    expect(e.progress?.episode).toBe(5); // coche libre : S2E5 sans S2E1-4
  });
  it("série grille vide : position nulle, watchedEpisodes null", async () => {
    const e = await updateProgress(deps, "u1", tv, { watchedEpisodes: [[], []] });
    expect(e.progress?.watchedEpisodes).toBeNull();
    expect(e.progress?.season).toBeNull();
    expect(e.progress?.episode).toBeNull();
  });
  it("chemin legacy (+1 épisode shelf) : ajoute l'épisode à la grille et recalcule", async () => {
    const first = await updateProgress(deps, "u1", tv, { season: 1, episode: 3 });
    expect(first.progress?.watchedEpisodes).toEqual([[3]]);
    const next = await updateProgress(deps, "u1", tv, { season: 1, episode: 4 });
    expect(next.progress?.watchedEpisodes).toEqual([[3, 4]]);
    expect(next.progress?.episode).toBe(4);
  });
});

describe("jalons", () => {
  it("shareMilestone pose activityAt (l'entrée devient visible dans le feed)", async () => {
    const e = await updateProgress(deps, "u1", tv, { season: 2, episode: 4 });
    expect(e.activityAt).toBeNull();
    const shared = await shareMilestone(deps, "u1", e.id);
    expect(shared.activityAt).not.toBeNull();
  });
  it("shareMilestone refuse un non-propriétaire", async () => {
    const e = await updateProgress(deps, "u1", tv, { season: 1, episode: 1 });
    await expect(shareMilestone(deps, "u2", e.id)).rejects.toThrow(ForbiddenError);
  });
});
