import { describe, it, expect, beforeEach } from "vitest";
import { makeInMemoryDeps, type Deps } from "@/server/container";
import { FakeCatalog } from "../helpers/fake-catalog";
import { importTvTime, runImportJob } from "@/server/application/import-tvtime";
import type { TvTimeExport } from "@/server/import/tvtime-parser";
import type { ImportJob } from "@/server/domain/entities";

let deps: Deps;
let fake: FakeCatalog;
const USER = "user-1";
beforeEach(() => {
  fake = new FakeCatalog();
  fake.tvdbToTmdb["999"] = "1396";
  deps = makeInMemoryDeps(fake);
});

const data: TvTimeExport = {
  series: [{ tvdbId: "999", name: "Breaking Bad", followedAt: null,
    watched: [{ season: 1, episode: 1, watchedAt: new Date("2020-01-01") }] }],
  movies: [{ name: "The Matrix", year: 1999, watchedAt: new Date("2021-03-03") }],
};

describe("progression et job", () => {
  it("importTvTime appelle onProgress avec des total corrects", async () => {
    const calls: { phase: string; done: number; total: number }[] = [];
    await importTvTime(deps, USER, data, (p) => { calls.push(p); });
    expect(calls.some((c) => c.phase === "series" && c.total === 1)).toBe(true);
    expect(calls.some((c) => c.phase === "movies" && c.total === 1)).toBe(true);
  });

  it("runImportJob fait passer le job à done avec un rapport", async () => {
    const now = deps.clock.now();
    const job: ImportJob = { id: "j1", userId: USER, status: "pending", phase: "series",
      done: 0, total: 1, report: null, error: null, createdAt: now, updatedAt: now };
    await deps.importJobs.create(job);
    await runImportJob(deps, "j1", USER, data);
    const done = await deps.importJobs.findById("j1");
    expect(done!.status).toBe("done");
    expect(done!.report!.moviesImported).toBe(1);
  });

  it("runImportJob marque error si le job n'existe pas au démarrage", async () => {
    // aucun job créé → le chargement initial échoue → pas de crash non géré
    await expect(runImportJob(deps, "absent", USER, data)).resolves.toBeUndefined();
  });
});
