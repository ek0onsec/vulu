import type { Deps } from "@/server/container";
import type { Crypto } from "@/server/ports/security";
import { AuthError, NotFoundError, ValidationError } from "@/server/domain/errors";
import { qrSvgFromUri } from "@/lib/qr";

const ISSUER = "vulu";
const BACKUP_CODE_COUNT = 8;
const BACKUP_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // sans 0/O/1/I ambigus

/** Code de secours au format XXXX-XXXX, tiré d'une source aléatoire cryptographiquement sûre. */
function randomBackupCode(crypto: Crypto): string {
  const pick = (n: number) =>
    Array.from({ length: n }, () => BACKUP_ALPHABET[crypto.randomInt(BACKUP_ALPHABET.length)]).join("");
  return `${pick(4)}-${pick(4)}`;
}

/** Normalise un code saisi (espaces/tirets, casse) avant vérification ou hachage. */
function normalizeCode(code: string): string {
  return code.replace(/[\s-]/g, "").toUpperCase();
}

async function loadUser(deps: Deps, userId: string) {
  const user = await deps.users.findById(userId);
  if (!user) throw new NotFoundError("Utilisateur introuvable");
  return user;
}

/** Démarre la configuration : génère un secret, le chiffre, renvoie l'URI + QR. La 2FA reste inactive. */
export async function beginTwoFactorSetup(
  deps: Deps,
  userId: string,
): Promise<{ keyUri: string; secret: string; qrSvg: string }> {
  const user = await loadUser(deps, userId);
  const secret = deps.totp.generateSecret();
  const keyUri = deps.totp.keyUri(secret, user.username, ISSUER);
  await deps.users.update({ ...user, twoFactorSecret: deps.crypto.encrypt(secret) });
  return { keyUri, secret, qrSvg: await qrSvgFromUri(keyUri) };
}

/** Confirme la configuration avec un code TOTP valide : active la 2FA et renvoie les codes de secours (en clair, une seule fois). */
export async function confirmTwoFactorSetup(
  deps: Deps,
  userId: string,
  code: string,
): Promise<{ backupCodes: string[] }> {
  const user = await loadUser(deps, userId);
  if (!user.twoFactorSecret) throw new ValidationError("Aucune configuration 2FA en attente");
  const secret = deps.crypto.decrypt(user.twoFactorSecret);
  if (!deps.totp.verify(normalizeCode(code), secret)) throw new AuthError("Code invalide");
  const backupCodes = Array.from({ length: BACKUP_CODE_COUNT }, () => randomBackupCode(deps.crypto));
  await deps.users.update({
    ...user,
    twoFactorEnabled: true,
    twoFactorBackupCodes: backupCodes.map((c) => deps.crypto.hash(normalizeCode(c))),
  });
  return { backupCodes };
}

/** Désactive la 2FA après revérification du mot de passe ; efface secret et codes. */
export async function disableTwoFactor(deps: Deps, userId: string, password: string): Promise<void> {
  const user = await loadUser(deps, userId);
  if (!(await deps.hasher.verify(password, user.passwordHash))) throw new AuthError("Mot de passe invalide");
  await deps.users.update({ ...user, twoFactorEnabled: false, twoFactorSecret: null, twoFactorBackupCodes: [] });
}

/** Deuxième étape du login : valide le challenge puis un code TOTP ou de secours ; renvoie le token de session. */
export async function completeTwoFactorLogin(
  deps: Deps,
  challenge: string,
  code: string,
): Promise<{ token: string }> {
  const payload = await deps.tokens.verifyChallenge(challenge);
  if (!payload) throw new AuthError("Session de vérification expirée");
  const user = await loadUser(deps, payload.userId);
  if (!user.twoFactorEnabled || !user.twoFactorSecret) throw new AuthError("2FA non configurée");

  const normalized = normalizeCode(code);
  const totpOk = deps.totp.verify(normalized, deps.crypto.decrypt(user.twoFactorSecret));
  if (!totpOk) {
    const hash = deps.crypto.hash(normalized);
    if (!user.twoFactorBackupCodes.includes(hash)) throw new AuthError("Code invalide");
    // code de secours à usage unique : on le retire
    await deps.users.update({
      ...user,
      twoFactorBackupCodes: user.twoFactorBackupCodes.filter((h) => h !== hash),
    });
  }
  return { token: await deps.tokens.issue({ userId: user.id }) };
}
