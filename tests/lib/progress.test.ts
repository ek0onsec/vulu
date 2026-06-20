import { describe, it, expect } from "vitest";
import { formatProgress, activityVerb } from "@/lib/progress";

describe("formatProgress", () => {
  it("série avec total connu", () => {
    expect(formatProgress({ progress: { season: 1, episode: 5, tome: null, page: null } },
      { type: "tv", episodeCounts: [7, 13], pageCount: null })).toBe("S1 E5/7");
  });
  it("série sans total", () => {
    expect(formatProgress({ progress: { season: 2, episode: 3, tome: null, page: null } },
      { type: "tv", episodeCounts: null, pageCount: null })).toBe("S2 E3");
  });
  it("livre tome + page avec total", () => {
    expect(formatProgress({ progress: { season: null, episode: null, tome: 3, page: 120 } },
      { type: "book", episodeCounts: null, pageCount: 480 })).toBe("Tome 3 · p.120/480");
  });
  it("null si pas de progression", () => {
    expect(formatProgress({ progress: null }, { type: "movie", episodeCounts: null, pageCount: null })).toBeNull();
  });
});

describe("activityVerb", () => {
  it("in_progress", () => {
    expect(activityVerb("in_progress", "tv")).toBe("regarde");
    expect(activityVerb("in_progress", "book")).toBe("lit");
    expect(activityVerb("done", "tv")).toBeNull();
  });
});
