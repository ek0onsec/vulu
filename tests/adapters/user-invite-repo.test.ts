import { describe, it, expect, beforeEach } from "vitest";
import { InMemoryUserRepository } from "@/server/adapters/memory";
import type { User } from "@/server/domain/entities";

function makeUser(over: Partial<User>): User {
  return {
    id: "u", email: "e", passwordHash: "h", username: "n", displayName: "N",
    bio: null, avatarUrl: null, bannerUrl: null, activeTabs: ["films"],
    tastes: { filmGenreIds: [], people: [] }, showcase: { movie: [], tv: [], book: [] },
    plus: false, staff: false, private: false, twoFactorEnabled: false,
    twoFactorSecret: null, twoFactorBackupCodes: [], deactivatedAt: null,
    notificationsSeenAt: null, tourCompletedAt: null, createdAt: new Date(),
    inviteCode: "AAAA1111", invitedBy: null, ...over,
  };
}

describe("InMemoryUserRepository invite methods", () => {
  let repo: InMemoryUserRepository;
  beforeEach(() => { repo = new InMemoryUserRepository(); });

  it("findByInviteCode retrouve l'utilisateur par son code", async () => {
    await repo.create(makeUser({ id: "u1", inviteCode: "CODE1234" }));
    expect((await repo.findByInviteCode("CODE1234"))?.id).toBe("u1");
    expect(await repo.findByInviteCode("NOPE0000")).toBeNull();
  });

  it("listByInviter liste les filleuls d'un parrain", async () => {
    await repo.create(makeUser({ id: "parrain", inviteCode: "PARRAIN1" }));
    await repo.create(makeUser({ id: "f1", email: "f1", username: "f1", inviteCode: "F1CODE22", invitedBy: "parrain" }));
    await repo.create(makeUser({ id: "f2", email: "f2", username: "f2", inviteCode: "F2CODE33", invitedBy: "parrain" }));
    await repo.create(makeUser({ id: "other", email: "o", username: "o", inviteCode: "OTHER444", invitedBy: null }));
    const filleuls = await repo.listByInviter("parrain");
    expect(filleuls.map((u) => u.id).sort()).toEqual(["f1", "f2"]);
  });
});
