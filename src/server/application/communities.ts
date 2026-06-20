import type { Deps } from "@/server/container";
import type { Community } from "@/server/domain/entities";
import { ForbiddenError, NotFoundError, ValidationError } from "@/server/domain/errors";
import { enrichEntries, type FeedItem } from "./feed";
import { detectImage } from "./profile-media";

const BANNER_MAX = 1_536 * 1024;

export interface CommunityDto {
  id: string; name: string; slug: string; description: string | null; bannerUrl: string | null;
  memberCount: number; isMember: boolean; isPinned: boolean; isOwner: boolean;
}

function slugify(name: string): string {
  return name.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40) || "communaute";
}

async function present(deps: Deps, viewerId: string, c: Community): Promise<CommunityDto> {
  const [memberCount, membership] = await Promise.all([
    deps.memberships.countForCommunity(c.id),
    deps.memberships.find(c.id, viewerId),
  ]);
  return { id: c.id, name: c.name, slug: c.slug, description: c.description, bannerUrl: c.bannerUrl, memberCount, isMember: Boolean(membership), isPinned: membership?.pinned ?? false, isOwner: c.ownerId === viewerId };
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

export async function createCommunity(deps: Deps, ownerId: string, input: { name: string; description: string | null }): Promise<Community> {
  const name = input.name.trim();
  if (name.length < 2) throw new ValidationError("Nom de communauté trop court");
  let slug = slugify(name);
  for (let i = 2; await deps.communities.findBySlug(slug); i++) slug = `${slugify(name)}-${i}`;
  const now = deps.clock.now();
  const community: Community = { id: deps.ids.next(), name, slug, description: input.description, bannerUrl: null, ownerId, createdAt: now };
  await deps.communities.create(community);
  await deps.memberships.add({ communityId: community.id, userId: ownerId, pinned: true, createdAt: now });
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

export async function joinCommunity(deps: Deps, userId: string, communityId: string): Promise<void> {
  const c = await deps.communities.findById(communityId);
  if (!c) throw new NotFoundError("Communauté introuvable");
  await deps.memberships.add({ communityId, userId, pinned: false, createdAt: deps.clock.now() });
}

export async function leaveCommunity(deps: Deps, userId: string, communityId: string): Promise<void> {
  await deps.memberships.remove(communityId, userId);
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

export async function communityFeed(deps: Deps, viewerId: string, communityId: string, cursor: { activityAt: Date; id: string } | null): Promise<FeedItem[]> {
  const entries = await deps.entries.feedByCommunity(communityId, cursor, 20);
  return enrichEntries(deps, viewerId, entries);
}
