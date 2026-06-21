import { describe, it, expect, beforeEach } from "vitest";
import { makeInMemoryDeps, type Deps } from "@/server/container";
import { FakeCatalog } from "../helpers/fake-catalog";
import {
  createCommunity, joinCommunity, leaveCommunity, setCommunityPinned,
  myCommunities, pinnedCommunities, communityFeed, getCommunity, setCommunityBanner,
  approveJoinRequest, rejectJoinRequest, inviteToCommunity, acceptInvite, declineInvite,
} from "@/server/application/communities";
import { rateOrReviewWork } from "@/server/application/library-entry";
import { registerUser } from "@/server/application/register-user";
import { ValidationError, ForbiddenError, ConflictError } from "@/server/domain/errors";

let deps: Deps; let u1: string; let u2: string;
const ref = { source: "tmdb" as const, externalId: "603", type: "movie" as const };
const tastes = { filmGenreIds: [878, 18, 35], people: [] };
beforeEach(async () => {
  deps = makeInMemoryDeps(new FakeCatalog());
  u1 = (await registerUser(deps, { email: "u1@x.io", username: "user1", displayName: "U1", password: "password1", activeTabs: ["films"], tastes })).id;
  u2 = (await registerUser(deps, { email: "u2@x.io", username: "user2", displayName: "U2", password: "password1", activeTabs: ["films"], tastes })).id;
  // Créer une communauté est réservé à vulu+ : les créateurs des tests sont abonnés.
  for (const id of [u1, u2]) { const u = await deps.users.findById(id); await deps.users.update({ ...u!, plus: true }); }
});

describe("communautés", () => {
  it("createCommunity slugifie, rejoint le créateur et l'épingle", async () => {
    const c = await createCommunity(deps, u1, { name: "Cinéphiles SF", description: "Science-fiction" });
    expect(c.slug).toBe("cinephiles-sf");
    expect(c.ownerId).toBe(u1);
    const m = await deps.memberships.find(c.id, u1);
    expect(m?.pinned).toBe(true);
  });

  it("réserve la création de communauté aux abonnés vulu+", async () => {
    const free = (await registerUser(deps, { email: "free@x.io", username: "free", displayName: "Free", password: "password1", activeTabs: ["films"], tastes })).id;
    await expect(createCommunity(deps, free, { name: "Sans abo", description: null })).rejects.toThrow(ForbiddenError);
  });

  it("rejette un nom trop court", async () => {
    await expect(createCommunity(deps, u1, { name: "x", description: null })).rejects.toThrow(ValidationError);
  });

  it("dé-duplique les slugs identiques", async () => {
    const a = await createCommunity(deps, u1, { name: "SF", description: null });
    const b = await createCommunity(deps, u2, { name: "SF", description: null });
    expect(a.slug).toBe("sf");
    expect(b.slug).toBe("sf-2");
  });

  it("join puis leave met à jour l'appartenance", async () => {
    const c = await createCommunity(deps, u1, { name: "Cinéphiles", description: null });
    await joinCommunity(deps, u2, c.id);
    expect((await getCommunity(deps, u2, c.id)).isMember).toBe(true);
    expect((await getCommunity(deps, u2, c.id)).memberCount).toBe(2);
    await leaveCommunity(deps, u2, c.id);
    expect((await getCommunity(deps, u2, c.id)).isMember).toBe(false);
  });

  it("setCommunityPinned exige d'être membre", async () => {
    const c = await createCommunity(deps, u1, { name: "Cinéphiles", description: null });
    await expect(setCommunityPinned(deps, u2, c.id, true)).rejects.toThrow(ForbiddenError);
  });

  it("myCommunities et pinnedCommunities reflètent l'épinglage", async () => {
    const c = await createCommunity(deps, u1, { name: "Cinéphiles", description: null });
    await joinCommunity(deps, u2, c.id);
    expect((await myCommunities(deps, u2)).map((x) => x.id)).toContain(c.id);
    expect((await pinnedCommunities(deps, u2)).map((x) => x.id)).not.toContain(c.id);
    await setCommunityPinned(deps, u2, c.id, true);
    expect((await pinnedCommunities(deps, u2)).map((x) => x.id)).toContain(c.id);
  });

  it("partager dans une communauté exige d'en être membre", async () => {
    const c = await createCommunity(deps, u1, { name: "Cinéphiles", description: null });
    await expect(
      rateOrReviewWork(deps, u2, ref, { rating: 4, text: "top", visibility: "public", communityId: c.id }),
    ).rejects.toThrow(ForbiddenError);
  });

  it("le fil de communauté ne contient que les avis qui y sont partagés", async () => {
    const c = await createCommunity(deps, u1, { name: "Cinéphiles", description: null });
    await rateOrReviewWork(deps, u1, ref, { rating: 4, text: "partagé", visibility: "public", communityId: c.id });
    await rateOrReviewWork(deps, u1, { source: "googlebooks", externalId: "book-1", type: "book" }, { rating: 3, text: "hors comm", visibility: "public", communityId: null });
    const feed = await communityFeed(deps, u1, c.id, null);
    expect(feed).toHaveLength(1);
    expect(feed[0]?.entry.text).toBe("partagé");
  });
});

// PNG minimal (signature + 1 octet) — suffisant pour detectImage.
const pngBytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]);

describe("bannière de communauté", () => {
  it("le créateur peut définir une bannière", async () => {
    const c = await createCommunity(deps, u1, { name: "Cinéphiles", description: null });
    expect((await getCommunity(deps, u1, c.id)).bannerUrl).toBeNull();
    const dto = await setCommunityBanner(deps, u1, c.id, pngBytes);
    expect(dto.bannerUrl).not.toBeNull();
    expect((await getCommunity(deps, u1, c.id)).bannerUrl).toBe(dto.bannerUrl);
  });
  it("un non-créateur ne peut pas", async () => {
    const c = await createCommunity(deps, u1, { name: "Cinéphiles", description: null });
    await expect(setCommunityBanner(deps, u2, c.id, pngBytes)).rejects.toThrow(ForbiddenError);
  });
  it("rejette un fichier non-image", async () => {
    const c = await createCommunity(deps, u1, { name: "Cinéphiles", description: null });
    await expect(setCommunityBanner(deps, u1, c.id, new Uint8Array([1, 2, 3]))).rejects.toThrow(ValidationError);
  });
  it("getCommunity expose isOwner", async () => {
    const c = await createCommunity(deps, u1, { name: "Cinéphiles", description: null });
    expect((await getCommunity(deps, u1, c.id)).isOwner).toBe(true);
    expect((await getCommunity(deps, u2, c.id)).isOwner).toBe(false);
  });
});

describe("communautés privées — adhésion", () => {
  it("rejoindre une communauté publique crée un membership", async () => {
    const c = await createCommunity(deps, u1, { name: "Publique", description: null });
    await joinCommunity(deps, u2, c.id);
    expect(await deps.memberships.find(c.id, u2)).not.toBeNull();
  });
  it("rejoindre une privée crée une demande, pas un membership", async () => {
    const c = await createCommunity(deps, u1, { name: "Privee", description: null, visibility: "private" });
    await joinCommunity(deps, u2, c.id);
    expect(await deps.memberships.find(c.id, u2)).toBeNull();
    expect(await deps.communityRequests.findPair(c.id, u2)).not.toBeNull();
  });
  it("le créateur ne peut pas quitter sa communauté", async () => {
    const c = await createCommunity(deps, u1, { name: "Owner Comm", description: null });
    await expect(leaveCommunity(deps, u1, c.id)).rejects.toThrow(ForbiddenError);
  });
});

describe("communautés privées — modération des demandes", () => {
  async function privateWithRequest() {
    const c = await createCommunity(deps, u1, { name: "Privee", description: null, visibility: "private" });
    await joinCommunity(deps, u2, c.id);
    const req = await deps.communityRequests.findPair(c.id, u2);
    return { c, reqId: req!.id };
  }
  it("l'owner approuve → membership créé, demande supprimée", async () => {
    const { c, reqId } = await privateWithRequest();
    await approveJoinRequest(deps, u1, reqId);
    expect(await deps.memberships.find(c.id, u2)).not.toBeNull();
    expect(await deps.communityRequests.findById(reqId)).toBeNull();
  });
  it("un non-modérateur ne peut pas approuver", async () => {
    const { reqId } = await privateWithRequest();
    await expect(approveJoinRequest(deps, u2, reqId)).rejects.toThrow(ForbiddenError);
  });
  it("refuser supprime la demande sans membership", async () => {
    const { c, reqId } = await privateWithRequest();
    await rejectJoinRequest(deps, u1, reqId);
    expect(await deps.memberships.find(c.id, u2)).toBeNull();
    expect(await deps.communityRequests.findById(reqId)).toBeNull();
  });
});

describe("communautés privées — invitations", () => {
  it("un mod invite par username ; l'invité accepte → membership", async () => {
    const c = await createCommunity(deps, u1, { name: "Privee", description: null, visibility: "private" });
    await inviteToCommunity(deps, u1, c.id, "user2"); // u2.username = "user2"
    const inv = (await deps.communityRequests.listInvitesForUser(u2))[0];
    expect(inv?.kind).toBe("invite");
    await acceptInvite(deps, u2, inv!.id);
    expect(await deps.memberships.find(c.id, u2)).not.toBeNull();
  });
  it("inviter deux fois → ConflictError", async () => {
    const c = await createCommunity(deps, u1, { name: "Privee", description: null, visibility: "private" });
    await inviteToCommunity(deps, u1, c.id, "user2");
    await expect(inviteToCommunity(deps, u1, c.id, "user2")).rejects.toThrow(ConflictError);
  });
  it("refuser une invitation la supprime sans membership", async () => {
    const c = await createCommunity(deps, u1, { name: "Privee", description: null, visibility: "private" });
    await inviteToCommunity(deps, u1, c.id, "user2");
    const inv = (await deps.communityRequests.listInvitesForUser(u2))[0];
    await declineInvite(deps, u2, inv!.id);
    expect(await deps.memberships.find(c.id, u2)).toBeNull();
    expect(await deps.communityRequests.findById(inv!.id)).toBeNull();
  });
  it("un non-modérateur ne peut pas inviter", async () => {
    const c = await createCommunity(deps, u1, { name: "Privee", description: null, visibility: "private" });
    await expect(inviteToCommunity(deps, u2, c.id, "user1")).rejects.toThrow(ForbiddenError);
  });
});
