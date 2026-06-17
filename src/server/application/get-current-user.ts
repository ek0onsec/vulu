import type { Deps } from "@/server/container";
import type { User } from "@/server/domain/entities";

export async function getCurrentUser(deps: Deps, token: string | undefined): Promise<User | null> {
  if (!token) return null;
  const payload = await deps.tokens.verify(token);
  if (!payload) return null;
  return deps.users.findById(payload.userId);
}
