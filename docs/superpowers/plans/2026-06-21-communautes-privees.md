# Communautés privées & modération — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Communautés privées avec rôles (owner/modérateur/membre), demandes d'adhésion et invitations, fil masqué aux non-membres, gérées via une page de modération.

**Architecture:** Hexagonale existante. `Community.visibility` + `Membership.role` + nouvelle entité `CommunityRequest` (calquée sur `FollowRequest`). Les règles vivent dans `application/communities.ts` ; un helper `canModerate` centralise l'autorisation.

**Tech Stack:** Next.js 16 (App Router, async params), React 19, Tailwind v4, MongoDB (driver natif), Vitest, zod v4.

## Global Constraints

- TypeScript strict, **aucun `any`** (CLAUDE.md).
- Découplage hexagonal : domaine → ports → adaptateurs ; pas d'accès driver hors adaptateur.
- TDD : test rouge → implémentation minimale → vert → commit.
- **Aucune attribution IA** dans le code/app/commits ; pas de co-auteur Claude.
- Ne PAS toucher à `lechatonfat/` ni aux clés réelles de `vulu/.env.local`.
- Typecheck : `node_modules/.bin/tsc --noEmit` (jamais `npx tsc`). Tests : `npx vitest run`.
- **Toujours préfixer les commandes par `cd /home/chamberlain/Desktop/Claude/vulu`** (le cwd du shell dérive).
- Commits en français, préfixe `feat(vulu):` / `test(vulu):`.
- Créer une communauté reste **réservé à vulu+** (déjà en place dans `createCommunity`).

---

### Task 1: Modèle — visibilité, rôle, entité CommunityRequest

**Files:**
- Modify: `src/server/domain/entities.ts`
- Modify: `src/server/application/communities.ts` (réparer les littéraux cassés)
- Modify: `src/server/adapters/mongo/mappers.ts` (backfill + mapper request)
- Test: `tests/adapters/mongo-mappers.test.ts`

**Interfaces:**
- Produces:
  - `Community.visibility: "public" | "private"`
  - `Membership.role: "owner" | "moderator" | "member"`
  - `type CommunityRole = "owner" | "moderator" | "member"`
  - `interface CommunityRequest { id: string; communityId: string; userId: string; kind: "request" | "invite"; createdAt: Date }`
  - mappers `toCommunityRequestDoc` / `fromCommunityRequestDoc`, `WithIdCommunityRequest`
  - `fromCommunityDoc` backfille `visibility:"public"` ; `fromMembershipDoc` backfille `role:"member"`

- [ ] **Step 1: Écrire le test qui échoue**

Ajouter dans `tests/adapters/mongo-mappers.test.ts` :

```ts
import { fromCommunityDoc, fromMembershipDoc } from "@/server/adapters/mongo/mappers";

describe("mappers — rétro-compat communautés privées", () => {
  it("fromCommunityDoc backfille visibility public", () => {
    // @ts-expect-error doc legacy sans visibility
    const c = fromCommunityDoc({ _id: "c", id: "c", name: "X", slug: "x", description: null, bannerUrl: null, ownerId: "u", createdAt: new Date() });
    expect(c.visibility).toBe("public");
  });
  it("fromMembershipDoc backfille role member", () => {
    // @ts-expect-error doc legacy sans role
    const m = fromMembershipDoc({ _id: "c:u", communityId: "c", userId: "u", pinned: false, createdAt: new Date() });
    expect(m.role).toBe("member");
  });
});
```

- [ ] **Step 2: Lancer le test, vérifier l'échec**

Run: `cd /home/chamberlain/Desktop/Claude/vulu && npx vitest run tests/adapters/mongo-mappers.test.ts`
Expected: FAIL — `visibility`/`role` valent `undefined`.

- [ ] **Step 3: Étendre les entités**

Dans `src/server/domain/entities.ts` :
- Dans `interface Community`, ajouter après `bannerUrl: string | null;` : `visibility: "public" | "private";`
- Avant `interface Membership`, ajouter : `export type CommunityRole = "owner" | "moderator" | "member";`
- Dans `interface Membership`, ajouter après `pinned: boolean;` : `role: CommunityRole;`
- Après `interface Membership { ... }`, ajouter :

```ts
export interface CommunityRequest {
  id: string;
  communityId: string;
  userId: string;
  kind: "request" | "invite"; // "request" = demandé par l'utilisateur ; "invite" = par un mod
  createdAt: Date;
}
```

- [ ] **Step 4: Réparer les littéraux dans communities.ts (tsc)**

Dans `src/server/application/communities.ts` :
- `createCommunity` : au littéral `community`, ajouter `visibility: input.visibility ?? "public",` (la signature gagnera `visibility` en Task 3 ; pour l'instant typer l'input comme `{ name: string; description: string | null; visibility?: "public" | "private" }`). Au `memberships.add(...)` du créateur, mettre `role: "owner"` : `await deps.memberships.add({ communityId: community.id, userId: ownerId, pinned: true, role: "owner", createdAt: now });`
- `joinCommunity` : au `memberships.add(...)`, ajouter `role: "member"`.

- [ ] **Step 5: Mappers Mongo**

Dans `src/server/adapters/mongo/mappers.ts` :
- Importer `CommunityRequest` dans l'import de types existant.
- Ajouter `export type WithIdCommunityRequest = WithId<CommunityRequest>;` (près de `WithIdCommunity`).
- Remplacer :
```ts
export const fromCommunityDoc = (d: WithIdCommunity): Community => strip(d);
```
par :
```ts
export const fromCommunityDoc = (d: WithIdCommunity): Community => {
  const c = strip(d);
  return { ...c, visibility: c.visibility ?? "public" };
};
```
- Remplacer :
```ts
export const fromMembershipDoc = (d: WithIdMembership): Membership => strip(d);
```
par :
```ts
export const fromMembershipDoc = (d: WithIdMembership): Membership => {
  const m = strip(d);
  return { ...m, role: m.role ?? "member" };
};
```
- Ajouter les mappers request :
```ts
export const toCommunityRequestDoc = (r: CommunityRequest): WithIdCommunityRequest => ({ _id: r.id, ...r });
export const fromCommunityRequestDoc = (d: WithIdCommunityRequest): CommunityRequest => strip(d);
```

- [ ] **Step 6: Lancer la suite + typecheck**

Run: `cd /home/chamberlain/Desktop/Claude/vulu && npx vitest run tests/adapters/mongo-mappers.test.ts && node_modules/.bin/tsc --noEmit`
Expected: PASS, tsc 0. Corriger tout littéral `Membership`/`Community` restant signalé par tsc (ajouter `role`/`visibility`).

- [ ] **Step 7: Commit**

```bash
cd /home/chamberlain/Desktop/Claude/vulu
git add src/server/domain/entities.ts src/server/application/communities.ts src/server/adapters/mongo/mappers.ts tests/adapters/mongo-mappers.test.ts
git commit -m "feat(vulu): modèle communautés privées — visibility, role, CommunityRequest + mappers"
```

---

### Task 2: Repositories — rôles membership + CommunityRequestRepository

**Files:**
- Modify: `src/server/ports/repositories.ts`
- Modify: `src/server/adapters/memory/index.ts`
- Modify: `src/server/adapters/mongo/repositories.ts`
- Modify: `src/server/adapters/mongo/indexes.ts`
- Modify: `src/server/container.ts`
- Test: `tests/adapters/memory.test.ts`

**Interfaces:**
- Consumes: `CommunityRequest`, `CommunityRole` (Task 1).
- Produces:
  - `MembershipRepository.setRole(communityId, userId, role: CommunityRole): Promise<void>`
  - `MembershipRepository.listForCommunity(communityId): Promise<Membership[]>`
  - `interface CommunityRequestRepository { add(r); findById(id); findPair(communityId, userId); listForCommunity(communityId): Promise<CommunityRequest[]>; listInvitesForUser(userId): Promise<CommunityRequest[]>; remove(id); removeAllForUser(userId); removeAllForCommunity(communityId) }`
  - `Deps.communityRequests: CommunityRequestRepository`

- [ ] **Step 1: Écrire le test qui échoue**

Ajouter dans `tests/adapters/memory.test.ts` :

```ts
import { InMemoryMembershipRepository, InMemoryCommunityRequestRepository } from "@/server/adapters/memory";

describe("InMemoryMembershipRepository — rôles", () => {
  it("setRole et listForCommunity", async () => {
    const r = new InMemoryMembershipRepository();
    await r.add({ communityId: "c", userId: "u1", pinned: true, role: "owner", createdAt: new Date() });
    await r.add({ communityId: "c", userId: "u2", pinned: false, role: "member", createdAt: new Date() });
    await r.setRole("c", "u2", "moderator");
    const members = await r.listForCommunity("c");
    expect(members).toHaveLength(2);
    expect((await r.find("c", "u2"))?.role).toBe("moderator");
  });
});

describe("InMemoryCommunityRequestRepository", () => {
  it("add idempotent par couple + listForCommunity (requests) + listInvitesForUser", async () => {
    const r = new InMemoryCommunityRequestRepository();
    await r.add({ id: "r1", communityId: "c", userId: "u1", kind: "request", createdAt: new Date() });
    await r.add({ id: "r1b", communityId: "c", userId: "u1", kind: "request", createdAt: new Date() }); // doublon couple → ignoré
    await r.add({ id: "r2", communityId: "c", userId: "u2", kind: "invite", createdAt: new Date() });
    expect((await r.listForCommunity("c")).map((x) => x.id)).toEqual(["r1"]);
    expect((await r.listInvitesForUser("u2")).map((x) => x.id)).toEqual(["r2"]);
    expect((await r.findPair("c", "u1"))?.id).toBe("r1");
  });
});
```

- [ ] **Step 2: Lancer le test, vérifier l'échec**

Run: `cd /home/chamberlain/Desktop/Claude/vulu && npx vitest run tests/adapters/memory.test.ts`
Expected: FAIL — `InMemoryCommunityRequestRepository` / `setRole` / `listForCommunity` introuvables.

- [ ] **Step 3: Étendre le port**

Dans `src/server/ports/repositories.ts` :
- Ajouter l'import du type : dans l'import existant depuis `@/server/domain/entities`, ajouter `CommunityRequest, CommunityRole`.
- Dans `interface MembershipRepository`, ajouter :
```ts
  setRole(communityId: string, userId: string, role: CommunityRole): Promise<void>;
  listForCommunity(communityId: string): Promise<Membership[]>;
```
- Ajouter une nouvelle interface :
```ts
export interface CommunityRequestRepository {
  add(request: CommunityRequest): Promise<void>;
  findById(id: string): Promise<CommunityRequest | null>;
  findPair(communityId: string, userId: string): Promise<CommunityRequest | null>;
  listForCommunity(communityId: string): Promise<CommunityRequest[]>;   // kind:"request"
  listInvitesForUser(userId: string): Promise<CommunityRequest[]>;      // kind:"invite"
  remove(id: string): Promise<void>;
  removeAllForUser(userId: string): Promise<void>;
  removeAllForCommunity(communityId: string): Promise<void>;
}
```

- [ ] **Step 4: Adaptateur mémoire**

Dans `src/server/adapters/memory/index.ts` :
- Dans `InMemoryMembershipRepository`, ajouter :
```ts
  async setRole(communityId: string, userId: string, role: import("@/server/domain/entities").CommunityRole) { const m = await this.find(communityId, userId); if (m) m.role = role; }
  async listForCommunity(communityId: string) { return this.rows.filter((m) => m.communityId === communityId); }
```
- Ajouter la classe (importer `CommunityRequest`/`CommunityRequestRepository` en tête) :
```ts
export class InMemoryCommunityRequestRepository implements CommunityRequestRepository {
  private reqs: CommunityRequest[] = [];
  async add(r: CommunityRequest) { if (!(await this.findPair(r.communityId, r.userId))) this.reqs.push(r); }
  async findById(id: string) { return this.reqs.find((r) => r.id === id) ?? null; }
  async findPair(communityId: string, userId: string) { return this.reqs.find((r) => r.communityId === communityId && r.userId === userId) ?? null; }
  async listForCommunity(communityId: string) { return this.reqs.filter((r) => r.communityId === communityId && r.kind === "request").sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()); }
  async listInvitesForUser(userId: string) { return this.reqs.filter((r) => r.userId === userId && r.kind === "invite").sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()); }
  async remove(id: string) { this.reqs = this.reqs.filter((r) => r.id !== id); }
  async removeAllForUser(userId: string) { this.reqs = this.reqs.filter((r) => r.userId !== userId); }
  async removeAllForCommunity(communityId: string) { this.reqs = this.reqs.filter((r) => r.communityId !== communityId); }
}
```

- [ ] **Step 5: Adaptateur Mongo**

Dans `src/server/adapters/mongo/repositories.ts` :
- Dans `MongoMembershipRepository`, ajouter :
```ts
  async setRole(communityId: string, userId: string, role: import("@/server/domain/entities").CommunityRole) { await this.col.updateOne({ _id: `${communityId}:${userId}` }, { $set: { role } }); }
  async listForCommunity(communityId: string) { return (await this.col.find({ communityId }).toArray()).map(M.fromMembershipDoc); }
```
- Ajouter la classe (suivre le template `MongoFollowRequestRepository`) :
```ts
export class MongoCommunityRequestRepository implements CommunityRequestRepository {
  constructor(private db: Db) {}
  private get col() { return this.db.collection<M.WithIdCommunityRequest>("community_requests"); }
  async add(r: CommunityRequest) { await this.col.updateOne({ communityId: r.communityId, userId: r.userId }, { $setOnInsert: M.toCommunityRequestDoc(r) }, { upsert: true }); }
  async findById(id: string) { const d = await this.col.findOne({ _id: id }); return d ? M.fromCommunityRequestDoc(d) : null; }
  async findPair(communityId: string, userId: string) { const d = await this.col.findOne({ communityId, userId }); return d ? M.fromCommunityRequestDoc(d) : null; }
  async listForCommunity(communityId: string) { return (await this.col.find({ communityId, kind: "request" }).sort({ createdAt: -1 }).toArray()).map(M.fromCommunityRequestDoc); }
  async listInvitesForUser(userId: string) { return (await this.col.find({ userId, kind: "invite" }).sort({ createdAt: -1 }).toArray()).map(M.fromCommunityRequestDoc); }
  async remove(id: string) { await this.col.deleteOne({ _id: id }); }
  async removeAllForUser(userId: string) { await this.col.deleteMany({ userId }); }
  async removeAllForCommunity(communityId: string) { await this.col.deleteMany({ communityId }); }
}
```
- Importer `CommunityRequest` et `CommunityRequestRepository` en tête du fichier (suivre les imports existants des autres entités/ports).

- [ ] **Step 6: Index Mongo**

Dans `src/server/adapters/mongo/indexes.ts`, ajouter après le bloc `memberships` :
```ts
  await db.collection("community_requests").createIndexes([
    { key: { communityId: 1, userId: 1 }, unique: true, name: "uniq_comm_request" },
    { key: { userId: 1, kind: 1 }, name: "by_user_kind" },
    { key: { communityId: 1, kind: 1 }, name: "by_comm_kind" },
  ]);
```

- [ ] **Step 7: Container**

Dans `src/server/container.ts` :
- Ajouter `InMemoryCommunityRequestRepository` à l'import depuis `@/server/adapters/memory` et `MongoCommunityRequestRepository` à l'import Mongo.
- Ajouter le type d'import `CommunityRequestRepository` (dans l'import des ports).
- Dans `interface Deps`, ajouter `communityRequests: CommunityRequestRepository;` (après `memberships`).
- Dans `makeInMemoryDeps`, ajouter `communityRequests: new InMemoryCommunityRequestRepository(),`.
- Dans `getDeps` (Mongo), ajouter `communityRequests: new MongoCommunityRequestRepository(db),`.

- [ ] **Step 8: Lancer la suite + typecheck + commit**

Run: `cd /home/chamberlain/Desktop/Claude/vulu && node_modules/.bin/tsc --noEmit && npx vitest run tests/adapters/memory.test.ts`
Expected: tsc 0, PASS.

```bash
cd /home/chamberlain/Desktop/Claude/vulu
git add src/server/ports/repositories.ts src/server/adapters/ src/server/container.ts tests/adapters/memory.test.ts
git commit -m "feat(vulu): repos — rôles membership + CommunityRequestRepository (memory + mongo)"
```

---

### Task 3: Application — createCommunity visibilité, join public/privé, leave owner

**Files:**
- Modify: `src/server/application/communities.ts`
- Modify: `src/lib/zod-schemas.ts`
- Test: `tests/application/communities.test.ts`

**Interfaces:**
- Consumes: `deps.communityRequests` (Task 2).
- Produces:
  - `createCommunity(deps, ownerId, { name, description, visibility? }): Promise<Community>`
  - `joinCommunity` : publique → membership ; privée → `CommunityRequest{kind:"request"}`
  - `leaveCommunity` : owner bloqué
  - `canModerate(deps, communityId, userId): Promise<boolean>` (export interne)
  - `createCommunitySchema` gagne `visibility`

- [ ] **Step 1: Écrire le test qui échoue**

Ajouter dans `tests/application/communities.test.ts` (les créateurs `u1`/`u2` sont déjà vulu+ via le `beforeEach`) :

```ts
import { setCommunityVisibility } from "@/server/application/communities";

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
    const c = await createCommunity(deps, u1, { name: "X", description: null });
    await expect(leaveCommunity(deps, u1, c.id)).rejects.toThrow(ForbiddenError);
  });
});
```

(importer `leaveCommunity` et `joinCommunity` en tête du fichier de test s'ils ne le sont pas déjà.)

- [ ] **Step 2: Lancer le test, vérifier l'échec**

Run: `cd /home/chamberlain/Desktop/Claude/vulu && npx vitest run tests/application/communities.test.ts`
Expected: FAIL — privée crée un membership (ancien comportement), leave owner ne lève pas.

- [ ] **Step 3: Schéma**

Dans `src/lib/zod-schemas.ts`, remplacer :
```ts
export const createCommunitySchema = z.object({ name: z.string().min(2).max(50), description: z.string().max(300).nullable() });
```
par :
```ts
export const createCommunitySchema = z.object({ name: z.string().min(2).max(50), description: z.string().max(300).nullable(), visibility: z.enum(["public", "private"]).default("public") });
```

- [ ] **Step 4: Implémenter**

Dans `src/server/application/communities.ts` :
- `createCommunity` : signature `input: { name: string; description: string | null; visibility?: "public" | "private" }` ; au littéral, `visibility: input.visibility ?? "public"` (si pas déjà fait en Task 1).
- Ajouter le helper :
```ts
export async function canModerate(deps: Deps, communityId: string, userId: string): Promise<boolean> {
  const m = await deps.memberships.find(communityId, userId);
  return m?.role === "owner" || m?.role === "moderator";
}
```
- Remplacer `joinCommunity` :
```ts
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
```
- Remplacer `leaveCommunity` :
```ts
export async function leaveCommunity(deps: Deps, userId: string, communityId: string): Promise<void> {
  const c = await deps.communities.findById(communityId);
  if (c && c.ownerId === userId) throw new ForbiddenError("Le créateur ne peut pas quitter sa communauté");
  await deps.memberships.remove(communityId, userId);
  const pending = await deps.communityRequests.findPair(communityId, userId);
  if (pending) await deps.communityRequests.remove(pending.id);
}
```
- Ajouter :
```ts
export async function setCommunityVisibility(deps: Deps, ownerId: string, communityId: string, visibility: "public" | "private"): Promise<void> {
  const c = await deps.communities.findById(communityId);
  if (!c) throw new NotFoundError("Communauté introuvable");
  if (c.ownerId !== ownerId) throw new ForbiddenError("Seul le créateur peut changer la visibilité");
  await deps.communities.update({ ...c, visibility });
}
```

- [ ] **Step 5: Lancer le test + typecheck**

Run: `cd /home/chamberlain/Desktop/Claude/vulu && npx vitest run tests/application/communities.test.ts && node_modules/.bin/tsc --noEmit`
Expected: PASS, tsc 0.

- [ ] **Step 6: Commit**

```bash
cd /home/chamberlain/Desktop/Claude/vulu
git add src/server/application/communities.ts src/lib/zod-schemas.ts tests/application/communities.test.ts
git commit -m "feat(vulu): communautés — visibilité, join public/privé (demande), leave owner bloqué"
```

---

### Task 4: Application — approbation / refus des demandes

**Files:**
- Modify: `src/server/application/communities.ts`
- Test: `tests/application/communities.test.ts`

**Interfaces:**
- Consumes: `canModerate`, `deps.communityRequests`.
- Produces:
  - `approveJoinRequest(deps, actorId, requestId): Promise<void>`
  - `rejectJoinRequest(deps, actorId, requestId): Promise<void>`

- [ ] **Step 1: Écrire le test qui échoue**

Ajouter dans `tests/application/communities.test.ts`. **Ne pas** tester ici le cas « un modérateur approuve » — il dépend de `setMemberRole` (Task 6) et y est testé. N'écris que owner/non-mod/reject :

```ts
import { approveJoinRequest, rejectJoinRequest } from "@/server/application/communities";

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
```

- [ ] **Step 2: Lancer le test, vérifier l'échec**

Run: `cd /home/chamberlain/Desktop/Claude/vulu && npx vitest run tests/application/communities.test.ts`
Expected: FAIL — `approveJoinRequest` / `rejectJoinRequest` introuvables.

- [ ] **Step 3: Implémenter**

Dans `src/server/application/communities.ts` :
```ts
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
```

- [ ] **Step 4: Lancer le test + typecheck**

Run: `cd /home/chamberlain/Desktop/Claude/vulu && npx vitest run tests/application/communities.test.ts && node_modules/.bin/tsc --noEmit`
Expected: PASS (cas owner/non-mod/reject), tsc 0.

- [ ] **Step 5: Commit**

```bash
cd /home/chamberlain/Desktop/Claude/vulu
git add src/server/application/communities.ts tests/application/communities.test.ts
git commit -m "feat(vulu): communautés — approuver / refuser les demandes d'adhésion (owner/mod)"
```

---

### Task 5: Application — invitations

**Files:**
- Modify: `src/server/application/communities.ts`
- Test: `tests/application/communities.test.ts`

**Interfaces:**
- Consumes: `canModerate`, `deps.communityRequests`, `deps.users.findByUsername`.
- Produces:
  - `inviteToCommunity(deps, actorId, communityId, targetUsername): Promise<void>`
  - `acceptInvite(deps, userId, requestId): Promise<void>`
  - `declineInvite(deps, userId, requestId): Promise<void>`

- [ ] **Step 1: Écrire le test qui échoue**

Ajouter dans `tests/application/communities.test.ts` :

```ts
import { inviteToCommunity, acceptInvite, declineInvite } from "@/server/application/communities";
import { ConflictError } from "@/server/domain/errors";

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
```

- [ ] **Step 2: Lancer le test, vérifier l'échec**

Run: `cd /home/chamberlain/Desktop/Claude/vulu && npx vitest run tests/application/communities.test.ts`
Expected: FAIL — fonctions introuvables.

- [ ] **Step 3: Implémenter**

Dans `src/server/application/communities.ts` (importer `ConflictError` depuis `@/server/domain/errors`) :
```ts
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
```

- [ ] **Step 4: Lancer le test + typecheck**

Run: `cd /home/chamberlain/Desktop/Claude/vulu && npx vitest run tests/application/communities.test.ts && node_modules/.bin/tsc --noEmit`
Expected: PASS, tsc 0.

- [ ] **Step 5: Commit**

```bash
cd /home/chamberlain/Desktop/Claude/vulu
git add src/server/application/communities.ts tests/application/communities.test.ts
git commit -m "feat(vulu): communautés — invitations (inviter / accepter / refuser)"
```

---

### Task 6: Application — rôles (promotion/rétrogradation)

**Files:**
- Modify: `src/server/application/communities.ts`
- Test: `tests/application/communities.test.ts`

**Interfaces:**
- Consumes: `deps.memberships`.
- Produces: `setMemberRole(deps, ownerId, communityId, targetUserId, role: "member" | "moderator"): Promise<void>`

- [ ] **Step 1: Écrire le test qui échoue**

Ajouter dans `tests/application/communities.test.ts` (le cas « un modérateur approuve » vit ici car il dépend de `setMemberRole`) :

```ts
import { setMemberRole } from "@/server/application/communities";

describe("communautés — rôles", () => {
  async function communityWithMember() {
    const c = await createCommunity(deps, u1, { name: "X", description: null });
    await joinCommunity(deps, u2, c.id);
    return c;
  }
  it("l'owner promeut un membre en modérateur", async () => {
    const c = await communityWithMember();
    await setMemberRole(deps, u1, c.id, u2, "moderator");
    expect((await deps.memberships.find(c.id, u2))?.role).toBe("moderator");
  });
  it("un non-owner ne peut pas promouvoir", async () => {
    const c = await communityWithMember();
    await expect(setMemberRole(deps, u2, c.id, u2, "moderator")).rejects.toThrow(ForbiddenError);
  });
  it("on ne peut pas changer le rôle de l'owner", async () => {
    const c = await communityWithMember();
    await expect(setMemberRole(deps, u1, c.id, u1, "member")).rejects.toThrow(ForbiddenError);
  });
  it("un modérateur peut approuver une demande", async () => {
    const c = await createCommunity(deps, u1, { name: "Privee", description: null, visibility: "private" });
    await joinCommunity(deps, u2, c.id); // demande de u2
    const other = (await registerUser(deps, { email: "o@x.io", username: "other", displayName: "O", password: "password1", activeTabs: ["films"], tastes })).id;
    await deps.memberships.add({ communityId: c.id, userId: other, pinned: false, role: "member", createdAt: new Date() });
    await setMemberRole(deps, u1, c.id, other, "moderator");
    const reqId = (await deps.communityRequests.findPair(c.id, u2))!.id;
    await approveJoinRequest(deps, other, reqId);
    expect(await deps.memberships.find(c.id, u2)).not.toBeNull();
  });
});
```

- [ ] **Step 2: Lancer le test, vérifier l'échec**

Run: `cd /home/chamberlain/Desktop/Claude/vulu && npx vitest run tests/application/communities.test.ts`
Expected: FAIL — `setMemberRole` introuvable.

- [ ] **Step 3: Implémenter**

Dans `src/server/application/communities.ts` :
```ts
export async function setMemberRole(deps: Deps, ownerId: string, communityId: string, targetUserId: string, role: "member" | "moderator"): Promise<void> {
  const c = await deps.communities.findById(communityId);
  if (!c) throw new NotFoundError("Communauté introuvable");
  if (c.ownerId !== ownerId) throw new ForbiddenError("Seul le créateur gère les rôles");
  if (targetUserId === c.ownerId) throw new ForbiddenError("Le rôle du créateur ne peut pas changer");
  if (!(await deps.memberships.find(communityId, targetUserId))) throw new NotFoundError("Membre introuvable");
  await deps.memberships.setRole(communityId, targetUserId, role);
}
```

- [ ] **Step 4: Lancer le test + typecheck**

Run: `cd /home/chamberlain/Desktop/Claude/vulu && npx vitest run tests/application/communities.test.ts && node_modules/.bin/tsc --noEmit`
Expected: PASS, tsc 0.

- [ ] **Step 5: Commit**

```bash
cd /home/chamberlain/Desktop/Claude/vulu
git add src/server/application/communities.ts tests/application/communities.test.ts
git commit -m "feat(vulu): communautés — promotion / rétrogradation des modérateurs (owner)"
```

---

### Task 7: Application — fil masqué + DTO enrichi + listes

**Files:**
- Modify: `src/server/application/communities.ts`
- Test: `tests/application/communities.test.ts`

**Interfaces:**
- Consumes: tout le précédent.
- Produces:
  - `communityFeed` lève `ForbiddenError` si privée + non-membre.
  - `CommunityDto` gagne `visibility`, `role` (`CommunityRole | null`), `requestState` (`"none"|"requested"|"invited"`), `canModerate: boolean`, `pendingCount: number`.
  - `listMembers(deps, viewerId, communityId): Promise<{ userId, username, displayName, avatarUrl, role }[]>`
  - `listJoinRequests(deps, actorId, communityId): Promise<{ requestId, username, displayName, avatarUrl }[]>`
  - `myInvites(deps, userId): Promise<{ requestId, community: CommunityDto }[]>`

- [ ] **Step 1: Écrire le test qui échoue**

Ajouter dans `tests/application/communities.test.ts` :

```ts
import { communityFeed, listJoinRequests } from "@/server/application/communities";

describe("communautés privées — visibilité du fil & DTO", () => {
  it("communityFeed refuse un non-membre d'une privée", async () => {
    const c = await createCommunity(deps, u1, { name: "Privee", description: null, visibility: "private" });
    await expect(communityFeed(deps, u2, c.id, null)).rejects.toThrow(ForbiddenError);
  });
  it("getCommunity expose visibility, role, requestState, canModerate", async () => {
    const c = await createCommunity(deps, u1, { name: "Privee", description: null, visibility: "private" });
    await joinCommunity(deps, u2, c.id); // demande
    const asOwner = await getCommunity(deps, u1, c.id);
    expect(asOwner.visibility).toBe("private");
    expect(asOwner.role).toBe("owner");
    expect(asOwner.canModerate).toBe(true);
    expect(asOwner.pendingCount).toBe(1);
    const asRequester = await getCommunity(deps, u2, c.id);
    expect(asRequester.role).toBeNull();
    expect(asRequester.requestState).toBe("requested");
  });
  it("listJoinRequests réservé à la modération", async () => {
    const c = await createCommunity(deps, u1, { name: "Privee", description: null, visibility: "private" });
    await joinCommunity(deps, u2, c.id);
    expect((await listJoinRequests(deps, u1, c.id))).toHaveLength(1);
    await expect(listJoinRequests(deps, u2, c.id)).rejects.toThrow(ForbiddenError);
  });
});
```

- [ ] **Step 2: Lancer le test, vérifier l'échec**

Run: `cd /home/chamberlain/Desktop/Claude/vulu && npx vitest run tests/application/communities.test.ts`
Expected: FAIL — champs DTO absents, feed non gardé, `listJoinRequests` introuvable.

- [ ] **Step 3: Implémenter**

Dans `src/server/application/communities.ts` :
- Étendre `CommunityDto` :
```ts
export interface CommunityDto {
  id: string; name: string; slug: string; description: string | null; bannerUrl: string | null;
  memberCount: number; isMember: boolean; isPinned: boolean; isOwner: boolean;
  visibility: "public" | "private"; role: import("@/server/domain/entities").CommunityRole | null;
  requestState: "none" | "requested" | "invited"; canModerate: boolean; pendingCount: number;
}
```
- Réécrire `present` :
```ts
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
```
- Garder `communityFeed` :
```ts
export async function communityFeed(deps: Deps, viewerId: string, communityId: string, cursor: { activityAt: Date; id: string } | null): Promise<FeedItem[]> {
  const c = await deps.communities.findById(communityId);
  if (!c) throw new NotFoundError("Communauté introuvable");
  if (c.visibility === "private" && !(await deps.memberships.find(communityId, viewerId))) {
    throw new ForbiddenError("Communauté privée — rejoins-la pour voir le fil");
  }
  const entries = await deps.entries.feedByCommunity(communityId, cursor, 20);
  return enrichEntries(deps, viewerId, entries);
}
```
- Ajouter les listes :
```ts
export async function listMembers(deps: Deps, viewerId: string, communityId: string): Promise<{ userId: string; username: string; displayName: string; avatarUrl: string | null; role: import("@/server/domain/entities").CommunityRole }[]> {
  const c = await deps.communities.findById(communityId);
  if (!c) throw new NotFoundError("Communauté introuvable");
  if (c.visibility === "private" && !(await deps.memberships.find(communityId, viewerId))) throw new ForbiddenError("Réservé aux membres");
  const members = await deps.memberships.listForCommunity(communityId);
  return Promise.all(members.map(async (m) => {
    const u = await deps.users.findById(m.userId);
    return { userId: m.userId, username: u?.username ?? "?", displayName: u?.displayName ?? "?", avatarUrl: u?.avatarUrl ?? null, role: m.role };
  }));
}

export async function listJoinRequests(deps: Deps, actorId: string, communityId: string): Promise<{ requestId: string; username: string; displayName: string; avatarUrl: string | null }[]> {
  if (!(await canModerate(deps, communityId, actorId))) throw new ForbiddenError("Réservé à la modération");
  const reqs = await deps.communityRequests.listForCommunity(communityId);
  return Promise.all(reqs.map(async (r) => {
    const u = await deps.users.findById(r.userId);
    return { requestId: r.id, username: u?.username ?? "?", displayName: u?.displayName ?? "?", avatarUrl: u?.avatarUrl ?? null };
  }));
}

export async function myInvites(deps: Deps, userId: string): Promise<{ requestId: string; community: CommunityDto }[]> {
  const invites = await deps.communityRequests.listInvitesForUser(userId);
  const out: { requestId: string; community: CommunityDto }[] = [];
  for (const inv of invites) {
    const c = await deps.communities.findById(inv.communityId);
    if (c) out.push({ requestId: inv.id, community: await present(deps, userId, c) });
  }
  return out;
}
```

- [ ] **Step 4: Lancer le test + typecheck**

Run: `cd /home/chamberlain/Desktop/Claude/vulu && npx vitest run tests/application/communities.test.ts && node_modules/.bin/tsc --noEmit`
Expected: PASS, tsc 0. (Les clients TS redéfinissent localement leur `CommunityDto`, donc pas de casse ; ils gagneront les champs en Task 9-10.)

- [ ] **Step 5: Commit**

```bash
cd /home/chamberlain/Desktop/Claude/vulu
git add src/server/application/communities.ts tests/application/communities.test.ts
git commit -m "feat(vulu): communautés — fil privé masqué + DTO enrichi (rôle/état/demandes) + listes membres/demandes/invitations"
```

---

### Task 8: API — routes modération, invitations, rôles, visibilité

**Files:**
- Create: `src/app/api/communities/[id]/requests/route.ts`
- Create: `src/app/api/communities/[id]/requests/[reqId]/route.ts`
- Create: `src/app/api/communities/[id]/invite/route.ts`
- Create: `src/app/api/communities/[id]/members/route.ts`
- Create: `src/app/api/communities/[id]/members/[userId]/role/route.ts`
- Create: `src/app/api/communities/[id]/visibility/route.ts`
- Create: `src/app/api/community-invites/mine/route.ts`
- Create: `src/app/api/community-invites/[reqId]/route.ts`
- Modify: `src/app/api/communities/route.ts` (passer `visibility`)

**Interfaces:**
- Consumes: toutes les fonctions application (Task 3-7).

- [ ] **Step 1: Route demandes (liste)**

Create `src/app/api/communities/[id]/requests/route.ts` :
```ts
import { getDeps } from "@/server/container";
import { listJoinRequests } from "@/server/application/communities";
import { requireUser, json } from "@/server/http/session";
import { toErrorResponse } from "@/server/http/errors";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try { const u = await requireUser(); const { id } = await params; return json({ requests: await listJoinRequests(await getDeps(), u.id, id) }); }
  catch (e) { return toErrorResponse(e); }
}
```

- [ ] **Step 2: Route approve/reject**

Create `src/app/api/communities/[id]/requests/[reqId]/route.ts` :
```ts
import { getDeps } from "@/server/container";
import { approveJoinRequest, rejectJoinRequest } from "@/server/application/communities";
import { requireUser, json } from "@/server/http/session";
import { toErrorResponse } from "@/server/http/errors";
import { z } from "zod";

export async function POST(req: Request, { params }: { params: Promise<{ id: string; reqId: string }> }) {
  try {
    const u = await requireUser(); const { reqId } = await params;
    const { action } = z.object({ action: z.enum(["approve", "reject"]) }).parse(await req.json());
    const deps = await getDeps();
    if (action === "approve") await approveJoinRequest(deps, u.id, reqId); else await rejectJoinRequest(deps, u.id, reqId);
    return json({ ok: true });
  } catch (e) { return toErrorResponse(e); }
}
```

- [ ] **Step 3: Route invite**

Create `src/app/api/communities/[id]/invite/route.ts` :
```ts
import { getDeps } from "@/server/container";
import { inviteToCommunity } from "@/server/application/communities";
import { requireUser, json } from "@/server/http/session";
import { toErrorResponse } from "@/server/http/errors";
import { z } from "zod";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const u = await requireUser(); const { id } = await params;
    const { username } = z.object({ username: z.string().min(1) }).parse(await req.json());
    await inviteToCommunity(await getDeps(), u.id, id, username);
    return json({ ok: true });
  } catch (e) { return toErrorResponse(e); }
}
```

- [ ] **Step 4: Route membres + rôle**

Create `src/app/api/communities/[id]/members/route.ts` :
```ts
import { getDeps } from "@/server/container";
import { listMembers } from "@/server/application/communities";
import { requireUser, json } from "@/server/http/session";
import { toErrorResponse } from "@/server/http/errors";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try { const u = await requireUser(); const { id } = await params; return json({ members: await listMembers(await getDeps(), u.id, id) }); }
  catch (e) { return toErrorResponse(e); }
}
```

Create `src/app/api/communities/[id]/members/[userId]/role/route.ts` :
```ts
import { getDeps } from "@/server/container";
import { setMemberRole } from "@/server/application/communities";
import { requireUser, json } from "@/server/http/session";
import { toErrorResponse } from "@/server/http/errors";
import { z } from "zod";

export async function POST(req: Request, { params }: { params: Promise<{ id: string; userId: string }> }) {
  try {
    const u = await requireUser(); const { id, userId } = await params;
    const { role } = z.object({ role: z.enum(["member", "moderator"]) }).parse(await req.json());
    await setMemberRole(await getDeps(), u.id, id, userId, role);
    return json({ ok: true });
  } catch (e) { return toErrorResponse(e); }
}
```

- [ ] **Step 5: Route visibilité**

Create `src/app/api/communities/[id]/visibility/route.ts` :
```ts
import { getDeps } from "@/server/container";
import { setCommunityVisibility } from "@/server/application/communities";
import { requireUser, json } from "@/server/http/session";
import { toErrorResponse } from "@/server/http/errors";
import { z } from "zod";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const u = await requireUser(); const { id } = await params;
    const { visibility } = z.object({ visibility: z.enum(["public", "private"]) }).parse(await req.json());
    await setCommunityVisibility(await getDeps(), u.id, id, visibility);
    return json({ ok: true });
  } catch (e) { return toErrorResponse(e); }
}
```

- [ ] **Step 6: Routes invitations reçues**

Create `src/app/api/community-invites/mine/route.ts` :
```ts
import { getDeps } from "@/server/container";
import { myInvites } from "@/server/application/communities";
import { requireUser, json } from "@/server/http/session";
import { toErrorResponse } from "@/server/http/errors";

export async function GET() {
  try { const u = await requireUser(); return json({ invites: await myInvites(await getDeps(), u.id) }); }
  catch (e) { return toErrorResponse(e); }
}
```

Create `src/app/api/community-invites/[reqId]/route.ts` :
```ts
import { getDeps } from "@/server/container";
import { acceptInvite, declineInvite } from "@/server/application/communities";
import { requireUser, json } from "@/server/http/session";
import { toErrorResponse } from "@/server/http/errors";
import { z } from "zod";

export async function POST(req: Request, { params }: { params: Promise<{ reqId: string }> }) {
  try {
    const u = await requireUser(); const { reqId } = await params;
    const { action } = z.object({ action: z.enum(["accept", "decline"]) }).parse(await req.json());
    const deps = await getDeps();
    if (action === "accept") await acceptInvite(deps, u.id, reqId); else await declineInvite(deps, u.id, reqId);
    return json({ ok: true });
  } catch (e) { return toErrorResponse(e); }
}
```

- [ ] **Step 7: createCommunity API passe visibility**

Dans `src/app/api/communities/route.ts`, le `createCommunitySchema` inclut déjà `visibility` (Task 3) et `createCommunity` la lit ; vérifier que le POST passe bien `input` complet (il fait déjà `createCommunity(deps, u.id, input)` — rien à changer si `input` contient `visibility`).

- [ ] **Step 8: Typecheck + commit**

Run: `cd /home/chamberlain/Desktop/Claude/vulu && node_modules/.bin/tsc --noEmit && npx vitest run`
Expected: tsc 0, tous verts.

```bash
cd /home/chamberlain/Desktop/Claude/vulu
git add "src/app/api/communities/[id]/requests/" "src/app/api/communities/[id]/invite/" "src/app/api/communities/[id]/members/" "src/app/api/communities/[id]/visibility/" "src/app/api/community-invites/"
git commit -m "feat(vulu): API communautés privées — demandes, invitations, rôles, visibilité"
```

---

### Task 9: UI — création (toggle visibilité) + découverte (cadenas)

**Files:**
- Modify: `src/app/communautes/CommunitiesClient.tsx`

**Interfaces:**
- Consumes: `POST /api/communities` (avec `visibility`), DTO `visibility` dans la liste.

- [ ] **Step 1: Étendre le DTO local + l'état**

Dans `src/app/communautes/CommunitiesClient.tsx` :
- Ajouter `visibility: "public" | "private"` à l'interface `CommunityDto` locale.
- Ajouter un état `const [visibility, setVisibility] = useState<"public" | "private">("public");`
- Dans `create()`, passer `visibility` : `await api.post("/api/communities", { name, description: description.trim() || null, visibility });` et réinitialiser `setVisibility("public")` après.

- [ ] **Step 2: Toggle dans la modale**

Dans la modale de création, sous le champ description, ajouter :
```tsx
<div className="flex gap-2">
  {(["public", "private"] as const).map((v) => (
    <button key={v} type="button" onClick={() => setVisibility(v)}
      className={`flex-1 rounded-xl border px-3 py-2 text-sm font-semibold ${visibility === v ? "border-[var(--color-primary)] bg-[var(--color-primary)] text-white" : "border-[var(--color-border)] text-[var(--color-text-muted)]"}`}>
      {v === "public" ? "Publique" : "Privée 🔒"}
    </button>
  ))}
</div>
```

- [ ] **Step 3: Cadenas + libellé bouton dans la liste**

Dans la carte communauté de la liste, à côté du nom, si `c.visibility === "private"` afficher `<Icon name="lock" size={14} />`. Pour le bouton de jointure, si non-membre et privée → libellé « Demander » au lieu de « Rejoindre ». Adapter la ligne du bouton :
```tsx
{c.isMember ? "Membre ✓" : c.visibility === "private" ? "Demander" : "Rejoindre"}
```

- [ ] **Step 4: Typecheck + commit**

Run: `cd /home/chamberlain/Desktop/Claude/vulu && node_modules/.bin/tsc --noEmit`
Expected: tsc 0.

```bash
cd /home/chamberlain/Desktop/Claude/vulu
git add src/app/communautes/CommunitiesClient.tsx
git commit -m "feat(vulu): UI découverte — communauté privée (toggle création + cadenas + Demander)"
```

---

### Task 10: UI — page communauté (demande, invitation, modération, membres, visibilité)

**Files:**
- Modify: `src/app/communaute/[id]/CommunityClient.tsx`

**Interfaces:**
- Consumes: les routes de Task 8 ; DTO enrichi (Task 7).

- [ ] **Step 1: Étendre le DTO local**

Dans `src/app/communaute/[id]/CommunityClient.tsx`, ajouter à l'interface `CommunityDto` locale : `visibility: "public" | "private"; role: "owner" | "moderator" | "member" | null; requestState: "none" | "requested" | "invited"; canModerate: boolean; pendingCount: number;`.

- [ ] **Step 2: Adapter la jointure (demande vs rejoindre)**

Le bouton « Rejoindre » d'une privée envoie une demande. Après `POST /api/communities/:id/join`, recharger le DTO (`loadCommunity()`), qui renverra `requestState:"requested"`. Adapter le libellé : non-membre + privée + `requestState==="requested"` → « Demande envoyée » (clic = `DELETE join` pour annuler) ; sinon privée → « Demander à rejoindre » ; publique → « Rejoindre ».

- [ ] **Step 3: Voile fil privé**

Si `!c.isMember && c.visibility === "private"`, remplacer le rendu du fil par un encart :
```tsx
<div className="rounded-2xl border border-dashed border-[var(--color-border)] p-10 text-center">
  <Icon name="lock" size={28} />
  <p className="mt-2 font-display text-lg font-bold">Communauté privée</p>
  <p className="mt-1 text-sm text-[var(--color-text-muted)]">Demande à rejoindre pour voir le fil.</p>
</div>
```
(ne pas appeler `/feed` dans ce cas — il renverrait 403.)

- [ ] **Step 4: Bandeau invitation**

Charger `GET /api/community-invites/mine` (ou détecter `c.requestState === "invited"`). Si `c.requestState === "invited"`, afficher un bandeau :
```tsx
<div className="mb-4 flex items-center justify-between rounded-2xl border border-[var(--color-primary)] bg-[color-mix(in_srgb,var(--color-primary)_10%,transparent)] p-3">
  <span className="text-sm font-semibold">Tu es invité à rejoindre cette communauté.</span>
  <span className="flex gap-2">
    <button onClick={() => respondInvite("accept")} className="rounded-full bg-[var(--color-primary)] px-3 py-1 text-sm font-semibold text-white">Accepter</button>
    <button onClick={() => respondInvite("decline")} className="rounded-full border border-[var(--color-border)] px-3 py-1 text-sm">Refuser</button>
  </span>
</div>
```
avec `respondInvite` qui appelle `POST /api/community-invites/<reqId>` — récupérer le `reqId` via `myInvites`. (Stocker l'invite courante en état après fetch de `/api/community-invites/mine` filtré sur `community.id`.)

- [ ] **Step 5: Panneau modération (owner/mod)**

Si `c.canModerate`, afficher une section « Demandes (`c.pendingCount`) » qui charge `GET /api/communities/:id/requests` et, pour chacune, des boutons Approuver/Refuser (`POST …/requests/:reqId` `{action}`), puis recharge la liste + le DTO. Ajouter un champ « Inviter par @username » (`POST …/invite` `{username}`) avec toast succès/erreur.

- [ ] **Step 6: Liste des membres + rôles + visibilité (owner)**

Si membre, charger `GET /api/communities/:id/members` et afficher la liste avec un badge de rôle (owner/mod/membre). Si `c.role === "owner"`, pour chaque membre ≠ owner, un bouton bascule « Promouvoir mod » / « Rétrograder » (`POST …/members/:userId/role` `{role}`), et un toggle de visibilité publique/privée (`POST …/visibility`).

- [ ] **Step 7: Typecheck + commit**

Run: `cd /home/chamberlain/Desktop/Claude/vulu && node_modules/.bin/tsc --noEmit`
Expected: tsc 0.

```bash
cd /home/chamberlain/Desktop/Claude/vulu
git add "src/app/communaute/[id]/CommunityClient.tsx"
git commit -m "feat(vulu): UI page communauté — demande/invitation, modération, membres, visibilité"
```

---

### Task 11: Vérification end-to-end + roadmap

**Files:**
- Modify: `docs/superpowers/ROADMAP.md`

- [ ] **Step 1: Suite complète + typecheck**

Run: `cd /home/chamberlain/Desktop/Claude/vulu && node_modules/.bin/tsc --noEmit && npx vitest run`
Expected: tsc 0, tous verts.

- [ ] **Step 2: Vérification live**

Serveur dev (sinon `MONGODB_URI="mongodb://127.0.0.1:43793/" npm run dev` en arrière-plan). Login démo (`demo@vulu.app` / `password1`, qui est vulu+). Scénario via `curl` avec cookie :
- Créer une communauté **privée** (`POST /api/communities {visibility:"private"}`).
- Avec un 2e compte (bob), `POST /api/communities/:id/join` → vérifier qu'aucun membership n'est créé et que `GET /api/communities/:id` renvoie `requestState:"requested"` pour bob.
- `GET /api/communities/:id/feed` en tant que bob → **403**.
- En tant que démo (owner), `GET /api/communities/:id/requests` → 1 demande ; `POST …/requests/:reqId {action:"approve"}` → bob devient membre ; son `feed` repasse à 200.
- `POST /api/communities/:id/visibility {visibility:"public"}` → ok.

- [ ] **Step 3: Reseed (si la base de démo a servi) + ROADMAP + commit**

Si nécessaire : `MONGODB_URI="mongodb://127.0.0.1:43793/" node scripts/seed-demo.mjs`.
Marquer dans `docs/superpowers/ROADMAP.md` la section « Communautés privées & modération » comme **LIVRÉ** (déplacer du backlog vers livré, avec la liste des fonctions/routes). Puis :

```bash
cd /home/chamberlain/Desktop/Claude/vulu
git add docs/superpowers/ROADMAP.md
git commit -m "docs(vulu): roadmap — communautés privées & modération livrées"
```

---

## Notes de cohérence (raffinements du spec)

- **Invitation par username exact** : `inviteToCommunity(actor, communityId, targetUsername)` résout
  via `deps.users.findByUsername` (pas d'autocomplétion). `NotFoundError` si introuvable.
- **Rétro-compat** : `fromMembershipDoc` backfille `role:"member"` ; les memberships d'owner
  écrits avant ce lot deviendraient « member », mais `present`/`canModerate` reposent sur le
  rôle stocké — comme il n'existe **aucune** communauté seedée ni en base de démo avant ce lot,
  aucun owner legacy n'est concerné. Les nouvelles créations posent `role:"owner"`.
- **Pas de notifications** de demandes/invitations dans ce lot (bandeau + panneau suffisent).
- **Le fil privé** n'est jamais chargé côté client pour un non-membre (évite le 403).
