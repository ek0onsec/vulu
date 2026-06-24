# Compatibilité de goûts (« Match % ») — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Afficher sur le profil d'un autre membre un score « Match % » de compatibilité de goûts calculé sur les œuvres co-notées, plus une ligne « vous aimez tous les deux ».

**Architecture:** Hexagonale. Fonction domaine pure `tasteMatchScore` → port `LibraryEntryRepository.listRatedByUser` (mémoire + Mongo) → application `computeTasteMatch` (visibilité, no-self, seuil) → server component profil + route API → composant présentationnel `TasteMatchBadge`.

**Tech Stack:** TypeScript strict (`noUncheckedIndexedAccess`), Next.js 16 (server components), MongoDB driver natif, Vitest, mongodb-memory-server.

## Global Constraints

- Toute dépendance externe derrière un port ; le domaine ne connaît ni Mongo ni Next. (copié de CLAUDE.md)
- Échelle de note : décimale 0–5 (`LibraryEntry.rating: number | null`).
- Seuil de significativité d'affichage : **overlap ≥ 3** œuvres co-notées ; sinon rien ne s'affiche.
- Pas de fuite de notes : ne croiser que les entries de la cible visibles par le viewer (`audiences.public || inCircle`), jamais en self.
- Match % = `round(100 × (1 − moyenne(|a−b|)/5))`, jamais négatif.
- `sample` ≤ 3 œuvres aimées des deux côtés (`a ≥ 4 && b ≥ 4 && |a−b| ≤ 1`).
- Aucune attribution IA dans le code ni les commits ; pas de co-auteur.
- Parité stricte mémoire/Mongo pour tout nouveau port.

---

### Task 1: Domaine — fonction pure `tasteMatchScore`

**Files:**
- Create: `src/server/domain/taste-match.ts`
- Test: `tests/domain/taste-match.test.ts`

**Interfaces:**
- Consumes: rien.
- Produces: `interface TasteMatch { score: number; overlap: number }` ; `function tasteMatchScore(pairs: { a: number; b: number }[]): TasteMatch`.

- [ ] **Step 1: Write the failing test**

```ts
// tests/domain/taste-match.test.ts
import { describe, it, expect } from "vitest";
import { tasteMatchScore } from "@/server/domain/taste-match";

describe("tasteMatchScore", () => {
  it("notes identiques → 100 %", () => {
    expect(tasteMatchScore([{ a: 4, b: 4 }, { a: 2, b: 2 }, { a: 5, b: 5 }])).toEqual({ score: 100, overlap: 3 });
  });
  it("écart maximal → 0 %", () => {
    expect(tasteMatchScore([{ a: 0, b: 5 }, { a: 5, b: 0 }])).toEqual({ score: 0, overlap: 2 });
  });
  it("arrondit la moyenne d'écart (0,65 → 87 %)", () => {
    // moyenne |a−b| = (1 + 0.6 + 0.35) / 3 = 0.65 → 100×(1−0.65/5) = 87
    expect(tasteMatchScore([{ a: 4, b: 3 }, { a: 4.6, b: 4 }, { a: 5, b: 4.65 }])).toEqual({ score: 87, overlap: 3 });
  });
  it("remonte l'overlap même sous le seuil de 3", () => {
    expect(tasteMatchScore([{ a: 4, b: 4 }])).toEqual({ score: 100, overlap: 1 });
  });
  it("liste vide → neutre sans division par zéro", () => {
    expect(tasteMatchScore([])).toEqual({ score: 0, overlap: 0 });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/domain/taste-match.test.ts`
Expected: FAIL — `tasteMatchScore` not exported / module not found.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/server/domain/taste-match.ts

/** Résultat de similarité sur des notes croisées (couche domaine, pure). */
export interface TasteMatch {
  /** Score de compatibilité 0–100 (entier). */
  score: number;
  /** Nombre d'œuvres co-notées ayant servi au calcul. */
  overlap: number;
}

/**
 * Match % sur les œuvres co-notées : 100 × (1 − moyenne(|a−b|) / 5), arrondi entier.
 * Pur, sans dépendance externe. Le seuil d'affichage (overlap ≥ 3) est la
 * responsabilité de l'appelant, pas de cette fonction.
 */
export function tasteMatchScore(pairs: { a: number; b: number }[]): TasteMatch {
  const overlap = pairs.length;
  if (overlap === 0) return { score: 0, overlap: 0 };
  const totalDiff = pairs.reduce((sum, p) => sum + Math.abs(p.a - p.b), 0);
  const score = Math.round(100 * (1 - totalDiff / overlap / 5));
  return { score, overlap };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/domain/taste-match.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/server/domain/taste-match.ts tests/domain/taste-match.test.ts
git commit -m "feat(vulu): domaine — tasteMatchScore (Match % sur notes croisées)"
```

---

### Task 2: Port + adaptateurs — `listRatedByUser`

**Files:**
- Modify: `src/server/domain/entities.ts` (ajout type `RatedEntry`)
- Modify: `src/server/ports/repositories.ts:43-44` (méthode sur `LibraryEntryRepository`)
- Modify: `src/server/adapters/memory/index.ts` (impl mémoire, classe `InMemoryLibraryEntryRepository`)
- Modify: `src/server/adapters/mongo/repositories.ts:65-75` (impl Mongo, classe `MongoLibraryEntryRepository`)
- Test: `tests/adapters/memory.test.ts`, `tests/adapters/mongo-repositories.test.ts`

**Interfaces:**
- Consumes: `LibraryEntry` (a `workId: string`, `domain: Domain`, `title: string`, `rating: number | null`, `audiences: EntryAudiences`).
- Produces: `interface RatedEntry { workId: string; domain: Domain; title: string; rating: number; audiences: EntryAudiences }` ; `LibraryEntryRepository.listRatedByUser(userId: string): Promise<RatedEntry[]>` — uniquement les entries dont `rating != null`.

- [ ] **Step 1: Write the failing test (mémoire)**

Ajouter dans `tests/adapters/memory.test.ts` (au sein du `describe` des entries ; adapter le helper de création d'entry au style déjà présent dans le fichier) :

```ts
it("listRatedByUser ne remonte que les entries notées, avec audiences", async () => {
  const entries = new InMemoryLibraryEntryRepository();
  const base = {
    userId: "u1", workId: "w1", domain: "films" as const, title: "The Matrix",
    status: "done" as const, progress: null, review: null, activityAt: new Date(),
    createdAt: new Date(), updatedAt: new Date(),
    audiences: { public: true, circle: true, communityIds: [] as string[] },
  };
  await entries.upsert({ ...base, id: "e1", rating: 4.5 });
  await entries.upsert({ ...base, id: "e2", workId: "w2", title: "Dune", rating: null });
  const rated = await entries.listRatedByUser("u1");
  expect(rated).toEqual([
    { workId: "w1", domain: "films", title: "The Matrix", rating: 4.5, audiences: { public: true, circle: true, communityIds: [] } },
  ]);
});
```

> Note : si la construction d'un `LibraryEntry` complet diffère dans ce fichier (champs additionnels requis par le type), reprendre le littéral d'entry déjà utilisé ailleurs dans `memory.test.ts` et n'ajuster que `id`/`rating`.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/adapters/memory.test.ts`
Expected: FAIL — `listRatedByUser` n'existe pas sur le type / la classe.

- [ ] **Step 3: Add the `RatedEntry` type**

Dans `src/server/domain/entities.ts`, juste après l'interface `LibraryEntry` :

```ts
/** Projection d'une œuvre notée par un utilisateur, pour le calcul de compatibilité. */
export interface RatedEntry {
  workId: string;
  domain: Domain;
  title: string;
  rating: number;
  audiences: EntryAudiences;
}
```

- [ ] **Step 4: Declare the port method**

Dans `src/server/ports/repositories.ts`, importer `RatedEntry` (l'ajouter à l'import existant depuis `../domain/entities`) puis, dans `interface LibraryEntryRepository`, après la ligne `listByUser(...)` :

```ts
  /** Œuvres notées (rating non nul) d'un utilisateur. Pour la compatibilité de goûts. */
  listRatedByUser(userId: string): Promise<RatedEntry[]>;
```

- [ ] **Step 5: Implement memory adapter**

Dans `src/server/adapters/memory/index.ts`, classe `InMemoryLibraryEntryRepository`, après `listByUser` :

```ts
  async listRatedByUser(userId: string): Promise<RatedEntry[]> {
    return [...this.byId.values()]
      .filter((e) => e.userId === userId && e.rating !== null)
      .map((e) => ({ workId: e.workId, domain: e.domain, title: e.title, rating: e.rating as number, audiences: e.audiences }));
  }
```

Ajouter `RatedEntry` à l'import de types depuis le domaine en haut du fichier.

- [ ] **Step 6: Run memory test to verify it passes**

Run: `npx vitest run tests/adapters/memory.test.ts`
Expected: PASS.

- [ ] **Step 7: Write the failing test (Mongo)**

Ajouter dans `tests/adapters/mongo-repositories.test.ts`, dans le `describe` des entries (réutiliser le helper d'insertion d'entry déjà présent dans ce fichier ; créer une entry notée et une non notée pour le même `userId`) :

```ts
it("listRatedByUser ne remonte que les entries notées (parité mémoire)", async () => {
  await entries.upsert(makeEntry({ id: "r1", userId: "u1", workId: "w1", title: "The Matrix", rating: 4.5 }));
  await entries.upsert(makeEntry({ id: "r2", userId: "u1", workId: "w2", title: "Dune", rating: null }));
  const rated = await entries.listRatedByUser("u1");
  expect(rated.map((r) => r.workId)).toEqual(["w1"]);
  expect(rated[0]).toMatchObject({ rating: 4.5, audiences: expect.any(Object) });
});
```

> Note : `entries`, `makeEntry` (ou l'équivalent) sont les helpers déjà définis dans ce fichier ; reprendre leur forme exacte. Ne pas créer un nouveau setup Mongo.

- [ ] **Step 8: Run Mongo test to verify it fails**

Run: `npx vitest run tests/adapters/mongo-repositories.test.ts`
Expected: FAIL — `listRatedByUser` non implémentée sur `MongoLibraryEntryRepository`.

- [ ] **Step 9: Implement Mongo adapter**

Dans `src/server/adapters/mongo/repositories.ts`, classe `MongoLibraryEntryRepository`, après `listByUser` (vers la ligne 75). On pousse le filtre `rating != null` à la base (pas de chargement inutile) :

```ts
  async listRatedByUser(userId: string): Promise<RatedEntry[]> {
    const docs = await this.col.find({ userId, rating: { $ne: null } }).sort({ createdAt: -1 }).toArray();
    return docs.map(M.fromEntryDoc).map((e) => ({
      workId: e.workId, domain: e.domain, title: e.title, rating: e.rating as number, audiences: e.audiences,
    }));
  }
```

Ajouter `RatedEntry` à l'import de types depuis le domaine en haut du fichier.

- [ ] **Step 10: Run Mongo test to verify it passes**

Run: `npx vitest run tests/adapters/mongo-repositories.test.ts`
Expected: PASS.

- [ ] **Step 11: Typecheck + commit**

```bash
npx tsc --noEmit
git add src/server/domain/entities.ts src/server/ports/repositories.ts src/server/adapters/memory/index.ts src/server/adapters/mongo/repositories.ts tests/adapters/memory.test.ts tests/adapters/mongo-repositories.test.ts
git commit -m "feat(vulu): port listRatedByUser (mémoire + Mongo) pour la compatibilité"
```

---

### Task 3: Application — `computeTasteMatch`

**Files:**
- Create: `src/server/application/taste-match.ts`
- Test: `tests/application/taste-match.test.ts`

**Interfaces:**
- Consumes: `tasteMatchScore` (Task 1) ; `deps.entries.listRatedByUser` (Task 2) ; `canViewProfile(deps, viewerId, target: User)` et `getCircle(deps, userId): Promise<Set<string>>` de `@/server/application/social` ; `User` du domaine.
- Produces: `interface SampleWork { workId: string; domain: Domain; title: string }` ; `interface TasteMatchResult { score: number; overlap: number; sample: SampleWork[] }` ; `function computeTasteMatch(deps: Deps, viewerId: string, target: User): Promise<TasteMatchResult>`.

- [ ] **Step 1: Write the failing test**

```ts
// tests/application/taste-match.test.ts
import { describe, it, expect, beforeEach } from "vitest";
import { makeInMemoryDeps, type Deps } from "@/server/container";
import { FakeCatalog } from "../helpers/fake-catalog";
import { rateOrReviewWork } from "@/server/application/library-entry";
import { computeTasteMatch } from "@/server/application/taste-match";
import type { User } from "@/server/domain/entities";

const matrix = { source: "tmdb" as const, externalId: "603", type: "movie" as const };
const book = { source: "googlebooks" as const, externalId: "book-1", type: "book" as const };
const bb = { source: "tmdb" as const, externalId: "1396", type: "tv" as const };
const PUBLIC = { public: true, circle: true, communityIds: [] as string[] };

let deps: Deps;
async function makeUser(id: string, isPrivate = false): Promise<User> {
  const u: User = {
    id, username: id, displayName: id, email: `${id}@x.io`, passwordHash: "x",
    avatarUrl: null, bannerUrl: null, bio: null, isPrivate, plus: false, staff: false,
    tastes: { filmGenreIds: [1, 2, 3], people: [] }, showcase: { movie: [], tv: [], book: [] },
    createdAt: new Date(),
  };
  await deps.users.create(u);
  return u;
}

beforeEach(() => { deps = makeInMemoryDeps(new FakeCatalog()); });

describe("computeTasteMatch", () => {
  it("croise les notes des œuvres co-notées et calcule le score + sample", async () => {
    const viewer = await makeUser("viewer");
    const target = await makeUser("target");
    for (const ref of [matrix, book, bb]) {
      await rateOrReviewWork(deps, viewer.id, ref, { rating: 5, text: null, audiences: PUBLIC });
      await rateOrReviewWork(deps, target.id, ref, { rating: 5, text: null, audiences: PUBLIC });
    }
    const r = await computeTasteMatch(deps, viewer.id, target);
    expect(r.score).toBe(100);
    expect(r.overlap).toBe(3);
    expect(r.sample).toHaveLength(3);
    expect(r.sample[0]).toMatchObject({ title: expect.any(String), workId: expect.any(String) });
  });

  it("ignore les œuvres notées d'un seul côté", async () => {
    const viewer = await makeUser("viewer");
    const target = await makeUser("target");
    await rateOrReviewWork(deps, viewer.id, matrix, { rating: 5, text: null, audiences: PUBLIC });
    await rateOrReviewWork(deps, target.id, book, { rating: 5, text: null, audiences: PUBLIC });
    const r = await computeTasteMatch(deps, viewer.id, target);
    expect(r.overlap).toBe(0);
  });

  it("self → résultat neutre", async () => {
    const viewer = await makeUser("viewer");
    await rateOrReviewWork(deps, viewer.id, matrix, { rating: 5, text: null, audiences: PUBLIC });
    expect(await computeTasteMatch(deps, viewer.id, viewer)).toEqual({ score: 0, overlap: 0, sample: [] });
  });

  it("profil privé hors cercle → résultat neutre, aucune fuite", async () => {
    const viewer = await makeUser("viewer");
    const target = await makeUser("target", true); // privé, viewer ne suit pas
    for (const ref of [matrix, book, bb]) {
      await rateOrReviewWork(deps, viewer.id, ref, { rating: 5, text: null, audiences: PUBLIC });
      await rateOrReviewWork(deps, target.id, ref, { rating: 5, text: null, audiences: PUBLIC });
    }
    expect(await computeTasteMatch(deps, viewer.id, target)).toEqual({ score: 0, overlap: 0, sample: [] });
  });

  it("ne compte pas les notes non publiques de la cible hors cercle", async () => {
    const viewer = await makeUser("viewer");
    const target = await makeUser("target");
    const PRIVATE = { public: false, circle: true, communityIds: [] as string[] };
    await rateOrReviewWork(deps, viewer.id, matrix, { rating: 5, text: null, audiences: PUBLIC });
    await rateOrReviewWork(deps, target.id, matrix, { rating: 5, text: null, audiences: PRIVATE });
    const r = await computeTasteMatch(deps, viewer.id, target);
    expect(r.overlap).toBe(0);
  });
});
```

> Note : adapter le littéral `User` et l'appel `deps.users.create(...)` à la forme exacte attendue (vérifier dans `tests/application/social.test.ts` comment un user est créé). L'important : deux users, des notes croisées via `rateOrReviewWork`, et `isPrivate` pour le test de fuite.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/application/taste-match.test.ts`
Expected: FAIL — `computeTasteMatch` non défini.

- [ ] **Step 3: Implement**

```ts
// src/server/application/taste-match.ts
import type { Deps } from "@/server/container";
import type { Domain, User } from "@/server/domain/entities";
import { tasteMatchScore } from "@/server/domain/taste-match";
import { canViewProfile, getCircle } from "@/server/application/social";

/** Œuvre aimée des deux côtés, pour la ligne « vous aimez tous les deux ». */
export interface SampleWork {
  workId: string;
  domain: Domain;
  title: string;
}

export interface TasteMatchResult {
  score: number;
  overlap: number;
  sample: SampleWork[];
}

const NEUTRAL: TasteMatchResult = { score: 0, overlap: 0, sample: [] };

/**
 * Compatibilité de goûts entre `viewer` et `target` sur leurs œuvres co-notées.
 * Respecte la visibilité (jamais de self, profil consultable, notes cible visibles
 * uniquement). Le seuil d'affichage (overlap ≥ 3) est appliqué par l'appelant.
 */
export async function computeTasteMatch(deps: Deps, viewerId: string, target: User): Promise<TasteMatchResult> {
  if (viewerId === target.id) return NEUTRAL;
  if (!(await canViewProfile(deps, viewerId, target))) return NEUTRAL;

  const inCircle = (await getCircle(deps, viewerId)).has(target.id);
  const [viewerRated, targetRatedAll] = await Promise.all([
    deps.entries.listRatedByUser(viewerId),
    deps.entries.listRatedByUser(target.id),
  ]);
  const targetByWork = new Map(
    targetRatedAll.filter((e) => e.audiences.public || inCircle).map((e) => [e.workId, e]),
  );

  const pairs: { a: number; b: number }[] = [];
  const sample: SampleWork[] = [];
  for (const v of viewerRated) {
    const t = targetByWork.get(v.workId);
    if (!t) continue;
    pairs.push({ a: v.rating, b: t.rating });
    if (sample.length < 3 && v.rating >= 4 && t.rating >= 4 && Math.abs(v.rating - t.rating) <= 1) {
      sample.push({ workId: t.workId, domain: t.domain, title: t.title });
    }
  }

  const { score, overlap } = tasteMatchScore(pairs);
  return { score, overlap, sample };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/application/taste-match.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/server/application/taste-match.ts tests/application/taste-match.test.ts
git commit -m "feat(vulu): application computeTasteMatch (visibilité + sample)"
```

---

### Task 4: API — exposer `tasteMatch` sur le profil

**Files:**
- Modify: `src/app/api/users/[username]/route.ts`

**Interfaces:**
- Consumes: `computeTasteMatch` (Task 3).
- Produces: la réponse JSON gagne `tasteMatch: { score, overlap, sample } | null` (null si pas de viewer, self, ou overlap < 3).

- [ ] **Step 1: Implement (pas de test dédié — route fine, logique testée en Task 3)**

Dans `src/app/api/users/[username]/route.ts`, ajouter l'import :

```ts
import { computeTasteMatch } from "@/server/application/taste-match";
```

Puis, avant le `return json({...})`, calculer le bloc et le gater sur le seuil :

```ts
    const rawMatch = viewer && !isSelf ? await computeTasteMatch(deps, viewer.id, target) : null;
    const tasteMatch = rawMatch && rawMatch.overlap >= 3 ? rawMatch : null;
```

Et l'ajouter à l'objet retourné :

```ts
      entries: visibleEntries, lists, tasteMatch,
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: aucune erreur.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/users/[username]/route.ts
git commit -m "feat(vulu): API profil — champ tasteMatch (gate overlap >= 3)"
```

---

### Task 5: UI — `TasteMatchBadge` + intégration dans la page profil

**Files:**
- Create: `src/components/TasteMatchBadge.tsx`
- Modify: `src/app/u/[username]/page.tsx`

**Interfaces:**
- Consumes: `computeTasteMatch` + `TasteMatchResult`/`SampleWork` (Task 3). Route fiche œuvre : `/work/${workId}` (cf. `ProfileTabs.tsx:24`).
- Produces: composant `TasteMatchBadge` rendu sous l'en-tête du profil quand pertinent.

- [ ] **Step 1: Create the presentational component**

```tsx
// src/components/TasteMatchBadge.tsx
import Link from "next/link";
import type { SampleWork } from "@/server/application/taste-match";

interface Props {
  score: number;
  overlap: number;
  sample: SampleWork[];
}

/** Pastille « Match % » + ligne d'affinité. Purement présentationnel, piloté par le serveur. */
export function TasteMatchBadge({ score, overlap, sample }: Props) {
  const tone =
    score >= 80
      ? "bg-[var(--color-accent)] text-white"
      : score >= 60
        ? "bg-[var(--color-accent)]/15 text-[var(--color-accent)]"
        : "bg-[var(--color-border)] text-[var(--color-fg)]";

  return (
    <div className="mt-3 flex flex-col gap-1">
      <div className="flex items-center gap-2">
        <span className={`inline-flex items-center rounded-full px-3 py-1 text-sm font-semibold ${tone}`}>
          {score} % de goûts communs
        </span>
        <span className="text-xs text-[var(--color-fg-muted)]">sur {overlap} œuvres notées en commun</span>
      </div>
      {sample.length > 0 && (
        <p className="text-sm text-[var(--color-fg-muted)]">
          Vous aimez tous les deux :{" "}
          {sample.map((w, i) => (
            <span key={w.workId}>
              {i > 0 && ", "}
              <Link href={`/work/${w.workId}`} className="italic text-[var(--color-fg)] hover:underline">
                {w.title}
              </Link>
            </span>
          ))}
        </p>
      )}
    </div>
  );
}
```

> Note : si les tokens de couleur diffèrent (`--color-accent`, `--color-fg-muted`…), reprendre ceux déjà utilisés dans `src/app/u/[username]/page.tsx` / `globals.css`. Le rendu exact est secondaire ; la condition d'affichage est portée par le serveur.

- [ ] **Step 2: Compute the match in the profile server component**

Dans `src/app/u/[username]/page.tsx`, ajouter les imports :

```ts
import { computeTasteMatch } from "@/server/application/taste-match";
import { TasteMatchBadge } from "@/components/TasteMatchBadge";
```

Après le calcul de `isSelf` (vers la ligne 26), ajouter :

```ts
  const rawMatch = !isSelf ? await computeTasteMatch(deps, viewer.id, target) : null;
  const tasteMatch = rawMatch && rawMatch.overlap >= 3 ? rawMatch : null;
```

- [ ] **Step 3: Render the badge under the profile header**

Dans le JSX de l'en-tête du profil (à côté du `FollowButton` / des infos d'identité — repérer le bloc qui affiche `displayName`/`@username` et les badges), insérer après ce bloc :

```tsx
        {tasteMatch && (
          <TasteMatchBadge score={tasteMatch.score} overlap={tasteMatch.overlap} sample={tasteMatch.sample} />
        )}
```

- [ ] **Step 4: Typecheck + full test suite**

Run: `npx tsc --noEmit && npx vitest run`
Expected: typecheck OK ; toute la suite verte.

- [ ] **Step 5: Manual smoke (optionnel mais recommandé)**

Démarrer le serveur dev, se connecter, visiter le profil d'un membre avec qui ≥ 3 œuvres sont co-notées → la pastille « X % de goûts communs » et la ligne « vous aimez tous les deux » s'affichent ; sur son propre profil, rien.

- [ ] **Step 6: Commit**

```bash
git add src/components/TasteMatchBadge.tsx src/app/u/[username]/page.tsx
git commit -m "feat(vulu): badge de compatibilité de goûts sur le profil"
```

---

## Self-review

- **Couverture spec :** métrique (Task 1) ✓ ; port `listRatedByUser` mémoire+Mongo (Task 2) ✓ ; `computeTasteMatch` no-self/visibilité/seuil/sample (Task 3) ✓ ; champ API `tasteMatch | null` (Task 4) ✓ ; badge + ligne affinité (Task 5) ✓ ; tests domaine/application/parité adaptateurs ✓.
- **Écart assumé vs spec :** la spec décrivait `listRatedByUser → { ref: WorkRef; rating }`. `WorkRef` n'existe pas dans le code ; la projection réelle est `RatedEntry { workId, domain, title, rating, audiences }` — `audiences` est nécessaire pour la règle de visibilité que la spec impose explicitement. Adaptation fidèle à l'intention.
- **Intégration réelle :** le profil rendu est le server component `src/app/u/[username]/page.tsx` (la route API n'est pas son consommateur) ; le badge y est câblé directement, et la route API reçoit le même champ par cohérence (Task 4).
- **Cohérence des types :** `tasteMatchScore` retourne `{ score, overlap }` (Tasks 1, 3) ; `computeTasteMatch` retourne `{ score, overlap, sample }` (Tasks 3, 4, 5) ; `RatedEntry.rating` est `number` (non nul) côté port, consommé tel quel dans les paires.
- **Pas de placeholder :** chaque étape de code est complète ; les seules notes sont des rappels d'alignement sur des littéraux d'objets déjà présents dans les fichiers de test (formes `LibraryEntry`/`User`).
