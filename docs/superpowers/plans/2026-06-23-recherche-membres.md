# Recherche de membres `@pseudo` — Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rechercher des membres depuis la barre de recherche en tapant `@pseudo`, via une section « Membres » affichée au-dessus du catalogue.

**Architecture :** Nouvelle méthode `searchByText` sur `UserRepository` (memory + Mongo, query regex échappée), un cas d'usage applicatif `searchUsers` renvoyant un DTO public slim, une route `GET /api/users/search`, et une section « Membres » dans `SearchClient` déclenchée par le préfixe `@`.

**Tech Stack :** Next.js 16 (App Router, route handlers), TypeScript strict (`noUncheckedIndexedAccess`), Vitest, MongoDB (driver natif) + mongodb-memory-server, zod v4, React 19, Tailwind v4.

## Global Constraints

- Toutes les commandes sont préfixées `cd /home/chamberlain/Desktop/Claude/vulu`.
- `tsc` : `node_modules/.bin/tsc --noEmit` doit rester vert.
- Tests : `npx vitest run` ; suite verte à 180 tests avant ce lot, doit le rester (+ nouveaux).
- Aucune mention d'IA / Claude dans le code, l'app ou les commits ; pas de co-auteur Claude.
- Ne pas toucher `lechatonfat/`. Stager uniquement des fichiers `vulu/`.
- Hexagonal : le domaine ne connaît pas Mongo ; toute requête externe passe par un port.
- Validation à la frontière HTTP (zod) ; jamais de regex non échappée construite depuis une entrée utilisateur.

## File Structure

- `src/server/ports/repositories.ts` — `UserRepository` gagne `searchByText`.
- `src/server/adapters/memory/index.ts` — `InMemoryUserRepository.searchByText`.
- `src/server/adapters/mongo/repositories.ts` — `MongoUserRepository.searchByText` (regex échappée).
- `src/server/application/search-users.ts` — **nouveau** : `searchUsers` + type `UserSearchResult`.
- `src/lib/zod-schemas.ts` — `userSearchSchema`.
- `src/app/api/users/search/route.ts` — **nouveau** : `GET` handler.
- `src/app/search/SearchClient.tsx` — section « Membres » déclenchée par `@`.
- Tests : `tests/adapters/memory.test.ts`, `tests/adapters/mongo-repositories.test.ts`, `tests/application/search-users.test.ts` (**nouveau**), `tests/lib/zod-schemas.test.ts`.

---

## Task 1 : `UserRepository.searchByText` (port + adaptateurs memory & Mongo)

**Files:**
- Modify: `src/server/ports/repositories.ts` (interface `UserRepository`, après `listRecent`)
- Modify: `src/server/adapters/memory/index.ts` (`InMemoryUserRepository`, après `listRecent`)
- Modify: `src/server/adapters/mongo/repositories.ts` (`MongoUserRepository`, après `listRecent`)
- Test: `tests/adapters/memory.test.ts`, `tests/adapters/mongo-repositories.test.ts`

**Interfaces:**
- Produces : `UserRepository.searchByText(query: string, limit: number): Promise<User[]>` — matche `username` OU `displayName` en `contains` insensible à la casse, trié par `username`, au plus `limit` résultats. La query est traitée littéralement (les métacaractères regex sont neutralisés côté Mongo).

- [ ] **Step 1 : Test mémoire**

Dans `tests/adapters/memory.test.ts`, repérer le `describe` du repo utilisateur (celui qui instancie `InMemoryUserRepository`). S'il n'existe pas de helper de création d'utilisateur, ajouter ce test autonome à la fin du fichier :

```ts
import { InMemoryUserRepository } from "@/server/adapters/memory";
import type { User } from "@/server/domain/entities";

const mkUser = (id: string, username: string, displayName: string): User => ({
  id, email: `${id}@x.io`, passwordHash: "h", username, displayName,
  bio: null, avatarUrl: null, bannerUrl: null, activeTabs: ["films"],
  tastes: { filmGenreIds: [], people: [] }, showcase: { movie: [], tv: [], book: [] },
  plus: false, staff: false, private: false, twoFactorEnabled: false,
  deactivatedAt: null, notificationsSeenAt: null, createdAt: new Date(),
});

describe("InMemoryUserRepository.searchByText", () => {
  it("matche username et displayName, insensible à la casse, respecte limit", async () => {
    const r = new InMemoryUserRepository();
    await r.create(mkUser("u1", "tom_92", "Thomas"));
    await r.create(mkUser("u2", "alice", "Alice T"));
    await r.create(mkUser("u3", "bob", "Bob"));
    expect((await r.searchByText("TOM", 10)).map((u) => u.id)).toEqual(["u1"]);
    expect((await r.searchByText("alice", 10)).map((u) => u.id)).toEqual(["u2"]);
    expect((await r.searchByText("o", 1)).length).toBe(1);
  });
});
```

(Vérifier l'import existant de `describe/it/expect` en tête de fichier ; réutiliser celui présent. Ajuster `InMemoryUserRepository` au nom d'export réel si déjà importé dans le fichier.)

- [ ] **Step 2 : Lancer, vérifier l'échec**

Run: `cd /home/chamberlain/Desktop/Claude/vulu && npx vitest run tests/adapters/memory.test.ts -t "searchByText"`
Expected: ÉCHEC — `searchByText` n'existe pas sur `InMemoryUserRepository`.

- [ ] **Step 3 : Port**

Dans `src/server/ports/repositories.ts`, dans `interface UserRepository`, après la ligne `listRecent(limit: number): Promise<User[]>;` ajouter :

```ts
  /** Recherche par username OU displayName (contains, insensible à la casse). */
  searchByText(query: string, limit: number): Promise<User[]>;
```

- [ ] **Step 4 : Adaptateur mémoire**

Dans `src/server/adapters/memory/index.ts`, dans `InMemoryUserRepository`, après la méthode `listRecent`, ajouter :

```ts
  async searchByText(query: string, limit: number) {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return [...this.byId.values()]
      .filter((u) => u.username.toLowerCase().includes(q) || u.displayName.toLowerCase().includes(q))
      .sort((a, b) => a.username.localeCompare(b.username))
      .slice(0, limit);
  }
```

- [ ] **Step 5 : Adaptateur Mongo**

Dans `src/server/adapters/mongo/repositories.ts`, dans `MongoUserRepository`, après la méthode `listRecent`, ajouter (échappement des métacaractères regex pour éviter toute injection / ReDoS) :

```ts
  async searchByText(query: string, limit: number) {
    const q = query.trim();
    if (!q) return [];
    const esc = q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const rx = { $regex: esc, $options: "i" };
    return (await this.col.find({ $or: [{ username: rx }, { displayName: rx }] })
      .sort({ username: 1 }).limit(limit).toArray()).map(M.fromUserDoc);
  }
```

- [ ] **Step 6 : Test Mongo (incluant garde-fou anti-injection)**

Dans `tests/adapters/mongo-repositories.test.ts`, ajouter un test dans le bloc qui dispose d'une instance `MongoUserRepository` (réutiliser le setup `beforeAll`/`db` existant). Si un seul repo y est testé, suivre le même modèle d'instanciation :

```ts
it("MongoUserRepository.searchByText matche username/displayName et échappe les regex", async () => {
  const r = new MongoUserRepository(db);
  const base = (id: string, username: string, displayName: string) => ({
    id, email: `${id}@x.io`, passwordHash: "h", username, displayName,
    bio: null, avatarUrl: null, bannerUrl: null, activeTabs: ["films"] as const,
    tastes: { filmGenreIds: [], people: [] }, showcase: { movie: [], tv: [], book: [] },
    plus: false, staff: false, private: false, twoFactorEnabled: false,
    deactivatedAt: null, notificationsSeenAt: null, createdAt: new Date(),
  });
  await r.create(base("s1", "tom.92", "Thomas"));
  await r.create(base("s2", "alice", "A(lice"));
  expect((await r.searchByText("THOM", 10)).map((u) => u.id)).toEqual(["s1"]);
  // métacaractères traités littéralement : "(" ne fait pas planter et matche displayName "A(lice"
  expect((await r.searchByText("(lice", 10)).map((u) => u.id)).toEqual(["s2"]);
  // "." littéral : "tom.92" matché par "m.9", PAS par "tomX92"
  expect((await r.searchByText("m.9", 10)).map((u) => u.id)).toEqual(["s1"]);
});
```

(Adapter le nom de la variable de connexion `db` à celui du fichier ; importer `MongoUserRepository` s'il ne l'est pas déjà.)

- [ ] **Step 7 : Lancer les tests adaptateurs**

Run: `cd /home/chamberlain/Desktop/Claude/vulu && npx vitest run tests/adapters/memory.test.ts tests/adapters/mongo-repositories.test.ts`
Expected: PASS (memory + mongo).

- [ ] **Step 8 : tsc + commit**

Run: `cd /home/chamberlain/Desktop/Claude/vulu && node_modules/.bin/tsc --noEmit`
Expected: 0 erreur.

```bash
cd /home/chamberlain/Desktop/Claude/vulu && git add -- src/server/ports/repositories.ts src/server/adapters/memory/index.ts src/server/adapters/mongo/repositories.ts tests/adapters/memory.test.ts tests/adapters/mongo-repositories.test.ts && git commit -q -m "feat(vulu): UserRepository.searchByText (recherche membres, regex échappée)"
```

---

## Task 2 : Cas d'usage `searchUsers` + schéma zod

**Files:**
- Create: `src/server/application/search-users.ts`
- Modify: `src/lib/zod-schemas.ts` (ajouter `userSearchSchema`)
- Test: `tests/application/search-users.test.ts` (créer), `tests/lib/zod-schemas.test.ts`

**Interfaces:**
- Consumes : `deps.users.searchByText(query, limit)` (Task 1).
- Produces :
  - `type UserSearchResult = { id: string; username: string; displayName: string; avatarUrl: string | null; plus: boolean; staff: boolean }`
  - `searchUsers(deps: Deps, viewerId: string, query: string, limit?: number): Promise<UserSearchResult[]>` (défaut `limit = 10`) — exclut le viewer, `[]` si query vide.
  - `userSearchSchema` (zod) : `{ q: string }` 1–50 caractères.

- [ ] **Step 1 : Test applicatif**

Créer `tests/application/search-users.test.ts` :

```ts
import { describe, it, expect, beforeEach } from "vitest";
import { makeInMemoryDeps, type Deps } from "@/server/container";
import { registerUser } from "@/server/application/register-user";
import { searchUsers } from "@/server/application/search-users";

let deps: Deps; let me: string;
const tastes = { filmGenreIds: [], people: [] };
beforeEach(async () => {
  deps = makeInMemoryDeps();
  me = (await registerUser(deps, { email: "me@x.io", username: "me", displayName: "Moi", password: "password1", activeTabs: ["films"], tastes })).id;
  await registerUser(deps, { email: "t@x.io", username: "tom92", displayName: "Thomas", password: "password1", activeTabs: ["films"], tastes });
});

describe("searchUsers", () => {
  it("trouve par pseudo et mappe un DTO public sans secret", async () => {
    const out = await searchUsers(deps, me, "tom");
    expect(out).toHaveLength(1);
    expect(out[0]!.username).toBe("tom92");
    expect(out[0]!.displayName).toBe("Thomas");
    expect(out[0]).not.toHaveProperty("passwordHash");
    expect(out[0]).not.toHaveProperty("email");
  });
  it("exclut le viewer lui-même", async () => {
    expect(await searchUsers(deps, me, "moi")).toHaveLength(0);
  });
  it("renvoie [] sur query vide", async () => {
    expect(await searchUsers(deps, me, "   ")).toEqual([]);
  });
});
```

(Vérifier la signature réelle de `registerUser` dans `src/server/application/register-user.ts` et l'aligner si besoin — elle est déjà utilisée ainsi dans `tests/application/feed.test.ts`.)

- [ ] **Step 2 : Lancer, vérifier l'échec**

Run: `cd /home/chamberlain/Desktop/Claude/vulu && npx vitest run tests/application/search-users.test.ts`
Expected: ÉCHEC — module `search-users` introuvable.

- [ ] **Step 3 : Implémenter `searchUsers`**

Créer `src/server/application/search-users.ts` :

```ts
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
```

(On demande `limit + 1` au repo puis on tronque après exclusion du viewer, pour ne pas renvoyer `limit - 1` quand le viewer figure dans les résultats.)

- [ ] **Step 4 : Schéma zod**

Dans `src/lib/zod-schemas.ts`, ajouter (près des autres schémas) :

```ts
export const userSearchSchema = z.object({ q: z.string().min(1).max(50) });
```

- [ ] **Step 5 : Test schéma**

Dans `tests/lib/zod-schemas.test.ts`, ajouter à la fin :

```ts
import { userSearchSchema } from "@/lib/zod-schemas";

describe("userSearchSchema", () => {
  it("exige q (1–50 caractères)", () => {
    expect(userSearchSchema.parse({ q: "tom" }).q).toBe("tom");
    expect(() => userSearchSchema.parse({ q: "" })).toThrow();
    expect(() => userSearchSchema.parse({ q: "x".repeat(51) })).toThrow();
  });
});
```

(Si `import { rateSchema }` est déjà en tête, ajouter `userSearchSchema` à cet import plutôt qu'une 2ᵉ ligne d'import.)

- [ ] **Step 6 : Lancer les tests + tsc**

Run: `cd /home/chamberlain/Desktop/Claude/vulu && npx vitest run tests/application/search-users.test.ts tests/lib/zod-schemas.test.ts && node_modules/.bin/tsc --noEmit`
Expected: PASS, 0 erreur tsc.

- [ ] **Step 7 : Commit**

```bash
cd /home/chamberlain/Desktop/Claude/vulu && git add -- src/server/application/search-users.ts src/lib/zod-schemas.ts tests/application/search-users.test.ts tests/lib/zod-schemas.test.ts && git commit -q -m "feat(vulu): cas d'usage searchUsers + userSearchSchema"
```

---

## Task 3 : Route API `GET /api/users/search`

**Files:**
- Create: `src/app/api/users/search/route.ts`

**Interfaces:**
- Consumes : `searchUsers(deps, viewerId, q)` (Task 2), `userSearchSchema` (Task 2), `requireUser`/`json` (`@/server/http/session`), `toErrorResponse` (`@/server/http/errors`), `getDeps` (`@/server/container`).
- Produces : `GET /api/users/search?q=...` → `{ users: UserSearchResult[] }`. `q` vide ou absent → `{ users: [] }`.

- [ ] **Step 1 : Implémenter le handler**

Créer `src/app/api/users/search/route.ts` (mêmes imports/pattern que `src/app/api/catalog/search/route.ts`) :

```ts
import { getDeps } from "@/server/container";
import { searchUsers } from "@/server/application/search-users";
import { userSearchSchema } from "@/lib/zod-schemas";
import { requireUser, json } from "@/server/http/session";
import { toErrorResponse } from "@/server/http/errors";

export async function GET(req: Request) {
  try {
    const user = await requireUser();
    const q = new URL(req.url).searchParams.get("q")?.trim() ?? "";
    if (!q) return json({ users: [] });
    const { q: query } = userSearchSchema.parse({ q });
    return json({ users: await searchUsers(await getDeps(), user.id, query) });
  } catch (e) { return toErrorResponse(e); }
}
```

- [ ] **Step 2 : Vérifier tsc**

Run: `cd /home/chamberlain/Desktop/Claude/vulu && node_modules/.bin/tsc --noEmit`
Expected: 0 erreur.

- [ ] **Step 3 : Vérifier le routage (auth → 401 sans session)**

Run: `cd /home/chamberlain/Desktop/Claude/vulu && curl -s -o /dev/null -w "%{http_code}\n" "http://localhost:3000/api/users/search?q=tom"`
Expected: `401` (non authentifié) — confirme que la route existe et exige une session (et non `404`).

- [ ] **Step 4 : Commit**

```bash
cd /home/chamberlain/Desktop/Claude/vulu && git add -- src/app/api/users/search/route.ts && git commit -q -m "feat(vulu): route GET /api/users/search"
```

---

## Task 4 : Section « Membres » dans `SearchClient`

**Files:**
- Modify: `src/app/search/SearchClient.tsx`

**Interfaces:**
- Consumes : `GET /api/users/search?q=...` → `{ users: UserSearchResult[] }` (Task 3) ; composants `Avatar` (`{ name, src?, size? }`), `CertifiedBadge` (`{ size? }`), `StaffBadge` (`{ size? }`).
- Produces : (UI seulement, pas d'interface consommée en aval).

- [ ] **Step 1 : Type + imports + état membres**

Dans `src/app/search/SearchClient.tsx`, après les imports existants, ajouter :

```ts
import Link from "next/link";
import { Avatar } from "@/components/Avatar";
import { CertifiedBadge } from "@/components/CertifiedBadge";
import { StaffBadge } from "@/components/StaffBadge";
import type { UserSearchResult } from "@/server/application/search-users";
```

Et dans le composant, à côté des autres `useState` :

```ts
  const [members, setMembers] = useState<UserSearchResult[]>([]);
```

- [ ] **Step 2 : Brancher la recherche membres dans le `useEffect` de debounce**

Remplacer le corps du `useEffect` (lignes ~19-33) par une version qui, en mode `@`, interroge les membres et fait porter la recherche catalogue sur le texte sans `@` :

```ts
  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    const trimmed = q.trim();
    const isMemberMode = trimmed.startsWith("@");
    const memberQuery = isMemberMode ? trimmed.slice(1).trim() : "";
    const catalogQuery = isMemberMode ? memberQuery : trimmed;
    if (!isMemberMode) setMembers([]);
    if (!catalogQuery && !memberQuery) { setResults([]); setMembers([]); return; }
    timer.current = setTimeout(async () => {
      setLoading(true);
      try {
        if (isMemberMode && memberQuery) {
          const m = await api.get<{ users: UserSearchResult[] }>(`/api/users/search?q=${encodeURIComponent(memberQuery)}`);
          setMembers(m.users);
        }
        if (catalogQuery) {
          const data = await api.get<{ results: WorkSummary[]; unavailable?: boolean }>(`/api/catalog/search?q=${encodeURIComponent(catalogQuery)}&domain=${domain}`);
          setResults(data.results);
          setUnavailable(Boolean(data.unavailable));
        } else {
          setResults([]);
        }
      } finally {
        setLoading(false);
      }
    }, 300);
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [q, domain]);
```

- [ ] **Step 3 : Indice de saisie + rendu de la section Membres**

Mettre à jour le `placeholder` du champ pour signaler le `@` — remplacer l'attribut `placeholder` existant par :

```tsx
        placeholder={domain === "books" ? "Un livre, un auteur, @pseudo…" : "Un film, une série, @pseudo…"}
```

Puis, juste avant le bloc `<div className="grid grid-cols-3 ...">` qui rend `results`, insérer :

```tsx
      {members.length > 0 && (
        <section className="mb-5">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">Membres</p>
          <ul className="flex flex-col gap-1">
            {members.map((u) => (
              <li key={u.id}>
                <Link href={`/u/${u.username}`} className="flex items-center gap-3 rounded-xl p-2 transition-colors hover:bg-[var(--color-surface)]">
                  <Avatar name={u.displayName} src={u.avatarUrl} size={40} />
                  <span className="min-w-0">
                    <span className="flex items-center gap-1 text-sm font-semibold">
                      {u.displayName}
                      {u.staff && <StaffBadge />}
                      {u.plus && <CertifiedBadge />}
                    </span>
                    <span className="block truncate text-xs text-[var(--color-text-muted)]">@{u.username}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
```

- [ ] **Step 4 : Vérifier tsc**

Run: `cd /home/chamberlain/Desktop/Claude/vulu && node_modules/.bin/tsc --noEmit`
Expected: 0 erreur.

- [ ] **Step 5 : Vérifier la page**

Run: `cd /home/chamberlain/Desktop/Claude/vulu && curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/search`
Expected: `200` (ou `307` si non authentifié — selon la protection de route ; les deux confirment l'absence d'erreur de compilation de la page).

- [ ] **Step 6 : Suite complète + commit**

Run: `cd /home/chamberlain/Desktop/Claude/vulu && npx vitest run`
Expected: suite verte.

```bash
cd /home/chamberlain/Desktop/Claude/vulu && git add -- src/app/search/SearchClient.tsx && git commit -q -m "feat(vulu): barre de recherche — section Membres déclenchée par @pseudo"
```

---

## Self-Review

**Spec coverage :**
- §1 Flux UI (`@` → memberQuery, catalogue sur texte sans `@`, section au-dessus, sans `@` inchangé) ⇒ Task 4 Steps 2-3. ✓
- §2 Port `searchByText` ⇒ Task 1 Step 3 ; adaptateur mémoire ⇒ Task 1 Step 4 ; adaptateur Mongo (regex échappée) ⇒ Task 1 Step 5 ; application `searchUsers` (query vide → [], exclut viewer, DTO public) ⇒ Task 2 Step 3 ; API `GET /api/users/search` (auth, zod 1–50) ⇒ Task 3 Step 1. ✓
- §3 Section Membres (Avatar + nom + badges + @username, lien `/u/<username>`) ⇒ Task 4 Step 3. ✓
- §4 Tests (mémoire, mongo + anti-injection, application, schéma) ⇒ Task 1 Steps 1/6, Task 2 Steps 1/5. ✓
- Hors périmètre (pas de fuzzy, pas de pagination, pas de communautés, pas de masquage catalogue) ⇒ respecté. ✓

**Placeholder scan :** aucun TODO/TBD ; chaque step montre le code complet.

**Type consistency :** `UserSearchResult { id, username, displayName, avatarUrl, plus, staff }` défini en Task 2, consommé identique en Task 3 (réponse `{ users }`) et Task 4 (état + rendu). `searchByText(query, limit)` cohérent entre port (Task 1.3), memory (1.4), mongo (1.5), et appel `searchUsers` (`limit + 1`, Task 2.3). `userSearchSchema` défini Task 2.4, importé Task 3.1. Signatures `Avatar/CertifiedBadge/StaffBadge` vérifiées (`{ name, src?, size? }` / `{ size? }`).

## Execution Handoff

**Plan complet, sauvegardé dans `docs/superpowers/plans/2026-06-23-recherche-membres.md`. Deux options d'exécution :**

**1. Subagent-Driven (recommandé)** — un sous-agent par tâche, revue entre chaque.

**2. Inline Execution** — exécution dans cette session via executing-plans, par lots avec points de contrôle.

**Quelle approche ?**
