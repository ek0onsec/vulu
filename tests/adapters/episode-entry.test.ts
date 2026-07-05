import { describe, it, expect } from "vitest";
import { InMemoryEpisodeEntryRepository } from "@/server/adapters/memory";
import type { EpisodeEntry } from "@/server/domain/entities";

const mk = (season: number, episode: number): EpisodeEntry => ({
  id: `${season}-${episode}`, userId: "u1", workId: "w1", season, episode,
  watched: true, watchedAt: new Date("2026-07-01T00:00:00Z"), rating: 4, text: "top",
  createdAt: new Date(0), updatedAt: new Date(0),
});

describe("InMemoryEpisodeEntryRepository", () => {
  it("upsert / findOne / listByUserAndWork", async () => {
    const repo = new InMemoryEpisodeEntryRepository();
    expect(await repo.findOne("u1", "w1", 1, 1)).toBeNull();
    await repo.upsert(mk(1, 1));
    await repo.upsert(mk(1, 2));
    expect((await repo.findOne("u1", "w1", 1, 2))?.rating).toBe(4);
    expect(await repo.listByUserAndWork("u1", "w1")).toHaveLength(2);
    expect(await repo.listByUserAndWork("u2", "w1")).toHaveLength(0);
  });
});
