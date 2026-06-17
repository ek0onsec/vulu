# vulu — Phase 1 (Films & Séries) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Livrer une tranche verticale complète du domaine Films & Séries de vulu : inscription/connexion, profil + goûts, graphe social (follow), bibliothèque (statut Vu/À voir + note décimale + commentaire + visibilité), listes, feed filtré, likes & commentaires, en web + PWA installable.

**Architecture:** Mono-repo Next.js (App Router) avec couche serveur hexagonale (`server/domain`, `server/application`, `server/ports`, `server/adapters`). Le domaine et les use-cases ne connaissent ni Next, ni MongoDB, ni TMDB — tout passe par des ports. Wiring dans `server/container.ts`. Tests TDD : use-cases sur repos in-memory, adapters sur mongodb-memory-server, TMDB mocké.

**Tech Stack:** Next.js 15 (App Router), TypeScript strict, Tailwind v4, MongoDB (driver natif), `bcryptjs`, `jose` (JWT), `zod`, Vitest + `mongodb-memory-server` + Testing Library, `@ducanh2912/next-pwa`.

---

## Conventions (lire avant de commencer)

- **TDD strict** : test rouge → implémentation minimale → test vert → commit. Un commit par tâche.
- **Pas de co-auteur** dans les messages de commit (règle utilisateur). Format : `type(scope): message`.
- **Imports** : alias `@/` → `src/`. Le domaine n'importe jamais `next`, `mongodb`, `jose`, `bcryptjs`.
- **IDs** : générés par le domaine via un port `IdGenerator` (adapter `crypto.randomUUID`), pas par Mongo `_id`. Le mapper Mongo stocke `id` en champ et duplique dans `_id` (string).
- **Dates** : objets `Date` dans le domaine ; stockés en `Date` BSON.
- **Erreurs** : classes d'erreur typées dans `server/domain/errors.ts` (distinguer métier vs not-found vs auth). Jamais de `catch {}` silencieux.
- **Lancer un seul test** : `npx vitest run <path> -t "<nom>"`. **Toute la suite** : `npx vitest run`.

---

## File Structure (cible Phase 1)

```
vulu/
  package.json, tsconfig.json, next.config.ts, vitest.config.ts, tailwind.config.ts
  .env.example
  src/
    app/
      layout.tsx, globals.css, page.tsx                 # shell + redirections
      (auth)/login/page.tsx, (auth)/register/page.tsx
      onboarding/page.tsx
      feed/page.tsx
      search/page.tsx
      lists/page.tsx
      u/[username]/page.tsx                             # profil public
      work/[id]/page.tsx                                # fiche œuvre
      api/                                              # route handlers (voir spec §9)
    components/                                         # UI React
    server/
      domain/        entities.ts, errors.ts, circle.ts, feed-rules.ts
      ports/         repositories.ts, catalog.ts, security.ts
      application/   *.ts (un fichier par use-case ou groupe cohérent)
      adapters/
        memory/      in-memory repos (tests + dev)
        mongo/       client.ts, mappers.ts, *-repository.ts, indexes.ts
        catalog/     tmdb-catalog.ts, tmdb-mappers.ts
        security/    bcrypt-hasher.ts, jwt-token-service.ts, uuid-id-generator.ts
      container.ts                                      # DI wiring
    lib/             theme.ts, api-client.ts, zod-schemas.ts
  tests/
    application/  adapters/  domain/
```

---

## Milestone M0 — Scaffold & outillage

### Task 0.1: Initialiser le projet Next.js + TypeScript + Tailwind

**Files:**
- Create: `vulu/package.json`, `vulu/tsconfig.json`, `vulu/next.config.ts`, `vulu/src/app/layout.tsx`, `vulu/src/app/globals.css`, `vulu/src/app/page.tsx`

- [ ] **Step 1: Scaffolder l'app**

```bash
cd /home/chamberlain/Desktop/Claude/vulu
npx create-next-app@latest . --ts --tailwind --app --src-dir --import-alias "@/*" --no-eslint --use-npm --yes
```

- [ ] **Step 2: Vérifier le démarrage**

Run: `npm run dev` puis ouvrir http://localhost:3000
Expected: page Next par défaut s'affiche. Arrêter avec Ctrl-C.

- [ ] **Step 3: Activer le mode strict TS**

Dans `tsconfig.json`, vérifier `"strict": true` et ajouter `"noUncheckedIndexedAccess": true`.

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "chore(vulu): scaffold Next.js + TS strict + Tailwind"
```

### Task 0.2: Installer les dépendances runtime & test

**Files:** Modify: `vulu/package.json`

- [ ] **Step 1: Installer**

```bash
cd /home/chamberlain/Desktop/Claude/vulu
npm i mongodb bcryptjs jose zod
npm i -D vitest @vitest/coverage-v8 mongodb-memory-server @testing-library/react @testing-library/jest-dom jsdom @types/bcryptjs
```

- [ ] **Step 2: Créer `vitest.config.ts`**

```ts
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts", "tests/**/*.test.tsx"],
    globals: true,
    setupFiles: ["tests/setup.ts"],
  },
  resolve: { alias: { "@": path.resolve(__dirname, "src") } },
});
```

- [ ] **Step 3: Installer le plugin react pour vitest**

```bash
npm i -D @vitejs/plugin-react
```

- [ ] **Step 4: Créer `tests/setup.ts`**

```ts
import "@testing-library/jest-dom/vitest";
```

- [ ] **Step 5: Ajouter le script test dans `package.json`**

Dans `"scripts"` ajouter : `"test": "vitest run"`, `"test:watch": "vitest"`.

- [ ] **Step 6: Vérifier que vitest tourne (zéro test)**

Run: `npx vitest run`
Expected: "No test files found" (sortie sans erreur de config).

- [ ] **Step 7: Commit**

```bash
git add -A && git commit -m "chore(vulu): deps runtime + setup Vitest"
```

### Task 0.3: Tokens de thème (clair + Aubergine nuit)

**Files:** Modify: `vulu/src/app/globals.css`; Create: `vulu/src/lib/theme.ts`

- [ ] **Step 1: Définir les variables CSS de thème dans `globals.css`**

Remplacer le contenu par :

```css
@import "tailwindcss";

:root {
  --color-primary: #9461C0;
  --color-accent: #F8C84E;
  --color-bg: #F6F2FB;
  --color-surface: #FFFFFF;
  --color-border: #E7DDED;
  --color-text: #2A2233;
  --color-text-muted: #6B6276;
}
.dark {
  --color-primary: #B98DE0;
  --color-accent: #F6C24B;
  --color-bg: #16121C;
  --color-surface: #211B2A;
  --color-surface-2: #2C2438;
  --color-border: #352C44;
  --color-text: #ECE6F2;
  --color-text-muted: #9C93AB;
}
@theme inline {
  --color-primary: var(--color-primary);
  --color-accent: var(--color-accent);
  --color-bg: var(--color-bg);
  --color-surface: var(--color-surface);
  --color-border: var(--color-border);
  --color-text: var(--color-text);
  --color-text-muted: var(--color-text-muted);
}
body { background: var(--color-bg); color: var(--color-text); }
```

- [ ] **Step 2: Créer le helper de thème `src/lib/theme.ts`**

```ts
export type Theme = "light" | "dark";
const KEY = "vulu-theme";

export function getStoredTheme(): Theme | null {
  if (typeof window === "undefined") return null;
  const v = window.localStorage.getItem(KEY);
  return v === "light" || v === "dark" ? v : null;
}

export function applyTheme(theme: Theme): void {
  document.documentElement.classList.toggle("dark", theme === "dark");
  window.localStorage.setItem(KEY, theme);
}

export function initialTheme(): Theme {
  const stored = getStoredTheme();
  if (stored) return stored;
  if (typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches) {
    return "dark";
  }
  return "light";
}
```

- [ ] **Step 3: Vérifier la compilation**

Run: `npx tsc --noEmit`
Expected: pas d'erreur.

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "feat(vulu): tokens de thème clair + Aubergine nuit"
```

### Task 0.4: Config par environnement

**Files:** Create: `vulu/.env.example`, `vulu/src/lib/env.ts`

- [ ] **Step 1: Créer `.env.example`**

```
MONGODB_URI=mongodb://localhost:27017
MONGODB_DB=vulu
JWT_SECRET=change-me-32-bytes-minimum-secret-key
TMDB_API_KEY=your-tmdb-v4-read-access-token
TMDB_BASE_URL=https://api.themoviedb.org/3
TMDB_IMAGE_BASE=https://image.tmdb.org/t/p
```

- [ ] **Step 2: Créer `src/lib/env.ts` (validation au démarrage)**

```ts
import { z } from "zod";

const schema = z.object({
  MONGODB_URI: z.string().min(1),
  MONGODB_DB: z.string().min(1),
  JWT_SECRET: z.string().min(32),
  TMDB_API_KEY: z.string().min(1),
  TMDB_BASE_URL: z.string().url(),
  TMDB_IMAGE_BASE: z.string().url(),
});

export type Env = z.infer<typeof schema>;

let cached: Env | null = null;
export function getEnv(): Env {
  if (cached) return cached;
  cached = schema.parse(process.env);
  return cached;
}
```

- [ ] **Step 3: Vérifier que `.env.local` est ignoré**

Run: `grep -q ".env" vulu/.gitignore || echo "MANQUE"`
Expected: rien (create-next-app a déjà ajouté `.env*`). Sinon ajouter `.env*.local`.

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "chore(vulu): config env validée par zod + .env.example"
```

---

## Milestone M1 — Domaine, ports, repos in-memory, DI

### Task 1.1: Entités du domaine

**Files:** Create: `vulu/src/server/domain/entities.ts`

- [ ] **Step 1: Écrire les types d'entités**

```ts
export type Domain = "films" | "books";
export type WorkType = "movie" | "tv";
export type EntryStatus = "planned" | "done";
export type Visibility = "circle" | "public";
export type ListVisibility = "public" | "private";
export type PersonRole = "actor" | "director";

export interface Tastes {
  filmGenreIds: number[];
  people: { tmdbId: number; name: string; role: PersonRole }[];
}

export interface User {
  id: string;
  email: string;
  passwordHash: string;
  username: string;
  displayName: string;
  bio: string | null;
  avatarUrl: string | null;
  activeTabs: Domain[];
  tastes: Tastes;
  createdAt: Date;
}

export interface Follow {
  followerId: string;
  followeeId: string;
  createdAt: Date;
}

export interface Work {
  id: string;
  source: "tmdb";
  externalId: string;
  type: WorkType;
  domain: Domain;
  title: string;
  year: number | null;
  posterUrl: string | null;
  backdropUrl: string | null;
  overview: string | null;
  genres: string[];
  people: { tmdbId: number; name: string; role: PersonRole }[];
  cachedAt: Date;
}

export interface LibraryEntry {
  id: string;
  userId: string;
  workId: string;
  domain: Domain;
  status: EntryStatus;
  rating: number | null;
  text: string | null;
  visibility: Visibility;
  createdAt: Date;
  updatedAt: Date;
}

export interface List {
  id: string;
  userId: string;
  name: string;
  domain: Domain;
  description: string | null;
  visibility: ListVisibility;
  workIds: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface Like {
  entryId: string;
  userId: string;
  createdAt: Date;
}

export interface Comment {
  id: string;
  entryId: string;
  userId: string;
  text: string;
  createdAt: Date;
}
```

- [ ] **Step 2: Vérifier la compilation**

Run: `npx tsc --noEmit`
Expected: pas d'erreur.

- [ ] **Step 3: Commit**

```bash
git add -A && git commit -m "feat(vulu): entités du domaine"
```

### Task 1.2: Erreurs typées du domaine

**Files:** Create: `vulu/src/server/domain/errors.ts`; Test: `vulu/tests/domain/errors.test.ts`

- [ ] **Step 1: Écrire le test**

```ts
import { describe, it, expect } from "vitest";
import { NotFoundError, ConflictError, AuthError, ValidationError, ForbiddenError } from "@/server/domain/errors";

describe("domain errors", () => {
  it("portent un code et un message", () => {
    expect(new NotFoundError("user").code).toBe("NOT_FOUND");
    expect(new ConflictError("email").code).toBe("CONFLICT");
    expect(new AuthError("bad creds").code).toBe("AUTH");
    expect(new ValidationError("min 3").code).toBe("VALIDATION");
    expect(new ForbiddenError("nope").code).toBe("FORBIDDEN");
    expect(new NotFoundError("x")).toBeInstanceOf(Error);
  });
});
```

- [ ] **Step 2: Lancer le test (échoue)**

Run: `npx vitest run tests/domain/errors.test.ts`
Expected: FAIL (module introuvable).

- [ ] **Step 3: Implémenter `errors.ts`**

```ts
export type DomainErrorCode = "NOT_FOUND" | "CONFLICT" | "AUTH" | "VALIDATION" | "FORBIDDEN";

export class DomainError extends Error {
  constructor(public readonly code: DomainErrorCode, message: string) {
    super(message);
    this.name = new.target.name;
  }
}
export class NotFoundError extends DomainError { constructor(m: string) { super("NOT_FOUND", m); } }
export class ConflictError extends DomainError { constructor(m: string) { super("CONFLICT", m); } }
export class AuthError extends DomainError { constructor(m: string) { super("AUTH", m); } }
export class ValidationError extends DomainError { constructor(m: string) { super("VALIDATION", m); } }
export class ForbiddenError extends DomainError { constructor(m: string) { super("FORBIDDEN", m); } }
```

- [ ] **Step 4: Lancer le test (passe)**

Run: `npx vitest run tests/domain/errors.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat(vulu): erreurs typées du domaine"
```

### Task 1.3: Calcul du cercle social (logique pure)

**Files:** Create: `vulu/src/server/domain/circle.ts`; Test: `vulu/tests/domain/circle.test.ts`

- [ ] **Step 1: Écrire le test**

```ts
import { describe, it, expect } from "vitest";
import { computeCircle } from "@/server/domain/circle";

describe("computeCircle", () => {
  it("retourne l'union des suivis et des abonnés, sans soi-même", () => {
    const circle = computeCircle("me", ["a", "b"], ["b", "c"]);
    expect([...circle].sort()).toEqual(["a", "b", "c"]);
  });
  it("exclut l'utilisateur lui-même", () => {
    const circle = computeCircle("me", ["me", "a"], ["me"]);
    expect([...circle].sort()).toEqual(["a"]);
  });
  it("retourne un Set vide si aucun lien", () => {
    expect(computeCircle("me", [], []).size).toBe(0);
  });
});
```

- [ ] **Step 2: Lancer le test (échoue)**

Run: `npx vitest run tests/domain/circle.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implémenter `circle.ts`**

```ts
/** Cercle = {gens suivis} ∪ {abonnés}, en excluant soi-même. */
export function computeCircle(userId: string, following: string[], followers: string[]): Set<string> {
  const set = new Set<string>([...following, ...followers]);
  set.delete(userId);
  return set;
}
```

- [ ] **Step 4: Lancer le test (passe)**

Run: `npx vitest run tests/domain/circle.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat(vulu): calcul du cercle social"
```

### Task 1.4: Règle de visibilité d'une entrée dans le feed (logique pure)

**Files:** Create: `vulu/src/server/domain/feed-rules.ts`; Test: `vulu/tests/domain/feed-rules.test.ts`

- [ ] **Step 1: Écrire le test**

```ts
import { describe, it, expect } from "vitest";
import { isPublishable } from "@/server/domain/feed-rules";
import type { LibraryEntry } from "@/server/domain/entities";

function entry(over: Partial<LibraryEntry>): LibraryEntry {
  return {
    id: "e1", userId: "u1", workId: "w1", domain: "films",
    status: "done", rating: 4, text: null, visibility: "public",
    createdAt: new Date(), updatedAt: new Date(), ...over,
  };
}

describe("isPublishable", () => {
  it("vraie si done + note", () => expect(isPublishable(entry({ rating: 4, text: null }))).toBe(true));
  it("vraie si done + commentaire", () => expect(isPublishable(entry({ rating: null, text: "top" }))).toBe(true));
  it("fausse si planned", () => expect(isPublishable(entry({ status: "planned", rating: null, text: null }))).toBe(false));
  it("fausse si done mais ni note ni texte", () => expect(isPublishable(entry({ status: "done", rating: null, text: null }))).toBe(false));
});
```

- [ ] **Step 2: Lancer le test (échoue)**

Run: `npx vitest run tests/domain/feed-rules.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implémenter `feed-rules.ts`**

```ts
import type { LibraryEntry } from "./entities";

/** Une entrée alimente le feed si elle est "vue" ET porte une note ou un commentaire. */
export function isPublishable(entry: LibraryEntry): boolean {
  return entry.status === "done" && (entry.rating !== null || entry.text !== null);
}
```

- [ ] **Step 4: Lancer le test (passe)**

Run: `npx vitest run tests/domain/feed-rules.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat(vulu): règle de publiabilité d'une entrée"
```

### Task 1.5: Interfaces des ports (repositories + catalogue + sécurité)

**Files:** Create: `vulu/src/server/ports/repositories.ts`, `vulu/src/server/ports/catalog.ts`, `vulu/src/server/ports/security.ts`

- [ ] **Step 1: Écrire `ports/security.ts`**

```ts
export interface PasswordHasher {
  hash(plain: string): Promise<string>;
  verify(plain: string, hash: string): Promise<boolean>;
}
export interface TokenService {
  issue(payload: { userId: string }): Promise<string>;
  verify(token: string): Promise<{ userId: string } | null>;
}
export interface IdGenerator {
  next(): string;
}
export interface Clock {
  now(): Date;
}
```

- [ ] **Step 2: Écrire `ports/catalog.ts`**

```ts
import type { PersonRole, WorkType } from "@/server/domain/entities";

export interface WorkSummary {
  externalId: string;
  type: WorkType;
  title: string;
  year: number | null;
  posterUrl: string | null;
}
export interface WorkDetails extends WorkSummary {
  backdropUrl: string | null;
  overview: string | null;
  genres: string[];
  people: { tmdbId: number; name: string; role: PersonRole }[];
}
export interface Genre { id: number; name: string; }
export interface Person { tmdbId: number; name: string; role: PersonRole; profileUrl: string | null; }

export interface CatalogProvider {
  searchWorks(query: string): Promise<WorkSummary[]>;
  getWork(externalId: string, type: WorkType): Promise<WorkDetails | null>;
  listGenres(): Promise<Genre[]>;
  searchPeople(query: string): Promise<Person[]>;
}
```

- [ ] **Step 3: Écrire `ports/repositories.ts`**

```ts
import type { User, Follow, Work, LibraryEntry, List, Like, Comment } from "@/server/domain/entities";

export interface UserRepository {
  create(user: User): Promise<void>;
  findById(id: string): Promise<User | null>;
  findByEmail(email: string): Promise<User | null>;
  findByUsername(username: string): Promise<User | null>;
  update(user: User): Promise<void>;
}
export interface FollowRepository {
  add(follow: Follow): Promise<void>;
  remove(followerId: string, followeeId: string): Promise<void>;
  exists(followerId: string, followeeId: string): Promise<boolean>;
  followeeIdsOf(userId: string): Promise<string[]>;   // gens que userId suit
  followerIdsOf(userId: string): Promise<string[]>;   // abonnés de userId
  countFollowers(userId: string): Promise<number>;
  countFollowing(userId: string): Promise<number>;
}
export interface WorkRepository {
  upsert(work: Work): Promise<void>;
  findById(id: string): Promise<Work | null>;
  findByExternal(source: "tmdb", externalId: string): Promise<Work | null>;
}
export interface LibraryEntryRepository {
  upsert(entry: LibraryEntry): Promise<void>;
  findById(id: string): Promise<LibraryEntry | null>;
  findByUserAndWork(userId: string, workId: string): Promise<LibraryEntry | null>;
  listByUser(userId: string, opts: { status?: "planned" | "done"; domain?: string }): Promise<LibraryEntry[]>;
  remove(id: string): Promise<void>;
  /** Entrées publiables des auteurs donnés OU publiques, filtrées par domaines, paginées par curseur. */
  feed(opts: {
    circleUserIds: string[];
    viewerId: string;
    domains: string[];
    cursor: { createdAt: Date; id: string } | null;
    limit: number;
  }): Promise<LibraryEntry[]>;
}
export interface ListRepository {
  create(list: List): Promise<void>;
  findById(id: string): Promise<List | null>;
  listByUser(userId: string, domain?: string): Promise<List[]>;
  update(list: List): Promise<void>;
  remove(id: string): Promise<void>;
}
export interface LikeRepository {
  add(like: Like): Promise<void>;
  remove(entryId: string, userId: string): Promise<void>;
  exists(entryId: string, userId: string): Promise<boolean>;
  countByEntry(entryId: string): Promise<number>;
  likedEntryIds(userId: string, entryIds: string[]): Promise<string[]>;
}
export interface CommentRepository {
  add(comment: Comment): Promise<void>;
  findById(id: string): Promise<Comment | null>;
  listByEntry(entryId: string): Promise<Comment[]>;
  countByEntry(entryId: string): Promise<number>;
  remove(id: string): Promise<void>;
}
```

- [ ] **Step 4: Vérifier la compilation**

Run: `npx tsc --noEmit`
Expected: pas d'erreur.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat(vulu): interfaces des ports (repos, catalogue, sécurité)"
```

### Task 1.6: Repositories in-memory (tests + dev)

**Files:** Create: `vulu/src/server/adapters/memory/index.ts`; Test: `vulu/tests/adapters/memory.test.ts`

- [ ] **Step 1: Écrire le test (comportements clés)**

```ts
import { describe, it, expect } from "vitest";
import { InMemoryUserRepository, InMemoryFollowRepository, InMemoryLibraryEntryRepository } from "@/server/adapters/memory";
import type { User, LibraryEntry } from "@/server/domain/entities";

function user(id: string, over: Partial<User> = {}): User {
  return { id, email: `${id}@x.io`, passwordHash: "h", username: id, displayName: id,
    bio: null, avatarUrl: null, activeTabs: ["films"], tastes: { filmGenreIds: [], people: [] },
    createdAt: new Date(), ...over };
}
function entry(id: string, over: Partial<LibraryEntry> = {}): LibraryEntry {
  return { id, userId: "u1", workId: "w1", domain: "films", status: "done", rating: 4,
    text: null, visibility: "public", createdAt: new Date(), updatedAt: new Date(), ...over };
}

describe("InMemory repos", () => {
  it("UserRepository find by email/username", async () => {
    const r = new InMemoryUserRepository();
    await r.create(user("u1", { email: "a@x.io", username: "alice" }));
    expect((await r.findByEmail("a@x.io"))?.id).toBe("u1");
    expect((await r.findByUsername("alice"))?.id).toBe("u1");
    expect(await r.findByEmail("none@x.io")).toBeNull();
  });

  it("FollowRepository union directions", async () => {
    const r = new InMemoryFollowRepository();
    await r.add({ followerId: "u1", followeeId: "u2", createdAt: new Date() });
    expect(await r.followeeIdsOf("u1")).toEqual(["u2"]);
    expect(await r.followerIdsOf("u2")).toEqual(["u1"]);
    expect(await r.exists("u1", "u2")).toBe(true);
  });

  it("feed: publiables, public OU cercle, filtré domaine, trié desc", async () => {
    const r = new InMemoryLibraryEntryRepository();
    const t0 = new Date(2024, 0, 1), t1 = new Date(2024, 0, 2), t2 = new Date(2024, 0, 3);
    await r.upsert(entry("e_pub", { userId: "stranger", visibility: "public", createdAt: t0 }));
    await r.upsert(entry("e_circle", { userId: "friend", visibility: "circle", createdAt: t1 }));
    await r.upsert(entry("e_hidden", { userId: "stranger", visibility: "circle", createdAt: t2 }));
    await r.upsert(entry("e_planned", { userId: "friend", status: "planned", rating: null, text: null, createdAt: t2 }));
    const res = await r.feed({ circleUserIds: ["friend"], viewerId: "me", domains: ["films"], cursor: null, limit: 10 });
    expect(res.map((e) => e.id)).toEqual(["e_circle", "e_pub"]);
  });
});
```

- [ ] **Step 2: Lancer le test (échoue)**

Run: `npx vitest run tests/adapters/memory.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implémenter `adapters/memory/index.ts`**

```ts
import type {
  UserRepository, FollowRepository, WorkRepository, LibraryEntryRepository,
  ListRepository, LikeRepository, CommentRepository,
} from "@/server/ports/repositories";
import type { User, Follow, Work, LibraryEntry, List, Like, Comment } from "@/server/domain/entities";
import { isPublishable } from "@/server/domain/feed-rules";

export class InMemoryUserRepository implements UserRepository {
  private byId = new Map<string, User>();
  async create(u: User) { this.byId.set(u.id, u); }
  async findById(id: string) { return this.byId.get(id) ?? null; }
  async findByEmail(email: string) { return [...this.byId.values()].find((u) => u.email === email) ?? null; }
  async findByUsername(username: string) { return [...this.byId.values()].find((u) => u.username === username) ?? null; }
  async update(u: User) { this.byId.set(u.id, u); }
}

export class InMemoryFollowRepository implements FollowRepository {
  private edges: Follow[] = [];
  async add(f: Follow) { if (!(await this.exists(f.followerId, f.followeeId))) this.edges.push(f); }
  async remove(a: string, b: string) { this.edges = this.edges.filter((e) => !(e.followerId === a && e.followeeId === b)); }
  async exists(a: string, b: string) { return this.edges.some((e) => e.followerId === a && e.followeeId === b); }
  async followeeIdsOf(id: string) { return this.edges.filter((e) => e.followerId === id).map((e) => e.followeeId); }
  async followerIdsOf(id: string) { return this.edges.filter((e) => e.followeeId === id).map((e) => e.followerId); }
  async countFollowers(id: string) { return (await this.followerIdsOf(id)).length; }
  async countFollowing(id: string) { return (await this.followeeIdsOf(id)).length; }
}

export class InMemoryWorkRepository implements WorkRepository {
  private byId = new Map<string, Work>();
  async upsert(w: Work) { this.byId.set(w.id, w); }
  async findById(id: string) { return this.byId.get(id) ?? null; }
  async findByExternal(source: "tmdb", externalId: string) {
    return [...this.byId.values()].find((w) => w.source === source && w.externalId === externalId) ?? null;
  }
}

export class InMemoryLibraryEntryRepository implements LibraryEntryRepository {
  private byId = new Map<string, LibraryEntry>();
  async upsert(e: LibraryEntry) { this.byId.set(e.id, e); }
  async findById(id: string) { return this.byId.get(id) ?? null; }
  async findByUserAndWork(userId: string, workId: string) {
    return [...this.byId.values()].find((e) => e.userId === userId && e.workId === workId) ?? null;
  }
  async listByUser(userId: string, opts: { status?: "planned" | "done"; domain?: string }) {
    return [...this.byId.values()].filter((e) =>
      e.userId === userId &&
      (opts.status ? e.status === opts.status : true) &&
      (opts.domain ? e.domain === opts.domain : true),
    ).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }
  async remove(id: string) { this.byId.delete(id); }
  async feed(opts: { circleUserIds: string[]; viewerId: string; domains: string[]; cursor: { createdAt: Date; id: string } | null; limit: number; }) {
    const circle = new Set(opts.circleUserIds);
    return [...this.byId.values()]
      .filter((e) => isPublishable(e))
      .filter((e) => opts.domains.includes(e.domain))
      .filter((e) => e.visibility === "public" || circle.has(e.userId))
      .filter((e) => !opts.cursor || e.createdAt.getTime() < opts.cursor.createdAt.getTime())
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, opts.limit);
  }
}

export class InMemoryListRepository implements ListRepository {
  private byId = new Map<string, List>();
  async create(l: List) { this.byId.set(l.id, l); }
  async findById(id: string) { return this.byId.get(id) ?? null; }
  async listByUser(userId: string, domain?: string) {
    return [...this.byId.values()].filter((l) => l.userId === userId && (domain ? l.domain === domain : true));
  }
  async update(l: List) { this.byId.set(l.id, l); }
  async remove(id: string) { this.byId.delete(id); }
}

export class InMemoryLikeRepository implements LikeRepository {
  private likes: Like[] = [];
  async add(l: Like) { if (!(await this.exists(l.entryId, l.userId))) this.likes.push(l); }
  async remove(entryId: string, userId: string) { this.likes = this.likes.filter((l) => !(l.entryId === entryId && l.userId === userId)); }
  async exists(entryId: string, userId: string) { return this.likes.some((l) => l.entryId === entryId && l.userId === userId); }
  async countByEntry(entryId: string) { return this.likes.filter((l) => l.entryId === entryId).length; }
  async likedEntryIds(userId: string, entryIds: string[]) {
    const s = new Set(entryIds);
    return this.likes.filter((l) => l.userId === userId && s.has(l.entryId)).map((l) => l.entryId);
  }
}

export class InMemoryCommentRepository implements CommentRepository {
  private byId = new Map<string, Comment>();
  async add(c: Comment) { this.byId.set(c.id, c); }
  async findById(id: string) { return this.byId.get(id) ?? null; }
  async listByEntry(entryId: string) {
    return [...this.byId.values()].filter((c) => c.entryId === entryId).sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  }
  async countByEntry(entryId: string) { return [...this.byId.values()].filter((c) => c.entryId === entryId).length; }
  async remove(id: string) { this.byId.delete(id); }
}
```

- [ ] **Step 4: Lancer le test (passe)**

Run: `npx vitest run tests/adapters/memory.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat(vulu): repositories in-memory"
```

### Task 1.7: Adapters sécurité (bcrypt, JWT, uuid, clock)

**Files:** Create: `vulu/src/server/adapters/security/bcrypt-hasher.ts`, `jwt-token-service.ts`, `uuid-id-generator.ts`, `system-clock.ts`; Test: `vulu/tests/adapters/security.test.ts`

- [ ] **Step 1: Écrire le test**

```ts
import { describe, it, expect } from "vitest";
import { BcryptHasher } from "@/server/adapters/security/bcrypt-hasher";
import { JwtTokenService } from "@/server/adapters/security/jwt-token-service";

describe("security adapters", () => {
  it("hash puis verify", async () => {
    const h = new BcryptHasher(4);
    const hash = await h.hash("secret");
    expect(hash).not.toBe("secret");
    expect(await h.verify("secret", hash)).toBe(true);
    expect(await h.verify("wrong", hash)).toBe(false);
  });
  it("issue puis verify un token", async () => {
    const t = new JwtTokenService("test-secret-test-secret-test-secret-32");
    const token = await t.issue({ userId: "u1" });
    expect((await t.verify(token))?.userId).toBe("u1");
    expect(await t.verify("garbage")).toBeNull();
  });
});
```

- [ ] **Step 2: Lancer le test (échoue)**

Run: `npx vitest run tests/adapters/security.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implémenter les 4 adapters**

`bcrypt-hasher.ts` :
```ts
import bcrypt from "bcryptjs";
import type { PasswordHasher } from "@/server/ports/security";

export class BcryptHasher implements PasswordHasher {
  constructor(private readonly rounds = 12) {}
  hash(plain: string) { return bcrypt.hash(plain, this.rounds); }
  verify(plain: string, hash: string) { return bcrypt.compare(plain, hash); }
}
```

`jwt-token-service.ts` :
```ts
import { SignJWT, jwtVerify } from "jose";
import type { TokenService } from "@/server/ports/security";

export class JwtTokenService implements TokenService {
  private key: Uint8Array;
  constructor(secret: string) { this.key = new TextEncoder().encode(secret); }
  async issue(payload: { userId: string }) {
    return new SignJWT({ userId: payload.userId })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime("7d")
      .sign(this.key);
  }
  async verify(token: string) {
    try {
      const { payload } = await jwtVerify(token, this.key);
      return typeof payload.userId === "string" ? { userId: payload.userId } : null;
    } catch { return null; }
  }
}
```

`uuid-id-generator.ts` :
```ts
import { randomUUID } from "node:crypto";
import type { IdGenerator } from "@/server/ports/security";
export class UuidIdGenerator implements IdGenerator { next() { return randomUUID(); } }
```

`system-clock.ts` :
```ts
import type { Clock } from "@/server/ports/security";
export class SystemClock implements Clock { now() { return new Date(); } }
```

- [ ] **Step 4: Lancer le test (passe)**

Run: `npx vitest run tests/adapters/security.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat(vulu): adapters sécurité (bcrypt, jwt, uuid, clock)"
```

### Task 1.8: Conteneur d'injection de dépendances

**Files:** Create: `vulu/src/server/container.ts`

> Note : le conteneur Mongo réel sera complété en M-Mongo. Pour l'instant il expose une fabrique de
> dépendances **in-memory** utilisée par les tests d'use-cases, plus les adapters sécurité réels.

- [ ] **Step 1: Écrire `container.ts`**

```ts
import {
  InMemoryUserRepository, InMemoryFollowRepository, InMemoryWorkRepository,
  InMemoryLibraryEntryRepository, InMemoryListRepository, InMemoryLikeRepository, InMemoryCommentRepository,
} from "@/server/adapters/memory";
import { BcryptHasher } from "@/server/adapters/security/bcrypt-hasher";
import { JwtTokenService } from "@/server/adapters/security/jwt-token-service";
import { UuidIdGenerator } from "@/server/adapters/security/uuid-id-generator";
import { SystemClock } from "@/server/adapters/security/system-clock";
import type {
  UserRepository, FollowRepository, WorkRepository, LibraryEntryRepository,
  ListRepository, LikeRepository, CommentRepository,
} from "@/server/ports/repositories";
import type { CatalogProvider } from "@/server/ports/catalog";
import type { PasswordHasher, TokenService, IdGenerator, Clock } from "@/server/ports/security";

export interface Deps {
  users: UserRepository;
  follows: FollowRepository;
  works: WorkRepository;
  entries: LibraryEntryRepository;
  lists: ListRepository;
  likes: LikeRepository;
  comments: CommentRepository;
  catalog: CatalogProvider;
  hasher: PasswordHasher;
  tokens: TokenService;
  ids: IdGenerator;
  clock: Clock;
}

/** Fabrique de dépendances in-memory pour les tests d'use-cases. */
export function makeInMemoryDeps(catalog: CatalogProvider): Deps {
  return {
    users: new InMemoryUserRepository(),
    follows: new InMemoryFollowRepository(),
    works: new InMemoryWorkRepository(),
    entries: new InMemoryLibraryEntryRepository(),
    lists: new InMemoryListRepository(),
    likes: new InMemoryLikeRepository(),
    comments: new InMemoryCommentRepository(),
    catalog,
    hasher: new BcryptHasher(4),
    tokens: new JwtTokenService("test-secret-test-secret-test-secret-32"),
    ids: new UuidIdGenerator(),
    clock: new SystemClock(),
  };
}
```

- [ ] **Step 2: Vérifier la compilation**

Run: `npx tsc --noEmit`
Expected: pas d'erreur.

- [ ] **Step 3: Commit**

```bash
git add -A && git commit -m "feat(vulu): conteneur DI (fabrique in-memory)"
```

---

## Milestone M2 — Use-cases d'authentification & profil

### Task 2.0: Faux catalogue pour les tests

**Files:** Create: `vulu/tests/helpers/fake-catalog.ts`

- [ ] **Step 1: Écrire le faux catalogue (réutilisé dans tous les tests d'use-cases)**

```ts
import type { CatalogProvider, WorkSummary, WorkDetails, Genre, Person } from "@/server/ports/catalog";

export class FakeCatalog implements CatalogProvider {
  works: Record<string, WorkDetails> = {
    "603": {
      externalId: "603", type: "movie", title: "The Matrix", year: 1999,
      posterUrl: "p.jpg", backdropUrl: "b.jpg", overview: "Neo…",
      genres: ["Science-fiction"], people: [{ tmdbId: 6384, name: "Keanu Reeves", role: "actor" }],
    },
  };
  async searchWorks(): Promise<WorkSummary[]> { return Object.values(this.works); }
  async getWork(externalId: string): Promise<WorkDetails | null> { return this.works[externalId] ?? null; }
  async listGenres(): Promise<Genre[]> { return [{ id: 878, name: "Science-fiction" }, { id: 18, name: "Drame" }, { id: 35, name: "Comédie" }]; }
  async searchPeople(): Promise<Person[]> { return [{ tmdbId: 1, name: "Denis Villeneuve", role: "director", profileUrl: null }]; }
}
```

- [ ] **Step 2: Compilation**

Run: `npx tsc --noEmit`
Expected: pas d'erreur.

- [ ] **Step 3: Commit**

```bash
git add -A && git commit -m "test(vulu): faux catalogue pour les use-cases"
```

### Task 2.1: RegisterUser

**Files:** Create: `vulu/src/server/application/register-user.ts`; Test: `vulu/tests/application/register-user.test.ts`

Règles : email & username uniques (insensibles à la casse), mot de passe ≥ 8, ≥ 3 genres dans
`tastes.filmGenreIds`, `activeTabs` non vide (défaut `["films"]`), mot de passe hashé.

- [ ] **Step 1: Écrire le test**

```ts
import { describe, it, expect, beforeEach } from "vitest";
import { makeInMemoryDeps, type Deps } from "@/server/container";
import { FakeCatalog } from "../helpers/fake-catalog";
import { registerUser } from "@/server/application/register-user";
import { ConflictError, ValidationError } from "@/server/domain/errors";

let deps: Deps;
const base = { email: "a@x.io", username: "alice", displayName: "Alice", password: "password1",
  activeTabs: ["films"] as const, tastes: { filmGenreIds: [878, 18, 35], people: [] } };

beforeEach(() => { deps = makeInMemoryDeps(new FakeCatalog()); });

describe("registerUser", () => {
  it("crée un utilisateur avec mot de passe hashé", async () => {
    const u = await registerUser(deps, { ...base });
    expect(u.id).toBeTruthy();
    expect(u.passwordHash).not.toBe("password1");
    expect(await deps.users.findByEmail("a@x.io")).not.toBeNull();
  });
  it("rejette un email déjà pris (insensible casse)", async () => {
    await registerUser(deps, { ...base });
    await expect(registerUser(deps, { ...base, username: "bob", email: "A@X.IO" })).rejects.toThrow(ConflictError);
  });
  it("rejette un username déjà pris", async () => {
    await registerUser(deps, { ...base });
    await expect(registerUser(deps, { ...base, email: "b@x.io" })).rejects.toThrow(ConflictError);
  });
  it("rejette moins de 3 genres", async () => {
    await expect(registerUser(deps, { ...base, tastes: { filmGenreIds: [878], people: [] } })).rejects.toThrow(ValidationError);
  });
  it("rejette un mot de passe trop court", async () => {
    await expect(registerUser(deps, { ...base, password: "short" })).rejects.toThrow(ValidationError);
  });
  it("rejette activeTabs vide", async () => {
    await expect(registerUser(deps, { ...base, activeTabs: [] })).rejects.toThrow(ValidationError);
  });
});
```

- [ ] **Step 2: Lancer (échoue)**

Run: `npx vitest run tests/application/register-user.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implémenter `register-user.ts`**

```ts
import type { Deps } from "@/server/container";
import type { Domain, Tastes, User } from "@/server/domain/entities";
import { ConflictError, ValidationError } from "@/server/domain/errors";

export interface RegisterInput {
  email: string;
  username: string;
  displayName: string;
  password: string;
  activeTabs: readonly Domain[];
  tastes: Tastes;
}

export async function registerUser(deps: Deps, input: RegisterInput): Promise<User> {
  const email = input.email.trim().toLowerCase();
  const username = input.username.trim().toLowerCase();

  if (input.password.length < 8) throw new ValidationError("Mot de passe : 8 caractères minimum");
  if (input.activeTabs.length < 1) throw new ValidationError("Au moins un onglet doit être actif");
  if (input.tastes.filmGenreIds.length < 3) throw new ValidationError("Sélectionne au moins 3 genres");
  if (await deps.users.findByEmail(email)) throw new ConflictError("Cet email est déjà utilisé");
  if (await deps.users.findByUsername(username)) throw new ConflictError("Ce nom d'utilisateur est pris");

  const user: User = {
    id: deps.ids.next(),
    email,
    passwordHash: await deps.hasher.hash(input.password),
    username,
    displayName: input.displayName.trim(),
    bio: null,
    avatarUrl: null,
    activeTabs: [...input.activeTabs],
    tastes: input.tastes,
    createdAt: deps.clock.now(),
  };
  await deps.users.create(user);
  return user;
}
```

- [ ] **Step 4: Lancer (passe)**

Run: `npx vitest run tests/application/register-user.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat(vulu): use-case RegisterUser"
```

### Task 2.2: AuthenticateUser

**Files:** Create: `vulu/src/server/application/authenticate-user.ts`; Test: `vulu/tests/application/authenticate-user.test.ts`

- [ ] **Step 1: Écrire le test**

```ts
import { describe, it, expect, beforeEach } from "vitest";
import { makeInMemoryDeps, type Deps } from "@/server/container";
import { FakeCatalog } from "../helpers/fake-catalog";
import { registerUser } from "@/server/application/register-user";
import { authenticateUser } from "@/server/application/authenticate-user";
import { AuthError } from "@/server/domain/errors";

let deps: Deps;
beforeEach(async () => {
  deps = makeInMemoryDeps(new FakeCatalog());
  await registerUser(deps, { email: "a@x.io", username: "alice", displayName: "Alice",
    password: "password1", activeTabs: ["films"], tastes: { filmGenreIds: [878, 18, 35], people: [] } });
});

describe("authenticateUser", () => {
  it("retourne un token + user pour de bons identifiants", async () => {
    const res = await authenticateUser(deps, { email: "A@x.io", password: "password1" });
    expect(res.token).toBeTruthy();
    expect((await deps.tokens.verify(res.token))?.userId).toBe(res.user.id);
  });
  it("rejette un mauvais mot de passe", async () => {
    await expect(authenticateUser(deps, { email: "a@x.io", password: "nope" })).rejects.toThrow(AuthError);
  });
  it("rejette un email inconnu", async () => {
    await expect(authenticateUser(deps, { email: "none@x.io", password: "password1" })).rejects.toThrow(AuthError);
  });
});
```

- [ ] **Step 2: Lancer (échoue)**

Run: `npx vitest run tests/application/authenticate-user.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implémenter `authenticate-user.ts`**

```ts
import type { Deps } from "@/server/container";
import type { User } from "@/server/domain/entities";
import { AuthError } from "@/server/domain/errors";

export async function authenticateUser(
  deps: Deps,
  input: { email: string; password: string },
): Promise<{ user: User; token: string }> {
  const user = await deps.users.findByEmail(input.email.trim().toLowerCase());
  if (!user) throw new AuthError("Identifiants invalides");
  const ok = await deps.hasher.verify(input.password, user.passwordHash);
  if (!ok) throw new AuthError("Identifiants invalides");
  const token = await deps.tokens.issue({ userId: user.id });
  return { user, token };
}
```

- [ ] **Step 4: Lancer (passe)**

Run: `npx vitest run tests/application/authenticate-user.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat(vulu): use-case AuthenticateUser"
```

### Task 2.3: GetCurrentUser, UpdateProfile, UpdateTastes

**Files:** Create: `vulu/src/server/application/get-current-user.ts`, `update-profile.ts`, `update-tastes.ts`; Test: `vulu/tests/application/profile.test.ts`

- [ ] **Step 1: Écrire le test**

```ts
import { describe, it, expect, beforeEach } from "vitest";
import { makeInMemoryDeps, type Deps } from "@/server/container";
import { FakeCatalog } from "../helpers/fake-catalog";
import { registerUser } from "@/server/application/register-user";
import { getCurrentUser } from "@/server/application/get-current-user";
import { updateProfile } from "@/server/application/update-profile";
import { updateTastes } from "@/server/application/update-tastes";
import { ValidationError } from "@/server/domain/errors";

let deps: Deps; let userId: string;
beforeEach(async () => {
  deps = makeInMemoryDeps(new FakeCatalog());
  const u = await registerUser(deps, { email: "a@x.io", username: "alice", displayName: "Alice",
    password: "password1", activeTabs: ["films"], tastes: { filmGenreIds: [878, 18, 35], people: [] } });
  userId = u.id;
});

describe("profil", () => {
  it("getCurrentUser via token", async () => {
    const token = await deps.tokens.issue({ userId });
    expect((await getCurrentUser(deps, token))?.id).toBe(userId);
    expect(await getCurrentUser(deps, "bad")).toBeNull();
  });
  it("updateProfile change bio + displayName", async () => {
    const u = await updateProfile(deps, userId, { displayName: "Alice B", bio: "hello", avatarUrl: null, activeTabs: ["films"] });
    expect(u.displayName).toBe("Alice B");
    expect(u.bio).toBe("hello");
  });
  it("updateProfile rejette activeTabs vide", async () => {
    await expect(updateProfile(deps, userId, { displayName: "A", bio: null, avatarUrl: null, activeTabs: [] })).rejects.toThrow(ValidationError);
  });
  it("updateTastes remplace les goûts", async () => {
    const u = await updateTastes(deps, userId, { filmGenreIds: [878, 18, 35, 53], people: [{ tmdbId: 1, name: "Villeneuve", role: "director" }] });
    expect(u.tastes.filmGenreIds).toContain(53);
    expect(u.tastes.people).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Lancer (échoue)**

Run: `npx vitest run tests/application/profile.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implémenter les 3 use-cases**

`get-current-user.ts` :
```ts
import type { Deps } from "@/server/container";
import type { User } from "@/server/domain/entities";

export async function getCurrentUser(deps: Deps, token: string | undefined): Promise<User | null> {
  if (!token) return null;
  const payload = await deps.tokens.verify(token);
  if (!payload) return null;
  return deps.users.findById(payload.userId);
}
```

`update-profile.ts` :
```ts
import type { Deps } from "@/server/container";
import type { Domain, User } from "@/server/domain/entities";
import { NotFoundError, ValidationError } from "@/server/domain/errors";

export async function updateProfile(
  deps: Deps, userId: string,
  input: { displayName: string; bio: string | null; avatarUrl: string | null; activeTabs: Domain[] },
): Promise<User> {
  const user = await deps.users.findById(userId);
  if (!user) throw new NotFoundError("Utilisateur introuvable");
  if (input.activeTabs.length < 1) throw new ValidationError("Au moins un onglet doit être actif");
  const updated: User = { ...user, displayName: input.displayName.trim(), bio: input.bio,
    avatarUrl: input.avatarUrl, activeTabs: input.activeTabs };
  await deps.users.update(updated);
  return updated;
}
```

`update-tastes.ts` :
```ts
import type { Deps } from "@/server/container";
import type { Tastes, User } from "@/server/domain/entities";
import { NotFoundError } from "@/server/domain/errors";

export async function updateTastes(deps: Deps, userId: string, tastes: Tastes): Promise<User> {
  const user = await deps.users.findById(userId);
  if (!user) throw new NotFoundError("Utilisateur introuvable");
  const updated: User = { ...user, tastes };
  await deps.users.update(updated);
  return updated;
}
```

- [ ] **Step 4: Lancer (passe)**

Run: `npx vitest run tests/application/profile.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat(vulu): use-cases GetCurrentUser, UpdateProfile, UpdateTastes"
```

---

## Milestone M3 — Catalogue & bibliothèque (entries)

### Task 3.1: SearchCatalog, listGenres, searchPeople (pass-through)

**Files:** Create: `vulu/src/server/application/catalog.ts`; Test: `vulu/tests/application/catalog.test.ts`

- [ ] **Step 1: Écrire le test**

```ts
import { describe, it, expect } from "vitest";
import { makeInMemoryDeps } from "@/server/container";
import { FakeCatalog } from "../helpers/fake-catalog";
import { searchCatalog, listGenres, searchPeople } from "@/server/application/catalog";

describe("catalog use-cases", () => {
  it("searchCatalog délègue au provider", async () => {
    const deps = makeInMemoryDeps(new FakeCatalog());
    const res = await searchCatalog(deps, "matrix");
    expect(res[0]?.title).toBe("The Matrix");
  });
  it("listGenres + searchPeople délèguent", async () => {
    const deps = makeInMemoryDeps(new FakeCatalog());
    expect((await listGenres(deps)).length).toBeGreaterThan(0);
    expect((await searchPeople(deps, "den"))[0]?.name).toContain("Villeneuve");
  });
});
```

- [ ] **Step 2: Lancer (échoue)** — Run: `npx vitest run tests/application/catalog.test.ts` — Expected: FAIL.

- [ ] **Step 3: Implémenter `catalog.ts`**

```ts
import type { Deps } from "@/server/container";

export function searchCatalog(deps: Deps, query: string) { return deps.catalog.searchWorks(query); }
export function listGenres(deps: Deps) { return deps.catalog.listGenres(); }
export function searchPeople(deps: Deps, query: string) { return deps.catalog.searchPeople(query); }
```

- [ ] **Step 4: Lancer (passe)** — Run: `npx vitest run tests/application/catalog.test.ts` — Expected: PASS.

- [ ] **Step 5: Commit** — `git add -A && git commit -m "feat(vulu): use-cases catalogue (search/genres/people)"`

### Task 3.2: GetWorkDetails (cache local des Work)

**Files:** Create: `vulu/src/server/application/get-work.ts`; Test: `vulu/tests/application/get-work.test.ts`

Règle : si la Work est en cache (`works`), la renvoyer ; sinon la chercher via le catalogue, la
persister, puis la renvoyer. `domain` dérivé du `type` (`movie`/`tv` → `films`).

- [ ] **Step 1: Écrire le test**

```ts
import { describe, it, expect, beforeEach } from "vitest";
import { makeInMemoryDeps, type Deps } from "@/server/container";
import { FakeCatalog } from "../helpers/fake-catalog";
import { getOrImportWork } from "@/server/application/get-work";
import { NotFoundError } from "@/server/domain/errors";

let deps: Deps;
beforeEach(() => { deps = makeInMemoryDeps(new FakeCatalog()); });

describe("getOrImportWork", () => {
  it("importe puis met en cache", async () => {
    const w = await getOrImportWork(deps, { source: "tmdb", externalId: "603", type: "movie" });
    expect(w.title).toBe("The Matrix");
    expect(w.domain).toBe("films");
    expect(await deps.works.findByExternal("tmdb", "603")).not.toBeNull();
  });
  it("renvoie le cache au 2e appel (même id)", async () => {
    const a = await getOrImportWork(deps, { source: "tmdb", externalId: "603", type: "movie" });
    const b = await getOrImportWork(deps, { source: "tmdb", externalId: "603", type: "movie" });
    expect(b.id).toBe(a.id);
  });
  it("NotFound si absent du catalogue", async () => {
    await expect(getOrImportWork(deps, { source: "tmdb", externalId: "999", type: "movie" })).rejects.toThrow(NotFoundError);
  });
});
```

- [ ] **Step 2: Lancer (échoue)** — Run: `npx vitest run tests/application/get-work.test.ts` — Expected: FAIL.

- [ ] **Step 3: Implémenter `get-work.ts`**

```ts
import type { Deps } from "@/server/container";
import type { Work, WorkType } from "@/server/domain/entities";
import { NotFoundError } from "@/server/domain/errors";

function domainOf(_type: WorkType): "films" { return "films"; } // Phase 2 : 'book' → 'books'

export async function getOrImportWork(
  deps: Deps, ref: { source: "tmdb"; externalId: string; type: WorkType },
): Promise<Work> {
  const cached = await deps.works.findByExternal(ref.source, ref.externalId);
  if (cached) return cached;
  const details = await deps.catalog.getWork(ref.externalId, ref.type);
  if (!details) throw new NotFoundError("Œuvre introuvable dans le catalogue");
  const work: Work = {
    id: deps.ids.next(),
    source: ref.source,
    externalId: details.externalId,
    type: details.type,
    domain: domainOf(details.type),
    title: details.title,
    year: details.year,
    posterUrl: details.posterUrl,
    backdropUrl: details.backdropUrl,
    overview: details.overview,
    genres: details.genres,
    people: details.people,
    cachedAt: deps.clock.now(),
  };
  await deps.works.upsert(work);
  return work;
}
```

- [ ] **Step 4: Lancer (passe)** — Run: `npx vitest run tests/application/get-work.test.ts` — Expected: PASS.

- [ ] **Step 5: Commit** — `git add -A && git commit -m "feat(vulu): use-case GetOrImportWork (cache local)"`

### Task 3.3: SetEntryStatus & RateOrReviewWork & RemoveEntry

**Files:** Create: `vulu/src/server/application/library-entry.ts`; Test: `vulu/tests/application/library-entry.test.ts`

Règles : une entrée unique par `(userId, workId)`. `setEntryStatus` crée/maj le statut. `rateOrReview`
force `status='done'`, valide la note (0–5, pas 0,1) et exige note OU texte. `removeEntry` n'autorise
que le propriétaire.

- [ ] **Step 1: Écrire le test**

```ts
import { describe, it, expect, beforeEach } from "vitest";
import { makeInMemoryDeps, type Deps } from "@/server/container";
import { FakeCatalog } from "../helpers/fake-catalog";
import { setEntryStatus, rateOrReviewWork, removeEntry } from "@/server/application/library-entry";
import { ValidationError, ForbiddenError } from "@/server/domain/errors";

let deps: Deps; const ref = { source: "tmdb" as const, externalId: "603", type: "movie" as const };
beforeEach(() => { deps = makeInMemoryDeps(new FakeCatalog()); });

describe("library entry", () => {
  it("setEntryStatus 'planned' crée une watchlist sans note", async () => {
    const e = await setEntryStatus(deps, "u1", ref, "planned");
    expect(e.status).toBe("planned");
    expect(e.rating).toBeNull();
  });
  it("rateOrReview force done et enregistre note + visibilité", async () => {
    const e = await rateOrReviewWork(deps, "u1", ref, { rating: 4.2, text: "top", visibility: "circle" });
    expect(e.status).toBe("done");
    expect(e.rating).toBe(4.2);
    expect(e.visibility).toBe("circle");
  });
  it("réutilise la même entrée (unicité user+work)", async () => {
    const a = await setEntryStatus(deps, "u1", ref, "planned");
    const b = await rateOrReviewWork(deps, "u1", ref, { rating: 3, text: null, visibility: "public" });
    expect(b.id).toBe(a.id);
  });
  it("rejette une note hors bornes ou non multiple de 0,1", async () => {
    await expect(rateOrReviewWork(deps, "u1", ref, { rating: 5.5, text: null, visibility: "public" })).rejects.toThrow(ValidationError);
    await expect(rateOrReviewWork(deps, "u1", ref, { rating: 2.73, text: null, visibility: "public" })).rejects.toThrow(ValidationError);
  });
  it("rejette ni note ni texte", async () => {
    await expect(rateOrReviewWork(deps, "u1", ref, { rating: null, text: null, visibility: "public" })).rejects.toThrow(ValidationError);
  });
  it("removeEntry interdit à un autre que le propriétaire", async () => {
    const e = await setEntryStatus(deps, "u1", ref, "planned");
    await expect(removeEntry(deps, "u2", e.id)).rejects.toThrow(ForbiddenError);
    await removeEntry(deps, "u1", e.id);
    expect(await deps.entries.findById(e.id)).toBeNull();
  });
});
```

- [ ] **Step 2: Lancer (échoue)** — Run: `npx vitest run tests/application/library-entry.test.ts` — Expected: FAIL.

- [ ] **Step 3: Implémenter `library-entry.ts`**

```ts
import type { Deps } from "@/server/container";
import type { EntryStatus, LibraryEntry, Visibility, WorkType } from "@/server/domain/entities";
import { ForbiddenError, NotFoundError, ValidationError } from "@/server/domain/errors";
import { getOrImportWork } from "./get-work";

type Ref = { source: "tmdb"; externalId: string; type: WorkType };

function isValidRating(r: number): boolean {
  if (r < 0 || r > 5) return false;
  return Math.round(r * 10) === r * 10; // pas de 0,1
}

async function loadOrCreateEntry(deps: Deps, userId: string, ref: Ref): Promise<LibraryEntry> {
  const work = await getOrImportWork(deps, ref);
  const existing = await deps.entries.findByUserAndWork(userId, work.id);
  if (existing) return existing;
  const now = deps.clock.now();
  return { id: deps.ids.next(), userId, workId: work.id, domain: work.domain,
    status: "planned", rating: null, text: null, visibility: "circle", createdAt: now, updatedAt: now };
}

export async function setEntryStatus(deps: Deps, userId: string, ref: Ref, status: EntryStatus): Promise<LibraryEntry> {
  const entry = await loadOrCreateEntry(deps, userId, ref);
  const updated: LibraryEntry = { ...entry, status, updatedAt: deps.clock.now() };
  await deps.entries.upsert(updated);
  return updated;
}

export async function rateOrReviewWork(
  deps: Deps, userId: string, ref: Ref,
  input: { rating: number | null; text: string | null; visibility: Visibility },
): Promise<LibraryEntry> {
  if (input.rating === null && (input.text === null || input.text.trim() === "")) {
    throw new ValidationError("Ajoute une note ou un commentaire");
  }
  if (input.rating !== null && !isValidRating(input.rating)) {
    throw new ValidationError("Note invalide (0 à 5, par pas de 0,1)");
  }
  const entry = await loadOrCreateEntry(deps, userId, ref);
  const updated: LibraryEntry = { ...entry, status: "done", rating: input.rating,
    text: input.text?.trim() ? input.text.trim() : null, visibility: input.visibility, updatedAt: deps.clock.now() };
  await deps.entries.upsert(updated);
  return updated;
}

export async function removeEntry(deps: Deps, userId: string, entryId: string): Promise<void> {
  const entry = await deps.entries.findById(entryId);
  if (!entry) throw new NotFoundError("Entrée introuvable");
  if (entry.userId !== userId) throw new ForbiddenError("Action non autorisée");
  await deps.entries.remove(entryId);
}
```

- [ ] **Step 4: Lancer (passe)** — Run: `npx vitest run tests/application/library-entry.test.ts` — Expected: PASS.

- [ ] **Step 5: Commit** — `git add -A && git commit -m "feat(vulu): use-cases bibliothèque (statut, note, suppression)"`

---

## Milestone M4 — Graphe social (follow) & cercle

### Task 4.1: FollowUser / UnfollowUser / GetCircle

**Files:** Create: `vulu/src/server/application/social.ts`; Test: `vulu/tests/application/social.test.ts`

Règles : pas de self-follow ; follow idempotent ; `getCircle` = `computeCircle` sur les deux directions.

- [ ] **Step 1: Écrire le test**

```ts
import { describe, it, expect, beforeEach } from "vitest";
import { makeInMemoryDeps, type Deps } from "@/server/container";
import { FakeCatalog } from "../helpers/fake-catalog";
import { followUser, unfollowUser, getCircle } from "@/server/application/social";
import { ValidationError } from "@/server/domain/errors";

let deps: Deps;
beforeEach(() => { deps = makeInMemoryDeps(new FakeCatalog()); });

describe("social", () => {
  it("follow puis cercle inclut l'autre", async () => {
    await followUser(deps, "me", "alice");
    expect([...(await getCircle(deps, "me"))]).toContain("alice");
  });
  it("le cercle est l'union des deux sens", async () => {
    await followUser(deps, "me", "alice");   // je suis alice
    await followUser(deps, "bob", "me");      // bob me suit
    const c = await getCircle(deps, "me");
    expect([...c].sort()).toEqual(["alice", "bob"]);
  });
  it("rejette le self-follow", async () => {
    await expect(followUser(deps, "me", "me")).rejects.toThrow(ValidationError);
  });
  it("follow idempotent", async () => {
    await followUser(deps, "me", "alice");
    await followUser(deps, "me", "alice");
    expect(await deps.follows.countFollowing("me")).toBe(1);
  });
  it("unfollow retire du cercle", async () => {
    await followUser(deps, "me", "alice");
    await unfollowUser(deps, "me", "alice");
    expect([...(await getCircle(deps, "me"))]).not.toContain("alice");
  });
});
```

- [ ] **Step 2: Lancer (échoue)** — Run: `npx vitest run tests/application/social.test.ts` — Expected: FAIL.

- [ ] **Step 3: Implémenter `social.ts`**

```ts
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
```

- [ ] **Step 4: Lancer (passe)** — Run: `npx vitest run tests/application/social.test.ts` — Expected: PASS.

- [ ] **Step 5: Commit** — `git add -A && git commit -m "feat(vulu): use-cases social (follow/unfollow/cercle)"`

---

## Milestone M5 — Listes

### Task 5.1: CRUD listes + ajout/retrait d'œuvre

**Files:** Create: `vulu/src/server/application/lists.ts`; Test: `vulu/tests/application/lists.test.ts`

Règles : seul le propriétaire modifie/supprime ; `addWorkToList` importe la Work si besoin et évite
les doublons ; `removeWorkFromList` retire l'id.

- [ ] **Step 1: Écrire le test**

```ts
import { describe, it, expect, beforeEach } from "vitest";
import { makeInMemoryDeps, type Deps } from "@/server/container";
import { FakeCatalog } from "../helpers/fake-catalog";
import { createList, addWorkToList, removeWorkFromList, updateList, deleteList, listsOf } from "@/server/application/lists";
import { ForbiddenError } from "@/server/domain/errors";

let deps: Deps; const ref = { source: "tmdb" as const, externalId: "603", type: "movie" as const };
beforeEach(() => { deps = makeInMemoryDeps(new FakeCatalog()); });

describe("lists", () => {
  it("crée une liste", async () => {
    const l = await createList(deps, "u1", { name: "SF culte", domain: "films", description: null, visibility: "public" });
    expect((await listsOf(deps, "u1")).map((x) => x.id)).toContain(l.id);
  });
  it("ajoute une œuvre sans doublon", async () => {
    const l = await createList(deps, "u1", { name: "SF", domain: "films", description: null, visibility: "public" });
    const after = await addWorkToList(deps, "u1", l.id, ref);
    await addWorkToList(deps, "u1", l.id, ref);
    const fresh = await deps.lists.findById(l.id);
    expect(fresh?.workIds).toHaveLength(1);
    expect(after.workIds).toHaveLength(1);
  });
  it("retire une œuvre", async () => {
    const l = await createList(deps, "u1", { name: "SF", domain: "films", description: null, visibility: "public" });
    await addWorkToList(deps, "u1", l.id, ref);
    const work = await deps.works.findByExternal("tmdb", "603");
    await removeWorkFromList(deps, "u1", l.id, work!.id);
    expect((await deps.lists.findById(l.id))?.workIds).toHaveLength(0);
  });
  it("interdit la modif par un non-propriétaire", async () => {
    const l = await createList(deps, "u1", { name: "SF", domain: "films", description: null, visibility: "public" });
    await expect(updateList(deps, "u2", l.id, { name: "x", description: null, visibility: "private" })).rejects.toThrow(ForbiddenError);
    await expect(deleteList(deps, "u2", l.id)).rejects.toThrow(ForbiddenError);
  });
});
```

- [ ] **Step 2: Lancer (échoue)** — Run: `npx vitest run tests/application/lists.test.ts` — Expected: FAIL.

- [ ] **Step 3: Implémenter `lists.ts`**

```ts
import type { Deps } from "@/server/container";
import type { Domain, List, ListVisibility, WorkType } from "@/server/domain/entities";
import { ForbiddenError, NotFoundError } from "@/server/domain/errors";
import { getOrImportWork } from "./get-work";

type Ref = { source: "tmdb"; externalId: string; type: WorkType };

async function owned(deps: Deps, userId: string, listId: string): Promise<List> {
  const list = await deps.lists.findById(listId);
  if (!list) throw new NotFoundError("Liste introuvable");
  if (list.userId !== userId) throw new ForbiddenError("Action non autorisée");
  return list;
}

export async function createList(
  deps: Deps, userId: string,
  input: { name: string; domain: Domain; description: string | null; visibility: ListVisibility },
): Promise<List> {
  const now = deps.clock.now();
  const list: List = { id: deps.ids.next(), userId, name: input.name.trim(), domain: input.domain,
    description: input.description, visibility: input.visibility, workIds: [], createdAt: now, updatedAt: now };
  await deps.lists.create(list);
  return list;
}

export async function updateList(
  deps: Deps, userId: string, listId: string,
  input: { name: string; description: string | null; visibility: ListVisibility },
): Promise<List> {
  const list = await owned(deps, userId, listId);
  const updated: List = { ...list, name: input.name.trim(), description: input.description,
    visibility: input.visibility, updatedAt: deps.clock.now() };
  await deps.lists.update(updated);
  return updated;
}

export async function deleteList(deps: Deps, userId: string, listId: string): Promise<void> {
  await owned(deps, userId, listId);
  await deps.lists.remove(listId);
}

export async function addWorkToList(deps: Deps, userId: string, listId: string, ref: Ref): Promise<List> {
  const list = await owned(deps, userId, listId);
  const work = await getOrImportWork(deps, ref);
  if (list.workIds.includes(work.id)) return list;
  const updated: List = { ...list, workIds: [...list.workIds, work.id], updatedAt: deps.clock.now() };
  await deps.lists.update(updated);
  return updated;
}

export async function removeWorkFromList(deps: Deps, userId: string, listId: string, workId: string): Promise<List> {
  const list = await owned(deps, userId, listId);
  const updated: List = { ...list, workIds: list.workIds.filter((id) => id !== workId), updatedAt: deps.clock.now() };
  await deps.lists.update(updated);
  return updated;
}

export function listsOf(deps: Deps, userId: string, domain?: Domain) { return deps.lists.listByUser(userId, domain); }
```

- [ ] **Step 4: Lancer (passe)** — Run: `npx vitest run tests/application/lists.test.ts` — Expected: PASS.

- [ ] **Step 5: Commit** — `git add -A && git commit -m "feat(vulu): use-cases listes (CRUD + œuvres)"`

---

## Milestone M6 — Feed

### Task 6.1: BuildFeed (filtré, enrichi, paginé)

**Files:** Create: `vulu/src/server/application/feed.ts`; Test: `vulu/tests/application/feed.test.ts`

Le feed renvoie des `FeedItem` enrichis (auteur, œuvre, compteurs, likedByMe), filtrés par cercle +
public + onglets actifs du viewer, paginés par curseur `createdAt`.

- [ ] **Step 1: Écrire le test**

```ts
import { describe, it, expect, beforeEach } from "vitest";
import { makeInMemoryDeps, type Deps } from "@/server/container";
import { FakeCatalog } from "../helpers/fake-catalog";
import { registerUser } from "@/server/application/register-user";
import { rateOrReviewWork } from "@/server/application/library-entry";
import { followUser } from "@/server/application/social";
import { likeEntry } from "@/server/application/engagement";
import { buildFeed } from "@/server/application/feed";

let deps: Deps; let me: string; let friend: string; let stranger: string;
const tastes = { filmGenreIds: [878, 18, 35], people: [] };
beforeEach(async () => {
  deps = makeInMemoryDeps(new FakeCatalog());
  me = (await registerUser(deps, { email: "me@x.io", username: "me", displayName: "Me", password: "password1", activeTabs: ["films"], tastes })).id;
  friend = (await registerUser(deps, { email: "f@x.io", username: "friend", displayName: "F", password: "password1", activeTabs: ["films"], tastes })).id;
  stranger = (await registerUser(deps, { email: "s@x.io", username: "stranger", displayName: "S", password: "password1", activeTabs: ["films"], tastes })).id;
  await followUser(deps, me, friend);
});

describe("buildFeed", () => {
  it("inclut public + cercle, enrichit auteur & œuvre & compteurs", async () => {
    const ref = { source: "tmdb" as const, externalId: "603", type: "movie" as const };
    const fe = await rateOrReviewWork(deps, friend, ref, { rating: 4.2, text: "circle", visibility: "circle" });
    await rateOrReviewWork(deps, stranger, ref, { rating: 3, text: "public", visibility: "public" });
    await likeEntry(deps, me, fe.id);

    const items = await buildFeed(deps, me, { cursor: null, limit: 10 });
    expect(items).toHaveLength(2);
    const circleItem = items.find((i) => i.entry.visibility === "circle")!;
    expect(circleItem.author.username).toBe("friend");
    expect(circleItem.work.title).toBe("The Matrix");
    expect(circleItem.likeCount).toBe(1);
    expect(circleItem.likedByMe).toBe(true);
  });
  it("exclut les entrées 'circle' d'un inconnu", async () => {
    const ref = { source: "tmdb" as const, externalId: "603", type: "movie" as const };
    await rateOrReviewWork(deps, stranger, ref, { rating: 3, text: "hidden", visibility: "circle" });
    const items = await buildFeed(deps, me, { cursor: null, limit: 10 });
    expect(items).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Lancer (échoue)** — Run: `npx vitest run tests/application/feed.test.ts` — Expected: FAIL.

- [ ] **Step 3: Implémenter `feed.ts`**

```ts
import type { Deps } from "@/server/container";
import type { LibraryEntry, User, Work } from "@/server/domain/entities";
import { NotFoundError } from "@/server/domain/errors";
import { getCircle } from "./social";

export interface FeedItem {
  entry: LibraryEntry;
  author: Pick<User, "id" | "username" | "displayName" | "avatarUrl">;
  work: Pick<Work, "id" | "title" | "year" | "posterUrl" | "type">;
  likeCount: number;
  commentCount: number;
  likedByMe: boolean;
}

export async function buildFeed(
  deps: Deps, viewerId: string, opts: { cursor: { createdAt: Date; id: string } | null; limit: number },
): Promise<FeedItem[]> {
  const viewer = await deps.users.findById(viewerId);
  if (!viewer) throw new NotFoundError("Utilisateur introuvable");
  const circle = await getCircle(deps, viewerId);

  const entries = await deps.entries.feed({
    circleUserIds: [...circle],
    viewerId,
    domains: viewer.activeTabs,
    cursor: opts.cursor,
    limit: opts.limit,
  });

  const liked = new Set(await deps.likes.likedEntryIds(viewerId, entries.map((e) => e.id)));

  return Promise.all(entries.map(async (entry) => {
    const [author, work, likeCount, commentCount] = await Promise.all([
      deps.users.findById(entry.userId),
      deps.works.findById(entry.workId),
      deps.likes.countByEntry(entry.id),
      deps.comments.countByEntry(entry.id),
    ]);
    if (!author || !work) throw new NotFoundError("Données de feed incohérentes");
    return {
      entry,
      author: { id: author.id, username: author.username, displayName: author.displayName, avatarUrl: author.avatarUrl },
      work: { id: work.id, title: work.title, year: work.year, posterUrl: work.posterUrl, type: work.type },
      likeCount, commentCount, likedByMe: liked.has(entry.id),
    };
  }));
}
```

> **Note d'ordre d'exécution :** la Task 7.1 (engagement) doit être implémentée **avant** de lancer
> le test 6.1 (il importe `likeEntry`). Implémente M7 puis reviens valider M6, ou commente la ligne
> `likeEntry` le temps du premier rouge. L'ordre recommandé : 7.1 → 6.1.

- [ ] **Step 4: Lancer (passe, après M7)** — Run: `npx vitest run tests/application/feed.test.ts` — Expected: PASS.

- [ ] **Step 5: Commit** — `git add -A && git commit -m "feat(vulu): use-case BuildFeed (filtré + enrichi)"`

---

## Milestone M7 — Engagement (likes & commentaires)

> Implémenter **avant** de valider M6.

### Task 7.1: LikeEntry / UnlikeEntry / CommentOnEntry / DeleteComment

**Files:** Create: `vulu/src/server/application/engagement.ts`; Test: `vulu/tests/application/engagement.test.ts`

Règles : on ne peut liker/commenter qu'une entrée **visible** pour soi (public ou auteur dans le
cercle, ou la sienne) ; like idempotent ; suppression de commentaire réservée à son auteur.

- [ ] **Step 1: Écrire le test**

```ts
import { describe, it, expect, beforeEach } from "vitest";
import { makeInMemoryDeps, type Deps } from "@/server/container";
import { FakeCatalog } from "../helpers/fake-catalog";
import { registerUser } from "@/server/application/register-user";
import { rateOrReviewWork } from "@/server/application/library-entry";
import { likeEntry, unlikeEntry, commentOnEntry, deleteComment, listComments } from "@/server/application/engagement";
import { ForbiddenError } from "@/server/domain/errors";

let deps: Deps; let me: string; let other: string;
const tastes = { filmGenreIds: [878, 18, 35], people: [] };
const ref = { source: "tmdb" as const, externalId: "603", type: "movie" as const };
beforeEach(async () => {
  deps = makeInMemoryDeps(new FakeCatalog());
  me = (await registerUser(deps, { email: "me@x.io", username: "me", displayName: "Me", password: "password1", activeTabs: ["films"], tastes })).id;
  other = (await registerUser(deps, { email: "o@x.io", username: "other", displayName: "O", password: "password1", activeTabs: ["films"], tastes })).id;
});

describe("engagement", () => {
  it("like public idempotent + unlike", async () => {
    const e = await rateOrReviewWork(deps, other, ref, { rating: 4, text: null, visibility: "public" });
    await likeEntry(deps, me, e.id);
    await likeEntry(deps, me, e.id);
    expect(await deps.likes.countByEntry(e.id)).toBe(1);
    await unlikeEntry(deps, me, e.id);
    expect(await deps.likes.countByEntry(e.id)).toBe(0);
  });
  it("interdit de liker une entrée 'circle' d'un inconnu", async () => {
    const e = await rateOrReviewWork(deps, other, ref, { rating: 4, text: null, visibility: "circle" });
    await expect(likeEntry(deps, me, e.id)).rejects.toThrow(ForbiddenError);
  });
  it("commente puis liste", async () => {
    const e = await rateOrReviewWork(deps, other, ref, { rating: 4, text: null, visibility: "public" });
    await commentOnEntry(deps, me, e.id, "bien vu");
    expect(await listComments(deps, me, e.id)).toHaveLength(1);
  });
  it("seul l'auteur supprime son commentaire", async () => {
    const e = await rateOrReviewWork(deps, other, ref, { rating: 4, text: null, visibility: "public" });
    const c = await commentOnEntry(deps, me, e.id, "x");
    await expect(deleteComment(deps, other, c.id)).rejects.toThrow(ForbiddenError);
    await deleteComment(deps, me, c.id);
    expect(await listComments(deps, me, e.id)).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Lancer (échoue)** — Run: `npx vitest run tests/application/engagement.test.ts` — Expected: FAIL.

- [ ] **Step 3: Implémenter `engagement.ts`**

```ts
import type { Deps } from "@/server/container";
import type { Comment, LibraryEntry } from "@/server/domain/entities";
import { ForbiddenError, NotFoundError } from "@/server/domain/errors";
import { getCircle } from "./social";

/** Une entrée est visible pour le viewer si : la sienne, OU publique, OU 'circle' et auteur dans le cercle. */
async function assertVisible(deps: Deps, viewerId: string, entry: LibraryEntry): Promise<void> {
  if (entry.userId === viewerId) return;
  if (entry.visibility === "public") return;
  const circle = await getCircle(deps, viewerId);
  if (!circle.has(entry.userId)) throw new ForbiddenError("Contenu non accessible");
}

async function loadVisible(deps: Deps, viewerId: string, entryId: string): Promise<LibraryEntry> {
  const entry = await deps.entries.findById(entryId);
  if (!entry) throw new NotFoundError("Entrée introuvable");
  await assertVisible(deps, viewerId, entry);
  return entry;
}

export async function likeEntry(deps: Deps, userId: string, entryId: string): Promise<void> {
  await loadVisible(deps, userId, entryId);
  await deps.likes.add({ entryId, userId, createdAt: deps.clock.now() });
}

export async function unlikeEntry(deps: Deps, userId: string, entryId: string): Promise<void> {
  await deps.likes.remove(entryId, userId);
}

export async function commentOnEntry(deps: Deps, userId: string, entryId: string, text: string): Promise<Comment> {
  const trimmed = text.trim();
  if (!trimmed) throw new ForbiddenError("Commentaire vide"); // remplacé par ValidationError côté API
  await loadVisible(deps, userId, entryId);
  const comment: Comment = { id: deps.ids.next(), entryId, userId, text: trimmed, createdAt: deps.clock.now() };
  await deps.comments.add(comment);
  return comment;
}

export async function deleteComment(deps: Deps, userId: string, commentId: string): Promise<void> {
  const comment = await deps.comments.findById(commentId);
  if (!comment) throw new NotFoundError("Commentaire introuvable");
  if (comment.userId !== userId) throw new ForbiddenError("Action non autorisée");
  await deps.comments.remove(commentId);
}

export async function listComments(deps: Deps, viewerId: string, entryId: string): Promise<Comment[]> {
  await loadVisible(deps, viewerId, entryId);
  return deps.comments.listByEntry(entryId);
}
```

- [ ] **Step 4: Lancer (passe)** — Run: `npx vitest run tests/application/engagement.test.ts` — Expected: PASS.

- [ ] **Step 5: Valider M6 maintenant** — Run: `npx vitest run tests/application/feed.test.ts` — Expected: PASS.

- [ ] **Step 6: Commit** — `git add -A && git commit -m "feat(vulu): use-cases engagement (likes/commentaires) + feed vert"`

---

## Milestone M8 — Adapters MongoDB

> Convention de mapping : chaque document Mongo a `_id: string = entity.id`. Les mappers convertissent
> document ↔ entité du domaine. Dates en `Date` BSON. Tests sur `mongodb-memory-server`.

### Task 8.1: Client Mongo (singleton poolé) + helper de test

**Files:** Create: `vulu/src/server/adapters/mongo/client.ts`; Create: `vulu/tests/helpers/mongo.ts`

- [ ] **Step 1: Implémenter `client.ts`**

```ts
import { MongoClient, type Db } from "mongodb";
import { getEnv } from "@/lib/env";

let client: MongoClient | null = null;
let db: Db | null = null;

export async function getDb(): Promise<Db> {
  if (db) return db;
  const env = getEnv();
  client = new MongoClient(env.MONGODB_URI, { maxPoolSize: 10 });
  await client.connect();
  db = client.db(env.MONGODB_DB);
  return db;
}

export async function closeDb(): Promise<void> {
  await client?.close();
  client = null; db = null;
}
```

- [ ] **Step 2: Implémenter `tests/helpers/mongo.ts`**

```ts
import { MongoMemoryServer } from "mongodb-memory-server";
import { MongoClient, type Db } from "mongodb";

export interface TestMongo { db: Db; stop: () => Promise<void>; }

export async function startTestMongo(): Promise<TestMongo> {
  const server = await MongoMemoryServer.create();
  const client = new MongoClient(server.getUri());
  await client.connect();
  const db = client.db("vulu_test");
  return { db, stop: async () => { await client.close(); await server.stop(); } };
}
```

- [ ] **Step 3: Compilation** — Run: `npx tsc --noEmit` — Expected: pas d'erreur.

- [ ] **Step 4: Commit** — `git add -A && git commit -m "feat(vulu): client Mongo poolé + helper de test"`

### Task 8.2: Mappers Mongo

**Files:** Create: `vulu/src/server/adapters/mongo/mappers.ts`; Test: `vulu/tests/adapters/mongo-mappers.test.ts`

- [ ] **Step 1: Écrire le test (aller-retour user & entry)**

```ts
import { describe, it, expect } from "vitest";
import { toUserDoc, fromUserDoc, toEntryDoc, fromEntryDoc } from "@/server/adapters/mongo/mappers";
import type { User, LibraryEntry } from "@/server/domain/entities";

const user: User = { id: "u1", email: "a@x.io", passwordHash: "h", username: "alice",
  displayName: "Alice", bio: null, avatarUrl: null, activeTabs: ["films"],
  tastes: { filmGenreIds: [1, 2, 3], people: [] }, createdAt: new Date("2024-01-01") };
const entry: LibraryEntry = { id: "e1", userId: "u1", workId: "w1", domain: "films",
  status: "done", rating: 4.2, text: "top", visibility: "public",
  createdAt: new Date("2024-01-02"), updatedAt: new Date("2024-01-03") };

describe("mongo mappers", () => {
  it("user round-trip", () => { expect(fromUserDoc(toUserDoc(user))).toEqual(user); });
  it("entry round-trip", () => { expect(fromEntryDoc(toEntryDoc(entry))).toEqual(entry); });
  it("user doc utilise _id = id", () => { expect(toUserDoc(user)._id).toBe("u1"); });
});
```

- [ ] **Step 2: Lancer (échoue)** — Run: `npx vitest run tests/adapters/mongo-mappers.test.ts` — Expected: FAIL.

- [ ] **Step 3: Implémenter `mappers.ts`** (un couple `to*Doc`/`from*Doc` par entité)

```ts
import type { User, Follow, Work, LibraryEntry, List, Like, Comment } from "@/server/domain/entities";

type WithId<T> = T & { _id: string };
const strip = <T>(d: WithId<T>): T => { const { _id, ...rest } = d as WithId<T> & Record<string, unknown>; void _id; return rest as T; };

export const toUserDoc = (u: User) => ({ _id: u.id, ...u });
export const fromUserDoc = (d: WithId<User>): User => strip(d);

export const toFollowDoc = (f: Follow) => ({ _id: `${f.followerId}:${f.followeeId}`, ...f });
export const fromFollowDoc = (d: WithId<Follow>): Follow => strip(d);

export const toWorkDoc = (w: Work) => ({ _id: w.id, ...w });
export const fromWorkDoc = (d: WithId<Work>): Work => strip(d);

export const toEntryDoc = (e: LibraryEntry) => ({ _id: e.id, ...e });
export const fromEntryDoc = (d: WithId<LibraryEntry>): LibraryEntry => strip(d);

export const toListDoc = (l: List) => ({ _id: l.id, ...l });
export const fromListDoc = (d: WithId<List>): List => strip(d);

export const toLikeDoc = (l: Like) => ({ _id: `${l.entryId}:${l.userId}`, ...l });
export const fromLikeDoc = (d: WithId<Like>): Like => strip(d);

export const toCommentDoc = (c: Comment) => ({ _id: c.id, ...c });
export const fromCommentDoc = (d: WithId<Comment>): Comment => strip(d);
```

- [ ] **Step 4: Lancer (passe)** — Run: `npx vitest run tests/adapters/mongo-mappers.test.ts` — Expected: PASS.

- [ ] **Step 5: Commit** — `git add -A && git commit -m "feat(vulu): mappers Mongo (round-trip)"`

### Task 8.3: Création des index

**Files:** Create: `vulu/src/server/adapters/mongo/indexes.ts`

- [ ] **Step 1: Implémenter `indexes.ts` (idempotent)**

```ts
import type { Db } from "mongodb";

export async function ensureIndexes(db: Db): Promise<void> {
  await db.collection("users").createIndexes([
    { key: { email: 1 }, unique: true, name: "uniq_email" },
    { key: { username: 1 }, unique: true, name: "uniq_username" },
  ]);
  await db.collection("follows").createIndexes([
    { key: { followerId: 1, followeeId: 1 }, unique: true, name: "uniq_edge" },
    { key: { followeeId: 1 }, name: "by_followee" },
  ]);
  await db.collection("works").createIndex({ source: 1, externalId: 1 }, { unique: true, name: "uniq_external" });
  await db.collection("entries").createIndexes([
    { key: { userId: 1, workId: 1 }, unique: true, name: "uniq_user_work" },
    { key: { visibility: 1, domain: 1, createdAt: -1 }, name: "feed" },
    { key: { userId: 1, status: 1 }, name: "by_user_status" },
    { key: { userId: 1, createdAt: -1 }, name: "by_user_date" },
  ]);
  await db.collection("lists").createIndex({ userId: 1 }, { name: "by_user" });
  await db.collection("likes").createIndex({ entryId: 1, userId: 1 }, { unique: true, name: "uniq_like" });
  await db.collection("comments").createIndex({ entryId: 1, createdAt: 1 }, { name: "by_entry" });
}
```

- [ ] **Step 2: Compilation** — Run: `npx tsc --noEmit` — Expected: pas d'erreur.

- [ ] **Step 3: Commit** — `git add -A && git commit -m "feat(vulu): création des index Mongo (idempotente)"`

### Task 8.4: Repositories Mongo + test d'intégration

**Files:** Create: `vulu/src/server/adapters/mongo/repositories.ts`; Test: `vulu/tests/adapters/mongo-repositories.test.ts`

> Les repos Mongo implémentent **les mêmes ports** que les repos in-memory. Le test rejoue un sous-
> ensemble des comportements (unicité, feed) contre une vraie base mémoire.

- [ ] **Step 1: Écrire le test d'intégration**

```ts
import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { startTestMongo, type TestMongo } from "../helpers/mongo";
import { ensureIndexes } from "@/server/adapters/mongo/indexes";
import { MongoUserRepository, MongoLibraryEntryRepository } from "@/server/adapters/mongo/repositories";
import type { User, LibraryEntry } from "@/server/domain/entities";

let m: TestMongo;
beforeAll(async () => { m = await startTestMongo(); await ensureIndexes(m.db); });
afterAll(async () => { await m.stop(); });
beforeEach(async () => { await m.db.collection("users").deleteMany({}); await m.db.collection("entries").deleteMany({}); });

const user = (id: string, over: Partial<User> = {}): User => ({ id, email: `${id}@x.io`, passwordHash: "h",
  username: id, displayName: id, bio: null, avatarUrl: null, activeTabs: ["films"],
  tastes: { filmGenreIds: [1, 2, 3], people: [] }, createdAt: new Date(), ...over });
const entry = (id: string, over: Partial<LibraryEntry> = {}): LibraryEntry => ({ id, userId: "u1", workId: "w1",
  domain: "films", status: "done", rating: 4, text: "x", visibility: "public",
  createdAt: new Date(), updatedAt: new Date(), ...over });

describe("Mongo repositories", () => {
  it("UserRepository persiste et retrouve par email", async () => {
    const r = new MongoUserRepository(m.db);
    await r.create(user("u1", { email: "a@x.io" }));
    expect((await r.findByEmail("a@x.io"))?.id).toBe("u1");
  });
  it("entries: unicité (userId, workId) via upsert", async () => {
    const r = new MongoLibraryEntryRepository(m.db);
    await r.upsert(entry("e1", { rating: 3 }));
    await r.upsert(entry("e1", { rating: 5 }));
    expect((await r.findByUserAndWork("u1", "w1"))?.rating).toBe(5);
  });
  it("feed: public OU cercle, trié desc", async () => {
    const r = new MongoLibraryEntryRepository(m.db);
    await r.upsert(entry("e_pub", { userId: "stranger", visibility: "public", createdAt: new Date(2024, 0, 1) }));
    await r.upsert(entry("e_cir", { userId: "friend", visibility: "circle", createdAt: new Date(2024, 0, 2) }));
    const res = await r.feed({ circleUserIds: ["friend"], viewerId: "me", domains: ["films"], cursor: null, limit: 10 });
    expect(res.map((e) => e.id)).toEqual(["e_cir", "e_pub"]);
  });
});
```

- [ ] **Step 2: Lancer (échoue)** — Run: `npx vitest run tests/adapters/mongo-repositories.test.ts` — Expected: FAIL.

- [ ] **Step 3: Implémenter `repositories.ts`** (toutes les classes Mongo)

```ts
import type { Db } from "mongodb";
import type {
  UserRepository, FollowRepository, WorkRepository, LibraryEntryRepository,
  ListRepository, LikeRepository, CommentRepository,
} from "@/server/ports/repositories";
import type { User, Follow, Work, LibraryEntry, List, Like, Comment } from "@/server/domain/entities";
import * as M from "./mappers";

export class MongoUserRepository implements UserRepository {
  private col = this.db.collection<M.WithIdUser>("users");
  constructor(private db: Db) {}
  async create(u: User) { await this.col.insertOne(M.toUserDoc(u)); }
  async findById(id: string) { const d = await this.col.findOne({ _id: id }); return d ? M.fromUserDoc(d) : null; }
  async findByEmail(email: string) { const d = await this.col.findOne({ email }); return d ? M.fromUserDoc(d) : null; }
  async findByUsername(username: string) { const d = await this.col.findOne({ username }); return d ? M.fromUserDoc(d) : null; }
  async update(u: User) { await this.col.replaceOne({ _id: u.id }, M.toUserDoc(u)); }
}

export class MongoFollowRepository implements FollowRepository {
  private col = this.db.collection<M.WithIdFollow>("follows");
  constructor(private db: Db) {}
  async add(f: Follow) { await this.col.updateOne({ _id: `${f.followerId}:${f.followeeId}` }, { $setOnInsert: M.toFollowDoc(f) }, { upsert: true }); }
  async remove(a: string, b: string) { await this.col.deleteOne({ _id: `${a}:${b}` }); }
  async exists(a: string, b: string) { return (await this.col.countDocuments({ _id: `${a}:${b}` })) > 0; }
  async followeeIdsOf(id: string) { return (await this.col.find({ followerId: id }).toArray()).map((d) => d.followeeId); }
  async followerIdsOf(id: string) { return (await this.col.find({ followeeId: id }).toArray()).map((d) => d.followerId); }
  async countFollowers(id: string) { return this.col.countDocuments({ followeeId: id }); }
  async countFollowing(id: string) { return this.col.countDocuments({ followerId: id }); }
}

export class MongoWorkRepository implements WorkRepository {
  private col = this.db.collection<M.WithIdWork>("works");
  constructor(private db: Db) {}
  async upsert(w: Work) { await this.col.replaceOne({ _id: w.id }, M.toWorkDoc(w), { upsert: true }); }
  async findById(id: string) { const d = await this.col.findOne({ _id: id }); return d ? M.fromWorkDoc(d) : null; }
  async findByExternal(source: "tmdb", externalId: string) { const d = await this.col.findOne({ source, externalId }); return d ? M.fromWorkDoc(d) : null; }
}

export class MongoLibraryEntryRepository implements LibraryEntryRepository {
  private col = this.db.collection<M.WithIdEntry>("entries");
  constructor(private db: Db) {}
  async upsert(e: LibraryEntry) { await this.col.replaceOne({ userId: e.userId, workId: e.workId }, M.toEntryDoc(e), { upsert: true }); }
  async findById(id: string) { const d = await this.col.findOne({ _id: id }); return d ? M.fromEntryDoc(d) : null; }
  async findByUserAndWork(userId: string, workId: string) { const d = await this.col.findOne({ userId, workId }); return d ? M.fromEntryDoc(d) : null; }
  async listByUser(userId: string, opts: { status?: "planned" | "done"; domain?: string }) {
    const q: Record<string, unknown> = { userId };
    if (opts.status) q.status = opts.status;
    if (opts.domain) q.domain = opts.domain;
    return (await this.col.find(q).sort({ createdAt: -1 }).toArray()).map(M.fromEntryDoc);
  }
  async remove(id: string) { await this.col.deleteOne({ _id: id }); }
  async feed(opts: { circleUserIds: string[]; viewerId: string; domains: string[]; cursor: { createdAt: Date; id: string } | null; limit: number; }) {
    const visibility = { $or: [{ visibility: "public" }, { userId: { $in: opts.circleUserIds } }] };
    const publishable = { status: "done", $or: [{ rating: { $ne: null } }, { text: { $ne: null } }] };
    const q: Record<string, unknown> = { $and: [visibility, publishable, { domain: { $in: opts.domains } }] };
    if (opts.cursor) (q.$and as unknown[]).push({ createdAt: { $lt: opts.cursor.createdAt } });
    return (await this.col.find(q).sort({ createdAt: -1, _id: -1 }).limit(opts.limit).toArray()).map(M.fromEntryDoc);
  }
}

export class MongoListRepository implements ListRepository {
  private col = this.db.collection<M.WithIdList>("lists");
  constructor(private db: Db) {}
  async create(l: List) { await this.col.insertOne(M.toListDoc(l)); }
  async findById(id: string) { const d = await this.col.findOne({ _id: id }); return d ? M.fromListDoc(d) : null; }
  async listByUser(userId: string, domain?: string) {
    const q: Record<string, unknown> = { userId };
    if (domain) q.domain = domain;
    return (await this.col.find(q).sort({ updatedAt: -1 }).toArray()).map(M.fromListDoc);
  }
  async update(l: List) { await this.col.replaceOne({ _id: l.id }, M.toListDoc(l)); }
  async remove(id: string) { await this.col.deleteOne({ _id: id }); }
}

export class MongoLikeRepository implements LikeRepository {
  private col = this.db.collection<M.WithIdLike>("likes");
  constructor(private db: Db) {}
  async add(l: Like) { await this.col.updateOne({ _id: `${l.entryId}:${l.userId}` }, { $setOnInsert: M.toLikeDoc(l) }, { upsert: true }); }
  async remove(entryId: string, userId: string) { await this.col.deleteOne({ _id: `${entryId}:${userId}` }); }
  async exists(entryId: string, userId: string) { return (await this.col.countDocuments({ _id: `${entryId}:${userId}` })) > 0; }
  async countByEntry(entryId: string) { return this.col.countDocuments({ entryId }); }
  async likedEntryIds(userId: string, entryIds: string[]) {
    return (await this.col.find({ userId, entryId: { $in: entryIds } }).toArray()).map((d) => d.entryId);
  }
}

export class MongoCommentRepository implements CommentRepository {
  private col = this.db.collection<M.WithIdComment>("comments");
  constructor(private db: Db) {}
  async add(c: Comment) { await this.col.insertOne(M.toCommentDoc(c)); }
  async findById(id: string) { const d = await this.col.findOne({ _id: id }); return d ? M.fromCommentDoc(d) : null; }
  async listByEntry(entryId: string) { return (await this.col.find({ entryId }).sort({ createdAt: 1 }).toArray()).map(M.fromCommentDoc); }
  async countByEntry(entryId: string) { return this.col.countDocuments({ entryId }); }
  async remove(id: string) { await this.col.deleteOne({ _id: id }); }
}
```

- [ ] **Step 4: Exporter les types `WithId*` depuis `mappers.ts`**

Ajouter en tête de `mappers.ts` (après l'import) :
```ts
export type WithIdUser = User & { _id: string };
export type WithIdFollow = Follow & { _id: string };
export type WithIdWork = Work & { _id: string };
export type WithIdEntry = LibraryEntry & { _id: string };
export type WithIdList = List & { _id: string };
export type WithIdLike = Like & { _id: string };
export type WithIdComment = Comment & { _id: string };
```

- [ ] **Step 5: Lancer (passe)** — Run: `npx vitest run tests/adapters/mongo-repositories.test.ts` — Expected: PASS.

- [ ] **Step 6: Commit** — `git add -A && git commit -m "feat(vulu): repositories Mongo + tests d'intégration"`

---

## Milestone M9 — Adapter TMDB & wiring réel

### Task 9.1: TmdbCatalog (adapter HTTP)

**Files:** Create: `vulu/src/server/adapters/catalog/tmdb-catalog.ts`; Test: `vulu/tests/adapters/tmdb-catalog.test.ts`

L'adapter mappe les DTO TMDB vers les types du port. Aucune structure TMDB ne fuit. `fetch` injecté
pour le test. Affiches/backdrops construits avec `TMDB_IMAGE_BASE`.

- [ ] **Step 1: Écrire le test (fetch mocké)**

```ts
import { describe, it, expect } from "vitest";
import { TmdbCatalog } from "@/server/adapters/catalog/tmdb-catalog";

function fakeFetch(routes: Record<string, unknown>): typeof fetch {
  return (async (url: string | URL | Request) => {
    const u = url.toString();
    const key = Object.keys(routes).find((k) => u.includes(k));
    if (!key) throw new Error("route inattendue: " + u);
    return { ok: true, json: async () => routes[key] } as Response;
  }) as typeof fetch;
}

const cfg = { apiKey: "tok", baseUrl: "https://api.themoviedb.org/3", imageBase: "https://img" };

describe("TmdbCatalog", () => {
  it("searchWorks mappe movie & tv", async () => {
    const c = new TmdbCatalog(cfg, fakeFetch({
      "/search/multi": { results: [
        { media_type: "movie", id: 603, title: "The Matrix", release_date: "1999-03-30", poster_path: "/p.jpg" },
        { media_type: "tv", id: 1396, name: "Breaking Bad", first_air_date: "2008-01-20", poster_path: "/q.jpg" },
        { media_type: "person", id: 5 },
      ] },
    }));
    const res = await c.searchWorks("x");
    expect(res).toHaveLength(2);
    expect(res[0]).toMatchObject({ externalId: "603", type: "movie", title: "The Matrix", year: 1999 });
    expect(res[0]?.posterUrl).toBe("https://img/w500/p.jpg");
    expect(res[1]).toMatchObject({ type: "tv", title: "Breaking Bad", year: 2008 });
  });
  it("getWork récupère détails + crédits (réalisateur)", async () => {
    const c = new TmdbCatalog(cfg, fakeFetch({
      "/movie/603": { id: 603, title: "The Matrix", release_date: "1999-03-30", poster_path: "/p.jpg",
        backdrop_path: "/b.jpg", overview: "Neo", genres: [{ id: 878, name: "Science Fiction" }],
        credits: { cast: [{ id: 6384, name: "Keanu Reeves" }], crew: [{ id: 1, name: "Lana W.", job: "Director" }] } },
    }));
    const w = await c.getWork("603", "movie");
    expect(w?.genres).toContain("Science Fiction");
    expect(w?.people.find((p) => p.role === "director")?.name).toBe("Lana W.");
    expect(w?.people.find((p) => p.role === "actor")?.name).toBe("Keanu Reeves");
  });
  it("listGenres fusionne movie + tv", async () => {
    const c = new TmdbCatalog(cfg, fakeFetch({
      "/genre/movie/list": { genres: [{ id: 878, name: "SF" }] },
      "/genre/tv/list": { genres: [{ id: 10765, name: "Sci-Fi & Fantasy" }] },
    }));
    expect((await c.listGenres()).length).toBe(2);
  });
});
```

- [ ] **Step 2: Lancer (échoue)** — Run: `npx vitest run tests/adapters/tmdb-catalog.test.ts` — Expected: FAIL.

- [ ] **Step 3: Implémenter `tmdb-catalog.ts`**

```ts
import type { CatalogProvider, WorkSummary, WorkDetails, Genre, Person } from "@/server/ports/catalog";
import type { WorkType } from "@/server/domain/entities";

export interface TmdbConfig { apiKey: string; baseUrl: string; imageBase: string; }

interface TmdbSearchItem { media_type?: string; id: number; title?: string; name?: string;
  release_date?: string; first_air_date?: string; poster_path?: string | null; }
interface TmdbDetails { id: number; title?: string; name?: string; release_date?: string; first_air_date?: string;
  poster_path?: string | null; backdrop_path?: string | null; overview?: string;
  genres?: { id: number; name: string }[];
  credits?: { cast?: { id: number; name: string }[]; crew?: { id: number; name: string; job: string }[] }; }

function yearOf(d?: string): number | null { return d ? Number(d.slice(0, 4)) || null : null; }

export class TmdbCatalog implements CatalogProvider {
  constructor(private cfg: TmdbConfig, private fetchImpl: typeof fetch = fetch) {}

  private img(path: string | null | undefined, size: string): string | null {
    return path ? `${this.cfg.imageBase}/${size}${path}` : null;
  }
  private async get<T>(path: string, params: Record<string, string> = {}): Promise<T> {
    const url = new URL(this.cfg.baseUrl + path);
    url.searchParams.set("language", "fr-FR");
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
    const res = await this.fetchImpl(url.toString(), { headers: { Authorization: `Bearer ${this.cfg.apiKey}` } });
    if (!res.ok) throw new Error(`TMDB ${res.status}`);
    return res.json() as Promise<T>;
  }

  async searchWorks(query: string): Promise<WorkSummary[]> {
    const data = await this.get<{ results: TmdbSearchItem[] }>("/search/multi", { query });
    return data.results
      .filter((r) => r.media_type === "movie" || r.media_type === "tv")
      .map((r) => ({
        externalId: String(r.id),
        type: (r.media_type === "tv" ? "tv" : "movie") as WorkType,
        title: r.title ?? r.name ?? "Sans titre",
        year: yearOf(r.release_date ?? r.first_air_date),
        posterUrl: this.img(r.poster_path, "w500"),
      }));
  }

  async getWork(externalId: string, type: WorkType): Promise<WorkDetails | null> {
    const d = await this.get<TmdbDetails>(`/${type}/${externalId}`, { append_to_response: "credits" });
    if (!d?.id) return null;
    const cast = (d.credits?.cast ?? []).slice(0, 10).map((c) => ({ tmdbId: c.id, name: c.name, role: "actor" as const }));
    const directors = (d.credits?.crew ?? []).filter((c) => c.job === "Director")
      .map((c) => ({ tmdbId: c.id, name: c.name, role: "director" as const }));
    return {
      externalId: String(d.id), type,
      title: d.title ?? d.name ?? "Sans titre",
      year: yearOf(d.release_date ?? d.first_air_date),
      posterUrl: this.img(d.poster_path, "w500"),
      backdropUrl: this.img(d.backdrop_path, "w1280"),
      overview: d.overview ?? null,
      genres: (d.genres ?? []).map((g) => g.name),
      people: [...directors, ...cast],
    };
  }

  async listGenres(): Promise<Genre[]> {
    const [movie, tv] = await Promise.all([
      this.get<{ genres: Genre[] }>("/genre/movie/list"),
      this.get<{ genres: Genre[] }>("/genre/tv/list"),
    ]);
    const map = new Map<number, Genre>();
    for (const g of [...movie.genres, ...tv.genres]) map.set(g.id, g);
    return [...map.values()];
  }

  async searchPeople(query: string): Promise<Person[]> {
    const data = await this.get<{ results: { id: number; name: string; known_for_department?: string; profile_path?: string | null }[] }>("/search/person", { query });
    return data.results.map((p) => ({
      tmdbId: p.id, name: p.name,
      role: (p.known_for_department === "Directing" ? "director" : "actor") as Person["role"],
      profileUrl: this.img(p.profile_path, "w185"),
    }));
  }
}
```

- [ ] **Step 4: Lancer (passe)** — Run: `npx vitest run tests/adapters/tmdb-catalog.test.ts` — Expected: PASS.

- [ ] **Step 5: Commit** — `git add -A && git commit -m "feat(vulu): adapter TMDB (catalogue)"`

### Task 9.2: Wiring réel des dépendances (container Mongo)

**Files:** Modify: `vulu/src/server/container.ts`

- [ ] **Step 1: Ajouter la fabrique réelle à `container.ts`**

Ajouter en bas du fichier :
```ts
import { getDb } from "@/server/adapters/mongo/client";
import {
  MongoUserRepository, MongoFollowRepository, MongoWorkRepository, MongoLibraryEntryRepository,
  MongoListRepository, MongoLikeRepository, MongoCommentRepository,
} from "@/server/adapters/mongo/repositories";
import { TmdbCatalog } from "@/server/adapters/catalog/tmdb-catalog";
import { getEnv } from "@/lib/env";

let realDeps: Deps | null = null;

/** Dépendances de production (Mongo + TMDB + sécurité réelle). Singleton. */
export async function getDeps(): Promise<Deps> {
  if (realDeps) return realDeps;
  const env = getEnv();
  const db = await getDb();
  realDeps = {
    users: new MongoUserRepository(db),
    follows: new MongoFollowRepository(db),
    works: new MongoWorkRepository(db),
    entries: new MongoLibraryEntryRepository(db),
    lists: new MongoListRepository(db),
    likes: new MongoLikeRepository(db),
    comments: new MongoCommentRepository(db),
    catalog: new TmdbCatalog({ apiKey: env.TMDB_API_KEY, baseUrl: env.TMDB_BASE_URL, imageBase: env.TMDB_IMAGE_BASE }),
    hasher: new BcryptHasher(12),
    tokens: new JwtTokenService(env.JWT_SECRET),
    ids: new UuidIdGenerator(),
    clock: new SystemClock(),
  };
  return realDeps;
}
```

- [ ] **Step 2: Créer le script d'init des index `vulu/scripts/init-db.ts`**

```ts
import { getDb } from "@/server/adapters/mongo/client";
import { ensureIndexes } from "@/server/adapters/mongo/indexes";

async function main() {
  const db = await getDb();
  await ensureIndexes(db);
  console.log("Index Mongo créés.");
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
```

Ajouter le script `package.json` : `"init-db": "node --import tsx scripts/init-db.ts"` et installer tsx :
`npm i -D tsx`.

- [ ] **Step 3: Compilation** — Run: `npx tsc --noEmit` — Expected: pas d'erreur.

- [ ] **Step 4: Commit** — `git add -A && git commit -m "feat(vulu): wiring Mongo/TMDB réel + script init-db"`

---

## Milestone M10 — Couche API (route handlers)

### Task 10.1: Schémas Zod, gestion d'erreur HTTP, session & requireUser

**Files:** Create: `vulu/src/lib/zod-schemas.ts`, `vulu/src/server/http/errors.ts`, `vulu/src/server/http/session.ts`

- [ ] **Step 1: `lib/zod-schemas.ts`**

```ts
import { z } from "zod";

export const tastesSchema = z.object({
  filmGenreIds: z.array(z.number().int()).min(3),
  people: z.array(z.object({ tmdbId: z.number().int(), name: z.string(), role: z.enum(["actor", "director"]) })),
});
export const registerSchema = z.object({
  email: z.string().email(),
  username: z.string().min(3).max(20).regex(/^[a-z0-9_]+$/i),
  displayName: z.string().min(1).max(40),
  password: z.string().min(8),
  activeTabs: z.array(z.enum(["films", "books"])).min(1),
  tastes: tastesSchema,
});
export const loginSchema = z.object({ email: z.string().email(), password: z.string().min(1) });
export const updateProfileSchema = z.object({
  displayName: z.string().min(1).max(40), bio: z.string().max(300).nullable(),
  avatarUrl: z.string().url().nullable(), activeTabs: z.array(z.enum(["films", "books"])).min(1),
});
export const workRefSchema = z.object({ source: z.literal("tmdb"), externalId: z.string(), type: z.enum(["movie", "tv"]) });
export const setStatusSchema = z.object({ ref: workRefSchema, status: z.enum(["planned", "done"]) });
export const rateSchema = z.object({
  ref: workRefSchema,
  rating: z.number().min(0).max(5).nullable(),
  text: z.string().max(2000).nullable(),
  visibility: z.enum(["circle", "public"]),
});
export const createListSchema = z.object({
  name: z.string().min(1).max(60), domain: z.enum(["films", "books"]),
  description: z.string().max(300).nullable(), visibility: z.enum(["public", "private"]),
});
export const commentSchema = z.object({ text: z.string().min(1).max(1000) });
```

- [ ] **Step 2: `server/http/errors.ts` (mappe DomainError → réponse)**

```ts
import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { DomainError } from "@/server/domain/errors";

const STATUS: Record<string, number> = { NOT_FOUND: 404, CONFLICT: 409, AUTH: 401, VALIDATION: 422, FORBIDDEN: 403 };

export function toErrorResponse(err: unknown): NextResponse {
  if (err instanceof ZodError) {
    return NextResponse.json({ error: "VALIDATION", details: err.flatten() }, { status: 422 });
  }
  if (err instanceof DomainError) {
    return NextResponse.json({ error: err.code, message: err.message }, { status: STATUS[err.code] ?? 400 });
  }
  console.error("Erreur inattendue:", err);
  return NextResponse.json({ error: "INTERNAL" }, { status: 500 });
}
```

- [ ] **Step 3: `server/http/session.ts` (cookie httpOnly + requireUser)**

```ts
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getDeps } from "@/server/container";
import { getCurrentUser } from "@/server/application/get-current-user";
import { AuthError } from "@/server/domain/errors";
import type { User } from "@/server/domain/entities";

const COOKIE = "vulu_session";

export async function setSessionCookie(token: string): Promise<void> {
  (await cookies()).set(COOKIE, token, {
    httpOnly: true, secure: process.env.NODE_ENV === "production",
    sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 7,
  });
}
export async function clearSessionCookie(): Promise<void> { (await cookies()).delete(COOKIE); }

export async function currentUser(): Promise<User | null> {
  const token = (await cookies()).get(COOKIE)?.value;
  const deps = await getDeps();
  return getCurrentUser(deps, token);
}

export async function requireUser(): Promise<User> {
  const user = await currentUser();
  if (!user) throw new AuthError("Authentification requise");
  return user;
}

export { COOKIE as SESSION_COOKIE };
export const json = NextResponse.json;
```

- [ ] **Step 4: Compilation** — Run: `npx tsc --noEmit` — Expected: pas d'erreur.

- [ ] **Step 5: Commit** — `git add -A && git commit -m "feat(vulu): schémas zod + erreurs HTTP + session"`

### Task 10.2: Routes auth (register / login / logout / me)

**Files:** Create: `vulu/src/app/api/auth/register/route.ts`, `login/route.ts`, `logout/route.ts`, `vulu/src/app/api/me/route.ts`

> Sérialisation : ne jamais renvoyer `passwordHash`. Helper `publicUser()`.

- [ ] **Step 1: Créer `vulu/src/lib/serialize.ts`**

```ts
import type { User } from "@/server/domain/entities";
export function publicUser(u: User) {
  const { passwordHash, email, ...rest } = u; void passwordHash;
  return rest; // email exclu des réponses publiques ; ré-ajouté explicitement pour /me si besoin
}
export function selfUser(u: User) { const { passwordHash, ...rest } = u; void passwordHash; return rest; }
```

- [ ] **Step 2: `register/route.ts`**

```ts
import { getDeps } from "@/server/container";
import { registerUser } from "@/server/application/register-user";
import { authenticateUser } from "@/server/application/authenticate-user";
import { registerSchema } from "@/lib/zod-schemas";
import { setSessionCookie, json } from "@/server/http/session";
import { toErrorResponse } from "@/server/http/errors";
import { selfUser } from "@/lib/serialize";

export async function POST(req: Request) {
  try {
    const input = registerSchema.parse(await req.json());
    const deps = await getDeps();
    await registerUser(deps, input);
    const { user, token } = await authenticateUser(deps, { email: input.email, password: input.password });
    await setSessionCookie(token);
    return json({ user: selfUser(user) }, { status: 201 });
  } catch (e) { return toErrorResponse(e); }
}
```

- [ ] **Step 3: `login/route.ts`**

```ts
import { getDeps } from "@/server/container";
import { authenticateUser } from "@/server/application/authenticate-user";
import { loginSchema } from "@/lib/zod-schemas";
import { setSessionCookie, json } from "@/server/http/session";
import { toErrorResponse } from "@/server/http/errors";
import { selfUser } from "@/lib/serialize";

export async function POST(req: Request) {
  try {
    const input = loginSchema.parse(await req.json());
    const deps = await getDeps();
    const { user, token } = await authenticateUser(deps, input);
    await setSessionCookie(token);
    return json({ user: selfUser(user) });
  } catch (e) { return toErrorResponse(e); }
}
```

- [ ] **Step 4: `logout/route.ts`**

```ts
import { clearSessionCookie, json } from "@/server/http/session";
export async function POST() { await clearSessionCookie(); return json({ ok: true }); }
```

- [ ] **Step 5: `me/route.ts` (GET + PATCH)**

```ts
import { getDeps } from "@/server/container";
import { updateProfile } from "@/server/application/update-profile";
import { updateProfileSchema } from "@/lib/zod-schemas";
import { requireUser, json } from "@/server/http/session";
import { toErrorResponse } from "@/server/http/errors";
import { selfUser } from "@/lib/serialize";

export async function GET() {
  try { return json({ user: selfUser(await requireUser()) }); }
  catch (e) { return toErrorResponse(e); }
}
export async function PATCH(req: Request) {
  try {
    const user = await requireUser();
    const input = updateProfileSchema.parse(await req.json());
    const deps = await getDeps();
    const updated = await updateProfile(deps, user.id, input);
    return json({ user: selfUser(updated) });
  } catch (e) { return toErrorResponse(e); }
}
```

- [ ] **Step 6: Test end-to-end des handlers auth**

Create: `vulu/tests/api/auth.test.ts`. Comme les handlers dépendent des cookies Next et de Mongo,
ce test importe les **use-cases** via une instance réelle Mongo + helper, et vérifie le parcours
register→login (la couverture HTTP fine est faite manuellement à l'étape 7).

```ts
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { startTestMongo, type TestMongo } from "../helpers/mongo";
import { ensureIndexes } from "@/server/adapters/mongo/indexes";
import { MongoUserRepository } from "@/server/adapters/mongo/repositories";
import { registerUser } from "@/server/application/register-user";
import { authenticateUser } from "@/server/application/authenticate-user";
import { makeInMemoryDeps, type Deps } from "@/server/container";
import { FakeCatalog } from "../helpers/fake-catalog";

let m: TestMongo; let deps: Deps;
beforeAll(async () => {
  m = await startTestMongo(); await ensureIndexes(m.db);
  deps = { ...makeInMemoryDeps(new FakeCatalog()), users: new MongoUserRepository(m.db) };
});
afterAll(async () => { await m.stop(); });

it("register → login (Mongo)", async () => {
  await registerUser(deps, { email: "a@x.io", username: "alice", displayName: "Alice",
    password: "password1", activeTabs: ["films"], tastes: { filmGenreIds: [1, 2, 3], people: [] } });
  const { token } = await authenticateUser(deps, { email: "a@x.io", password: "password1" });
  expect(token).toBeTruthy();
});
```

- [ ] **Step 7: Lancer + vérif manuelle**

Run: `npx vitest run tests/api/auth.test.ts` — Expected: PASS.
Manuel : `npm run init-db` puis `npm run dev`, tester `curl -X POST localhost:3000/api/auth/register -H 'content-type: application/json' -d '{...}'` (cookie de session renvoyé).

- [ ] **Step 8: Commit** — `git add -A && git commit -m "feat(vulu): routes API auth (register/login/logout/me)"`

### Task 10.3: Routes catalogue, œuvre & entrée

**Files:** Create: `vulu/src/app/api/catalog/search/route.ts`, `catalog/genres/route.ts`, `catalog/people/route.ts`, `vulu/src/app/api/works/[id]/route.ts`, `vulu/src/app/api/works/entry/route.ts`

> `works/[id]` renvoie les détails d'une Work déjà en cache (id interne). L'import depuis TMDB se fait
> lors de l'ajout/notation via le `ref` (source/externalId/type), porté dans le body de `works/entry`.

- [ ] **Step 1: `catalog/search/route.ts`**

```ts
import { getDeps } from "@/server/container";
import { searchCatalog } from "@/server/application/catalog";
import { requireUser, json } from "@/server/http/session";
import { toErrorResponse } from "@/server/http/errors";

export async function GET(req: Request) {
  try {
    await requireUser();
    const q = new URL(req.url).searchParams.get("q")?.trim() ?? "";
    if (!q) return json({ results: [] });
    return json({ results: await searchCatalog(await getDeps(), q) });
  } catch (e) { return toErrorResponse(e); }
}
```

- [ ] **Step 2: `catalog/genres/route.ts` & `catalog/people/route.ts`**

`genres/route.ts` :
```ts
import { getDeps } from "@/server/container";
import { listGenres } from "@/server/application/catalog";
import { json } from "@/server/http/session";
import { toErrorResponse } from "@/server/http/errors";
export async function GET() {
  try { return json({ genres: await listGenres(await getDeps()) }); }
  catch (e) { return toErrorResponse(e); }
}
```
`people/route.ts` :
```ts
import { getDeps } from "@/server/container";
import { searchPeople } from "@/server/application/catalog";
import { requireUser, json } from "@/server/http/session";
import { toErrorResponse } from "@/server/http/errors";
export async function GET(req: Request) {
  try {
    await requireUser();
    const q = new URL(req.url).searchParams.get("q")?.trim() ?? "";
    if (!q) return json({ results: [] });
    return json({ results: await searchPeople(await getDeps(), q) });
  } catch (e) { return toErrorResponse(e); }
}
```

- [ ] **Step 3: `works/[id]/route.ts` (GET détails depuis le cache)**

```ts
import { getDeps } from "@/server/container";
import { json } from "@/server/http/session";
import { toErrorResponse } from "@/server/http/errors";
import { NotFoundError } from "@/server/domain/errors";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const deps = await getDeps();
    const work = await deps.works.findById(id);
    if (!work) throw new NotFoundError("Œuvre introuvable");
    return json({ work });
  } catch (e) { return toErrorResponse(e); }
}
```

- [ ] **Step 4: `works/entry/route.ts` (PUT statut/note, DELETE)**

```ts
import { getDeps } from "@/server/container";
import { setEntryStatus, rateOrReviewWork, removeEntry } from "@/server/application/library-entry";
import { setStatusSchema, rateSchema } from "@/lib/zod-schemas";
import { requireUser, json } from "@/server/http/session";
import { toErrorResponse } from "@/server/http/errors";
import { z } from "zod";

export async function PUT(req: Request) {
  try {
    const user = await requireUser();
    const deps = await getDeps();
    const body = await req.json();
    if ("rating" in body || "text" in body) {
      const input = rateSchema.parse(body);
      return json({ entry: await rateOrReviewWork(deps, user.id, input.ref, input) });
    }
    const input = setStatusSchema.parse(body);
    return json({ entry: await setEntryStatus(deps, user.id, input.ref, input.status) });
  } catch (e) { return toErrorResponse(e); }
}

export async function DELETE(req: Request) {
  try {
    const user = await requireUser();
    const { entryId } = z.object({ entryId: z.string() }).parse(await req.json());
    await removeEntry(await getDeps(), user.id, entryId);
    return json({ ok: true });
  } catch (e) { return toErrorResponse(e); }
}
```

- [ ] **Step 5: Compilation** — Run: `npx tsc --noEmit` — Expected: pas d'erreur.

- [ ] **Step 6: Commit** — `git add -A && git commit -m "feat(vulu): routes API catalogue/œuvre/entrée"`

### Task 10.4: Routes feed, follow, listes, engagement

**Files:** Create: `vulu/src/app/api/feed/route.ts`, `vulu/src/app/api/users/[username]/route.ts`, `vulu/src/app/api/users/[id]/follow/route.ts`, `vulu/src/app/api/lists/route.ts`, `vulu/src/app/api/lists/[id]/route.ts`, `vulu/src/app/api/lists/[id]/items/route.ts`, `vulu/src/app/api/entries/[id]/like/route.ts`, `vulu/src/app/api/entries/[id]/comments/route.ts`, `vulu/src/app/api/comments/[id]/route.ts`

> Toutes suivent le même squelette : `requireUser()` → `parse` zod → use-case → `json(...)` →
> `catch (e) { return toErrorResponse(e); }`. Code complet ci-dessous.

- [ ] **Step 1: `feed/route.ts`**

```ts
import { getDeps } from "@/server/container";
import { buildFeed } from "@/server/application/feed";
import { requireUser, json } from "@/server/http/session";
import { toErrorResponse } from "@/server/http/errors";

export async function GET(req: Request) {
  try {
    const user = await requireUser();
    const sp = new URL(req.url).searchParams;
    const cursorRaw = sp.get("cursor");
    const cursor = cursorRaw ? JSON.parse(cursorRaw) as { createdAt: string; id: string } : null;
    const items = await buildFeed(await getDeps(), user.id, {
      cursor: cursor ? { createdAt: new Date(cursor.createdAt), id: cursor.id } : null,
      limit: 20,
    });
    const last = items.at(-1);
    const nextCursor = last ? JSON.stringify({ createdAt: last.entry.createdAt, id: last.entry.id }) : null;
    return json({ items, nextCursor });
  } catch (e) { return toErrorResponse(e); }
}
```

- [ ] **Step 2: `users/[username]/route.ts` (profil public)**

```ts
import { getDeps } from "@/server/container";
import { currentUser, json } from "@/server/http/session";
import { toErrorResponse } from "@/server/http/errors";
import { NotFoundError } from "@/server/domain/errors";
import { getCircle } from "@/server/application/social";
import { publicUser } from "@/lib/serialize";

export async function GET(_req: Request, { params }: { params: Promise<{ username: string }> }) {
  try {
    const { username } = await params;
    const deps = await getDeps();
    const target = await deps.users.findByUsername(username.toLowerCase());
    if (!target) throw new NotFoundError("Profil introuvable");
    const viewer = await currentUser();
    const inCircle = viewer ? (await getCircle(deps, viewer.id)).has(target.id) : false;
    const isSelf = viewer?.id === target.id;
    const visibleEntries = (await deps.entries.listByUser(target.id, { status: "done" }))
      .filter((e) => e.visibility === "public" || isSelf || inCircle);
    const lists = (await deps.lists.listByUser(target.id))
      .filter((l) => l.visibility === "public" || isSelf);
    const [followers, following] = await Promise.all([deps.follows.countFollowers(target.id), deps.follows.countFollowing(target.id)]);
    return json({
      profile: publicUser(target),
      stats: { followers, following, watched: visibleEntries.length },
      relation: { isSelf, isFollowing: viewer ? await deps.follows.exists(viewer.id, target.id) : false },
      entries: visibleEntries, lists,
    });
  } catch (e) { return toErrorResponse(e); }
}
```

- [ ] **Step 3: `users/[id]/follow/route.ts` (POST/DELETE)**

```ts
import { getDeps } from "@/server/container";
import { followUser, unfollowUser } from "@/server/application/social";
import { requireUser, json } from "@/server/http/session";
import { toErrorResponse } from "@/server/http/errors";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await params;
    await followUser(await getDeps(), user.id, id);
    return json({ ok: true });
  } catch (e) { return toErrorResponse(e); }
}
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await params;
    await unfollowUser(await getDeps(), user.id, id);
    return json({ ok: true });
  } catch (e) { return toErrorResponse(e); }
}
```

- [ ] **Step 4: `lists/route.ts` (GET mes listes, POST créer)**

```ts
import { getDeps } from "@/server/container";
import { createList, listsOf } from "@/server/application/lists";
import { createListSchema } from "@/lib/zod-schemas";
import { requireUser, json } from "@/server/http/session";
import { toErrorResponse } from "@/server/http/errors";

export async function GET() {
  try { const u = await requireUser(); return json({ lists: await listsOf(await getDeps(), u.id) }); }
  catch (e) { return toErrorResponse(e); }
}
export async function POST(req: Request) {
  try {
    const u = await requireUser();
    const input = createListSchema.parse(await req.json());
    return json({ list: await createList(await getDeps(), u.id, input) }, { status: 201 });
  } catch (e) { return toErrorResponse(e); }
}
```

- [ ] **Step 5: `lists/[id]/route.ts` (PATCH/DELETE) & `lists/[id]/items/route.ts` (POST/DELETE)**

`lists/[id]/route.ts` :
```ts
import { getDeps } from "@/server/container";
import { updateList, deleteList } from "@/server/application/lists";
import { createListSchema } from "@/lib/zod-schemas";
import { requireUser, json } from "@/server/http/session";
import { toErrorResponse } from "@/server/http/errors";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const u = await requireUser(); const { id } = await params;
    const { name, description, visibility } = createListSchema.parse(await req.json());
    return json({ list: await updateList(await getDeps(), u.id, id, { name, description, visibility }) });
  } catch (e) { return toErrorResponse(e); }
}
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try { const u = await requireUser(); const { id } = await params; await deleteList(await getDeps(), u.id, id); return json({ ok: true }); }
  catch (e) { return toErrorResponse(e); }
}
```
`lists/[id]/items/route.ts` :
```ts
import { getDeps } from "@/server/container";
import { addWorkToList, removeWorkFromList } from "@/server/application/lists";
import { workRefSchema } from "@/lib/zod-schemas";
import { requireUser, json } from "@/server/http/session";
import { toErrorResponse } from "@/server/http/errors";
import { z } from "zod";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const u = await requireUser(); const { id } = await params;
    const ref = workRefSchema.parse(await req.json());
    return json({ list: await addWorkToList(await getDeps(), u.id, id, ref) });
  } catch (e) { return toErrorResponse(e); }
}
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const u = await requireUser(); const { id } = await params;
    const { workId } = z.object({ workId: z.string() }).parse(await req.json());
    return json({ list: await removeWorkFromList(await getDeps(), u.id, id, workId) });
  } catch (e) { return toErrorResponse(e); }
}
```

- [ ] **Step 6: `entries/[id]/like/route.ts` & `entries/[id]/comments/route.ts` & `comments/[id]/route.ts`**

`like/route.ts` :
```ts
import { getDeps } from "@/server/container";
import { likeEntry, unlikeEntry } from "@/server/application/engagement";
import { requireUser, json } from "@/server/http/session";
import { toErrorResponse } from "@/server/http/errors";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try { const u = await requireUser(); const { id } = await params; await likeEntry(await getDeps(), u.id, id); return json({ ok: true }); }
  catch (e) { return toErrorResponse(e); }
}
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try { const u = await requireUser(); const { id } = await params; await unlikeEntry(await getDeps(), u.id, id); return json({ ok: true }); }
  catch (e) { return toErrorResponse(e); }
}
```
`comments/route.ts` :
```ts
import { getDeps } from "@/server/container";
import { commentOnEntry, listComments } from "@/server/application/engagement";
import { commentSchema } from "@/lib/zod-schemas";
import { requireUser, json } from "@/server/http/session";
import { toErrorResponse } from "@/server/http/errors";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try { const u = await requireUser(); const { id } = await params; return json({ comments: await listComments(await getDeps(), u.id, id) }); }
  catch (e) { return toErrorResponse(e); }
}
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const u = await requireUser(); const { id } = await params;
    const { text } = commentSchema.parse(await req.json());
    return json({ comment: await commentOnEntry(await getDeps(), u.id, id, text) }, { status: 201 });
  } catch (e) { return toErrorResponse(e); }
}
```
`comments/[id]/route.ts` :
```ts
import { getDeps } from "@/server/container";
import { deleteComment } from "@/server/application/engagement";
import { requireUser, json } from "@/server/http/session";
import { toErrorResponse } from "@/server/http/errors";

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try { const u = await requireUser(); const { id } = await params; await deleteComment(await getDeps(), u.id, id); return json({ ok: true }); }
  catch (e) { return toErrorResponse(e); }
}
```

- [ ] **Step 7: PUT /me/tastes** — Create `vulu/src/app/api/me/tastes/route.ts`

```ts
import { getDeps } from "@/server/container";
import { updateTastes } from "@/server/application/update-tastes";
import { tastesSchema } from "@/lib/zod-schemas";
import { requireUser, json } from "@/server/http/session";
import { toErrorResponse } from "@/server/http/errors";
import { selfUser } from "@/lib/serialize";

export async function PUT(req: Request) {
  try {
    const u = await requireUser();
    const tastes = tastesSchema.parse(await req.json());
    return json({ user: selfUser(await updateTastes(await getDeps(), u.id, tastes)) });
  } catch (e) { return toErrorResponse(e); }
}
```

- [ ] **Step 8: Compilation + suite complète** — Run: `npx tsc --noEmit && npx vitest run` — Expected: tout vert.

- [ ] **Step 9: Commit** — `git add -A && git commit -m "feat(vulu): routes API feed/follow/listes/engagement/tastes"`

---

## Milestone M11 — Interface (web + responsive)

> **Activer le skill `frontend-design:frontend-design`** pour le travail visuel de ce milestone :
> l'objectif produit est une UI distinctive et soignée (pas une grille grise générique). Les tokens de
> thème (M0.3) et les maquettes validées (`vulu/.superpowers/brainstorm/`) sont la référence. Le code
> ci-dessous fournit la structure et les composants à forte logique ; le raffinement visuel (espacement,
> micro-interactions, états hover/focus) se fait avec le skill.

### Task 11.1: Provider de thème + bouton bascule

**Files:** Create: `vulu/src/components/ThemeProvider.tsx`, `vulu/src/components/ThemeToggle.tsx`; Modify: `vulu/src/app/layout.tsx`

- [ ] **Step 1: `ThemeProvider.tsx`** (applique le thème au montage, évite le flash via script inline)

```tsx
"use client";
import { useEffect } from "react";
import { initialTheme, applyTheme } from "@/lib/theme";

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => { applyTheme(initialTheme()); }, []);
  return <>{children}</>;
}

/** À injecter dans <head> pour éviter le flash de thème clair au chargement. */
export const themeNoFlashScript =
  `(function(){try{var t=localStorage.getItem('vulu-theme');` +
  `if(!t){t=matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';}` +
  `document.documentElement.classList.toggle('dark',t==='dark');}catch(e){}})();`;
```

- [ ] **Step 2: `ThemeToggle.tsx`**

```tsx
"use client";
import { useEffect, useState } from "react";
import { type Theme, applyTheme, initialTheme } from "@/lib/theme";

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("light");
  useEffect(() => { setTheme(initialTheme()); }, []);
  function toggle() { const next: Theme = theme === "dark" ? "light" : "dark"; setTheme(next); applyTheme(next); }
  return (
    <button onClick={toggle} aria-label="Basculer le thème"
      className="rounded-full p-2 text-[var(--color-text-muted)] hover:bg-[var(--color-border)]">
      {theme === "dark" ? "☀️" : "🌙"}
    </button>
  );
}
```

- [ ] **Step 3: Brancher dans `layout.tsx`** (script no-flash dans `<head>`, ThemeProvider autour de `children`, `lang="fr"`).

```tsx
import "./globals.css";
import { ThemeProvider, themeNoFlashScript } from "@/components/ThemeProvider";

export const metadata = { title: "vulu", description: "vu & lu — tes films, séries et livres" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" suppressHydrationWarning>
      <head><script dangerouslySetInnerHTML={{ __html: themeNoFlashScript }} /></head>
      <body><ThemeProvider>{children}</ThemeProvider></body>
    </html>
  );
}
```

- [ ] **Step 4: Vérif** — Run: `npm run dev`, basculer le thème, recharger → pas de flash, préférence persistée. `npx tsc --noEmit`.

- [ ] **Step 5: Commit** — `git add -A && git commit -m "feat(vulu): provider + bascule de thème (sans flash)"`

### Task 11.2: Client API typé

**Files:** Create: `vulu/src/lib/api-client.ts`

- [ ] **Step 1: Implémenter `api-client.ts`**

```ts
async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, { ...init, headers: { "content-type": "application/json", ...init?.headers }, credentials: "same-origin" });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, (data as { error?: string }).error ?? "ERROR", (data as { message?: string }).message);
  return data as T;
}
export class ApiError extends Error { constructor(public status: number, public code: string, message?: string) { super(message ?? code); } }

export const api = {
  get: <T>(p: string) => request<T>(p),
  post: <T>(p: string, body?: unknown) => request<T>(p, { method: "POST", body: body ? JSON.stringify(body) : undefined }),
  put: <T>(p: string, body: unknown) => request<T>(p, { method: "PUT", body: JSON.stringify(body) }),
  patch: <T>(p: string, body: unknown) => request<T>(p, { method: "PATCH", body: JSON.stringify(body) }),
  del: <T>(p: string, body?: unknown) => request<T>(p, { method: "DELETE", body: body ? JSON.stringify(body) : undefined }),
};
```

- [ ] **Step 2: Compilation** — Run: `npx tsc --noEmit` — Expected: OK.

- [ ] **Step 3: Commit** — `git add -A && git commit -m "feat(vulu): client API typé"`

### Task 11.3: Composant RatingSlider (note décimale + jauge d'étoiles)

**Files:** Create: `vulu/src/components/RatingStars.tsx`, `vulu/src/components/RatingSlider.tsx`; Test: `vulu/tests/components/rating.test.tsx`

Le composant gère la note 0–5 au pas de 0,1, affiche la valeur littérale `x,y/5` et une jauge
d'étoiles à remplissage partiel. Accessible (input range, valeur annoncée).

- [ ] **Step 1: Écrire le test**

```tsx
import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { RatingSlider } from "@/components/RatingSlider";
import { useState } from "react";

function Harness() {
  const [v, setV] = useState(0);
  return <RatingSlider value={v} onChange={setV} />;
}

describe("RatingSlider", () => {
  it("affiche la valeur littérale en français (virgule)", () => {
    render(<RatingSlider value={4.2} onChange={() => {}} />);
    expect(screen.getByText("4,2/5")).toBeInTheDocument();
  });
  it("le range a min 0 max 5 step 0.1", () => {
    render(<RatingSlider value={2.7} onChange={() => {}} />);
    const range = screen.getByRole("slider") as HTMLInputElement;
    expect(range.min).toBe("0"); expect(range.max).toBe("5"); expect(range.step).toBe("0.1");
  });
  it("notifie le changement", () => {
    render(<Harness />);
    fireEvent.change(screen.getByRole("slider"), { target: { value: "3.5" } });
    expect(screen.getByText("3,5/5")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Lancer (échoue)** — Run: `npx vitest run tests/components/rating.test.tsx` — Expected: FAIL.

- [ ] **Step 3: `RatingStars.tsx`** (jauge en lecture seule, remplissage partiel)

```tsx
export function RatingStars({ value, size = 18 }: { value: number; size?: number }) {
  const pct = Math.max(0, Math.min(100, (value / 5) * 100));
  return (
    <span className="relative inline-block leading-none" style={{ fontSize: size }} aria-hidden>
      <span className="text-[var(--color-border)]">★★★★★</span>
      <span className="absolute left-0 top-0 overflow-hidden whitespace-nowrap text-[var(--color-accent)]" style={{ width: `${pct}%` }}>★★★★★</span>
    </span>
  );
}
```

- [ ] **Step 4: `RatingSlider.tsx`**

```tsx
"use client";
import { RatingStars } from "./RatingStars";

export function RatingSlider({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const label = `${value.toFixed(1).replace(".", ",")}/5`;
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-3">
        <RatingStars value={value} size={26} />
        <span className="text-xl font-extrabold text-[var(--color-text)]">{label}</span>
      </div>
      <input type="range" min={0} max={5} step={0.1} value={value} role="slider"
        aria-label="Note sur 5" aria-valuetext={label}
        onChange={(e) => onChange(Number(e.target.value))}
        className="accent-[var(--color-primary)]" />
    </div>
  );
}
```

- [ ] **Step 5: Lancer (passe)** — Run: `npx vitest run tests/components/rating.test.tsx` — Expected: PASS.

- [ ] **Step 6: Commit** — `git add -A && git commit -m "feat(vulu): composant RatingSlider + jauge d'étoiles"`

### Task 11.4: App shell (sidebar desktop + barre d'onglets mobile)

**Files:** Create: `vulu/src/components/AppShell.tsx`, `vulu/src/components/TabSwitcher.tsx`

- [ ] **Step 1: `AppShell.tsx`** (layout responsive, nav, slot pour `children`)

```tsx
"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ThemeToggle } from "./ThemeToggle";

const NAV = [
  { href: "/feed", label: "Feed", icon: "🏠" },
  { href: "/search", label: "Recherche", icon: "🔍" },
  { href: "/lists", label: "Mes listes", icon: "🗂️" },
  { href: "/u/me", label: "Profil", icon: "👤" },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  return (
    <div className="min-h-screen md:grid md:grid-cols-[220px_1fr]">
      <aside className="hidden md:flex flex-col gap-1 border-r border-[var(--color-border)] bg-[var(--color-surface)] p-4">
        <div className="px-2 pb-4 text-2xl font-extrabold text-[var(--color-primary)]">vulu</div>
        {NAV.map((n) => (
          <Link key={n.href} href={n.href}
            className={`flex items-center gap-3 rounded-xl px-3 py-2 text-sm ${path.startsWith(n.href) ? "bg-[color-mix(in_srgb,var(--color-primary)_15%,transparent)] font-bold text-[var(--color-primary)]" : "text-[var(--color-text)]"}`}>
            <span>{n.icon}</span>{n.label}
          </Link>
        ))}
        <div className="mt-2"><ThemeToggle /></div>
      </aside>

      <main className="mx-auto w-full max-w-2xl px-3 pb-24 pt-4 md:pb-8">{children}</main>

      <nav className="fixed bottom-0 left-0 right-0 z-10 flex justify-around border-t border-[var(--color-border)] bg-[var(--color-surface)] py-2 md:hidden">
        {NAV.map((n) => (
          <Link key={n.href} href={n.href} aria-label={n.label}
            className={`text-xl ${path.startsWith(n.href) ? "text-[var(--color-primary)]" : "text-[var(--color-text-muted)]"}`}>{n.icon}</Link>
        ))}
      </nav>
    </div>
  );
}
```

- [ ] **Step 2: `TabSwitcher.tsx`** (onglets Films/Livres ; en Phase 1, Livres désactivé si non actif)

```tsx
"use client";
import type { Domain } from "@/server/domain/entities";

export function TabSwitcher({ active, value, onChange }: { active: Domain[]; value: Domain; onChange: (d: Domain) => void }) {
  const tabs: { id: Domain; label: string }[] = [{ id: "films", label: "🎬 Films & Séries" }, { id: "books", label: "📚 Livres" }];
  return (
    <div className="mb-4 flex gap-2">
      {tabs.filter((t) => active.includes(t.id)).map((t) => (
        <button key={t.id} onClick={() => onChange(t.id)}
          className={`rounded-full border px-4 py-1.5 text-sm ${value === t.id ? "border-[var(--color-primary)] bg-[var(--color-primary)] text-white" : "border-[var(--color-border)] text-[var(--color-text-muted)]"}`}>
          {t.label}
        </button>
      ))}
    </div>
  );
}
```

- [ ] **Step 3: Compilation** — Run: `npx tsc --noEmit` — Expected: OK.

- [ ] **Step 4: Commit** — `git add -A && git commit -m "feat(vulu): app shell responsive + onglets"`

### Task 11.5: FeedCard + page Feed

**Files:** Create: `vulu/src/components/FeedCard.tsx`, `vulu/src/app/feed/page.tsx`, `vulu/src/app/feed/FeedClient.tsx`

> Le type `FeedItem` est celui de `@/server/application/feed`. La page serveur protège l'accès
> (redirige vers /login si non connecté) et délègue le rendu interactif au client.

- [ ] **Step 1: `FeedCard.tsx`**

```tsx
"use client";
import { useState } from "react";
import Link from "next/link";
import { RatingStars } from "./RatingStars";
import { api } from "@/lib/api-client";
import type { FeedItem } from "@/server/application/feed";

export function FeedCard({ item }: { item: FeedItem }) {
  const [liked, setLiked] = useState(item.likedByMe);
  const [likes, setLikes] = useState(item.likeCount);
  async function toggleLike() {
    const next = !liked; setLiked(next); setLikes((n) => n + (next ? 1 : -1));
    try { next ? await api.post(`/api/entries/${item.entry.id}/like`) : await api.del(`/api/entries/${item.entry.id}/like`); }
    catch { setLiked(!next); setLikes((n) => n + (next ? -1 : 1)); }
  }
  const badge = item.entry.visibility === "public" ? "● Public" : "● Cercle";
  return (
    <article className="mb-3 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
      <header className="flex items-center gap-3">
        <div className="h-9 w-9 rounded-full bg-gradient-to-br from-[var(--color-primary)] to-[var(--color-accent)]" />
        <div className="text-sm">
          <Link href={`/u/${item.author.username}`} className="font-bold text-[var(--color-text)]">{item.author.displayName}</Link>
          <span className="text-[var(--color-text-muted)]"> @{item.author.username}</span>
          <div className="text-xs text-[var(--color-text-muted)]">
            <Link href={`/work/${item.work.id}`}>{item.work.title}{item.work.year ? ` (${item.work.year})` : ""}</Link>
          </div>
        </div>
      </header>
      {item.entry.rating !== null && (
        <div className="mt-2 flex items-center gap-2">
          <RatingStars value={item.entry.rating} />
          <span className="font-bold text-[var(--color-text)]">{item.entry.rating.toFixed(1).replace(".", ",")}/5</span>
        </div>
      )}
      {item.entry.text && <p className="mt-1 text-sm text-[var(--color-text)]">{item.entry.text}</p>}
      <footer className="mt-3 flex items-center gap-2 text-xs">
        <span className="rounded-full bg-[color-mix(in_srgb,var(--color-primary)_12%,transparent)] px-3 py-1 text-[var(--color-primary)]">{badge}</span>
        <button onClick={toggleLike} className="rounded-full px-3 py-1 text-[var(--color-primary)]">{liked ? "♥" : "♡"} {likes}</button>
        <Link href={`/work/${item.work.id}`} className="rounded-full px-3 py-1 text-[var(--color-primary)]">💬 {item.commentCount}</Link>
      </footer>
    </article>
  );
}
```

- [ ] **Step 2: `feed/page.tsx` (serveur, garde d'auth)**

```tsx
import { redirect } from "next/navigation";
import { currentUser } from "@/server/http/session";
import { AppShell } from "@/components/AppShell";
import { FeedClient } from "./FeedClient";

export default async function FeedPage() {
  const user = await currentUser();
  if (!user) redirect("/login");
  return <AppShell><FeedClient activeTabs={user.activeTabs} /></AppShell>;
}
```

- [ ] **Step 3: `feed/FeedClient.tsx` (chargement + pagination + onglets)**

```tsx
"use client";
import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api-client";
import { FeedCard } from "@/components/FeedCard";
import { TabSwitcher } from "@/components/TabSwitcher";
import type { Domain } from "@/server/domain/entities";
import type { FeedItem } from "@/server/application/feed";

export function FeedClient({ activeTabs }: { activeTabs: Domain[] }) {
  const [tab, setTab] = useState<Domain>(activeTabs[0] ?? "films");
  const [items, setItems] = useState<FeedItem[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async (reset: boolean) => {
    setLoading(true);
    try {
      const url = `/api/feed${cursor && !reset ? `?cursor=${encodeURIComponent(cursor)}` : ""}`;
      const data = await api.get<{ items: FeedItem[]; nextCursor: string | null }>(url);
      setItems((prev) => reset ? data.items : [...prev, ...data.items]);
      setCursor(data.nextCursor);
    } finally { setLoading(false); }
  }, [cursor]);

  useEffect(() => { void load(true); /* premier chargement */ }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const visible = items.filter((i) => i.entry.domain === tab);
  return (
    <>
      <TabSwitcher active={activeTabs} value={tab} onChange={setTab} />
      {visible.map((i) => <FeedCard key={i.entry.id} item={i} />)}
      {visible.length === 0 && !loading && <p className="text-[var(--color-text-muted)]">Rien pour l'instant. Suis des gens ou note des films !</p>}
      {cursor && <button onClick={() => load(false)} disabled={loading} className="mt-2 w-full rounded-full border border-[var(--color-border)] py-2 text-sm">{loading ? "…" : "Charger plus"}</button>}
    </>
  );
}
```

- [ ] **Step 4: Compilation + lancer** — Run: `npx tsc --noEmit` puis `npm run dev`, se connecter, voir le feed.

- [ ] **Step 5: Commit** — `git add -A && git commit -m "feat(vulu): page Feed + FeedCard interactif"`

### Task 11.6: Pages auth (login / register) + onboarding goûts

**Files:** Create: `vulu/src/app/(auth)/login/page.tsx`, `vulu/src/app/(auth)/register/page.tsx`, `vulu/src/app/onboarding/page.tsx`, `vulu/src/components/TasteSelector.tsx`

> Visuel à finaliser avec **frontend-design** (cf. maquette `onboarding-tastes.html`). Logique requise :
> register → onboarding (sélection ≥ 3 genres + acteurs/réals optionnels) → POST register → /feed.

- [ ] **Step 1: `register/page.tsx`** : formulaire (email, username, displayName, password, choix onglets ≥ 1) qui stocke en état local et **navigue vers `/onboarding`** en passant les valeurs (via `sessionStorage` ou state global léger). Validation côté client minimale, l'API revalide.

- [ ] **Step 2: `TasteSelector.tsx`** : charge `GET /api/catalog/genres`, chips multi-sélection (min 3), recherche `GET /api/catalog/people?q=` (debounce 300 ms) pour acteurs/réals, expose `value: Tastes` + `onChange`.

```tsx
"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/api-client";
import type { Tastes } from "@/server/domain/entities";
import type { Genre } from "@/server/ports/catalog";

export function TasteSelector({ value, onChange }: { value: Tastes; onChange: (t: Tastes) => void }) {
  const [genres, setGenres] = useState<Genre[]>([]);
  useEffect(() => { api.get<{ genres: Genre[] }>("/api/catalog/genres").then((d) => setGenres(d.genres)); }, []);
  function toggleGenre(id: number) {
    const has = value.filmGenreIds.includes(id);
    onChange({ ...value, filmGenreIds: has ? value.filmGenreIds.filter((g) => g !== id) : [...value.filmGenreIds, id] });
  }
  return (
    <div>
      <div className="mb-2 text-sm font-bold">Genres aimés <span className="text-[var(--color-primary)]">{value.filmGenreIds.length}/min. 3</span></div>
      <div className="flex flex-wrap gap-2">
        {genres.map((g) => (
          <button key={g.id} onClick={() => toggleGenre(g.id)}
            className={`rounded-full border px-3 py-1.5 text-sm ${value.filmGenreIds.includes(g.id) ? "border-[var(--color-primary)] bg-[var(--color-primary)] text-white" : "border-[var(--color-border)]"}`}>
            {g.name}
          </button>
        ))}
      </div>
      {/* Acteurs/réals : champ de recherche + vignettes, ajoutent à value.people (facultatif) */}
    </div>
  );
}
```

- [ ] **Step 3: `onboarding/page.tsx`** : récupère les valeurs d'inscription, monte `TasteSelector`, bouton « Continuer » désactivé tant que `< 3` genres, puis `api.post("/api/auth/register", { ...signup, tastes })` et `router.push("/feed")`. Gérer `ApiError` (afficher message).

- [ ] **Step 4: `login/page.tsx`** : formulaire email/password → `api.post("/api/auth/login")` → `/feed` ; lien vers `/register`.

- [ ] **Step 5: Vérif manuelle** — parcours complet inscription → onboarding → feed ; connexion. `npx tsc --noEmit`.

- [ ] **Step 6: Commit** — `git add -A && git commit -m "feat(vulu): pages auth + onboarding goûts"`

### Task 11.7: Page fiche œuvre (entry + avis)

**Files:** Create: `vulu/src/app/work/[id]/page.tsx`, `vulu/src/app/work/[id]/WorkClient.tsx`, `vulu/src/components/EntryEditor.tsx`

> Compose : en-tête (backdrop/poster/métadonnées depuis `GET /api/works/[id]`), `EntryEditor` (bascule
> À voir/Vu, `RatingSlider`, commentaire, visibilité Cercle/Public, ajout à une liste, Enregistrer →
> `PUT /api/works/entry` avec `ref`), et la liste des avis. Visuel finalisé avec **frontend-design** (cf.
> `work-detail.html`).

- [ ] **Step 1: `EntryEditor.tsx`** — état local `{ status, rating, text, visibility }`, `RatingSlider`, `<textarea>`, segmented Cercle/Public, bouton Enregistrer appelant :

```ts
await api.put("/api/works/entry", { ref, rating, text: text || null, visibility });
```

Si l'utilisateur ne met que le statut « À voir » : `await api.put("/api/works/entry", { ref, status: "planned" })`.

- [ ] **Step 2: `WorkClient.tsx`** — affiche l'œuvre + `EntryEditor` + section avis (charge `GET /api/entries/[id]/comments` quand on déploie un avis ; like via `FeedCard`-like). Onglets « Mon cercle » / « Public » sur les avis (filtrage côté API à étendre en Phase 2 si besoin ; en Phase 1, lister les avis publics de l'œuvre via une route à ajouter si nécessaire — **hors périmètre strict** : afficher au minimum l'entrée de l'utilisateur courant).

- [ ] **Step 3: `work/[id]/page.tsx`** — garde d'auth, fetch initial server-side de la Work, rend `AppShell` + `WorkClient`.

- [ ] **Step 4: Vérif manuelle** — chercher un film, l'ouvrir, le noter avec le slider, enregistrer, vérifier qu'il apparaît dans le feed (visibilité publique). `npx tsc --noEmit`.

- [ ] **Step 5: Commit** — `git add -A && git commit -m "feat(vulu): fiche œuvre + éditeur d'entrée"`

### Task 11.8: Page profil + page listes + page recherche

**Files:** Create: `vulu/src/app/u/[username]/page.tsx` (+ `ProfileClient.tsx`), `vulu/src/app/lists/page.tsx`, `vulu/src/app/search/page.tsx`; Modify: `vulu/src/app/page.tsx`

> `/u/me` : la page résout `me` via `currentUser()` et redirige vers `/u/<username>`. Visuel finalisé
> avec **frontend-design** (cf. `profile.html`).

- [ ] **Step 1: `u/[username]/page.tsx`** — si `username === "me"`, `redirect("/u/" + currentUser.username)`. Sinon fetch `GET /api/users/[username]`, rend en-tête (avatar, nom, bio, stats), bouton **Suivre/Suivi** (POST/DELETE `/api/users/[id]/follow`) si pas soi, `TabSwitcher`, sous-filtres **Vus/À voir/Listes**, grille de posters (note overlay via `RatingStars`), cartes de listes.

- [ ] **Step 2: `lists/page.tsx`** — `GET /api/lists`, grille de cartes + création (POST `/api/lists`), édition/suppression (PATCH/DELETE).

- [ ] **Step 3: `search/page.tsx`** — champ de recherche (debounce) → `GET /api/catalog/search?q=`, résultats en grille de posters cliquables vers `/work/<externalId>`… (l'œuvre est importée à la 1re interaction ; pour ouvrir la fiche avant import, naviguer avec `ref` encodé ou importer à la volée via une route `POST /api/works/import` — **ajouter cette petite route** : importe via `getOrImportWork` et renvoie l'`id` interne, puis rediriger vers `/work/<id>`).

- [ ] **Step 4: Route d'import** — Create `vulu/src/app/api/works/import/route.ts` :

```ts
import { getDeps } from "@/server/container";
import { getOrImportWork } from "@/server/application/get-work";
import { workRefSchema } from "@/lib/zod-schemas";
import { requireUser, json } from "@/server/http/session";
import { toErrorResponse } from "@/server/http/errors";

export async function POST(req: Request) {
  try {
    await requireUser();
    const ref = workRefSchema.parse(await req.json());
    const work = await getOrImportWork(await getDeps(), ref);
    return json({ work });
  } catch (e) { return toErrorResponse(e); }
}
```

- [ ] **Step 5: `app/page.tsx`** — redirige vers `/feed` si connecté, sinon `/login`.

- [ ] **Step 6: Vérif manuelle + compilation** — Run: `npx tsc --noEmit`, parcourir profil/listes/recherche.

- [ ] **Step 7: Commit** — `git add -A && git commit -m "feat(vulu): pages profil, listes, recherche + import œuvre"`

---

## Milestone M12 — Durcissement (rate-limit) & PWA

### Task 12.1: Rate-limiting login/register (anti-bruteforce)

**Files:** Create: `vulu/src/server/http/rate-limit.ts`; Modify: `vulu/src/app/api/auth/login/route.ts`, `register/route.ts`; Test: `vulu/tests/http/rate-limit.test.ts`

> Limiteur en mémoire (fenêtre glissante par IP). Suffisant pour un MVP mono-instance ; à remplacer par
> un store partagé (Redis) si multi-instances — noté dans la spec §13.

- [ ] **Step 1: Écrire le test**

```ts
import { describe, it, expect, beforeEach } from "vitest";
import { RateLimiter } from "@/server/http/rate-limit";

describe("RateLimiter", () => {
  let now = 0; const limiter = new RateLimiter({ limit: 3, windowMs: 1000, clock: () => now });
  beforeEach(() => { now = 0; limiter.reset(); });
  it("autorise jusqu'à la limite puis bloque", () => {
    expect(limiter.allow("ip")).toBe(true);
    expect(limiter.allow("ip")).toBe(true);
    expect(limiter.allow("ip")).toBe(true);
    expect(limiter.allow("ip")).toBe(false);
  });
  it("réautorise après la fenêtre", () => {
    limiter.allow("ip"); limiter.allow("ip"); limiter.allow("ip");
    now = 1001;
    expect(limiter.allow("ip")).toBe(true);
  });
});
```

- [ ] **Step 2: Lancer (échoue)** — Run: `npx vitest run tests/http/rate-limit.test.ts` — Expected: FAIL.

- [ ] **Step 3: Implémenter `rate-limit.ts`**

```ts
export class RateLimiter {
  private hits = new Map<string, number[]>();
  constructor(private cfg: { limit: number; windowMs: number; clock?: () => number }) {}
  private now() { return this.cfg.clock ? this.cfg.clock() : Date.now(); }
  allow(key: string): boolean {
    const now = this.now();
    const recent = (this.hits.get(key) ?? []).filter((t) => now - t < this.cfg.windowMs);
    if (recent.length >= this.cfg.limit) { this.hits.set(key, recent); return false; }
    recent.push(now); this.hits.set(key, recent); return true;
  }
  reset() { this.hits.clear(); }
}

export const authLimiter = new RateLimiter({ limit: 10, windowMs: 60_000 });

export function clientIp(req: Request): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
}
```

- [ ] **Step 4: Brancher dans login/register** — au début du `try`, avant le parse :

```ts
import { authLimiter, clientIp } from "@/server/http/rate-limit";
import { AuthError } from "@/server/domain/errors";
// ...
if (!authLimiter.allow(clientIp(req))) throw new AuthError("Trop de tentatives, réessaie plus tard");
```

- [ ] **Step 5: Lancer (passe)** — Run: `npx vitest run tests/http/rate-limit.test.ts` — Expected: PASS.

- [ ] **Step 6: Commit** — `git add -A && git commit -m "feat(vulu): rate-limiting auth (anti-bruteforce)"`

### Task 12.2: PWA (manifest + service worker)

**Files:** Create: `vulu/public/manifest.webmanifest`, icônes `vulu/public/icon-192.png`, `icon-512.png`, `icon-maskable-512.png`; Modify: `vulu/next.config.ts`, `vulu/src/app/layout.tsx`

- [ ] **Step 1: Installer next-pwa**

```bash
cd /home/chamberlain/Desktop/Claude/vulu && npm i @ducanh2912/next-pwa
```

- [ ] **Step 2: `public/manifest.webmanifest`**

```json
{
  "name": "vulu — vu & lu",
  "short_name": "vulu",
  "description": "Tes films, séries et livres, entre amis.",
  "start_url": "/feed",
  "display": "standalone",
  "background_color": "#16121C",
  "theme_color": "#9461C0",
  "icons": [
    { "src": "/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icon-512.png", "sizes": "512x512", "type": "image/png" },
    { "src": "/icon-maskable-512.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable" }
  ]
}
```

- [ ] **Step 3: Générer des icônes placeholder** (fond `#9461C0`, lettre « v » blanche). Avec ImageMagick :

```bash
cd /home/chamberlain/Desktop/Claude/vulu/public
for s in 192 512; do convert -size ${s}x${s} xc:'#9461C0' -gravity center -pointsize $((s/2)) -fill white -annotate 0 'v' icon-${s}.png; done
cp icon-512.png icon-maskable-512.png
```

- [ ] **Step 4: Envelopper `next.config.ts` avec next-pwa**

```ts
import withPWAInit from "@ducanh2912/next-pwa";
const withPWA = withPWAInit({ dest: "public", disable: process.env.NODE_ENV === "development" });
export default withPWA({ /* options Next existantes */ });
```

- [ ] **Step 5: Lier le manifest + theme-color dans `layout.tsx`**

Dans `metadata` ajouter `manifest: "/manifest.webmanifest"` et `themeColor: "#9461C0"` (via `export const viewport = { themeColor: "#9461C0" }`).

- [ ] **Step 6: Vérifier l'installabilité**

Run: `npm run build && npm start`, ouvrir http://localhost:3000, DevTools → Application → Manifest : aucune erreur, bouton « Installer » disponible.

- [ ] **Step 7: Commit** — `git add -A && git commit -m "feat(vulu): PWA (manifest + service worker)"`

### Task 12.3: Vérification finale Phase 1

- [ ] **Step 1: Suite de tests complète**

Run: `npx vitest run`
Expected: tous les tests verts (domaine, use-cases, adapters Mongo/TMDB, composants, http).

- [ ] **Step 2: Typecheck + build de production**

Run: `npx tsc --noEmit && npm run build`
Expected: build sans erreur.

- [ ] **Step 3: Parcours fonctionnel manuel (checklist)**

Lancer Mongo local + `npm run init-db` + `npm run dev`, puis vérifier :
- [ ] inscription avec ≥ 3 genres → onboarding → feed
- [ ] connexion / déconnexion (cookie httpOnly présent, pas de token en localStorage)
- [ ] recherche d'un film → fiche → statut « À voir » (watchlist, absent du feed)
- [ ] noter au slider (ex. 4,2/5) + commentaire + visibilité Public → apparaît dans le feed
- [ ] visibilité Cercle → visible seulement pour le cercle (tester avec 2 comptes)
- [ ] follow d'un autre compte → ses avis cercle apparaissent
- [ ] like + commentaire sur un avis
- [ ] création d'une liste + ajout d'une œuvre
- [ ] bascule thème clair/sombre persistée
- [ ] installation PWA (desktop + mobile)

- [ ] **Step 4: Commit final** — `git add -A && git commit -m "chore(vulu): vérification Phase 1 complète"`

---

## Self-Review (effectuée)

**Couverture de la spec :**

| Exigence spec | Tâche(s) |
|---|---|
| Architecture hexagonale, DI | M1 (ports, container), M9.2 (wiring) |
| User + activeTabs ≥ 1 + tastes | 1.1, 2.1, 2.3, 10.2, 10.4 |
| Follow + cercle (union) | 1.3, 4.1, 10.4 |
| Work + cache TMDB | 3.2, 9.1, 8.4 |
| LibraryEntry + statut Vu/À voir + note décimale + visibilité | 1.1, 3.3, 10.3, 11.3, 11.7 |
| Listes (CRUD, multi-appartenance) | 5.1, 10.4, 11.8 |
| Feed (cercle+public, filtré onglets, paginé) | 1.4, 6.1, 8.4, 10.4, 11.5 |
| Likes & commentaires (visibilité vérifiée) | 7.1, 10.4, 11.5 |
| Auth email/mdp + JWT cookies httpOnly | 1.7, 2.1, 2.2, 10.1, 10.2 |
| Autorisation revérifiée par use-case | 3.3, 5.1, 7.1, 10.x |
| Validation aux frontières (zod) | 10.1 + tous les handlers |
| Rate-limiting | 12.1 |
| Index Mongo | 8.3 |
| Tastes/onboarding (collecte, algo reporté) | 2.x, 11.6, §12 spec |
| Thèmes clair/sombre | 0.3, 11.1 |
| Écrans (shell/feed/profil/œuvre/goûts) | 11.4–11.8 |
| PWA | 12.2 |
| Tests (unit/intégration/composants) | présents à chaque milestone |

**Note de cohérence de types :** `FeedItem` défini en 6.1 et consommé en 11.5 ; `Tastes`/`Domain`/
`Visibility` partagés depuis `entities.ts` ; signatures de ports stables de M1 à M8. Les use-cases
prennent toujours `(deps, …)` en premier argument.

**Limite assumée :** l'onglet « avis publics » de la fiche œuvre (11.7) liste a minima l'entrée de
l'utilisateur ; l'agrégation complète des avis publics d'une œuvre pourra nécessiter une route
dédiée (`GET /api/works/[id]/reviews`) — à ajouter si le besoin se confirme, hors périmètre strict
Phase 1.

---

## Execution Handoff

Plan complet et sauvegardé dans `vulu/docs/superpowers/plans/2026-06-17-vulu-films-phase1.md`.
