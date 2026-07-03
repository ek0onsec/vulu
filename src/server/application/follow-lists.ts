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
  const users = await Promise.all(ids.map((id) => deps.users.findById(id)));
  return users.filter((u): u is NonNullable<typeof u> => u !== null).map(toCard);
}

export async function listFollowers(deps: Deps, userId: string): Promise<UserCard[]> {
  return resolveCards(deps, await deps.follows.followerIdsOf(userId));
}

export async function listFollowing(deps: Deps, userId: string): Promise<UserCard[]> {
  return resolveCards(deps, await deps.follows.followeeIdsOf(userId));
}
