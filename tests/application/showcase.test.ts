import { describe, it, expect, beforeEach } from "vitest";
import { makeInMemoryDeps, type Deps } from "@/server/container";
import { FakeCatalog } from "../helpers/fake-catalog";
import { registerUser } from "@/server/application/register-user";
import { updateShowcase } from "@/server/application/showcase";
import { ValidationError } from "@/server/domain/errors";

const tastes = { filmGenreIds: [1, 2, 3], people: [] };
let deps: Deps; let me: string;
beforeEach(async () => {
  deps = makeInMemoryDeps(new FakeCatalog());
  me = (await registerUser(deps, { email: "me@x.io", username: "me", displayName: "Me", password: "password1", activeTabs: ["films", "books"], tastes })).id;
});

describe("updateShowcase", () => {
  it("enregistre et dédoublonne", async () => {
    const u = await updateShowcase(deps, me, { movie: ["a", "a", "b"], tv: [], book: ["x"] });
    expect(u.showcase.movie).toEqual(["a", "b"]);
    expect(u.showcase.book).toEqual(["x"]);
  });
  it("refuse plus de 5 dans une catégorie", async () => {
    await expect(updateShowcase(deps, me, { movie: ["1", "2", "3", "4", "5", "6"], tv: [], book: [] })).rejects.toThrow(ValidationError);
  });
});
