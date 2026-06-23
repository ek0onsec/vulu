import type { Deps } from "@/server/container";
import type { User } from "@/server/domain/entities";
import { AuthError } from "@/server/domain/errors";
import { DELETION_GRACE_MS, cancelAccountDeletion, purgeUser } from "./account";

// Hash bcrypt (coût 12) d'une valeur aléatoire jetable. Sert à exécuter une
// comparaison factice quand l'email est inconnu, pour égaliser le temps de réponse
// et empêcher l'énumération d'emails par timing. Ce n'est pas un secret.
const DUMMY_HASH = "$2b$12$UR3hcoMj.q00H8Prrhcy7eDgC.z.Q9ufOrpMx4zbAqkyhTj/f2LLq";

export async function authenticateUser(
  deps: Deps,
  input: { email: string; password: string },
): Promise<{ user: User; token: string; reactivated?: boolean }> {
  const user = await deps.users.findByEmail(input.email.trim().toLowerCase());
  if (!user) {
    // Comparaison factice : même coût de calcul que pour un email existant, afin de
    // ne pas révéler l'existence d'un compte via le temps de réponse.
    await deps.hasher.verify(input.password, DUMMY_HASH);
    throw new AuthError("Identifiants invalides");
  }
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
