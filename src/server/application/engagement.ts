import type { Deps } from "@/server/container";
import type { Comment, LibraryEntry } from "@/server/domain/entities";
import { ForbiddenError, NotFoundError, ValidationError } from "@/server/domain/errors";
import { getCircle } from "./social";

/** Une entrée est visible pour le viewer si : la sienne, OU publique, OU 'circle' et auteur dans le cercle. */
async function assertVisible(deps: Deps, viewerId: string, entry: LibraryEntry): Promise<void> {
  if (entry.userId === viewerId) return;
  if (entry.audiences.public) return;
  const circle = await getCircle(deps, viewerId);
  if (!circle.has(entry.userId)) throw new ForbiddenError("Contenu non accessible");
}

async function loadVisible(deps: Deps, viewerId: string, entryId: string): Promise<LibraryEntry> {
  const entry = await deps.entries.findById(entryId);
  if (!entry) throw new NotFoundError("Entrée introuvable");
  await assertVisible(deps, viewerId, entry);
  return entry;
}

export async function likeEntry(deps: Deps, userId: string, entryId: string): Promise<void> {
  await loadVisible(deps, userId, entryId);
  await deps.likes.add({ entryId, userId, createdAt: deps.clock.now() });
}

export async function unlikeEntry(deps: Deps, userId: string, entryId: string): Promise<void> {
  await deps.likes.remove(entryId, userId);
}

export async function commentOnEntry(deps: Deps, userId: string, entryId: string, text: string): Promise<Comment> {
  const trimmed = text.trim();
  if (!trimmed) throw new ValidationError("Commentaire vide");
  await loadVisible(deps, userId, entryId);
  const comment: Comment = { id: deps.ids.next(), entryId, userId, text: trimmed, createdAt: deps.clock.now() };
  await deps.comments.add(comment);
  return comment;
}

export async function deleteComment(deps: Deps, userId: string, commentId: string): Promise<void> {
  const comment = await deps.comments.findById(commentId);
  if (!comment) throw new NotFoundError("Commentaire introuvable");
  if (comment.userId !== userId) throw new ForbiddenError("Action non autorisée");
  await deps.comments.remove(commentId);
}

export async function listComments(deps: Deps, viewerId: string, entryId: string): Promise<Comment[]> {
  await loadVisible(deps, viewerId, entryId);
  return deps.comments.listByEntry(entryId);
}
