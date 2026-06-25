import type { User } from "@/server/domain/entities";

/** Données publiques d'un utilisateur (sans hash ni email). */
export function publicUser(u: User) {
  const { passwordHash, email, twoFactorSecret, twoFactorBackupCodes, ...rest } = u;
  void passwordHash; void email; void twoFactorSecret; void twoFactorBackupCodes;
  return rest;
}

/** Données de l'utilisateur courant (sans hash ni secrets 2FA ; email conservé). */
export function selfUser(u: User) {
  const { passwordHash, twoFactorSecret, twoFactorBackupCodes, ...rest } = u;
  void passwordHash; void twoFactorSecret; void twoFactorBackupCodes;
  return rest;
}
