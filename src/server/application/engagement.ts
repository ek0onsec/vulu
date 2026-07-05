import type { Deps } from "@/server/container";
import type { Comment, EntryAudiences } from "@/server/domain/entities";
import { ForbiddenError, NotFoundError, ValidationError } from "@/server/domain/errors";
import { getCircle } from "./social";

type Visible = { userId: string; audiences: EntryAudiences };

/** Une cible (avis d'œuvre ou d'épisode) est visible pour le viewer si : la sienne, OU publique, OU 'circle' et auteur dans le cercle. */
async function assertVisible(deps: Deps, viewerId: string, target: Visible): Promise<void> {
  if (target.userId === viewerId) return;
  if (target.audiences.public) return;
  const circle = await getCircle(deps, viewerId);
  if (!circle.has(target.userId)) throw new ForbiddenError("Contenu non accessible");
}

async function loadVisible(deps: Deps, viewerId: string, id: string): Promise<Visible> {
  const entry = await deps.entries.findById(id);
  if (entry) { await assertVisible(deps, viewerId, entry); return entry; }
  const ep = await deps.episodeEntries.findById(id);
  if (ep) { await assertVisible(deps, viewerId, ep); return ep; }
  throw new NotFoundError("Entrée introuvable");
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
