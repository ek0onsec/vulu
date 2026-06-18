import type { Deps } from "@/server/container";
import type { List, ListKind, ListVisibility, Work, WorkSource, WorkType } from "@/server/domain/entities";
import { ForbiddenError, NotFoundError, ValidationError } from "@/server/domain/errors";
import { getOrImportWork } from "./get-work";
import { detectImage } from "./profile-media";

type Ref = { source: WorkSource; externalId: string; type: WorkType };

async function owned(deps: Deps, userId: string, listId: string): Promise<List> {
  const list = await deps.lists.findById(listId);
  if (!list) throw new NotFoundError("Liste introuvable");
  if (list.userId !== userId) throw new ForbiddenError("Action non autorisée");
  return list;
}

export async function createList(
  deps: Deps, userId: string,
  input: { name: string; kind: ListKind; description: string | null; visibility: ListVisibility },
): Promise<List> {
  const now = deps.clock.now();
  const list: List = { id: deps.ids.next(), userId, name: input.name.trim(), kind: input.kind,
    description: input.description, bannerUrl: null, visibility: input.visibility, workIds: [], createdAt: now, updatedAt: now };
  await deps.lists.create(list);
  return list;
}

export async function updateList(
  deps: Deps, userId: string, listId: string,
  input: { name: string; kind: ListKind; description: string | null; visibility: ListVisibility },
): Promise<List> {
  const list = await owned(deps, userId, listId);
  const updated: List = { ...list, name: input.name.trim(), kind: input.kind, description: input.description,
    visibility: input.visibility, updatedAt: deps.clock.now() };
  await deps.lists.update(updated);
  return updated;
}

export async function updateListBanner(deps: Deps, userId: string, listId: string, bytes: Uint8Array): Promise<List> {
  const list = await owned(deps, userId, listId);
  if (bytes.length === 0 || bytes.length > 1_536 * 1024) throw new ValidationError("Image vide ou trop lourde");
  const ext = detectImage(bytes);
  if (!ext) throw new ValidationError("Format non supporté (JPEG, PNG ou WebP)");
  const url = await deps.media.save(bytes, ext);
  const previous = list.bannerUrl;
  const updated: List = { ...list, bannerUrl: url, updatedAt: deps.clock.now() };
  await deps.lists.update(updated);
  if (previous) await deps.media.delete(previous);
  return updated;
}

export async function deleteList(deps: Deps, userId: string, listId: string): Promise<void> {
  await owned(deps, userId, listId);
  await deps.lists.remove(listId);
}

export async function addWorkToList(deps: Deps, userId: string, listId: string, ref: Ref): Promise<List> {
  const list = await owned(deps, userId, listId);
  const work = await getOrImportWork(deps, ref);
  if (list.workIds.includes(work.id)) return list;
  const updated: List = { ...list, workIds: [...list.workIds, work.id], updatedAt: deps.clock.now() };
  await deps.lists.update(updated);
  return updated;
}

export async function removeWorkFromList(deps: Deps, userId: string, listId: string, workId: string): Promise<List> {
  const list = await owned(deps, userId, listId);
  const updated: List = { ...list, workIds: list.workIds.filter((id) => id !== workId), updatedAt: deps.clock.now() };
  await deps.lists.update(updated);
  return updated;
}

export function listsOf(deps: Deps, userId: string) { return deps.lists.listByUser(userId); }

/** Liste + ses œuvres résolues (ordre préservé). Accessible au propriétaire ou si publique. */
export async function getListWithWorks(
  deps: Deps, viewerId: string, listId: string,
): Promise<{ list: List; works: Work[] }> {
  const list = await deps.lists.findById(listId);
  if (!list) throw new NotFoundError("Liste introuvable");
  if (list.visibility === "private" && list.userId !== viewerId) throw new ForbiddenError("Liste privée");
  const resolved = await Promise.all(list.workIds.map((id) => deps.works.findById(id)));
  const works = resolved.filter((w): w is Work => w !== null);
  return { list, works };
}
