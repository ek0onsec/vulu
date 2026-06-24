import { describe, it, expect } from "vitest";
import { tasteMatchScore } from "@/server/domain/taste-match";

describe("tasteMatchScore", () => {
  it("notes identiques → 100 %", () => {
    expect(tasteMatchScore([{ a: 4, b: 4 }, { a: 2, b: 2 }, { a: 5, b: 5 }])).toEqual({ score: 100, overlap: 3 });
  });
  it("écart maximal → 0 %", () => {
    expect(tasteMatchScore([{ a: 0, b: 5 }, { a: 5, b: 0 }])).toEqual({ score: 0, overlap: 2 });
  });
  it("arrondit la moyenne d'écart (0,65 → 87 %)", () => {
    // moyenne |a−b| = (1 + 0.6 + 0.35) / 3 = 0.65 → 100×(1−0.65/5) = 87
    expect(tasteMatchScore([{ a: 4, b: 3 }, { a: 4.6, b: 4 }, { a: 5, b: 4.65 }])).toEqual({ score: 87, overlap: 3 });
  });
  it("remonte l'overlap même sous le seuil de 3", () => {
    expect(tasteMatchScore([{ a: 4, b: 4 }])).toEqual({ score: 100, overlap: 1 });
  });
  it("liste vide → neutre sans division par zéro", () => {
    expect(tasteMatchScore([])).toEqual({ score: 0, overlap: 0 });
  });
});
