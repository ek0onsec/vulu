import type { Deps } from "@/server/container";

export interface UserCard {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  plus: boolean;
  staff: boolean;
}

function toCard(u: { id: string; username: string; displayName: string; avatarUrl: string | null; plus: boolean; staff: boolean }): UserCard {
  return { id: u.id, username: u.username, displayName: u.displayName, avatarUrl: u.avatarUrl, plus: u.plus, staff: u.staff };
}

async function resolveCards(deps: Deps, ids: string[]): Promise<UserCard[]> {
  const byId = new Map((await deps.users.findByIds(ids)).map((u) => [u.id, u]));
  return ids.map((id) => byId.get(id)).filter((u): u is NonNullable<typeof u> => u !== undefined).map(toCard);
}

export async function listFollowers(deps: Deps, userId: string): Promise<UserCard[]> {
  return resolveCards(deps, await deps.follows.followerIdsOf(userId));
}

export async function listFollowing(deps: Deps, userId: string): Promise<UserCard[]> {
  return resolveCards(deps, await deps.follows.followeeIdsOf(userId));
}
