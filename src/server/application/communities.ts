import type { Deps } from "@/server/container";
import type { Community, CommunityRole } from "@/server/domain/entities";
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from "@/server/domain/errors";
import { enrichEntries, type WorkFeedItem } from "./feed";
import { detectImage } from "./profile-media";

const BANNER_MAX = 1_536 * 1024;

export interface CommunityDto {
  id: string; name: string; slug: string; description: string | null; bannerUrl: string | null;
  memberCount: number; isMember: boolean; isPinned: boolean; isOwner: boolean;
  visibility: "public" | "private"; role: CommunityRole | null;
  requestState: "none" | "requested" | "invited"; canModerate: boolean; pendingCount: number;
}

function slugify(name: string): string {
  return name.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40) || "communaute";
}

async function present(deps: Deps, viewerId: string, c: Community): Promise<CommunityDto> {
  const [memberCount, membership, request] = await Promise.all([
    deps.memberships.countForCommunity(c.id),
    deps.memberships.find(c.id, viewerId),
    deps.communityRequests.findPair(c.id, viewerId),
  ]);
  const role = membership ? membership.role : null;
  const canMod = role === "owner" || role === "moderator";
  const pendingCount = canMod ? (await deps.communityRequests.listForCommunity(c.id)).length : 0;
  const requestState = request ? (request.kind === "invite" ? "invited" : "requested") : "none";
  return {
    id: c.id, name: c.name, slug: c.slug, description: c.description, bannerUrl: c.bannerUrl,
    memberCount, isMember: Boolean(membership), isPinned: membership?.pinned ?? false, isOwner: c.ownerId === viewerId,
    visibility: c.visibility, role, requestState, canModerate: canMod, pendingCount,
  };
}

/** Le créateur d'une communauté téléverse/remplace sa bannière. */
export async function setCommunityBanner(deps: Deps, userId: string, communityId: string, bytes: Uint8Array): Promise<CommunityDto> {
  const community = await deps.communities.findById(communityId);
  if (!community) throw new NotFoundError("Communauté introuvable");
  if (community.ownerId !== userId) throw new ForbiddenError("Seul le créateur peut modifier la bannière");
  if (bytes.length === 0) throw new ValidationError("Fichier vide");
  if (bytes.length > BANNER_MAX) throw new ValidationError("Image trop lourde");
  const ext = detectImage(bytes);
  if (!ext) throw new ValidationError("Format non supporté (JPEG, PNG ou WebP)");

  const url = await deps.media.save(bytes, ext);
  const previous = community.bannerUrl;
  const updated: Community = { ...community, bannerUrl: url };
  await deps.communities.update(updated);
  if (previous) await deps.media.delete(previous);
  return present(deps, userId, updated);
}

export async function createCommunity(deps: Deps, ownerId: string, input: { name: string; description: string | null; visibility?: "public" | "private" }): Promise<Community> {
  const owner = await deps.users.findById(ownerId);
  if (!owner) throw new NotFoundError("Utilisateur introuvable");
  if (!owner.plus) throw new ForbiddenError("La création de communauté est réservée à vulu+");
  const name = input.name.trim();
  if (name.length < 2) throw new ValidationError("Nom de communauté trop court");
  let slug = slugify(name);
  for (let i = 2; await deps.communities.findBySlug(slug); i++) slug = `${slugify(name)}-${i}`;
  const now = deps.clock.now();
  const community: Community = { id: deps.ids.next(), name, slug, description: input.description, bannerUrl: null, visibility: input.visibility ?? "public", ownerId, createdAt: now };
  await deps.communities.create(community);
  await deps.memberships.add({ communityId: community.id, userId: ownerId, pinned: true, role: "owner", createdAt: now });
  return community;
}

export async function listPublicCommunities(deps: Deps, viewerId: string): Promise<CommunityDto[]> {
  const list = await deps.communities.listPublic(50);
  return Promise.all(list.map((c) => present(deps, viewerId, c)));
}

export async function getCommunity(deps: Deps, viewerId: string, id: string): Promise<CommunityDto> {
  const c = await deps.communities.findById(id);
  if (!c) throw new NotFoundError("Communauté introuvable");
  return present(deps, viewerId, c);
}

export async function canModerate(deps: Deps, communityId: string, userId: string): Promise<boolean> {
  const m = await deps.memberships.find(communityId, userId);
  return m?.role === "owner" || m?.role === "moderator";
}

export async function joinCommunity(deps: Deps, userId: string, communityId: string): Promise<void> {
  const c = await deps.communities.findById(communityId);
  if (!c) throw new NotFoundError("Communauté introuvable");
  if (await deps.memberships.find(communityId, userId)) return;
  if (c.visibility === "private") {
    if (await deps.communityRequests.findPair(communityId, userId)) return;
    await deps.communityRequests.add({ id: deps.ids.next(), communityId, userId, kind: "request", createdAt: deps.clock.now() });
    return;
  }
  await deps.memberships.add({ communityId, userId, pinned: false, role: "member", createdAt: deps.clock.now() });
}

export async function leaveCommunity(deps: Deps, userId: string, communityId: string): Promise<void> {
  const c = await deps.communities.findById(communityId);
  if (c && c.ownerId === userId) throw new ForbiddenError("Le créateur ne peut pas quitter sa communauté");
  await deps.memberships.remove(communityId, userId);
  const pending = await deps.communityRequests.findPair(communityId, userId);
  if (pending) await deps.communityRequests.remove(pending.id);
}

export async function setCommunityVisibility(deps: Deps, ownerId: string, communityId: string, visibility: "public" | "private"): Promise<void> {
  const c = await deps.communities.findById(communityId);
  if (!c) throw new NotFoundError("Communauté introuvable");
  if (c.ownerId !== ownerId) throw new ForbiddenError("Seul le créateur peut changer la visibilité");
  await deps.communities.update({ ...c, visibility });
}

export async function approveJoinRequest(deps: Deps, actorId: string, requestId: string): Promise<void> {
  const req = await deps.communityRequests.findById(requestId);
  if (!req || req.kind !== "request") throw new NotFoundError("Demande introuvable");
  if (!(await canModerate(deps, req.communityId, actorId))) throw new ForbiddenError("Action réservée à la modération");
  await deps.memberships.add({ communityId: req.communityId, userId: req.userId, pinned: false, role: "member", createdAt: deps.clock.now() });
  await deps.communityRequests.remove(req.id);
}

export async function rejectJoinRequest(deps: Deps, actorId: string, requestId: string): Promise<void> {
  const req = await deps.communityRequests.findById(requestId);
  if (!req || req.kind !== "request") throw new NotFoundError("Demande introuvable");
  if (!(await canModerate(deps, req.communityId, actorId))) throw new ForbiddenError("Action réservée à la modération");
  await deps.communityRequests.remove(req.id);
}

export async function inviteToCommunity(deps: Deps, actorId: string, communityId: string, targetUsername: string): Promise<void> {
  if (!(await canModerate(deps, communityId, actorId))) throw new ForbiddenError("Action réservée à la modération");
  const target = await deps.users.findByUsername(targetUsername.toLowerCase());
  if (!target) throw new NotFoundError("Utilisateur introuvable");
  if (await deps.memberships.find(communityId, target.id)) throw new ConflictError("Déjà membre");
  if (await deps.communityRequests.findPair(communityId, target.id)) throw new ConflictError("Demande ou invitation déjà en attente");
  await deps.communityRequests.add({ id: deps.ids.next(), communityId, userId: target.id, kind: "invite", createdAt: deps.clock.now() });
}

export async function acceptInvite(deps: Deps, userId: string, requestId: string): Promise<void> {
  const req = await deps.communityRequests.findById(requestId);
  if (!req || req.kind !== "invite" || req.userId !== userId) throw new NotFoundError("Invitation introuvable");
  await deps.memberships.add({ communityId: req.communityId, userId, pinned: false, role: "member", createdAt: deps.clock.now() });
  await deps.communityRequests.remove(req.id);
}

export async function declineInvite(deps: Deps, userId: string, requestId: string): Promise<void> {
  const req = await deps.communityRequests.findById(requestId);
  if (!req || req.kind !== "invite" || req.userId !== userId) throw new NotFoundError("Invitation introuvable");
  await deps.communityRequests.remove(req.id);
}

export async function setMemberRole(deps: Deps, ownerId: string, communityId: string, targetUserId: string, role: "member" | "moderator"): Promise<void> {
  const c = await deps.communities.findById(communityId);
  if (!c) throw new NotFoundError("Communauté introuvable");
  if (c.ownerId !== ownerId) throw new ForbiddenError("Seul le créateur gère les rôles");
  if (targetUserId === c.ownerId) throw new ForbiddenError("Le rôle du créateur ne peut pas changer");
  if (!(await deps.memberships.find(communityId, targetUserId))) throw new NotFoundError("Membre introuvable");
  await deps.memberships.setRole(communityId, targetUserId, role);
}

export async function setCommunityPinned(deps: Deps, userId: string, communityId: string, pinned: boolean): Promise<void> {
  const m = await deps.memberships.find(communityId, userId);
  if (!m) throw new ForbiddenError("Rejoins la communauté pour l'épingler");
  await deps.memberships.setPinned(communityId, userId, pinned);
}

/** Communautés rejointes par l'utilisateur (pour le sélecteur de partage). */
export async function myCommunities(deps: Deps, userId: string): Promise<{ id: string; name: string }[]> {
  const memberships = await deps.memberships.listForUser(userId);
  const communities = await deps.communities.listByIds(memberships.map((m) => m.communityId));
  return communities.map((c) => ({ id: c.id, name: c.name }));
}

/** Communautés épinglées (onglets du feed principal). */
export async function pinnedCommunities(deps: Deps, userId: string): Promise<{ id: string; name: string }[]> {
  const pinned = (await deps.memberships.listForUser(userId)).filter((m) => m.pinned).map((m) => m.communityId);
  const communities = await deps.communities.listByIds(pinned);
  return communities.map((c) => ({ id: c.id, name: c.name }));
}

export async function communityFeed(deps: Deps, viewerId: string, communityId: string, cursor: { activityAt: Date; id: string } | null): Promise<WorkFeedItem[]> {
  const c = await deps.communities.findById(communityId);
  if (!c) throw new NotFoundError("Communauté introuvable");
  if (c.visibility === "private" && !(await deps.memberships.find(communityId, viewerId))) {
    throw new ForbiddenError("Communauté privée — rejoins-la pour voir le fil");
  }
  const entries = await deps.entries.feedByCommunity(communityId, cursor, 20);
  return enrichEntries(deps, viewerId, entries);
}

export async function listMembers(deps: Deps, viewerId: string, communityId: string): Promise<{ userId: string; username: string; displayName: string; avatarUrl: string | null; role: CommunityRole }[]> {
  const c = await deps.communities.findById(communityId);
  if (!c) throw new NotFoundError("Communauté introuvable");
  if (c.visibility === "private" && !(await deps.memberships.find(communityId, viewerId))) throw new ForbiddenError("Réservé aux membres");
  const members = await deps.memberships.listForCommunity(communityId);
  const usersById = new Map((await deps.users.findByIds(members.map((m) => m.userId))).map((u) => [u.id, u]));
  return members.map((m) => {
    const u = usersById.get(m.userId);
    return { userId: m.userId, username: u?.username ?? "?", displayName: u?.displayName ?? "?", avatarUrl: u?.avatarUrl ?? null, role: m.role };
  });
}

export async function listJoinRequests(deps: Deps, actorId: string, communityId: string): Promise<{ requestId: string; username: string; displayName: string; avatarUrl: string | null }[]> {
  if (!(await canModerate(deps, communityId, actorId))) throw new ForbiddenError("Réservé à la modération");
  const reqs = await deps.communityRequests.listForCommunity(communityId);
  const usersById = new Map((await deps.users.findByIds(reqs.map((r) => r.userId))).map((u) => [u.id, u]));
  return reqs.map((r) => {
    const u = usersById.get(r.userId);
    return { requestId: r.id, username: u?.username ?? "?", displayName: u?.displayName ?? "?", avatarUrl: u?.avatarUrl ?? null };
  });
}

export async function myInvites(deps: Deps, userId: string): Promise<{ requestId: string; community: CommunityDto }[]> {
  const invites = await deps.communityRequests.listInvitesForUser(userId);
  const communitiesById = new Map((await deps.communities.listByIds(invites.map((inv) => inv.communityId))).map((c) => [c.id, c]));
  const out: { requestId: string; community: CommunityDto }[] = [];
  for (const inv of invites) {
    const c = communitiesById.get(inv.communityId);
    if (c) out.push({ requestId: inv.id, community: await present(deps, userId, c) });
  }
  return out;
}
