import type { Deps } from "@/server/container";
import type { Domain, Tastes, User } from "@/server/domain/entities";
import { ConflictError, ValidationError } from "@/server/domain/errors";

export interface RegisterInput {
  email: string;
  username: string;
  displayName: string;
  password: string;
  activeTabs: readonly Domain[];
  tastes: Tastes;
}

export async function registerUser(deps: Deps, input: RegisterInput): Promise<User> {
  const email = input.email.trim().toLowerCase();
  const username = input.username.trim().toLowerCase();

  if (input.password.length < 8) throw new ValidationError("Mot de passe : 8 caractères minimum");
  if (input.activeTabs.length < 1) throw new ValidationError("Au moins un onglet doit être actif");
  if (input.tastes.filmGenreIds.length < 3) throw new ValidationError("Sélectionne au moins 3 genres");
  if (await deps.users.findByEmail(email)) throw new ConflictError("Cet email est déjà utilisé");
  if (await deps.users.findByUsername(username)) throw new ConflictError("Ce nom d'utilisateur est pris");

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
    plus: false,
    staff: false,
    private: false,
    createdAt: deps.clock.now(),
  };
  await deps.users.create(user);
  return user;
}
