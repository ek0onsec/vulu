import { describe, it, expect } from "vitest";
import { InMemoryEpisodeEntryRepository } from "@/server/adapters/memory";
import type { EpisodeEntry, EntryAudiences } from "@/server/domain/entities";

const mk = (season: number, episode: number): EpisodeEntry => ({
  id: `${season}-${episode}`, userId: "u1", workId: "w1", season, episode,
  watched: true, watchedAt: new Date("2026-07-01T00:00:00Z"), rating: 4, text: "top",
  audiences: { public: false, circle: false, communityIds: [] }, activityAt: null,
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
  it("findById trouve par id ou renvoie null", async () => {
    const repo = new InMemoryEpisodeEntryRepository();
    await repo.upsert(mk(1, 1));
    expect((await repo.findById("1-1"))?.episode).toBe(1);
    expect(await repo.findById("absent")).toBeNull();
  });
});

const shared = (season: number, episode: number, audiences: EntryAudiences, activityAt: Date | null): EpisodeEntry => ({
  ...mk(season, episode), id: `${season}-${episode}`, audiences, activityAt,
});

describe("InMemoryEpisodeEntryRepository.feed", () => {
  const opts = { scope: "foryou" as const, circleUserIds: [], followingUserIds: [], viewerId: "v", cursor: null, limit: 20 };
  it("inclut public, ignore activityAt null et privé", async () => {
    const repo = new InMemoryEpisodeEntryRepository();
    await repo.upsert(shared(1, 1, { public: true, circle: false, communityIds: [] }, new Date(2)));
    await repo.upsert(shared(1, 2, { public: true, circle: false, communityIds: [] }, null));
    await repo.upsert(shared(1, 3, { public: false, circle: false, communityIds: [] }, new Date(1)));
    const res = await repo.feed(opts);
    expect(res.map((e) => e.episode)).toEqual([1]);
  });
});
