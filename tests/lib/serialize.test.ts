import { describe, it, expect } from "vitest";
import { selfUser, publicUser } from "@/lib/serialize";
import type { User } from "@/server/domain/entities";

const u: User = {
  id: "u1", email: "a@x.io", passwordHash: "h", username: "a", displayName: "A",
  bio: null, avatarUrl: null, bannerUrl: null, activeTabs: ["films"],
  tastes: { filmGenreIds: [], people: [] }, showcase: { movie: [], tv: [], book: [] },
  plus: false, staff: false, private: false, twoFactorEnabled: true,
  twoFactorSecret: "ENCRYPTED", twoFactorBackupCodes: ["hash1"],
  deactivatedAt: null, notificationsSeenAt: null, tourCompletedAt: null, createdAt: new Date(),
  inviteCode: "XXXXXXXX", invitedBy: null,
};

describe("serialize n'expose pas les secrets 2FA", () => {
  it("selfUser retire secret + backup codes (et le hash)", () => {
    const s = selfUser(u) as Record<string, unknown>;
    expect(s.passwordHash).toBeUndefined();
    expect(s.twoFactorSecret).toBeUndefined();
    expect(s.twoFactorBackupCodes).toBeUndefined();
    expect(s.twoFactorEnabled).toBe(true); // l'état reste exposé
  });
  it("publicUser retire aussi email + secrets", () => {
    const p = publicUser(u) as Record<string, unknown>;
    expect(p.email).toBeUndefined();
    expect(p.twoFactorSecret).toBeUndefined();
    expect(p.twoFactorBackupCodes).toBeUndefined();
  });
});
