import type { Deps } from "@/server/container";
import type { Tastes, User } from "@/server/domain/entities";
import { NotFoundError } from "@/server/domain/errors";

export async function updateTastes(deps: Deps, userId: string, tastes: Tastes): Promise<User> {
  const user = await deps.users.findById(userId);
  if (!user) throw new NotFoundError("Utilisateur introuvable");
  const updated: User = { ...user, tastes };
  await deps.users.update(updated);
  return updated;
}
