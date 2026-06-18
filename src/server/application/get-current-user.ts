import type { Deps } from "@/server/container";
import type { User } from "@/server/domain/entities";

export async function getCurrentUser(deps: Deps, token: string | undefined): Promise<User | null> {
  if (!token) return null;
  const payload = await deps.tokens.verify(token);
  if (!payload) return null;
  const user = await deps.users.findById(payload.userId);
  // Un compte désactivé (suppression en cours) est traité comme déconnecté.
  if (!user || user.deactivatedAt) return null;
  return user;
}
