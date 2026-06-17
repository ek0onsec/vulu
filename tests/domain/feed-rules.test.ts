import { describe, it, expect } from "vitest";
import { isPublishable } from "@/server/domain/feed-rules";
import type { LibraryEntry } from "@/server/domain/entities";

function entry(over: Partial<LibraryEntry>): LibraryEntry {
  return {
    id: "e1", userId: "u1", workId: "w1", domain: "films",
    status: "done", rating: 4, text: null, visibility: "public",
    createdAt: new Date(), updatedAt: new Date(), ...over,
  };
}

describe("isPublishable", () => {
  it("vraie si done + note", () => expect(isPublishable(entry({ rating: 4, text: null }))).toBe(true));
  it("vraie si done + commentaire", () => expect(isPublishable(entry({ rating: null, text: "top" }))).toBe(true));
  it("fausse si planned", () => expect(isPublishable(entry({ status: "planned", rating: null, text: null }))).toBe(false));
  it("fausse si done mais ni note ni texte", () => expect(isPublishable(entry({ status: "done", rating: null, text: null }))).toBe(false));
});
