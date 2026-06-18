import type { Deps } from "@/server/container";
import type { Showcase, User } from "@/server/domain/entities";
import { NotFoundError, ValidationError } from "@/server/domain/errors";

const cap = (ids: string[]) => [...new Set(ids)].slice(0, 5);

export async function updateShowcase(deps: Deps, userId: string, input: Showcase): Promise<User> {
  const user = await deps.users.findById(userId);
  if (!user) throw new NotFoundError("Utilisateur introuvable");
  if (input.movie.length > 5 || input.tv.length > 5 || input.book.length > 5) {
    throw new ValidationError("5 œuvres maximum par catégorie");
  }
  const showcase: Showcase = { movie: cap(input.movie), tv: cap(input.tv), book: cap(input.book) };
  const updated: User = { ...user, showcase };
  await deps.users.update(updated);
  return updated;
}
