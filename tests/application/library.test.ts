import { describe, it, expect, beforeEach } from "vitest";
import { makeInMemoryDeps, type Deps } from "@/server/container";
import { FakeCatalog } from "../helpers/fake-catalog";
import { registerUser } from "@/server/application/register-user";
import { setEntryStatus, rateOrReviewWork } from "@/server/application/library-entry";
import { createList, addWorkToList } from "@/server/application/lists";
import { getLibrary } from "@/server/application/library";

const tastes = { filmGenreIds: [1, 2, 3], people: [] };
const film = { source: "tmdb" as const, externalId: "603", type: "movie" as const };
const book = { source: "googlebooks" as const, externalId: "book-1", type: "book" as const };

let deps: Deps; let me: string;
beforeEach(async () => {
  deps = makeInMemoryDeps(new FakeCatalog());
  me = (await registerUser(deps, { email: "me@x.io", username: "me", displayName: "Me", password: "password1", activeTabs: ["films", "books"], tastes })).id;
});

describe("getLibrary", () => {
  it("agrège watchlist, vus/lus et playlists avec couvertures", async () => {
    await setEntryStatus(deps, me, book, "planned");
    await rateOrReviewWork(deps, me, film, { rating: 4, text: null, visibility: "public" });
    const l = await createList(deps, me, { name: "Mix", kind: "films", description: null, visibility: "public" });
    await addWorkToList(deps, me, l.id, film);

    const lib = await getLibrary(deps, me);
    expect(lib.watchlist.map((w) => w.type)).toEqual(["book"]);
    expect(lib.seen.map((w) => w.type)).toEqual(["movie"]);
    expect(lib.playlists[0]?.count).toBe(1);
    expect(lib.playlists[0]?.covers.length).toBe(1);
  });
});
