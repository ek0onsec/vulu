import type { User } from "@/server/domain/entities";

/** Données publiques d'un utilisateur (sans hash, email, secrets 2FA ni données d'invitation). */
export function publicUser(u: User) {
  // inviteCode/invitedBy sont privés : exposer le code contournerait le gating à l'inscription,
  // et invitedBy révélerait le graphe de parrainage.
  const { passwordHash, email, twoFactorSecret, twoFactorBackupCodes, inviteCode, invitedBy, ...rest } = u;
  void passwordHash; void email; void twoFactorSecret; void twoFactorBackupCodes; void inviteCode; void invitedBy;
  return rest;
}

/** Données de l'utilisateur courant (sans hash ni secrets 2FA ; email conservé). */
export function selfUser(u: User) {
  const { passwordHash, twoFactorSecret, twoFactorBackupCodes, ...rest } = u;
  void passwordHash; void twoFactorSecret; void twoFactorBackupCodes;
  return rest;
}
