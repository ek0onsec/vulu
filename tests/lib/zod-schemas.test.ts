import { describe, it, expect } from "vitest";
import { rateSchema } from "@/lib/zod-schemas";

const ref = { source: "tmdb", externalId: "603", type: "movie" } as const;

describe("rateSchema", () => {
  // Garde-fou : zod retire les clés inconnues. Si communityId n'est pas
  // déclaré, le partage en communauté est silencieusement perdu à la frontière HTTP.
  it("préserve communityId quand il est fourni", () => {
    const out = rateSchema.parse({ ref, rating: 4, text: "top", visibility: "public", communityId: "c-1" });
    expect(out.communityId).toBe("c-1");
  });

  it("accepte l'absence de communityId (partage hors communauté)", () => {
    const out = rateSchema.parse({ ref, rating: 4, text: "top", visibility: "circle" });
    expect(out.communityId ?? null).toBeNull();
  });

  it("accepte communityId null explicite", () => {
    const out = rateSchema.parse({ ref, rating: 4, text: "top", visibility: "public", communityId: null });
    expect(out.communityId).toBeNull();
  });
});
