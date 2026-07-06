import { describe, it, expect } from "vitest";
import { deriveSeriesStatus } from "@/server/application/series-status";

describe("deriveSeriesStatus", () => {
  it("aucun coché → planned", () => { expect(deriveSeriesStatus(null, [7, 13])).toBe("planned"); expect(deriveSeriesStatus([[], []], [7, 13])).toBe("planned"); });
  it("partiel → in_progress", () => { expect(deriveSeriesStatus([[1, 2, 3], []], [7, 13])).toBe("in_progress"); });
  it("tous cochés → done", () => { expect(deriveSeriesStatus([[1, 2, 3, 4, 5, 6, 7], [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13]], [7, 13])).toBe("done"); });
  it("episodeCounts inconnu + coché → in_progress (jamais done)", () => { expect(deriveSeriesStatus([[1, 2]], null)).toBe("in_progress"); });
});
