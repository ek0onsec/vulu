import type { Deps } from "@/server/container";
import type { User } from "@/server/domain/entities";
import { NotFoundError } from "@/server/domain/errors";

/** Active/désactive vulu+ (paiement réel branché plus tard — Stripe). */
export async function setPlus(deps: Deps, userId: string, plus: boolean): Promise<User> {
  const user = await deps.users.findById(userId);
  if (!user) throw new NotFoundError("Utilisateur introuvable");
  const updated: User = { ...user, plus };
  await deps.users.update(updated);
  return updated;
}
