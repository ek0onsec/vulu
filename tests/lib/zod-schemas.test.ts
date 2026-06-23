import { describe, it, expect } from "vitest";
import { rateSchema, userSearchSchema, checkAccountSchema } from "@/lib/zod-schemas";

const ref = { source: "tmdb", externalId: "603", type: "movie" } as const;

describe("rateSchema", () => {
  // Garde-fou : zod retire les clés inconnues. Si audiences n'est pas déclaré, les
  // destinations de partage sont silencieusement perdues à la frontière HTTP.
  it("conserve audiences (public + cercle + communautés)", () => {
    const out = rateSchema.parse({
      ref, rating: 4, text: "top",
      audiences: { public: true, circle: false, communityIds: ["c-1"] },
    });
    expect(out.audiences).toEqual({ public: true, circle: false, communityIds: ["c-1"] });
  });

  it("accepte communityIds vide (partage hors communauté)", () => {
    const out = rateSchema.parse({
      ref, rating: 4, text: "top",
      audiences: { public: false, circle: true, communityIds: [] },
    });
    expect(out.audiences.communityIds).toEqual([]);
  });

  it("rejette un audiences mal typé", () => {
    expect(() => rateSchema.parse({
      ref, rating: 4, text: "top",
      audiences: { public: "yes", circle: true, communityIds: [] },
    })).toThrow();
  });
});

describe("userSearchSchema", () => {
  it("exige q (1–50 caractères)", () => {
    expect(userSearchSchema.parse({ q: "tom" }).q).toBe("tom");
    expect(() => userSearchSchema.parse({ q: "" })).toThrow();
    expect(() => userSearchSchema.parse({ q: "x".repeat(51) })).toThrow();
  });
});

describe("checkAccountSchema", () => {
  it("accepte un pseudo et un email valides", () => {
    expect(checkAccountSchema.parse({ u: "tom_92", e: "a@x.io" })).toEqual({ u: "tom_92", e: "a@x.io" });
  });
  it("rejette un pseudo trop court ou un email invalide", () => {
    expect(() => checkAccountSchema.parse({ u: "ab", e: "a@x.io" })).toThrow();
    expect(() => checkAccountSchema.parse({ u: "tom_92", e: "pas-un-email" })).toThrow();
  });
});
