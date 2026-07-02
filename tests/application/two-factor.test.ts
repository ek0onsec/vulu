import { describe, it, expect, beforeEach } from "vitest";
import { authenticator } from "otplib";
import { makeInMemoryDeps, type Deps } from "@/server/container";
import { FakeCatalog } from "../helpers/fake-catalog";
import { registerUser } from "@/server/application/register-user";
import { AuthError } from "@/server/domain/errors";
import {
  beginTwoFactorSetup, confirmTwoFactorSetup, disableTwoFactor, completeTwoFactorLogin,
} from "@/server/application/two-factor";

let deps: Deps; let userId: string;
const tastes = { filmGenreIds: [1, 2, 3], people: [] };

beforeEach(async () => {
  deps = makeInMemoryDeps(new FakeCatalog());
  userId = (await registerUser(deps, { email: "me@x.io", username: "me", displayName: "Me", password: "password1", activeTabs: ["films"], tastes })).id;
});

async function enable(): Promise<string[]> {
  const { secret } = await beginTwoFactorSetup(deps, userId);
  const { backupCodes } = await confirmTwoFactorSetup(deps, userId, authenticator.generate(secret));
  return backupCodes;
}

describe("two-factor", () => {
  it("setup stocke un secret chiffré, enabled reste false", async () => {
    const { secret, keyUri, qrSvg } = await beginTwoFactorSetup(deps, userId);
    const u = (await deps.users.findById(userId))!;
    expect(u.twoFactorEnabled).toBe(false);
    expect(u.twoFactorSecret).not.toBeNull();
    expect(u.twoFactorSecret).not.toBe(secret); // chiffré
    expect(keyUri).toContain("otpauth://totp/");
    expect(qrSvg).toContain("<svg");
  });

  it("confirm avec code TOTP valide active la 2FA et renvoie 8 codes", async () => {
    const codes = await enable();
    expect(codes).toHaveLength(8);
    expect((await deps.users.findById(userId))!.twoFactorEnabled).toBe(true);
  });

  it("confirm avec code invalide échoue et laisse désactivé", async () => {
    await beginTwoFactorSetup(deps, userId);
    await expect(confirmTwoFactorSetup(deps, userId, "000000")).rejects.toThrow(AuthError);
    expect((await deps.users.findById(userId))!.twoFactorEnabled).toBe(false);
  });

  it("login: challenge + TOTP courant → token", async () => {
    const { secret } = await beginTwoFactorSetup(deps, userId);
    await confirmTwoFactorSetup(deps, userId, authenticator.generate(secret));
    const challenge = await deps.tokens.issueChallenge(userId);
    const { token } = await completeTwoFactorLogin(deps, challenge, authenticator.generate(secret));
    expect(await deps.tokens.verify(token)).toEqual({ userId });
  });

  it("login: code de secours accepté une fois, refusé ensuite", async () => {
    const codes = await enable();
    const challenge = await deps.tokens.issueChallenge(userId);
    await expect(completeTwoFactorLogin(deps, challenge, codes[0]!)).resolves.toHaveProperty("token");
    const challenge2 = await deps.tokens.issueChallenge(userId);
    await expect(completeTwoFactorLogin(deps, challenge2, codes[0]!)).rejects.toThrow(AuthError);
  });

  it("login: challenge invalide → AuthError", async () => {
    await enable();
    await expect(completeTwoFactorLogin(deps, "pas-un-token", "000000")).rejects.toThrow(AuthError);
  });

  it("disable: bon mot de passe efface tout ; mauvais → AuthError", async () => {
    await enable();
    await expect(disableTwoFactor(deps, userId, "mauvais")).rejects.toThrow(AuthError);
    await disableTwoFactor(deps, userId, "password1");
    const u = (await deps.users.findById(userId))!;
    expect(u.twoFactorEnabled).toBe(false);
    expect(u.twoFactorSecret).toBeNull();
    expect(u.twoFactorBackupCodes).toEqual([]);
  });
});
