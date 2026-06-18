import type { Deps } from "@/server/container";
import type { User } from "@/server/domain/entities";
import { AuthError } from "@/server/domain/errors";
import { DELETION_GRACE_MS, cancelAccountDeletion, purgeUser } from "./account";

export async function authenticateUser(
  deps: Deps,
  input: { email: string; password: string },
): Promise<{ user: User; token: string; reactivated?: boolean }> {
  const user = await deps.users.findByEmail(input.email.trim().toLowerCase());
  if (!user) throw new AuthError("Identifiants invalides");
  const ok = await deps.hasher.verify(input.password, user.passwordHash);
  if (!ok) throw new AuthError("Identifiants invalides");

  let active = user;
  let reactivated = false;
  if (user.deactivatedAt) {
    const elapsed = deps.clock.now().getTime() - user.deactivatedAt.getTime();
    if (elapsed >= DELETION_GRACE_MS) {
      await purgeUser(deps, user.id);
      throw new AuthError("Ce compte a été supprimé");
    }
    // Reconnexion dans les 48 h → la suppression est annulée.
    active = await cancelAccountDeletion(deps, user.id);
    reactivated = true;
  }

  const token = await deps.tokens.issue({ userId: active.id });
  return { user: active, token, reactivated };
}
