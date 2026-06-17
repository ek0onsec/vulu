import type { Deps } from "@/server/container";
import type { User } from "@/server/domain/entities";
import { AuthError } from "@/server/domain/errors";

export async function authenticateUser(
  deps: Deps,
  input: { email: string; password: string },
): Promise<{ user: User; token: string }> {
  const user = await deps.users.findByEmail(input.email.trim().toLowerCase());
  if (!user) throw new AuthError("Identifiants invalides");
  const ok = await deps.hasher.verify(input.password, user.passwordHash);
  if (!ok) throw new AuthError("Identifiants invalides");
  const token = await deps.tokens.issue({ userId: user.id });
  return { user, token };
}
