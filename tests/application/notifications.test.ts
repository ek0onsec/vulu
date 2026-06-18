import { describe, it, expect, beforeEach } from "vitest";
import { makeInMemoryDeps, type Deps } from "@/server/container";
import { FakeCatalog } from "../helpers/fake-catalog";
import { registerUser } from "@/server/application/register-user";
import { rateOrReviewWork } from "@/server/application/library-entry";
import { likeEntry, commentOnEntry } from "@/server/application/engagement";
import { followUser } from "@/server/application/social";
import { buildNotifications } from "@/server/application/notifications";

const tastes = { filmGenreIds: [1, 2, 3], people: [] };
const ref = { source: "tmdb" as const, externalId: "603", type: "movie" as const };
let deps: Deps; let me: string; let alice: string; let bob: string;

beforeEach(async () => {
  deps = makeInMemoryDeps(new FakeCatalog());
  me = (await registerUser(deps, { email: "me@x.io", username: "me", displayName: "Me", password: "password1", activeTabs: ["films"], tastes })).id;
  alice = (await registerUser(deps, { email: "a@x.io", username: "alice", displayName: "Alice", password: "password1", activeTabs: ["films"], tastes })).id;
  bob = (await registerUser(deps, { email: "b@x.io", username: "bob", displayName: "Bob", password: "password1", activeTabs: ["films"], tastes })).id;
});

describe("buildNotifications", () => {
  it("agrège likes/commentaires sur mon avis + nouveaux abonnés", async () => {
    const entry = await rateOrReviewWork(deps, me, ref, { rating: 4, text: "top", visibility: "public" });
    await likeEntry(deps, alice, entry.id);
    await likeEntry(deps, bob, entry.id);
    await commentOnEntry(deps, alice, entry.id, "d'accord");
    await followUser(deps, alice, me);

    const notifs = await buildNotifications(deps, me);
    const like = notifs.find((n) => n.kind === "like")!;
    expect(like.totalActors).toBe(2);
    expect(like.work?.title).toBe("The Matrix");
    expect(notifs.find((n) => n.kind === "comment")?.totalActors).toBe(1);
    expect(notifs.find((n) => n.kind === "follow")?.totalActors).toBe(1);
  });
  it("ignore mes propres likes/commentaires", async () => {
    const entry = await rateOrReviewWork(deps, me, ref, { rating: 4, text: "top", visibility: "public" });
    await likeEntry(deps, me, entry.id);
    expect(await buildNotifications(deps, me)).toHaveLength(0);
  });
});
