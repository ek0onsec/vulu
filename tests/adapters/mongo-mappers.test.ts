import { describe, it, expect } from "vitest";
import { toUserDoc, fromUserDoc, toEntryDoc, fromEntryDoc } from "@/server/adapters/mongo/mappers";
import type { User, LibraryEntry } from "@/server/domain/entities";

const user: User = { id: "u1", email: "a@x.io", passwordHash: "h", username: "alice",
  displayName: "Alice", bio: null, avatarUrl: null, bannerUrl: null, activeTabs: ["films"],
  tastes: { filmGenreIds: [1, 2, 3], people: [] }, plus: false, staff: false, private: false, twoFactorEnabled: false, deactivatedAt: null, notificationsSeenAt: null, createdAt: new Date("2024-01-01") };
const entry: LibraryEntry = { id: "e1", userId: "u1", workId: "w1", domain: "films",
  status: "done", rating: 4.2, text: "top", visibility: "public",
  createdAt: new Date("2024-01-02"), updatedAt: new Date("2024-01-03") };

describe("mongo mappers", () => {
  it("user round-trip", () => { expect(fromUserDoc(toUserDoc(user))).toEqual(user); });
  it("entry round-trip", () => { expect(fromEntryDoc(toEntryDoc(entry))).toEqual(entry); });
  it("user doc utilise _id = id", () => { expect(toUserDoc(user)._id).toBe("u1"); });
});
