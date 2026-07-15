import { describe, it, expect } from "vitest";
import { InMemoryEpisodeEntryRepository, InMemoryLikeRepository, InMemoryCommentRepository } from "@/server/adapters/memory";
import { LocalDiskStorage } from "@/server/adapters/media/local-disk-storage";
import { tmpdir } from "node:os";
import { join } from "node:path";

describe("listByUser", () => {
  it("épisodes : ne renvoie que ceux de l'utilisateur", async () => {
    const repo = new InMemoryEpisodeEntryRepository();
    const base = { watched: true, watchedAt: null, rating: null, text: null, audiences: { public: false, circle: false, communityIds: [] }, activityAt: null, createdAt: new Date(), updatedAt: new Date() };
    await repo.upsert({ id: "e1", userId: "u1", workId: "w", season: 1, episode: 1, ...base });
    await repo.upsert({ id: "e2", userId: "u2", workId: "w", season: 1, episode: 1, ...base });
    expect((await repo.listByUser("u1")).map((e) => e.id)).toEqual(["e1"]);
  });
  it("likes : ne renvoie que ceux de l'utilisateur", async () => {
    const repo = new InMemoryLikeRepository();
    await repo.add({ entryId: "a", userId: "u1", createdAt: new Date() });
    await repo.add({ entryId: "b", userId: "u2", createdAt: new Date() });
    expect((await repo.listByUser("u1")).map((l) => l.entryId)).toEqual(["a"]);
  });
  it("commentaires : ne renvoie que ceux de l'utilisateur", async () => {
    const repo = new InMemoryCommentRepository();
    await repo.add({ id: "c1", entryId: "a", userId: "u1", text: "hi", createdAt: new Date() });
    await repo.add({ id: "c2", entryId: "a", userId: "u2", text: "yo", createdAt: new Date() });
    expect((await repo.listByUser("u1")).map((c) => c.id)).toEqual(["c1"]);
  });
  it("media.load : relit les octets écrits, null si absent", async () => {
    const media = new LocalDiskStorage(join(tmpdir(), "vulu-export-test"));
    const url = await media.save(new Uint8Array([1, 2, 3]), "jpg");
    expect([...(await media.load(url))!]).toEqual([1, 2, 3]);
    expect(await media.load("/uploads/inexistant.jpg")).toBeNull();
  });
});
