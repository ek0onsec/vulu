import type { Deps } from "@/server/container";
import type { Domain, List, ListVisibility, WorkType } from "@/server/domain/entities";
import { ForbiddenError, NotFoundError } from "@/server/domain/errors";
import { getOrImportWork } from "./get-work";

type Ref = { source: "tmdb"; externalId: string; type: WorkType };

async function owned(deps: Deps, userId: string, listId: string): Promise<List> {
  const list = await deps.lists.findById(listId);
  if (!list) throw new NotFoundError("Liste introuvable");
  if (list.userId !== userId) throw new ForbiddenError("Action non autorisée");
  return list;
}

export async function createList(
  deps: Deps, userId: string,
  input: { name: string; domain: Domain; description: string | null; visibility: ListVisibility },
): Promise<List> {
  const now = deps.clock.now();
  const list: List = { id: deps.ids.next(), userId, name: input.name.trim(), domain: input.domain,
    description: input.description, visibility: input.visibility, workIds: [], createdAt: now, updatedAt: now };
  await deps.lists.create(list);
  return list;
}

export async function updateList(
  deps: Deps, userId: string, listId: string,
  input: { name: string; description: string | null; visibility: ListVisibility },
): Promise<List> {
  const list = await owned(deps, userId, listId);
  const updated: List = { ...list, name: input.name.trim(), description: input.description,
    visibility: input.visibility, updatedAt: deps.clock.now() };
  await deps.lists.update(updated);
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

export function listsOf(deps: Deps, userId: string, domain?: Domain) { return deps.lists.listByUser(userId, domain); }
