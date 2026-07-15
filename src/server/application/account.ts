import type { Deps } from "@/server/container";
import type { User } from "@/server/domain/entities";
import { AuthError, ConflictError, NotFoundError, ValidationError } from "@/server/domain/errors";

export const DELETION_GRACE_MS = 48 * 60 * 60 * 1000;

const USERNAME_RE = /^[a-z0-9_]{3,20}$/i;

export async function changeUsername(deps: Deps, userId: string, raw: string, currentPassword: string): Promise<User> {
  const username = raw.trim().toLowerCase();
  if (!USERNAME_RE.test(username)) throw new ValidationError("Nom d'utilisateur invalide (3–20 caractères, lettres/chiffres/_)");
  const user = await deps.users.findById(userId);
  if (!user) throw new NotFoundError("Utilisateur introuvable");
  if (!(await deps.hasher.verify(currentPassword, user.passwordHash))) throw new AuthError("Mot de passe incorrect");
  if (username !== user.username) {
    const taken = await deps.users.findByUsername(username);
    if (taken) throw new ConflictError("Ce nom d'utilisateur est pris");
  }
  const updated: User = { ...user, username };
  await deps.users.update(updated);
  return updated;
}

export async function changeEmail(deps: Deps, userId: string, rawEmail: string, currentPassword: string): Promise<User> {
  const email = rawEmail.trim().toLowerCase();
  const user = await deps.users.findById(userId);
  if (!user) throw new NotFoundError("Utilisateur introuvable");
  if (!(await deps.hasher.verify(currentPassword, user.passwordHash))) throw new AuthError("Mot de passe incorrect");
  if (email !== user.email) {
    const taken = await deps.users.findByEmail(email);
    if (taken) throw new ConflictError("Cet email est déjà utilisé");
  }
  const updated: User = { ...user, email };
  await deps.users.update(updated);
  return updated;
}

export async function changePassword(deps: Deps, userId: string, currentPassword: string, newPassword: string): Promise<void> {
  if (newPassword.length < 8) throw new ValidationError("Mot de passe : 8 caractères minimum");
  const user = await deps.users.findById(userId);
  if (!user) throw new NotFoundError("Utilisateur introuvable");
  if (!(await deps.hasher.verify(currentPassword, user.passwordHash))) throw new AuthError("Mot de passe actuel incorrect");
  await deps.users.update({ ...user, passwordHash: await deps.hasher.hash(newPassword) });
}

/** Désactive le compte (suppression différée). Purge définitive après 48 h. */
export async function requestAccountDeletion(deps: Deps, userId: string): Promise<void> {
  const user = await deps.users.findById(userId);
  if (!user) throw new NotFoundError("Utilisateur introuvable");
  await deps.users.update({ ...user, deactivatedAt: deps.clock.now() });
}

export async function cancelAccountDeletion(deps: Deps, userId: string): Promise<User> {
  const user = await deps.users.findById(userId);
  if (!user) throw new NotFoundError("Utilisateur introuvable");
  const updated: User = { ...user, deactivatedAt: null };
  await deps.users.update(updated);
  return updated;
}

/** Suppression définitive : retire l'utilisateur et toutes ses données. */
export async function purgeUser(deps: Deps, userId: string): Promise<void> {
  await Promise.all([
    deps.entries.removeAllForUser(userId),
    deps.lists.removeAllForUser(userId),
    deps.likes.removeAllForUser(userId),
    deps.comments.removeAllForUser(userId),
    deps.follows.removeAllForUser(userId),
    deps.followRequests.removeAllForUser(userId),
  ]);
  await deps.users.remove(userId);
}
