import type { Deps } from "@/server/container";
import { computeCircle } from "@/server/domain/circle";
import { ValidationError } from "@/server/domain/errors";

export async function followUser(deps: Deps, followerId: string, followeeId: string): Promise<void> {
  if (followerId === followeeId) throw new ValidationError("Impossible de se suivre soi-même");
  await deps.follows.add({ followerId, followeeId, createdAt: deps.clock.now() });
}

export async function unfollowUser(deps: Deps, followerId: string, followeeId: string): Promise<void> {
  await deps.follows.remove(followerId, followeeId);
}

export async function getCircle(deps: Deps, userId: string): Promise<Set<string>> {
  const [following, followers] = await Promise.all([
    deps.follows.followeeIdsOf(userId),
    deps.follows.followerIdsOf(userId),
  ]);
  return computeCircle(userId, following, followers);
}
