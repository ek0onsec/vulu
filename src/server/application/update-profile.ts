import type { Deps } from "@/server/container";
import type { Domain, User } from "@/server/domain/entities";
import { NotFoundError, ValidationError } from "@/server/domain/errors";

export async function updateProfile(
  deps: Deps, userId: string,
  input: { displayName: string; bio: string | null; avatarUrl: string | null; activeTabs: Domain[] },
): Promise<User> {
  const user = await deps.users.findById(userId);
  if (!user) throw new NotFoundError("Utilisateur introuvable");
  if (input.activeTabs.length < 1) throw new ValidationError("Au moins un onglet doit être actif");
  const updated: User = { ...user, displayName: input.displayName.trim(), bio: input.bio,
    avatarUrl: input.avatarUrl, activeTabs: input.activeTabs };
  await deps.users.update(updated);
  return updated;
}
