import type { User } from "@/server/domain/entities";

/** Données publiques d'un utilisateur (sans hash ni email). */
export function publicUser(u: User) {
  const { passwordHash, email, ...rest } = u;
  void passwordHash; void email;
  return rest;
}

/** Données de l'utilisateur courant (sans hash, email conservé). */
export function selfUser(u: User) {
  const { passwordHash, ...rest } = u;
  void passwordHash;
  return rest;
}
