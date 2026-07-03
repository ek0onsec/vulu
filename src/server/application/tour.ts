import type { Deps } from "@/server/container";
import type { User } from "@/server/domain/entities";
import { NotFoundError } from "@/server/domain/errors";

/** Marque l'app tour comme vu/complété pour l'utilisateur (idempotent). */
export async function markTourSeen(deps: Deps, userId: string): Promise<User> {
  const user = await deps.users.findById(userId);
  if (!user) throw new NotFoundError("Utilisateur introuvable");
  const updated: User = { ...user, tourCompletedAt: deps.clock.now() };
  await deps.users.update(updated);
  return updated;
}
