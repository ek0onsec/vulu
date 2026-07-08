import type { Deps } from "@/server/container";
import type { Domain, Tastes, User } from "@/server/domain/entities";
import { ConflictError, ValidationError } from "@/server/domain/errors";
import { generateUniqueInviteCode } from "./invite-code";

export interface RegisterInput {
  email: string;
  username: string;
  displayName: string;
  password: string;
  activeTabs: readonly Domain[];
  tastes: Tastes;
  invitedBy?: string | null;
}

export async function registerUser(deps: Deps, input: RegisterInput): Promise<User> {
  const email = input.email.trim().toLowerCase();
  const username = input.username.trim().toLowerCase();

  if (input.password.length < 8) throw new ValidationError("Mot de passe : 8 caractères minimum");
  if (input.activeTabs.length < 1) throw new ValidationError("Au moins un onglet doit être actif");
  if (input.tastes.filmGenreIds.length < 3) throw new ValidationError("Sélectionne au moins 3 genres");
  if (await deps.users.findByEmail(email)) throw new ConflictError("Cet email est déjà utilisé");
  if (await deps.users.findByUsername(username)) throw new ConflictError("Ce nom d'utilisateur est pris");

  const inviteCode = await generateUniqueInviteCode(deps);

  const user: User = {
    id: deps.ids.next(),
    email,
    passwordHash: await deps.hasher.hash(input.password),
    username,
    displayName: input.displayName.trim(),
    bio: null,
    avatarUrl: null,
    bannerUrl: null,
    activeTabs: [...input.activeTabs],
    tastes: input.tastes,
    showcase: { movie: [], tv: [], book: [] },
    plus: false,
    staff: false,
    private: false,
    twoFactorEnabled: false,
    twoFactorSecret: null,
    twoFactorBackupCodes: [],
    deactivatedAt: null,
    notificationsSeenAt: null,
    tourCompletedAt: null,
    createdAt: deps.clock.now(),
    inviteCode,
    invitedBy: input.invitedBy ?? null,
  };
  await deps.users.create(user);
  return user;
}

/**
 * Inscription conditionnée à un code d'invitation. Valide le code (fondateur ou code d'un
 * membre), résout le parrain, puis délègue à `registerUser`. La validation vit ici, à la
 * frontière applicative de l'inscription.
 */
export async function registerWithInvite(
  deps: Deps,
  input: RegisterInput & { inviteCode: string },
): Promise<User> {
  const code = input.inviteCode.trim().toUpperCase();
  if (!code) throw new ValidationError("Code d'invitation invalide");
  const isFounder = deps.founderCodes.has(code);
  const inviter = isFounder ? null : await deps.users.findByInviteCode(code);
  if (!isFounder && !inviter) throw new ValidationError("Code d'invitation invalide");
  return registerUser(deps, { ...input, invitedBy: inviter?.id ?? null });
}
