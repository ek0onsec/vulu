import type { Deps } from "@/server/container";

export interface UserSearchResult {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  plus: boolean;
  staff: boolean;
}

/** Recherche de membres par pseudo/nom. Exclut le viewer ; DTO public slim. */
export async function searchUsers(deps: Deps, viewerId: string, query: string, limit = 10): Promise<UserSearchResult[]> {
  if (query.trim() === "") return [];
  const users = await deps.users.searchByText(query, limit + 1);
  return users
    .filter((u) => u.id !== viewerId)
    .slice(0, limit)
    .map((u) => ({ id: u.id, username: u.username, displayName: u.displayName, avatarUrl: u.avatarUrl, plus: u.plus, staff: u.staff }));
}
