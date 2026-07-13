import { describe, it, expect, beforeEach } from "vitest";
import { makeInMemoryDeps, type Deps } from "@/server/container";
import { FakeCatalog } from "../helpers/fake-catalog";
import { registerUser } from "@/server/application/register-user";
import { updateEpisode } from "@/server/application/episode-entry";
import { likeEntry, commentOnEntry, listComments } from "@/server/application/engagement";
import { ForbiddenError } from "@/server/domain/errors";

const tv = { source: "tmdb" as const, externalId: "1396", type: "tv" as const };
const tastes = { filmGenreIds: [878, 18, 35], people: [] };
let deps: Deps; let author: string; let other: string;
beforeEach(async () => {
  deps = makeInMemoryDeps(new FakeCatalog());
  author = (await registerUser(deps, { email: "a@x.io", username: "author", displayName: "A", password: "password1", activeTabs: ["films"], tastes })).id;
  other = (await registerUser(deps, { email: "o@x.io", username: "other", displayName: "O", password: "password1", activeTabs: ["films"], tastes })).id;
});

describe("engagement sur un avis d'épisode", () => {
  async function sharedEpisode() {
    await updateEpisode(deps, author, tv, 1, 1, { rating: 4 });
    const e = await updateEpisode(deps, author, tv, 1, 1, { audiences: { public: true, circle: false, communityIds: [] } });
    return e.id;
  }
  it("like + commentaire d'un avis d'épisode public par un autre", async () => {
    const id = await sharedEpisode();
    await likeEntry(deps, other, id);
    await commentOnEntry(deps, other, id, "super épisode");
    expect(await deps.likes.countByEntry(id)).toBe(1);
    const comments = await listComments(deps, other, id);
    expect(comments.map((c) => c.text)).toContain("super épisode");
  });
  it("refuse like/commentaire sur un avis d'épisode privé d'un autre", async () => {
    await updateEpisode(deps, author, tv, 1, 2, { rating: 4 }); // non partagé (activityAt null)
    const priv = await deps.episodeEntries.findOne(author, (await deps.works.findByExternal("tmdb", "1396", "tv"))!.id, 1, 2);
    await expect(likeEntry(deps, other, priv!.id)).rejects.toBeInstanceOf(ForbiddenError);
  });
});
