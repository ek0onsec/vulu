import type { Deps } from "@/server/container";
import type { User } from "@/server/domain/entities";
import { computeCircle } from "@/server/domain/circle";
import { ForbiddenError, NotFoundError, ValidationError } from "@/server/domain/errors";

export async function followUser(deps: Deps, followerId: string, followeeId: string): Promise<void> {
  if (followerId === followeeId) throw new ValidationError("Impossible de se suivre soi-même");
  await deps.follows.add({ followerId, followeeId, createdAt: deps.clock.now() });
}

export async function unfollowUser(deps: Deps, followerId: string, followeeId: string): Promise<void> {
  await deps.follows.remove(followerId, followeeId);
}

export type FollowResult = "following" | "requested";

/** Suit directement un compte public ; envoie une demande pour un compte privé. */
export async function requestOrFollow(deps: Deps, requesterId: string, targetId: string): Promise<FollowResult> {
  if (requesterId === targetId) throw new ValidationError("Impossible de se suivre soi-même");
  if (await deps.follows.exists(requesterId, targetId)) return "following";
  const target = await deps.users.findById(targetId);
  if (!target) throw new NotFoundError("Utilisateur introuvable");
  if (target.private) {
    await deps.followRequests.add({ id: deps.ids.next(), requesterId, targetId, createdAt: deps.clock.now() });
    return "requested";
  }
  await deps.follows.add({ followerId: requesterId, followeeId: targetId, createdAt: deps.clock.now() });
  return "following";
}

export async function approveFollowRequest(deps: Deps, targetId: string, requestId: string): Promise<void> {
  const req = await deps.followRequests.findById(requestId);
  if (!req) throw new NotFoundError("Demande introuvable");
  if (req.targetId !== targetId) throw new ForbiddenError("Action non autorisée");
  await deps.follows.add({ followerId: req.requesterId, followeeId: targetId, createdAt: deps.clock.now() });
  await deps.followRequests.remove(requestId);
}

export async function rejectFollowRequest(deps: Deps, targetId: string, requestId: string): Promise<void> {
  const req = await deps.followRequests.findById(requestId);
  if (!req) throw new NotFoundError("Demande introuvable");
  if (req.targetId !== targetId) throw new ForbiddenError("Action non autorisée");
  await deps.followRequests.remove(requestId);
}

export interface PresentedRequest { id: string; requester: Pick<User, "username" | "displayName" | "avatarUrl"> }

export async function listFollowRequests(deps: Deps, targetId: string): Promise<PresentedRequest[]> {
  const reqs = await deps.followRequests.listForTarget(targetId);
  return Promise.all(reqs.map(async (r) => {
    const u = await deps.users.findById(r.requesterId);
    return { id: r.id, requester: { username: u?.username ?? "inconnu", displayName: u?.displayName ?? "Utilisateur", avatarUrl: u?.avatarUrl ?? null } };
  }));
}

export async function setAccountPrivacy(deps: Deps, userId: string, isPrivate: boolean): Promise<User> {
  const user = await deps.users.findById(userId);
  if (!user) throw new NotFoundError("Utilisateur introuvable");
  const updated: User = { ...user, private: isPrivate };
  await deps.users.update(updated);
  return updated;
}

/** A et B se suivent mutuellement. */
export async function areMutual(deps: Deps, a: string, b: string): Promise<boolean> {
  const [ab, ba] = await Promise.all([deps.follows.exists(a, b), deps.follows.exists(b, a)]);
  return ab && ba;
}

/** Le viewer peut-il voir le contenu du profil cible ? */
export async function canViewProfile(deps: Deps, viewerId: string, target: User): Promise<boolean> {
  if (!target.private) return true;
  if (viewerId === target.id) return true;
  return areMutual(deps, viewerId, target.id);
}

export async function getCircle(deps: Deps, userId: string): Promise<Set<string>> {
  const [following, followers] = await Promise.all([
    deps.follows.followeeIdsOf(userId),
    deps.follows.followerIdsOf(userId),
  ]);
  return computeCircle(userId, following, followers);
}
