import { describe, it, expect } from "vitest";
import { InMemoryEpisodeCache } from "@/server/adapters/memory";
import type { SeasonEpisodes } from "@/server/domain/entities";

const sample: SeasonEpisodes = {
  source: "tmdb", externalId: "1396", season: 1,
  episodes: [{ number: 1, title: "Pilote", airDate: "2008-01-20", overview: "Walter…" }],
  cachedAt: new Date("2026-07-01T00:00:00Z"),
};

describe("InMemoryEpisodeCache", () => {
  it("upsert puis find par (source, externalId, season)", async () => {
    const repo = new InMemoryEpisodeCache();
    expect(await repo.find("tmdb", "1396", 1)).toBeNull();
    await repo.upsert(sample);
    const found = await repo.find("tmdb", "1396", 1);
    expect(found?.episodes[0]?.title).toBe("Pilote");
    expect(await repo.find("tmdb", "1396", 2)).toBeNull();
  });
});
