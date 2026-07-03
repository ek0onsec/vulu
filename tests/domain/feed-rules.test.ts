import { describe, it, expect } from "vitest";
import { isPublishable, isFeedVisible } from "@/server/domain/feed-rules";
import type { LibraryEntry } from "@/server/domain/entities";

function entry(over: Partial<LibraryEntry>): LibraryEntry {
  return {
    id: "e1", userId: "u1", workId: "w1", domain: "films",
    status: "done", rating: 4, text: null, audiences: { public: true, circle: true, communityIds: [] },
    completedAt: null, progress: null, activityAt: null, createdAt: new Date(), updatedAt: new Date(), ...over,
  };
}

describe("isPublishable", () => {
  it("vraie si done + note", () => expect(isPublishable(entry({ rating: 4, text: null }))).toBe(true));
  it("vraie si done + commentaire", () => expect(isPublishable(entry({ rating: null, text: "top" }))).toBe(true));
  it("fausse si planned", () => expect(isPublishable(entry({ status: "planned", rating: null, text: null }))).toBe(false));
  it("fausse si done mais ni note ni texte", () => expect(isPublishable(entry({ status: "done", rating: null, text: null }))).toBe(false));
});

describe("isFeedVisible", () => {
  it("vrai si activityAt est posé (avis ou jalon partagé)", () => {
    expect(isFeedVisible(entry({ status: "done", activityAt: new Date() }))).toBe(true);
    expect(isFeedVisible(entry({ status: "in_progress", rating: null, activityAt: new Date() }))).toBe(true);
  });
  it("faux si activityAt est null (jamais partagé)", () => {
    expect(isFeedVisible(entry({ status: "in_progress", rating: null, activityAt: null }))).toBe(false);
    expect(isFeedVisible(entry({ status: "planned", rating: null, activityAt: null }))).toBe(false);
  });
});
