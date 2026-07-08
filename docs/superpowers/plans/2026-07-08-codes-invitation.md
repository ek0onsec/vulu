# Codes d'invitation — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rendre l'inscription conditionnée à un code d'invitation, donner à chaque utilisateur un code permanent partageable, et afficher dans ses paramètres le nombre et la liste de ses filleuls.

**Architecture:** Hexagonal, comme le reste du repo. Deux champs ajoutés à `User` (`inviteCode`, `invitedBy`). La validation du code se fait à la frontière HTTP via un nouveau service `registerWithInvite` qui délègue à `registerUser` (rétro-compatible : ce dernier ne gagne qu'un `invitedBy?` optionnel et génère le code en interne). Backfill lazy des comptes existants au premier `getMyInvite`. Codes fondateurs injectés depuis l'environnement.

**Tech Stack:** Next.js 16 (App Router), TypeScript strict, MongoDB, Zod, Vitest.

## Global Constraints

- **Aucune mention d'IA/Claude** dans le code, l'app ou les commits ; pas de co-author IA. (Les commits de ce plan n'ajoutent PAS de trailer `Co-Authored-By`.)
- TypeScript strict : pas de `any`, types complets.
- Toute dépendance externe derrière une interface (port) ; injection via `Deps`.
- Validation des entrées à la frontière (Zod côté HTTP).
- Alphabet du code : `ABCDEFGHJKMNPQRSTUVWXYZ23456789` (majuscules, sans `O/0/I/1/L`), 8 caractères.
- Comparaison des codes **insensible à la casse** (normalisation en majuscules).
- Lien Discord (constante inline) : `https://discord.gg/apREpGzK7K`.
- Après chaque tâche : `npx tsc --noEmit` et `npx vitest run` doivent passer.

---

### Task 1: Port + adaptateur `InviteCodeGenerator`, câblage `Deps` (générateur + codes fondateurs + env)

**Files:**
- Modify: `src/server/ports/security.ts` (ajouter l'interface `InviteCodeGenerator`)
- Create: `src/server/adapters/security/random-invite-code-generator.ts`
- Modify: `src/lib/env.ts` (variable `INVITE_FOUNDER_CODES`)
- Modify: `src/server/container.ts` (champs `inviteCodes` + `founderCodes` dans `Deps`, `makeInMemoryDeps`, `getDeps`)
- Test: `tests/adapters/invite-code-generator.test.ts`

**Interfaces:**
- Produces:
  - `interface InviteCodeGenerator { next(): string }`
  - `class RandomInviteCodeGenerator implements InviteCodeGenerator`
  - `Deps.inviteCodes: InviteCodeGenerator`
  - `Deps.founderCodes: ReadonlySet<string>` (codes en MAJUSCULES)
  - `makeInMemoryDeps(catalog)` fournit par défaut `founderCodes = new Set(["TESTCODE"])`

- [ ] **Step 1: Write the failing test**

Create `tests/adapters/invite-code-generator.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { RandomInviteCodeGenerator } from "@/server/adapters/security/random-invite-code-generator";

describe("RandomInviteCodeGenerator", () => {
  const gen = new RandomInviteCodeGenerator();

  it("génère un code de 8 caractères de l'alphabet non ambigu", () => {
    for (let i = 0; i < 200; i++) {
      const code = gen.next();
      expect(code).toMatch(/^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{8}$/);
    }
  });

  it("génère des codes variés (pas de constante)", () => {
    const codes = new Set(Array.from({ length: 50 }, () => gen.next()));
    expect(codes.size).toBeGreaterThan(40);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/adapters/invite-code-generator.test.ts`
Expected: FAIL — module `random-invite-code-generator` introuvable.

- [ ] **Step 3: Add the port interface**

In `src/server/ports/security.ts`, add after the `IdGenerator` interface:

```ts
export interface InviteCodeGenerator {
  /** Un code brut de 8 caractères. L'unicité est vérifiée par l'appelant. */
  next(): string;
}
```

- [ ] **Step 4: Implement the adapter**

Create `src/server/adapters/security/random-invite-code-generator.ts`:

```ts
import { randomInt } from "node:crypto";
import type { InviteCodeGenerator } from "@/server/ports/security";

const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const LENGTH = 8;

export class RandomInviteCodeGenerator implements InviteCodeGenerator {
  next(): string {
    let code = "";
    for (let i = 0; i < LENGTH; i++) code += ALPHABET[randomInt(ALPHABET.length)];
    return code;
  }
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run tests/adapters/invite-code-generator.test.ts`
Expected: PASS.

- [ ] **Step 6: Wire env config**

In `src/lib/env.ts`, add inside the `schema` object (after `TRUSTED_PROXY_HOPS`):

```ts
  // Codes d'invitation « fondateurs » (séparés par des virgules) permettant les
  // premières inscriptions sur une base vierge. Optionnel.
  INVITE_FOUNDER_CODES: z.string().optional(),
```

- [ ] **Step 7: Wire `Deps`**

In `src/server/container.ts`:

1. Add the import near the other security adapters:

```ts
import { RandomInviteCodeGenerator } from "@/server/adapters/security/random-invite-code-generator";
```

2. Add the two fields to the `Deps` interface (after `ids: IdGenerator;`):

```ts
  inviteCodes: InviteCodeGenerator;
  founderCodes: ReadonlySet<string>;
```

Add `InviteCodeGenerator` to the existing import from `@/server/ports/security`.

3. In `makeInMemoryDeps`, add to the returned object (after `ids: new UuidIdGenerator(),`):

```ts
    inviteCodes: new RandomInviteCodeGenerator(),
    founderCodes: new Set(["TESTCODE"]),
```

4. In `getDeps`, add to the `realDeps` object (after `ids: new UuidIdGenerator(),`):

```ts
    inviteCodes: new RandomInviteCodeGenerator(),
    founderCodes: new Set(
      (env.INVITE_FOUNDER_CODES ?? "")
        .split(",")
        .map((c) => c.trim().toUpperCase())
        .filter((c) => c.length > 0),
    ),
```

(`env` is already available in `getDeps` via `getEnv()`.)

- [ ] **Step 8: Verify typecheck and full suite**

Run: `npx tsc --noEmit && npx vitest run`
Expected: no type errors; all tests pass (existing suite unaffected — new `Deps` fields have in-memory defaults).

- [ ] **Step 9: Commit**

```bash
git add src/server/ports/security.ts src/server/adapters/security/random-invite-code-generator.ts src/lib/env.ts src/server/container.ts tests/adapters/invite-code-generator.test.ts
git commit -m "feat(vulu): générateur de codes d'invitation + câblage config (env, Deps)"
```

---

### Task 2: Champs `User` + méthodes repo `findByInviteCode` / `listByInviter`

**Files:**
- Modify: `src/server/domain/entities.ts` (champs `inviteCode`, `invitedBy` sur `User`)
- Modify: `src/server/ports/repositories.ts` (2 méthodes sur `UserRepository`)
- Modify: `src/server/adapters/memory/index.ts` (`InMemoryUserRepository`)
- Modify: `src/server/adapters/mongo/repositories.ts` (`MongoUserRepository`)
- Modify: `src/server/adapters/mongo/mappers.ts` (`fromUserDoc` : défaut `invitedBy`)
- Modify: `src/server/adapters/mongo/indexes.ts` (index unique sparse sur `inviteCode`)
- Test: `tests/adapters/user-invite-repo.test.ts`

**Interfaces:**
- Consumes: entité `User`.
- Produces:
  - `User.inviteCode: string`
  - `User.invitedBy: string | null`
  - `UserRepository.findByInviteCode(code: string): Promise<User | null>`
  - `UserRepository.listByInviter(inviterId: string): Promise<User[]>`

- [ ] **Step 1: Write the failing test**

Create `tests/adapters/user-invite-repo.test.ts`:

```ts
import { describe, it, expect, beforeEach } from "vitest";
import { InMemoryUserRepository } from "@/server/adapters/memory";
import type { User } from "@/server/domain/entities";

function makeUser(over: Partial<User>): User {
  return {
    id: "u", email: "e", passwordHash: "h", username: "n", displayName: "N",
    bio: null, avatarUrl: null, bannerUrl: null, activeTabs: ["films"],
    tastes: { filmGenreIds: [], people: [] }, showcase: { movie: [], tv: [], book: [] },
    plus: false, staff: false, private: false, twoFactorEnabled: false,
    twoFactorSecret: null, twoFactorBackupCodes: [], deactivatedAt: null,
    notificationsSeenAt: null, tourCompletedAt: null, createdAt: new Date(),
    inviteCode: "AAAA1111", invitedBy: null, ...over,
  };
}

describe("InMemoryUserRepository invite methods", () => {
  let repo: InMemoryUserRepository;
  beforeEach(() => { repo = new InMemoryUserRepository(); });

  it("findByInviteCode retrouve l'utilisateur par son code", async () => {
    await repo.create(makeUser({ id: "u1", inviteCode: "CODE1234" }));
    expect((await repo.findByInviteCode("CODE1234"))?.id).toBe("u1");
    expect(await repo.findByInviteCode("NOPE0000")).toBeNull();
  });

  it("listByInviter liste les filleuls d'un parrain", async () => {
    await repo.create(makeUser({ id: "parrain", inviteCode: "PARRAIN1" }));
    await repo.create(makeUser({ id: "f1", email: "f1", username: "f1", inviteCode: "F1CODE22", invitedBy: "parrain" }));
    await repo.create(makeUser({ id: "f2", email: "f2", username: "f2", inviteCode: "F2CODE33", invitedBy: "parrain" }));
    await repo.create(makeUser({ id: "other", email: "o", username: "o", inviteCode: "OTHER444", invitedBy: null }));
    const filleuls = await repo.listByInviter("parrain");
    expect(filleuls.map((u) => u.id).sort()).toEqual(["f1", "f2"]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/adapters/user-invite-repo.test.ts`
Expected: FAIL — `findByInviteCode` / `listByInviter` n'existent pas.

- [ ] **Step 3: Add entity fields**

In `src/server/domain/entities.ts`, add to the `User` interface (after `createdAt: Date;` or near the end, before the closing brace):

```ts
  inviteCode: string;        // code d'invitation permanent, unique, partageable
  invitedBy: string | null;  // id du parrain (null si code fondateur / compte pré-invite)
```

- [ ] **Step 4: Add port methods**

In `src/server/ports/repositories.ts`, inside `interface UserRepository`, after `findByIds(...)`:

```ts
  /** Retrouve un utilisateur par son code d'invitation (déjà normalisé en majuscules). */
  findByInviteCode(code: string): Promise<User | null>;
  /** Liste les utilisateurs parrainés par `inviterId` (filleuls). */
  listByInviter(inviterId: string): Promise<User[]>;
```

- [ ] **Step 5: Implement in-memory methods**

In `src/server/adapters/memory/index.ts`, inside `InMemoryUserRepository`, after `findByIds`:

```ts
  async findByInviteCode(code: string) { return [...this.byId.values()].find((u) => u.inviteCode === code) ?? null; }
  async listByInviter(inviterId: string) { return [...this.byId.values()].filter((u) => u.invitedBy === inviterId); }
```

- [ ] **Step 6: Implement Mongo methods**

In `src/server/adapters/mongo/repositories.ts`, inside `MongoUserRepository`, after `findByIds`:

```ts
  async findByInviteCode(code: string) { const d = await this.col.findOne({ inviteCode: code }); return d ? M.fromUserDoc(d) : null; }
  async listByInviter(inviterId: string) { return (await this.col.find({ invitedBy: inviterId }).toArray()).map(M.fromUserDoc); }
```

- [ ] **Step 7: Default `invitedBy` in the mapper**

In `src/server/adapters/mongo/mappers.ts`, in `fromUserDoc`, add a default so anciens documents (sans le champ) restent cohérents:

```ts
export const fromUserDoc = (d: WithIdUser): User => ({
  ...strip(d),
  twoFactorSecret: d.twoFactorSecret ?? null,
  twoFactorBackupCodes: d.twoFactorBackupCodes ?? [],
  tourCompletedAt: d.tourCompletedAt ?? null,
  invitedBy: d.invitedBy ?? null,
});
```

(`inviteCode` n'a pas de défaut sûr dans un mapper pur : les anciens comptes le reçoivent au premier `getMyInvite`, cf. Task 5.)

- [ ] **Step 8: Add the unique sparse index**

In `src/server/adapters/mongo/indexes.ts`, add to the `users` `createIndexes` array:

```ts
    { key: { inviteCode: 1 }, unique: true, sparse: true, name: "uniq_invite_code" },
```

et, hors du bloc unique (nouvelle ligne après le bloc users), un index simple pour les filleuls :

```ts
  await db.collection("users").createIndex({ invitedBy: 1 }, { name: "by_inviter" });
```

- [ ] **Step 9: Run tests to verify they pass**

Run: `npx vitest run tests/adapters/user-invite-repo.test.ts`
Expected: PASS.

- [ ] **Step 10: Verify typecheck and full suite**

Run: `npx tsc --noEmit && npx vitest run`
Expected: type errors possible dans les tests qui construisent un `User` littéral SANS les nouveaux champs. Si `tsc` signale de tels emplacements dans `tests/`, ajouter `inviteCode: "XXXXXXXX", invitedBy: null` au littéral concerné. Ne PAS toucher au code de production pour ça. Relancer jusqu'au vert.

- [ ] **Step 11: Commit**

```bash
git add src/server/domain/entities.ts src/server/ports/repositories.ts src/server/adapters/ tests/adapters/user-invite-repo.test.ts
git commit -m "feat(vulu): champs inviteCode/invitedBy sur User + accès repo (findByInviteCode, listByInviter)"
```

---

### Task 3: `registerUser` génère le code propre + accepte `invitedBy` optionnel

**Files:**
- Create: `src/server/application/invite-code.ts` (`generateUniqueInviteCode`)
- Modify: `src/server/application/register-user.ts`
- Test: `tests/application/register-user.test.ts` (ajouts)

**Interfaces:**
- Consumes: `Deps.inviteCodes`, `deps.users.findByInviteCode`.
- Produces:
  - `generateUniqueInviteCode(deps: Deps): Promise<string>`
  - `RegisterInput` gagne `invitedBy?: string | null` (optionnel, défaut `null`)
  - Tout utilisateur créé par `registerUser` a un `inviteCode` unique non vide.

- [ ] **Step 1: Write the failing test**

Append to `tests/application/register-user.test.ts` (dans le `describe("registerUser", ...)`):

```ts
  it("attribue un code d'invitation unique au nouvel inscrit", async () => {
    const a = await registerUser(deps, { ...base });
    const b = await registerUser(deps, { ...base, email: "b@x.io", username: "bob" });
    expect(a.inviteCode).toMatch(/^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{8}$/);
    expect(b.inviteCode).not.toBe(a.inviteCode);
    expect(await deps.users.findByInviteCode(a.inviteCode)).not.toBeNull();
  });

  it("invitedBy vaut null par défaut et reflète l'argument fourni", async () => {
    const solo = await registerUser(deps, { ...base });
    expect(solo.invitedBy).toBeNull();
    const filleul = await registerUser(deps, { ...base, email: "c@x.io", username: "carol", invitedBy: solo.id });
    expect(filleul.invitedBy).toBe(solo.id);
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/application/register-user.test.ts`
Expected: FAIL — `inviteCode` undefined / `invitedBy` non géré.

- [ ] **Step 3: Create the unique-code helper**

Create `src/server/application/invite-code.ts`:

```ts
import type { Deps } from "@/server/container";

/** Génère un code d'invitation garanti unique (retry sur collision). */
export async function generateUniqueInviteCode(deps: Deps): Promise<string> {
  for (let attempt = 0; attempt < 10; attempt++) {
    const code = deps.inviteCodes.next();
    if (!(await deps.users.findByInviteCode(code))) return code;
  }
  throw new Error("Impossible de générer un code d'invitation unique");
}
```

- [ ] **Step 4: Update `registerUser`**

In `src/server/application/register-user.ts`:

1. Add the import:

```ts
import { generateUniqueInviteCode } from "./invite-code";
```

2. Add `invitedBy` to `RegisterInput`:

```ts
  activeTabs: readonly Domain[];
  tastes: Tastes;
  invitedBy?: string | null;
```

3. Generate the code before building the user object (after the `findByUsername` check):

```ts
  const inviteCode = await generateUniqueInviteCode(deps);
```

4. Add the two fields to the `user` object literal (after `createdAt: deps.clock.now(),`):

```ts
    inviteCode,
    invitedBy: input.invitedBy ?? null,
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run tests/application/register-user.test.ts`
Expected: PASS.

- [ ] **Step 6: Verify full suite**

Run: `npx tsc --noEmit && npx vitest run`
Expected: all green (les 21 fichiers appelant `registerUser` sans `invitedBy` restent valides — champ optionnel).

- [ ] **Step 7: Commit**

```bash
git add src/server/application/invite-code.ts src/server/application/register-user.ts tests/application/register-user.test.ts
git commit -m "feat(vulu): registerUser attribue un code d'invitation unique + parrain optionnel"
```

---

### Task 4: Service `registerWithInvite` (validation du code à l'inscription)

**Files:**
- Modify: `src/server/application/register-user.ts` (ajouter `registerWithInvite`)
- Test: `tests/application/register-with-invite.test.ts`

**Interfaces:**
- Consumes: `registerUser`, `deps.founderCodes`, `deps.users.findByInviteCode`.
- Produces:
  - `registerWithInvite(deps: Deps, input: RegisterInput & { inviteCode: string }): Promise<User>`
  - Rejette `ValidationError("Code d'invitation invalide")` si le code n'est ni fondateur ni celui d'un utilisateur.

- [ ] **Step 1: Write the failing test**

Create `tests/application/register-with-invite.test.ts`:

```ts
import { describe, it, expect, beforeEach } from "vitest";
import { makeInMemoryDeps, type Deps } from "@/server/container";
import { FakeCatalog } from "../helpers/fake-catalog";
import { registerUser, registerWithInvite } from "@/server/application/register-user";
import { ValidationError } from "@/server/domain/errors";

let deps: Deps;
const base = { email: "a@x.io", username: "alice", displayName: "Alice", password: "password1",
  activeTabs: ["films"] as const, tastes: { filmGenreIds: [878, 18, 35], people: [] } };

beforeEach(() => { deps = makeInMemoryDeps(new FakeCatalog()); }); // founderCodes = {"TESTCODE"}

describe("registerWithInvite", () => {
  it("accepte un code fondateur (invitedBy null)", async () => {
    const u = await registerWithInvite(deps, { ...base, inviteCode: "TESTCODE" });
    expect(u.invitedBy).toBeNull();
    expect(u.inviteCode).toMatch(/^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{8}$/);
  });

  it("accepte le code d'un utilisateur existant et fixe invitedBy sur le parrain", async () => {
    const parrain = await registerUser(deps, { ...base });
    const filleul = await registerWithInvite(deps, {
      ...base, email: "b@x.io", username: "bob", inviteCode: parrain.inviteCode,
    });
    expect(filleul.invitedBy).toBe(parrain.id);
  });

  it("accepte un code en minuscules (insensible à la casse)", async () => {
    const parrain = await registerUser(deps, { ...base });
    const filleul = await registerWithInvite(deps, {
      ...base, email: "c@x.io", username: "carol", inviteCode: parrain.inviteCode.toLowerCase(),
    });
    expect(filleul.invitedBy).toBe(parrain.id);
  });

  it("rejette un code inconnu", async () => {
    await expect(
      registerWithInvite(deps, { ...base, email: "d@x.io", username: "dave", inviteCode: "ZZZZ9999" }),
    ).rejects.toThrow(ValidationError);
  });

  it("rejette un code vide", async () => {
    await expect(
      registerWithInvite(deps, { ...base, email: "e@x.io", username: "erin", inviteCode: "   " }),
    ).rejects.toThrow(ValidationError);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/application/register-with-invite.test.ts`
Expected: FAIL — `registerWithInvite` n'existe pas.

- [ ] **Step 3: Implement `registerWithInvite`**

In `src/server/application/register-user.ts`, append at the end of the file:

```ts
/**
 * Inscription conditionnée à un code d'invitation. Valide le code (fondateur ou code d'un
 * membre), résout le parrain, puis délègue à `registerUser`. La validation vit ici, à la
 * frontière applicative de l'inscription.
 */
export async function registerWithInvite(
  deps: Deps,
  input: RegisterInput & { inviteCode: string },
): Promise<User> {
  const code = input.inviteCode.trim().toUpperCase();
  if (!code) throw new ValidationError("Code d'invitation invalide");
  const inviter = deps.founderCodes.has(code) ? null : await deps.users.findByInviteCode(code);
  if (!deps.founderCodes.has(code) && !inviter) throw new ValidationError("Code d'invitation invalide");
  return registerUser(deps, { ...input, invitedBy: inviter?.id ?? null });
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/application/register-with-invite.test.ts`
Expected: PASS.

- [ ] **Step 5: Verify full suite**

Run: `npx tsc --noEmit && npx vitest run`
Expected: all green.

- [ ] **Step 6: Commit**

```bash
git add src/server/application/register-user.ts tests/application/register-with-invite.test.ts
git commit -m "feat(vulu): validation du code d'invitation à l'inscription (registerWithInvite)"
```

---

### Task 5: Service `getMyInvite` (code + compteur + liste des filleuls, backfill lazy)

**Files:**
- Create: `src/server/application/invite.ts`
- Test: `tests/application/get-my-invite.test.ts`

**Interfaces:**
- Consumes: `deps.users`, `generateUniqueInviteCode`.
- Produces:
  - `interface InviteInfo { code: string; invitedCount: number; invitees: InviteeCard[] }`
  - `interface InviteeCard { id: string; username: string; displayName: string; avatarUrl: string | null }`
  - `getMyInvite(deps: Deps, userId: string): Promise<InviteInfo>`

- [ ] **Step 1: Write the failing test**

Create `tests/application/get-my-invite.test.ts`:

```ts
import { describe, it, expect, beforeEach } from "vitest";
import { makeInMemoryDeps, type Deps } from "@/server/container";
import { FakeCatalog } from "../helpers/fake-catalog";
import { registerUser, registerWithInvite } from "@/server/application/register-user";
import { getMyInvite } from "@/server/application/invite";
import { NotFoundError } from "@/server/domain/errors";

let deps: Deps;
const base = { email: "a@x.io", username: "alice", displayName: "Alice", password: "password1",
  activeTabs: ["films"] as const, tastes: { filmGenreIds: [878, 18, 35], people: [] } };

beforeEach(() => { deps = makeInMemoryDeps(new FakeCatalog()); });

describe("getMyInvite", () => {
  it("retourne le code, le compteur et la liste des filleuls", async () => {
    const parrain = await registerUser(deps, { ...base });
    await registerWithInvite(deps, { ...base, email: "b@x.io", username: "bob", displayName: "Bob", inviteCode: parrain.inviteCode });
    await registerWithInvite(deps, { ...base, email: "c@x.io", username: "carol", displayName: "Carol", inviteCode: parrain.inviteCode });

    const info = await getMyInvite(deps, parrain.id);
    expect(info.code).toBe(parrain.inviteCode);
    expect(info.invitedCount).toBe(2);
    expect(info.invitees.map((i) => i.username).sort()).toEqual(["bob", "carol"]);
    expect(info.invitees[0]).toHaveProperty("displayName");
    expect(info.invitees[0]).toHaveProperty("avatarUrl");
  });

  it("génère et persiste un code pour un compte sans code (backfill lazy)", async () => {
    const u = await registerUser(deps, { ...base });
    // Simule un ancien compte sans code.
    await deps.users.update({ ...u, inviteCode: "" as unknown as string });
    const info = await getMyInvite(deps, u.id);
    expect(info.code).toMatch(/^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{8}$/);
    expect((await deps.users.findById(u.id))?.inviteCode).toBe(info.code);
  });

  it("rejette un utilisateur inconnu", async () => {
    await expect(getMyInvite(deps, "nope")).rejects.toThrow(NotFoundError);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/application/get-my-invite.test.ts`
Expected: FAIL — module `invite` introuvable.

- [ ] **Step 3: Implement the service**

Create `src/server/application/invite.ts`:

```ts
import type { Deps } from "@/server/container";
import { NotFoundError } from "@/server/domain/errors";
import { generateUniqueInviteCode } from "./invite-code";

export interface InviteeCard {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
}
export interface InviteInfo {
  code: string;
  invitedCount: number;
  invitees: InviteeCard[];
}

export async function getMyInvite(deps: Deps, userId: string): Promise<InviteInfo> {
  const user = await deps.users.findById(userId);
  if (!user) throw new NotFoundError("Utilisateur introuvable");

  // Backfill lazy : les comptes antérieurs à la feature n'ont pas encore de code.
  let code = user.inviteCode;
  if (!code) {
    code = await generateUniqueInviteCode(deps);
    await deps.users.update({ ...user, inviteCode: code });
  }

  const invitees: InviteeCard[] = (await deps.users.listByInviter(userId)).map((u) => ({
    id: u.id, username: u.username, displayName: u.displayName, avatarUrl: u.avatarUrl,
  }));
  return { code, invitedCount: invitees.length, invitees };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/application/get-my-invite.test.ts`
Expected: PASS.

- [ ] **Step 5: Verify full suite**

Run: `npx tsc --noEmit && npx vitest run`
Expected: all green.

- [ ] **Step 6: Commit**

```bash
git add src/server/application/invite.ts tests/application/get-my-invite.test.ts
git commit -m "feat(vulu): service getMyInvite (code, compteur, filleuls) avec backfill lazy"
```

---

### Task 6: Câblage HTTP (schéma Zod + route register + route `GET /api/me/invite`)

**Files:**
- Modify: `src/lib/zod-schemas.ts` (`registerSchema`)
- Modify: `src/app/api/auth/register/route.ts` (utiliser `registerWithInvite`)
- Create: `src/app/api/me/invite/route.ts`
- Test: `tests/api/auth.test.ts` (ajout d'un cas invite si le fichier teste déjà la route register)

**Interfaces:**
- Consumes: `registerWithInvite`, `getMyInvite`, `requireUser`, `json`.
- Produces:
  - `registerSchema` exige `inviteCode: string` (min 1).
  - `GET /api/me/invite` → `{ code, invitedCount, invitees }`.

- [ ] **Step 1: Inspect the existing register API test**

Run: `sed -n '1,60p' tests/api/auth.test.ts`
Objectif : voir comment la route register est testée (payload envoyé) pour y ajouter `inviteCode` et éviter de casser le test.

- [ ] **Step 2: Update the Zod schema**

In `src/lib/zod-schemas.ts`, add to `registerSchema` (after `tastes: tastesSchema,`):

```ts
  inviteCode: z.string().min(1),
```

- [ ] **Step 3: Update the register route**

In `src/app/api/auth/register/route.ts`:

1. Replace the import of `registerUser` with `registerWithInvite`:

```ts
import { registerWithInvite } from "@/server/application/register-user";
```

2. Replace the call `await registerUser(deps, input);` with:

```ts
    await registerWithInvite(deps, input);
```

(`input` now includes `inviteCode`, validated by Zod. `ValidationError` is already mapped to a 400 by `toErrorResponse`.)

- [ ] **Step 4: Create the invite route**

Create `src/app/api/me/invite/route.ts`:

```ts
import { getDeps } from "@/server/container";
import { getMyInvite } from "@/server/application/invite";
import { requireUser, json } from "@/server/http/session";
import { toErrorResponse } from "@/server/http/errors";

export async function GET() {
  try {
    const user = await requireUser();
    return json(await getMyInvite(await getDeps(), user.id));
  } catch (e) { return toErrorResponse(e); }
}
```

- [ ] **Step 5: Fix the existing register API test**

If `tests/api/auth.test.ts` posts to the register route, add `inviteCode: "TESTCODE"` to that payload (the in-memory deps founder set contains it). If the test builds deps differently, ensure a valid founder code or seed a user whose `inviteCode` is used.

Run: `npx vitest run tests/api/auth.test.ts`
Expected: PASS.

- [ ] **Step 6: Verify full suite + typecheck**

Run: `npx tsc --noEmit && npx vitest run`
Expected: all green.

- [ ] **Step 7: Commit**

```bash
git add src/lib/zod-schemas.ts src/app/api/auth/register/route.ts src/app/api/me/invite/route.ts tests/api/auth.test.ts
git commit -m "feat(vulu): code d'invitation requis à l'inscription (HTTP) + route GET /api/me/invite"
```

---

### Task 7: UI inscription — champ code + note Discord

**Files:**
- Modify: `src/lib/signup.ts` (`SignupDraft` gagne `inviteCode`)
- Modify: `src/app/(auth)/register/page.tsx`

**Interfaces:**
- Consumes: `SignupDraft`, POST `/api/auth/register` (envoyé par la page onboarding, qui spread déjà `draft`).
- Produces: `SignupDraft.inviteCode: string`.

- [ ] **Step 1: Extend `SignupDraft`**

In `src/lib/signup.ts`, add to the `SignupDraft` interface:

```ts
  inviteCode: string;
```

- [ ] **Step 2: Add the field to the register form**

In `src/app/(auth)/register/page.tsx`:

1. Add `inviteCode: ""` to the initial `useState` draft object:

```ts
  const [draft, setDraft] = useState<SignupDraft>({
    email: "", username: "", displayName: "", password: "", activeTabs: ["films"], inviteCode: "",
  });
```

2. Add a front validation in `next(...)`, before `setBusy(true)` (after the password check):

```ts
    if (!draft.inviteCode.trim()) { setError("Un code d'invitation est requis"); return; }
```

3. Add the input + Discord note in the form, right after the password `<input>`:

```tsx
        <input className={field} placeholder="Code d'invitation" value={draft.inviteCode}
          onChange={(e) => setDraft({ ...draft, inviteCode: e.target.value.toUpperCase() })} required />
        <p className="-mt-1 text-xs text-[var(--color-text-muted)]">
          Pas de code d'invitation ?{" "}
          <a href="https://discord.gg/apREpGzK7K" target="_blank" rel="noreferrer"
            className="font-semibold text-[var(--color-primary)]">Rejoins le Discord</a>
        </p>
```

- [ ] **Step 3: Verify typecheck + build**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Manual verification (documented)**

Run the app (`npm run dev`) and confirm on `/register`:
- Le champ « Code d'invitation » apparaît, saisie forcée en majuscules.
- La note « Pas de code d'invitation ? Rejoins le Discord » pointe vers `https://discord.gg/apREpGzK7K` (nouvel onglet).
- Soumettre sans code affiche l'erreur ; avec un code invalide, l'erreur serveur « Code d'invitation invalide » s'affiche après l'étape onboarding.

- [ ] **Step 5: Commit**

```bash
git add src/lib/signup.ts "src/app/(auth)/register/page.tsx"
git commit -m "feat(vulu): champ code d'invitation à l'inscription + lien Discord de secours"
```

---

### Task 8: UI paramètres — section « Parrainage »

**Files:**
- Create: `src/components/InviteSection.tsx`
- Modify: `src/app/parametres/SettingsClient.tsx`

**Interfaces:**
- Consumes: `GET /api/me/invite` → `{ code, invitedCount, invitees }` ; `Avatar`, `Icon`, `toast`, `api`.
- Produces: nouvelle section réglages `invite`.

- [ ] **Step 1: Create the InviteSection component**

Create `src/components/InviteSection.tsx`:

```tsx
"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/api-client";
import { toast } from "@/lib/toast";
import { Avatar } from "@/components/Avatar";
import { Icon } from "@/components/Icon";
import type { InviteInfo } from "@/server/application/invite";

export function InviteSection() {
  const [info, setInfo] = useState<InviteInfo | null>(null);

  useEffect(() => {
    api.get<InviteInfo>("/api/me/invite").then(setInfo).catch(() => setInfo(null));
  }, []);

  async function copy() {
    if (!info) return;
    try { await navigator.clipboard.writeText(info.code); toast("Code copié"); }
    catch { toast("Copie impossible", "error"); }
  }

  return (
    <>
      <h2 className="mb-4 font-display text-xl font-bold">Parrainage</h2>
      <p className="mb-4 text-sm text-[var(--color-text-muted)]">
        Partage ton code pour inviter de nouveaux membres sur vulu.
      </p>
      {info === null ? (
        <div className="h-12 animate-pulse rounded-xl bg-[var(--color-border)]" />
      ) : (
        <>
          <div className="mb-5 flex items-center gap-2">
            <span className="flex-1 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] px-4 py-2.5 font-mono text-lg font-bold tracking-widest">
              {info.code}
            </span>
            <button onClick={copy} aria-label="Copier le code"
              className="flex items-center gap-1.5 rounded-full bg-[var(--color-primary)] px-4 py-2.5 text-sm font-semibold text-white">
              <Icon name="copy" size={18} /> Copier
            </button>
          </div>
          <p className="mb-3 text-sm font-semibold">
            {info.invitedCount === 0
              ? "Personne n'a encore utilisé ton code."
              : `${info.invitedCount} personne${info.invitedCount > 1 ? "s" : ""} inscrite${info.invitedCount > 1 ? "s" : ""} grâce à ton code`}
          </p>
          <ul className="flex flex-col gap-1">
            {info.invitees.map((u) => (
              <li key={u.id} className="flex items-center gap-3 rounded-xl p-2">
                <Avatar name={u.displayName} src={u.avatarUrl} size={36} />
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold">{u.displayName}</span>
                  <span className="block truncate text-xs text-[var(--color-text-muted)]">@{u.username}</span>
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </>
  );
}
```

Note: si l'icône `copy` n'existe pas dans `src/components/Icon.tsx`, utiliser un nom d'icône déjà présent (vérifier via `grep -n "copy\|link\|share" src/components/Icon.tsx`) ; à défaut, retirer l'`<Icon>` et ne garder que le libellé « Copier ».

- [ ] **Step 2: Register the section in SettingsClient**

In `src/app/parametres/SettingsClient.tsx`:

1. Add the import:

```ts
import { InviteSection } from "@/components/InviteSection";
```

2. Add `"invite"` to the `SectionId` union type:

```ts
type SectionId = "account" | "plus" | "security" | "privacy" | "display" | "interests" | "accessibility" | "legal" | "community" | "invite";
```

3. Add an entry to the `SECTIONS` array (after the `community` entry):

```ts
  { id: "invite", label: "Parrainage", icon: "user-plus", desc: "Ton code d'invitation et tes filleuls" },
```

4. In `Panel()`, add a branch (before the final return / near the other `if (cur === ...)` blocks):

```tsx
    if (cur === "invite") return <InviteSection />;
```

- [ ] **Step 3: Verify typecheck**

Run: `npx tsc --noEmit`
Expected: no errors. (Si `icon: "user-plus"` n'est pas un `IconName` valide, choisir un nom présent dans `IconName`.)

- [ ] **Step 4: Full build verification**

Run: `npx next build`
Expected: build réussit, route `/parametres` et `/api/me/invite` présentes.

- [ ] **Step 5: Manual verification (documented)**

Dans `/parametres`, ouvrir « Parrainage » : le code s'affiche, le bouton Copier fonctionne (toast), le compteur et la liste des filleuls sont corrects.

- [ ] **Step 6: Commit**

```bash
git add src/components/InviteSection.tsx src/app/parametres/SettingsClient.tsx
git commit -m "feat(vulu): section Parrainage dans les paramètres (code, compteur, filleuls)"
```

---

## Self-Review

**Spec coverage :**
- Code requis à l'inscription → Tasks 4, 6 (registerWithInvite + registerSchema + route).
- Code permanent réutilisable par user → Tasks 2, 3 (champ + génération).
- Débloqué automatiquement à l'inscription → Task 3 (généré dans registerUser).
- Récupérer son code dans les paramètres → Tasks 5, 6, 8.
- Nombre de filleuls + liste → Tasks 5, 8.
- Bootstrap : backfill lazy → Task 5 ; codes fondateurs env → Task 1.
- Note Discord à l'inscription → Task 7.

**Placeholders :** aucun (tout le code est fourni ; les seules conditions « si l'icône n'existe pas » incluent l'action de repli exacte).

**Cohérence des types :** `RegisterInput.invitedBy?`, `registerWithInvite(input & { inviteCode })`, `InviteInfo`/`InviteeCard`, `Deps.inviteCodes`/`Deps.founderCodes`, `generateUniqueInviteCode(deps)` — noms et signatures identiques entre définitions (Tasks 1-5) et usages (Tasks 6-8).

**Portée :** un seul sous-système cohérent (invitation) — un seul plan.
```
