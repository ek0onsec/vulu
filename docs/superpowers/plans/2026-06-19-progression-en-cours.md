# Progression « en cours » — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ajouter un statut `in_progress` avec suivi de progression (séries `S1 E5`, livres `Tome 3 · p.230`, films sans détail), des jalons partageables dans le feed, et une section « En cours » sur le profil.

**Architecture:** Hexagonale existante. La progression vit sur `LibraryEntry` ; les totaux (épisodes/pages) sur `Work` (best-effort, sans appel API en plus). Le feed devient ordonné par `activityAt` (nullable) : une entrée n'apparaît dans le feed que si `activityAt !== null`, posé par une note/avis ou un partage de jalon explicite (les incréments silencieux ne remontent rien).

**Tech Stack:** Next.js 16 (App Router, async params), React 19, Tailwind v4, MongoDB (driver natif), Vitest, zod v4.

## Global Constraints

- TypeScript strict, **aucun `any`**, types complets (CLAUDE.md).
- Découplage hexagonal : domaine → ports → adaptateurs ; pas d'accès driver hors adaptateur.
- TDD : test qui échoue → implémentation minimale → test vert → commit.
- **Aucune attribution IA** dans le code, l'app ou les commits ; pas de co-auteur Claude.
- Ne PAS toucher au dossier `lechatonfat/` ni aux clés réelles de `vulu/.env.local`.
- Typecheck : `node_modules/.bin/tsc --noEmit` (jamais `npx tsc`). Tests : `npx vitest run`.
- Commits en français, préfixe `feat(vulu):` / `test(vulu):` / `refactor(vulu):`.
- Tous les chemins sont relatifs à `/home/chamberlain/Desktop/Claude/vulu`.

---

### Task 1: Modèle de domaine (statut, progression, totaux, visibilité feed)

**Files:**
- Modify: `src/server/domain/entities.ts`
- Modify: `src/server/domain/feed-rules.ts`
- Test: `tests/domain/feed-rules.test.ts`

**Interfaces:**
- Produces:
  - `type EntryStatus = "planned" | "in_progress" | "done"`
  - `interface EntryProgress { season: number | null; episode: number | null; tome: number | null; page: number | null }`
  - `LibraryEntry.progress: EntryProgress | null`, `LibraryEntry.activityAt: Date | null`
  - `Work.episodeCounts: number[] | null`, `Work.pageCount: number | null`
  - `isFeedVisible(entry: LibraryEntry): boolean` (export depuis `feed-rules.ts`)

- [ ] **Step 1: Écrire le test qui échoue**

Ajouter dans `tests/domain/feed-rules.test.ts` (garder les tests existants) :

```ts
import { isFeedVisible } from "@/server/domain/feed-rules";

describe("isFeedVisible", () => {
  const base = {
    id: "e", userId: "u", workId: "w", domain: "films" as const,
    rating: null, text: null, visibility: "public" as const, communityId: null,
    progress: null, createdAt: new Date(), updatedAt: new Date(),
  };
  it("vrai si activityAt est posé (avis ou jalon partagé)", () => {
    expect(isFeedVisible({ ...base, status: "done", activityAt: new Date() })).toBe(true);
    expect(isFeedVisible({ ...base, status: "in_progress", activityAt: new Date() })).toBe(true);
  });
  it("faux si activityAt est null (jamais partagé)", () => {
    expect(isFeedVisible({ ...base, status: "in_progress", activityAt: null })).toBe(false);
    expect(isFeedVisible({ ...base, status: "planned", activityAt: null })).toBe(false);
  });
});
```

- [ ] **Step 2: Lancer le test, vérifier l'échec**

Run: `npx vitest run tests/domain/feed-rules.test.ts`
Expected: FAIL — `isFeedVisible` introuvable + erreurs de type sur `progress`/`activityAt`.

- [ ] **Step 3: Modifier les entités**

Dans `src/server/domain/entities.ts` :
- Remplacer `export type EntryStatus = "planned" | "done";` par
  `export type EntryStatus = "planned" | "in_progress" | "done";`
- Ajouter après `EntryStatus` :

```ts
export interface EntryProgress {
  season: number | null;   // séries
  episode: number | null;  // séries
  tome: number | null;     // livres
  page: number | null;     // livres
}
```

- Dans `interface Work`, ajouter avant `cachedAt: Date;` :

```ts
  episodeCounts: number[] | null;  // tv : nb d'épisodes par saison ; total = somme
  pageCount: number | null;        // livre : pages totales
```

- Dans `interface LibraryEntry`, ajouter après `communityId: string | null;` :

```ts
  progress: EntryProgress | null;  // null pour les films « en cours » (statut seul)
  activityAt: Date | null;         // date d'apparition/remontée dans le feed (null = absent du feed)
```

- [ ] **Step 4: Modifier feed-rules.ts**

```ts
import type { LibraryEntry } from "./entities";

/** Une entrée alimente le mur d'une œuvre / les tendances si elle est "vue" ET notée ou commentée. */
export function isPublishable(entry: LibraryEntry): boolean {
  return entry.status === "done" && (entry.rating !== null || entry.text !== null);
}

/** Une entrée est visible dans le feed dès qu'un avis ou un jalon a été partagé (activityAt posé). */
export function isFeedVisible(entry: LibraryEntry): boolean {
  return entry.activityAt !== null;
}
```

- [ ] **Step 5: Réparer les sites de construction (sinon tsc casse partout)**

Ajouter des champs **requis** à `LibraryEntry`/`Work` casse tout littéral qui les construit. Les corriger ici pour garder `tsc` vert :

1. `src/server/application/library-entry.ts` — dans `loadOrCreateEntry`, au littéral retourné, ajouter après `communityId: null,` : `progress: null, activityAt: null,`.
2. `src/server/application/library-entry.ts` — dans `rateOrReviewWork`, au littéral `updated`, ajouter `activityAt: deps.clock.now(),` (un avis rend l'entrée visible dans le feed). `setEntryStatus` et `rateOrReviewWork` font `{ ...entry, ... }` donc héritent `progress`/`activityAt` de la base — rien d'autre à changer.
3. `src/server/application/get-work.ts` — dans le littéral `work`, ajouter avant `cachedAt:` : `episodeCounts: null, pageCount: null,` (placeholder ; rempli en Task 2).
4. Lancer `node_modules/.bin/tsc --noEmit` et corriger chaque littéral `LibraryEntry`/`Work` restant signalé (notamment dans les tests d'adaptateurs `tests/adapters/*.test.ts`) en ajoutant `progress: null, activityAt: null` aux entrées et `episodeCounts: null, pageCount: null` aux œuvres.

- [ ] **Step 6: Lancer la suite complète, vérifier le vert**

Run: `node_modules/.bin/tsc --noEmit && npx vitest run`
Expected: tsc 0, tous les tests verts (le feed utilise encore l'ancienne règle — inchangé à ce stade).

- [ ] **Step 7: Commit**

```bash
git add src/server/domain/entities.ts src/server/domain/feed-rules.ts src/server/application/library-entry.ts src/server/application/get-work.ts tests/
git commit -m "feat(vulu): modèle progression — statut in_progress, EntryProgress, totaux Work, isFeedVisible"
```

---

### Task 2: Catalogue — totaux épisodes/pages (port, adaptateurs, import, FakeCatalog)

**Files:**
- Modify: `src/server/ports/catalog.ts`
- Modify: `src/server/adapters/catalog/tmdb-catalog.ts`
- Modify: `src/server/adapters/catalog/google-books-catalog.ts`
- Modify: `src/server/application/get-work.ts`
- Modify: `tests/helpers/fake-catalog.ts`
- Test: `tests/application/get-work.test.ts` (créer)

**Interfaces:**
- Consumes: types de Task 1 (`Work.episodeCounts`, `Work.pageCount`).
- Produces:
  - `WorkDetails.episodeCounts?: number[] | null`, `WorkDetails.pageCount?: number | null`
  - `getOrImportWork` recopie ces champs dans `Work`.
  - `FakeCatalog.works["1396"]` (série tv, `episodeCounts: [7, 13]`) et `book-1.pageCount: 271`.

- [ ] **Step 1: Écrire le test qui échoue**

Créer `tests/application/get-work.test.ts` :

```ts
import { describe, it, expect, beforeEach } from "vitest";
import { makeInMemoryDeps, type Deps } from "@/server/container";
import { FakeCatalog } from "../helpers/fake-catalog";
import { getOrImportWork } from "@/server/application/get-work";

let deps: Deps;
beforeEach(() => { deps = makeInMemoryDeps(new FakeCatalog()); });

describe("getOrImportWork — totaux", () => {
  it("importe episodeCounts pour une série", async () => {
    const w = await getOrImportWork(deps, { source: "tmdb", externalId: "1396", type: "tv" });
    expect(w.episodeCounts).toEqual([7, 13]);
    expect(w.pageCount).toBeNull();
  });
  it("importe pageCount pour un livre", async () => {
    const w = await getOrImportWork(deps, { source: "googlebooks", externalId: "book-1", type: "book" });
    expect(w.pageCount).toBe(271);
    expect(w.episodeCounts).toBeNull();
  });
});
```

- [ ] **Step 2: Lancer le test, vérifier l'échec**

Run: `npx vitest run tests/application/get-work.test.ts`
Expected: FAIL — `episodeCounts`/`pageCount` absents (et série `1396` inexistante dans FakeCatalog).

- [ ] **Step 3: Étendre le port catalogue**

Dans `src/server/ports/catalog.ts`, dans `interface WorkDetails`, ajouter avant la fermeture `}` :

```ts
  episodeCounts?: number[] | null;  // tv uniquement
  pageCount?: number | null;        // livre uniquement
```

- [ ] **Step 4: Étendre FakeCatalog**

Dans `tests/helpers/fake-catalog.ts`, ajouter à `works` une série, et `pageCount` au livre :

```ts
    "1396": {
      source: "tmdb", externalId: "1396", type: "tv", title: "Breaking Bad", year: 2008,
      posterUrl: "p.jpg", backdropUrl: "b.jpg", overview: "Walter White…",
      genres: ["Drame"], people: [{ tmdbId: 1, name: "Bryan Cranston", role: "actor" }],
      externalRating: 8.9, watchProviders: [{ name: "Netflix", logoUrl: "n.jpg" }],
      episodeCounts: [7, 13],
    },
```

Et dans l'entrée `"book-1"`, ajouter `pageCount: 271,` après `watchProviders: [],`.

- [ ] **Step 5: Mapper les totaux dans get-work**

Dans `src/server/application/get-work.ts`, remplacer les placeholders `episodeCounts: null, pageCount: null,` (posés en Task 1) par :

```ts
    episodeCounts: details.episodeCounts ?? null,
    pageCount: details.pageCount ?? null,
```

- [ ] **Step 6: Mapper TMDB (séries)**

Dans `src/server/adapters/catalog/tmdb-catalog.ts` :
- Dans `interface TmdbDetails`, ajouter `seasons?: { season_number: number; episode_count: number }[];` à la fin de la déclaration (avant le `}`).
- Dans `getWork`, juste avant le `return {`, ajouter :

```ts
    const episodeCounts = type === "tv"
      ? (d.seasons ?? []).filter((s) => s.season_number >= 1).sort((a, b) => a.season_number - b.season_number).map((s) => s.episode_count)
      : null;
```

- Dans l'objet retourné, ajouter après `watchProviders,` :

```ts
      episodeCounts: episodeCounts && episodeCounts.length ? episodeCounts : null,
      pageCount: null,
```

- [ ] **Step 7: Mapper Google Books (pages)**

Dans `src/server/adapters/catalog/google-books-catalog.ts` :
- Dans le type `Volume["volumeInfo"]`, ajouter `pageCount?: number;` (à côté des autres champs de `volumeInfo`).
- Dans `getWork`, dans l'objet retourné, ajouter après `watchProviders: [],` :

```ts
      episodeCounts: null,
      pageCount: typeof info.pageCount === "number" && info.pageCount > 0 ? info.pageCount : null,
```

- [ ] **Step 8: Lancer les tests, vérifier le succès**

Run: `npx vitest run tests/application/get-work.test.ts`
Expected: PASS.

- [ ] **Step 9: Typecheck + commit**

```bash
node_modules/.bin/tsc --noEmit
git add src/server/ports/catalog.ts src/server/adapters/catalog/tmdb-catalog.ts src/server/adapters/catalog/google-books-catalog.ts src/server/application/get-work.ts tests/helpers/fake-catalog.ts tests/application/get-work.test.ts
git commit -m "feat(vulu): catalogue — totaux épisodes (TMDB) et pages (Google Books) sur Work"
```

---

### Task 3: Mappers Mongo — rétro-compat des nouveaux champs

**Files:**
- Modify: `src/server/adapters/mongo/mappers.ts`
- Test: `tests/adapters/mongo-mappers.test.ts`

**Interfaces:**
- Consumes: types Task 1.
- Produces: `fromEntryDoc` backfill `progress: null`, `activityAt` (= `createdAt` si publiable, sinon `null`) ; `fromWorkDoc` backfill `episodeCounts: null`, `pageCount: null`.

- [ ] **Step 1: Écrire le test qui échoue**

Ajouter dans `tests/adapters/mongo-mappers.test.ts` :

```ts
import { fromEntryDoc, fromWorkDoc } from "@/server/adapters/mongo/mappers";

describe("mappers — rétro-compat progression", () => {
  it("fromEntryDoc backfille un ancien doc (avis) avec activityAt = createdAt", () => {
    const created = new Date("2025-01-01");
    // @ts-expect-error doc legacy sans progress/activityAt
    const e = fromEntryDoc({ _id: "e", id: "e", userId: "u", workId: "w", domain: "films",
      status: "done", rating: 4, text: null, visibility: "public", communityId: null,
      createdAt: created, updatedAt: created });
    expect(e.progress).toBeNull();
    expect(e.activityAt).toEqual(created);
  });
  it("fromEntryDoc laisse activityAt null pour un ancien doc non publiable", () => {
    const created = new Date("2025-01-01");
    // @ts-expect-error doc legacy
    const e = fromEntryDoc({ _id: "e", id: "e", userId: "u", workId: "w", domain: "films",
      status: "planned", rating: null, text: null, visibility: "circle", communityId: null,
      createdAt: created, updatedAt: created });
    expect(e.activityAt).toBeNull();
  });
  it("fromWorkDoc backfille episodeCounts/pageCount à null", () => {
    // @ts-expect-error doc legacy
    const w = fromWorkDoc({ _id: "w", id: "w", source: "tmdb", externalId: "1", type: "movie",
      domain: "films", title: "X", year: 2000, posterUrl: null, backdropUrl: null, overview: null,
      genres: [], people: [], externalRating: null, watchProviders: [], cachedAt: new Date() });
    expect(w.episodeCounts).toBeNull();
    expect(w.pageCount).toBeNull();
  });
});
```

- [ ] **Step 2: Lancer le test, vérifier l'échec**

Run: `npx vitest run tests/adapters/mongo-mappers.test.ts`
Expected: FAIL — `activityAt`/`progress`/`episodeCounts` valent `undefined`.

- [ ] **Step 3: Implémenter les backfills**

Dans `src/server/adapters/mongo/mappers.ts`, remplacer les deux one-liners concernés. Ajouter en haut l'import :

```ts
import { isPublishable } from "@/server/domain/feed-rules";
```

Puis remplacer :

```ts
export const fromWorkDoc = (d: WithIdWork): Work => strip(d);
```
par :
```ts
export const fromWorkDoc = (d: WithIdWork): Work => {
  const w = strip(d);
  return { ...w, episodeCounts: w.episodeCounts ?? null, pageCount: w.pageCount ?? null };
};
```

Et remplacer :
```ts
export const fromEntryDoc = (d: WithIdEntry): LibraryEntry => strip(d);
```
par :
```ts
export const fromEntryDoc = (d: WithIdEntry): LibraryEntry => {
  const e = strip(d);
  const progress = e.progress ?? null;
  const activityAt = e.activityAt ?? (isPublishable({ ...e, progress, activityAt: null }) ? e.createdAt : null);
  return { ...e, progress, activityAt };
};
```

- [ ] **Step 4: Lancer le test, vérifier le succès**

Run: `npx vitest run tests/adapters/mongo-mappers.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/server/adapters/mongo/mappers.ts tests/adapters/mongo-mappers.test.ts
git commit -m "feat(vulu): mappers Mongo — rétro-compat progress/activityAt/totaux"
```

---

### Task 4: Repositories — feed ordonné par activityAt

**Files:**
- Modify: `src/server/ports/repositories.ts`
- Modify: `src/server/adapters/memory/index.ts`
- Modify: `src/server/adapters/mongo/repositories.ts`
- Modify: `src/server/adapters/mongo/indexes.ts`
- Modify: `src/server/application/feed.ts` (type de curseur de `buildFeed`)
- Modify: `src/server/application/communities.ts` (type de curseur de `communityFeed`)
- Modify: `src/app/api/feed/route.ts`, `src/app/api/communities/[id]/feed/route.ts` (sérialisation curseur)
- Test: `tests/adapters/memory.test.ts`

**Interfaces:**
- Consumes: `isFeedVisible` (Task 1).
- Produces:
  - Curseur feed **renommé partout** `{ createdAt, id }` → `{ activityAt, id }` (port, adaptateurs, `buildFeed`, `communityFeed`, routes). Ce renommage doit être fait en un seul bloc pour garder `tsc` vert.
  - `listByUser` accepte `status?: "planned" | "in_progress" | "done"`.
  - Le feed filtre sur `isFeedVisible` (activityAt non-null) et trie par `activityAt` décroissant.

- [ ] **Step 1: Écrire le test qui échoue**

Ajouter dans `tests/adapters/memory.test.ts` (suivre le style du fichier ; importer `InMemoryLibraryEntryRepository` s'il ne l'est pas déjà) :

```ts
import { InMemoryLibraryEntryRepository } from "@/server/adapters/memory";

describe("InMemoryLibraryEntryRepository — feed activityAt", () => {
  const mk = (id: string, activityAt: Date | null, over: Partial<import("@/server/domain/entities").LibraryEntry> = {}) => ({
    id, userId: "u", workId: "w-" + id, domain: "films" as const, status: "done" as const,
    rating: 4, text: null, visibility: "public" as const, communityId: null, progress: null,
    activityAt, createdAt: new Date(2020, 0, 1), updatedAt: new Date(2020, 0, 1), ...over,
  });
  it("exclut les entrées sans activityAt et trie par activityAt desc", async () => {
    const repo = new InMemoryLibraryEntryRepository();
    await repo.upsert(mk("a", new Date(2021, 0, 1)));
    await repo.upsert(mk("b", new Date(2023, 0, 1)));
    await repo.upsert(mk("c", null, { status: "in_progress", rating: null }));
    const out = await repo.feed({ scope: "foryou", circleUserIds: [], viewerId: "u", domains: ["films"], cursor: null, limit: 10 });
    expect(out.map((e) => e.id)).toEqual(["b", "a"]);
  });
  it("pagine via le curseur activityAt", async () => {
    const repo = new InMemoryLibraryEntryRepository();
    await repo.upsert(mk("a", new Date(2021, 0, 1)));
    await repo.upsert(mk("b", new Date(2023, 0, 1)));
    const out = await repo.feed({ scope: "foryou", circleUserIds: [], viewerId: "u", domains: ["films"], cursor: { activityAt: new Date(2023, 0, 1), id: "b" }, limit: 10 });
    expect(out.map((e) => e.id)).toEqual(["a"]);
  });
});
```

- [ ] **Step 2: Lancer le test, vérifier l'échec**

Run: `npx vitest run tests/adapters/memory.test.ts`
Expected: FAIL — le curseur attend encore `createdAt`, et `c` (activityAt null) apparaît.

- [ ] **Step 3: Mettre à jour le port**

Dans `src/server/ports/repositories.ts`, interface `LibraryEntryRepository` :
- `listByUser(userId: string, opts: { status?: "planned" | "in_progress" | "done"; domain?: string }): Promise<LibraryEntry[]>;`
- Dans `feed(opts: {...})`, remplacer `cursor: { createdAt: Date; id: string } | null;` par `cursor: { activityAt: Date; id: string } | null;`
- `feedByCommunity(communityId: string, cursor: { activityAt: Date; id: string } | null, limit: number): Promise<LibraryEntry[]>;`

- [ ] **Step 4: Mettre à jour l'adaptateur mémoire**

Dans `src/server/adapters/memory/index.ts`, classe `InMemoryLibraryEntryRepository` :
- Importer `isFeedVisible` : remplacer `import { isPublishable } from "@/server/domain/feed-rules";` par `import { isPublishable, isFeedVisible } from "@/server/domain/feed-rules";`
- `listByUser` : changer le type `opts` en `{ status?: "planned" | "in_progress" | "done"; domain?: string }`.
- `feed` : remplacer le corps par :

```ts
  async feed(opts: { scope: "foryou" | "circle"; circleUserIds: string[]; viewerId: string; domains: string[]; cursor: { activityAt: Date; id: string } | null; limit: number; }) {
    const circle = new Set(opts.circleUserIds);
    return [...this.byId.values()]
      .filter((e) => isFeedVisible(e))
      .filter((e) => opts.domains.includes(e.domain))
      .filter((e) => opts.scope === "circle" ? circle.has(e.userId) : (e.visibility === "public" || circle.has(e.userId)))
      .filter((e) => !opts.cursor || e.activityAt!.getTime() < opts.cursor.activityAt.getTime())
      .sort((a, b) => b.activityAt!.getTime() - a.activityAt!.getTime())
      .slice(0, opts.limit);
  }
```

- `feedByCommunity` : remplacer par :

```ts
  async feedByCommunity(communityId: string, cursor: { activityAt: Date; id: string } | null, limit: number) {
    return [...this.byId.values()]
      .filter((e) => e.communityId === communityId && isFeedVisible(e))
      .filter((e) => !cursor || e.activityAt!.getTime() < cursor.activityAt.getTime())
      .sort((a, b) => b.activityAt!.getTime() - a.activityAt!.getTime())
      .slice(0, limit);
  }
```

(`listRecentPublic` et `listByWork` restent sur `isPublishable` — ne pas les toucher.)

- [ ] **Step 5: Mettre à jour l'adaptateur Mongo**

Dans `src/server/adapters/mongo/repositories.ts`, classe `MongoLibraryEntryRepository` :
- `listByUser` : changer le type `opts.status` en `"planned" | "in_progress" | "done"`.
- `feed` : remplacer la ligne du filtre statut
  `{ status: "done", $or: [{ rating: { $ne: null } }, { text: { $ne: null } }] },`
  par `{ activityAt: { $ne: null } },`
  puis remplacer la pagination/tri :
  `if (opts.cursor) and.push({ createdAt: { $lt: opts.cursor.createdAt } });`
  → `if (opts.cursor) and.push({ activityAt: { $lt: opts.cursor.activityAt } });`
  et `.sort({ createdAt: -1, _id: -1 })` → `.sort({ activityAt: -1, _id: -1 })`.
  Mettre à jour le type `cursor` de la signature `feed(opts: {...})` en `{ activityAt: Date; id: string } | null`.
- `feedByCommunity` : changer la signature du curseur en `{ activityAt: Date; id: string } | null`, le filtre en `{ communityId, activityAt: { $ne: null } }` (remplacer le filtre `isPublishable`/`status:done`), le tri en `{ activityAt: -1, _id: -1 }`, et le curseur en `{ activityAt: { $lt: cursor.activityAt } }`.

- [ ] **Step 6: Mettre à jour les index Mongo**

Dans `src/server/adapters/mongo/indexes.ts`, ajouter à la collection `entries` un index `{ activityAt: -1, _id: -1 }` (suivre le style des `createIndex` existants).

- [ ] **Step 6b: Propager le renommage du curseur (application + routes)**

Pour que `tsc` reste vert, renommer le curseur partout où il transite :
- `src/server/application/feed.ts` — signature `buildFeed`, type `cursor` : `{ activityAt: Date; id: string } | null`.
- `src/server/application/communities.ts` — signature `communityFeed`, type `cursor` : `{ activityAt: Date; id: string } | null`.
- `src/app/api/feed/route.ts` :
  - `const cursor = cursorRaw ? JSON.parse(cursorRaw) as { activityAt: string; id: string } : null;`
  - passage à `buildFeed` : `cursor: cursor ? { activityAt: new Date(cursor.activityAt), id: cursor.id } : null,`
  - `const nextCursor = last ? JSON.stringify({ activityAt: last.entry.activityAt ?? last.entry.createdAt, id: last.entry.id }) : null;`
- `src/app/api/communities/[id]/feed/route.ts` : mêmes trois changements (curseur passé à `communityFeed`).

- [ ] **Step 7: Lancer les tests, vérifier le succès**

Run: `npx vitest run tests/adapters/memory.test.ts`
Expected: PASS.

- [ ] **Step 8: Suite complète (le feed bascule sur isFeedVisible) + typecheck + commit**

Le feed passe de l'ancienne règle (`done && rating||text`) à `isFeedVisible` (activityAt non-null). Comme un avis pose `activityAt` (Task 1), `feed.test.ts` doit rester vert.

```bash
node_modules/.bin/tsc --noEmit && npx vitest run
git add src/server/ports/repositories.ts src/server/adapters/memory/index.ts src/server/adapters/mongo/repositories.ts src/server/adapters/mongo/indexes.ts src/server/application/feed.ts src/server/application/communities.ts src/app/api/feed/route.ts "src/app/api/communities/[id]/feed/route.ts" tests/adapters/memory.test.ts
git commit -m "feat(vulu): feed ordonné par activityAt (curseur + index), statut in_progress dans listByUser"
```

---

### Task 5: Application — updateProgress + schémas zod

**Files:**
- Modify: `src/lib/zod-schemas.ts`
- Modify: `src/server/application/library-entry.ts`
- Test: `tests/application/progress.test.ts` (créer)

**Interfaces:**
- Consumes: `loadOrCreateEntry` (interne), `getOrImportWork`, `Work.episodeCounts/pageCount` (Task 2).
- Produces:
  - `workRefSchema` élargi : `source: z.enum(["tmdb","googlebooks"])`, `type: z.enum(["movie","tv","book"])`.
  - `progressSchema = { ref, season?, episode?, tome?, page? }` (entiers nullable).
  - `updateProgress(deps, userId, ref, input: { season?: number|null; episode?: number|null; tome?: number|null; page?: number|null }): Promise<LibraryEntry>` — statut `in_progress`, **ne touche pas** `activityAt`.

- [ ] **Step 1: Écrire le test qui échoue**

Créer `tests/application/progress.test.ts` :

```ts
import { describe, it, expect, beforeEach } from "vitest";
import { makeInMemoryDeps, type Deps } from "@/server/container";
import { FakeCatalog } from "../helpers/fake-catalog";
import { updateProgress } from "@/server/application/library-entry";
import { ValidationError } from "@/server/domain/errors";

let deps: Deps;
const tv = { source: "tmdb" as const, externalId: "1396", type: "tv" as const };
const book = { source: "googlebooks" as const, externalId: "book-1", type: "book" as const };
const movie = { source: "tmdb" as const, externalId: "603", type: "movie" as const };
beforeEach(() => { deps = makeInMemoryDeps(new FakeCatalog()); });

describe("updateProgress", () => {
  it("série : enregistre saison/épisode et passe en in_progress sans activityAt", async () => {
    const e = await updateProgress(deps, "u1", tv, { season: 1, episode: 5 });
    expect(e.status).toBe("in_progress");
    expect(e.progress).toEqual({ season: 1, episode: 5, tome: null, page: null });
    expect(e.activityAt).toBeNull();
  });
  it("livre : enregistre tome/page", async () => {
    const e = await updateProgress(deps, "u1", book, { tome: 3, page: 120 });
    expect(e.progress).toEqual({ season: null, episode: null, tome: 3, page: 120 });
  });
  it("film : in_progress sans détail (progress null)", async () => {
    const e = await updateProgress(deps, "u1", movie, {});
    expect(e.status).toBe("in_progress");
    expect(e.progress).toBeNull();
  });
  it("clampe l'épisode au total connu de la saison", async () => {
    const e = await updateProgress(deps, "u1", tv, { season: 1, episode: 99 });
    expect(e.progress?.episode).toBe(7); // saison 1 = 7 épisodes
  });
  it("clampe la page au pageCount connu", async () => {
    const e = await updateProgress(deps, "u1", book, { page: 9999 });
    expect(e.progress?.page).toBe(271);
  });
  it("rejette un nombre < 1", async () => {
    await expect(updateProgress(deps, "u1", tv, { season: 0, episode: 1 })).rejects.toThrow(ValidationError);
  });
});
```

- [ ] **Step 2: Lancer le test, vérifier l'échec**

Run: `npx vitest run tests/application/progress.test.ts`
Expected: FAIL — `updateProgress` introuvable.

- [ ] **Step 3: Élargir les schémas zod**

Dans `src/lib/zod-schemas.ts` :
- Remplacer `export const workRefSchema = z.object({ source: z.literal("tmdb"), externalId: z.string(), type: z.enum(["movie", "tv"]) });`
  par `export const workRefSchema = z.object({ source: z.enum(["tmdb", "googlebooks"]), externalId: z.string(), type: z.enum(["movie", "tv", "book"]) });`
- Après `rateSchema`, ajouter :

```ts
const progInt = z.number().int().min(1).nullable().optional();
export const progressSchema = z.object({
  ref: workRefSchema,
  season: progInt, episode: progInt, tome: progInt, page: progInt,
});
```

- [ ] **Step 4: Implémenter updateProgress**

Dans `src/server/application/library-entry.ts` :
- Étendre l'import de types : `import type { EntryProgress, EntryStatus, LibraryEntry, Visibility, WorkSource, WorkType } from "@/server/domain/entities";`
- (`loadOrCreateEntry` a déjà `progress: null, activityAt: null` depuis Task 1 — ne pas le rajouter.)
- Ajouter la fonction :

```ts
function clampPositive(n: number | null | undefined, max: number | null): number | null {
  if (n === null || n === undefined) return null;
  const v = Math.max(1, Math.floor(n));
  return max && max > 0 ? Math.min(v, max) : v;
}

export async function updateProgress(
  deps: Deps, userId: string, ref: Ref,
  input: { season?: number | null; episode?: number | null; tome?: number | null; page?: number | null },
): Promise<LibraryEntry> {
  for (const v of [input.season, input.episode, input.tome, input.page]) {
    if (v !== null && v !== undefined && (!Number.isInteger(v) || v < 1)) {
      throw new ValidationError("Progression invalide (entier ≥ 1)");
    }
  }
  const work = await getOrImportWork(deps, ref);
  const existing = await deps.entries.findByUserAndWork(userId, work.id);
  const base = existing ?? await loadOrCreateEntry(deps, userId, ref);

  let progress: EntryProgress | null = null;
  if (work.type === "tv") {
    const season = clampPositive(input.season, null) ?? base.progress?.season ?? 1;
    const epMax = work.episodeCounts && work.episodeCounts[season - 1] ? work.episodeCounts[season - 1] : null;
    progress = { season, episode: clampPositive(input.episode, epMax) ?? base.progress?.episode ?? 1, tome: null, page: null };
  } else if (work.type === "book") {
    progress = {
      season: null, episode: null,
      tome: clampPositive(input.tome, null) ?? base.progress?.tome ?? null,
      page: clampPositive(input.page, work.pageCount) ?? base.progress?.page ?? null,
    };
  } // film : progress reste null

  const updated: LibraryEntry = { ...base, status: "in_progress", progress, updatedAt: deps.clock.now() };
  await deps.entries.upsert(updated);
  return updated;
}
```

- [ ] **Step 5: Lancer le test, vérifier le succès**

Run: `npx vitest run tests/application/progress.test.ts`
Expected: PASS.

- [ ] **Step 6: Typecheck + commit**

```bash
node_modules/.bin/tsc --noEmit
git add src/lib/zod-schemas.ts src/server/application/library-entry.ts tests/application/progress.test.ts
git commit -m "feat(vulu): updateProgress (séries/livres/films) + workRefSchema élargi aux livres"
```

---

### Task 6: Application — jalon partageable (shareMilestone)

**Files:**
- Modify: `src/server/application/library-entry.ts`
- Test: `tests/application/progress.test.ts`

**Interfaces:**
- Consumes: `updateProgress` (Task 5), `isFeedVisible`.
- Produces:
  - `shareMilestone(deps, userId, entryId): Promise<LibraryEntry>` — pose `activityAt = now` (ownership requise).
  - (`rateOrReviewWork` pose déjà `activityAt` depuis Task 1 ; `setEntryStatus` accepte `in_progress` via le type.)

- [ ] **Step 1: Écrire le test qui échoue**

Ajouter dans `tests/application/progress.test.ts` :

```ts
import { updateProgress, shareMilestone } from "@/server/application/library-entry";
import { ForbiddenError } from "@/server/domain/errors";

describe("jalons", () => {
  const tv = { source: "tmdb" as const, externalId: "1396", type: "tv" as const };
  it("shareMilestone pose activityAt (l'entrée devient visible dans le feed)", async () => {
    const e = await updateProgress(deps, "u1", tv, { season: 2, episode: 4 });
    expect(e.activityAt).toBeNull();
    const shared = await shareMilestone(deps, "u1", e.id);
    expect(shared.activityAt).not.toBeNull();
  });
  it("shareMilestone refuse un non-propriétaire", async () => {
    const e = await updateProgress(deps, "u1", tv, { season: 1, episode: 1 });
    await expect(shareMilestone(deps, "u2", e.id)).rejects.toThrow(ForbiddenError);
  });
});
```

- [ ] **Step 2: Lancer le test, vérifier l'échec**

Run: `npx vitest run tests/application/progress.test.ts`
Expected: FAIL — `shareMilestone` introuvable.

- [ ] **Step 3: Implémenter**

Dans `src/server/application/library-entry.ts`, ajouter :

```ts
export async function shareMilestone(deps: Deps, userId: string, entryId: string): Promise<LibraryEntry> {
  const entry = await deps.entries.findById(entryId);
  if (!entry) throw new NotFoundError("Entrée introuvable");
  if (entry.userId !== userId) throw new ForbiddenError("Action non autorisée");
  const updated: LibraryEntry = { ...entry, activityAt: deps.clock.now(), updatedAt: deps.clock.now() };
  await deps.entries.upsert(updated);
  return updated;
}
```

- [ ] **Step 4: Lancer les tests, vérifier le succès**

Run: `npx vitest run tests/application/progress.test.ts tests/application/library-entry.test.ts`
Expected: PASS (les tests existants de `library-entry` restent verts).

- [ ] **Step 5: Commit**

```bash
git add src/server/application/library-entry.ts tests/application/progress.test.ts
git commit -m "feat(vulu): shareMilestone — partage de jalon dans le feed"
```

---

### Task 7: Routes API — progress, share, statut élargi

**Files:**
- Create: `src/app/api/works/progress/route.ts`
- Create: `src/app/api/entries/[id]/share/route.ts`
- Modify: `src/lib/zod-schemas.ts` (setStatusSchema)

**Interfaces:**
- Consumes: `updateProgress`, `shareMilestone`, `progressSchema`.
- Produces: `PUT /api/works/progress`, `POST /api/entries/:id/share`. (Les curseurs feed ont été renommés en `activityAt` en Task 4.)

- [ ] **Step 1: setStatusSchema accepte in_progress**

Dans `src/lib/zod-schemas.ts`, remplacer
`export const setStatusSchema = z.object({ ref: workRefSchema, status: z.enum(["planned", "done"]) });`
par
`export const setStatusSchema = z.object({ ref: workRefSchema, status: z.enum(["planned", "in_progress", "done"]) });`

- [ ] **Step 2: Route progress**

Créer `src/app/api/works/progress/route.ts` :

```ts
import { getDeps } from "@/server/container";
import { updateProgress } from "@/server/application/library-entry";
import { progressSchema } from "@/lib/zod-schemas";
import { requireUser, json } from "@/server/http/session";
import { toErrorResponse } from "@/server/http/errors";

export async function PUT(req: Request) {
  try {
    const user = await requireUser();
    const input = progressSchema.parse(await req.json());
    const { ref, ...progress } = input;
    const entry = await updateProgress(await getDeps(), user.id, ref, progress);
    return json({ entry });
  } catch (e) { return toErrorResponse(e); }
}
```

- [ ] **Step 3: Route share**

Créer `src/app/api/entries/[id]/share/route.ts` :

```ts
import { getDeps } from "@/server/container";
import { shareMilestone } from "@/server/application/library-entry";
import { requireUser, json } from "@/server/http/session";
import { toErrorResponse } from "@/server/http/errors";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const entry = await shareMilestone(await getDeps(), user.id, id);
    return json({ entry });
  } catch (e) { return toErrorResponse(e); }
}
```

- [ ] **Step 4: Typecheck + tests + commit**

```bash
node_modules/.bin/tsc --noEmit
npx vitest run
git add src/lib/zod-schemas.ts src/app/api/works/progress/route.ts "src/app/api/entries/[id]/share/route.ts"
git commit -m "feat(vulu): routes API progress + share, statut in_progress accepté"
```

---

### Task 8: Helper d'affichage + feed (verbe & badge de progression)

**Files:**
- Create: `src/lib/progress.ts`
- Modify: `src/server/application/feed.ts` (pick `episodeCounts`/`pageCount` dans `FeedItem.work`)
- Modify: `src/components/FeedCard.tsx`
- Test: `tests/lib/progress.test.ts` (créer)

**Interfaces:**
- Consumes: `EntryProgress`, `Work.episodeCounts/pageCount`.
- Produces:
  - `formatProgress(entry: { progress: EntryProgress | null }, work: { type: WorkType; episodeCounts: number[] | null; pageCount: number | null }): string | null`
  - `activityVerb(status: EntryStatus, type: WorkType): string | null`
  - `FeedItem.work` inclut `episodeCounts` et `pageCount`.

- [ ] **Step 1: Écrire le test qui échoue**

Créer `tests/lib/progress.test.ts` :

```ts
import { describe, it, expect } from "vitest";
import { formatProgress, activityVerb } from "@/lib/progress";

describe("formatProgress", () => {
  it("série avec total connu", () => {
    expect(formatProgress({ progress: { season: 1, episode: 5, tome: null, page: null } },
      { type: "tv", episodeCounts: [7, 13], pageCount: null })).toBe("S1 E5/7");
  });
  it("série sans total", () => {
    expect(formatProgress({ progress: { season: 2, episode: 3, tome: null, page: null } },
      { type: "tv", episodeCounts: null, pageCount: null })).toBe("S2 E3");
  });
  it("livre tome + page avec total", () => {
    expect(formatProgress({ progress: { season: null, episode: null, tome: 3, page: 120 } },
      { type: "book", episodeCounts: null, pageCount: 480 })).toBe("Tome 3 · p.120/480");
  });
  it("null si pas de progression", () => {
    expect(formatProgress({ progress: null }, { type: "movie", episodeCounts: null, pageCount: null })).toBeNull();
  });
});

describe("activityVerb", () => {
  it("in_progress", () => {
    expect(activityVerb("in_progress", "tv")).toBe("regarde");
    expect(activityVerb("in_progress", "book")).toBe("lit");
    expect(activityVerb("done", "tv")).toBeNull();
  });
});
```

- [ ] **Step 2: Lancer le test, vérifier l'échec**

Run: `npx vitest run tests/lib/progress.test.ts`
Expected: FAIL — module `@/lib/progress` introuvable.

- [ ] **Step 3: Implémenter le helper**

Créer `src/lib/progress.ts` :

```ts
import type { EntryProgress, EntryStatus, WorkType } from "@/server/domain/entities";

interface WorkLike { type: WorkType; episodeCounts: number[] | null; pageCount: number | null }

export function formatProgress(entry: { progress: EntryProgress | null }, work: WorkLike): string | null {
  const p = entry.progress;
  if (!p) return null;
  if (work.type === "tv" && p.season && p.episode) {
    const total = work.episodeCounts?.[p.season - 1];
    return `S${p.season} E${p.episode}${total ? `/${total}` : ""}`;
  }
  if (work.type === "book") {
    const parts: string[] = [];
    if (p.tome) parts.push(`Tome ${p.tome}`);
    if (p.page) parts.push(`p.${p.page}${work.pageCount ? `/${work.pageCount}` : ""}`);
    return parts.length ? parts.join(" · ") : null;
  }
  return null;
}

export function activityVerb(status: EntryStatus, type: WorkType): string | null {
  if (status !== "in_progress") return null;
  return type === "book" ? "lit" : "regarde";
}
```

- [ ] **Step 4: Enrichir FeedItem.work**

Dans `src/server/application/feed.ts` :
- Type `FeedItem.work` : remplacer `Pick<Work, "id" | "title" | "year" | "posterUrl" | "type">` par `Pick<Work, "id" | "title" | "year" | "posterUrl" | "type" | "episodeCounts" | "pageCount">`.
- Dans `enrichEntries`, au littéral `work: { ... }`, ajouter `episodeCounts: work.episodeCounts, pageCount: work.pageCount,`.

- [ ] **Step 5: Afficher dans FeedCard**

Dans `src/components/FeedCard.tsx`, importer le helper :

```ts
import { formatProgress, activityVerb } from "@/lib/progress";
```

Puis, là où la note s'affiche (bloc `item.entry.rating !== null`), insérer juste avant un rendu de progression pour les entrées en cours :

```tsx
          {item.entry.status === "in_progress" && (
            <p className="mt-1.5 inline-flex items-center gap-1.5 rounded-full bg-[color-mix(in_srgb,var(--color-primary)_12%,transparent)] px-2.5 py-1 text-xs font-semibold text-[var(--color-primary)]">
              {activityVerb(item.entry.status, item.work.type)}
              {formatProgress(item.entry, item.work) && <span>· {formatProgress(item.entry, item.work)}</span>}
            </p>
          )}
```

- [ ] **Step 6: Lancer le test + typecheck**

Run: `npx vitest run tests/lib/progress.test.ts && node_modules/.bin/tsc --noEmit`
Expected: PASS, tsc 0.

- [ ] **Step 7: Commit**

```bash
git add src/lib/progress.ts src/server/application/feed.ts src/components/FeedCard.tsx tests/lib/progress.test.ts
git commit -m "feat(vulu): badge de progression dans le feed (verbe + S/E ou tome/page)"
```

---

### Task 9: UI EntryEditor — steppers de progression + partage de jalon

**Files:**
- Modify: `src/components/EntryEditor.tsx`
- Modify: `src/app/work/[id]/page.tsx` (passer les totaux à l'éditeur)

**Interfaces:**
- Consumes: `PUT /api/works/progress`, `POST /api/entries/:id/share`, `formatProgress`.
- Produces: aucune nouvelle API.

- [ ] **Step 1: Passer les totaux de l'œuvre à l'éditeur**

Dans `src/app/work/[id]/page.tsx`, à l'usage de `<EntryEditor .../>`, ajouter les props :
`workType={work.type}` `episodeCounts={work.episodeCounts}` `pageCount={work.pageCount}`.

- [ ] **Step 2: Étendre EntryEditor**

Dans `src/components/EntryEditor.tsx` :
- Élargir les props :

```tsx
export function EntryEditor({ workRef, initial, workType, episodeCounts, pageCount }: {
  workRef: Ref; initial: LibraryEntry | null;
  workType: WorkType; episodeCounts: number[] | null; pageCount: number | null;
}) {
```

(importer `WorkType` depuis `@/server/domain/entities`.)

- Ajouter l'état progression :

```tsx
  const [season, setSeason] = useState(initial?.progress?.season ?? 1);
  const [episode, setEpisode] = useState(initial?.progress?.episode ?? 1);
  const [tome, setTome] = useState(initial?.progress?.tome ?? 1);
  const [page, setPage] = useState(initial?.progress?.page ?? 1);
```

- Ajouter le statut `in_progress` au sélecteur de segment (entre « À voir » et « Vu ») :

```tsx
        <button className={seg(status === "in_progress")} onClick={() => setStatus("in_progress")}>En cours</button>
```

(et élargir le type d'état `status` à `"planned" | "in_progress" | "done"`.)

- Ajouter une fonction d'enregistrement de progression :

```tsx
  async function saveProgress(share: boolean) {
    setBusy(true);
    try {
      const body: Record<string, unknown> = { ref: workRef };
      if (workType === "tv") { body.season = season; body.episode = episode; }
      else if (workType === "book") { body.tome = tome; body.page = page; }
      const { entry } = await api.put<{ entry: LibraryEntry }>("/api/works/progress", body);
      setEntryId(entry.id);
      if (share) { await api.post(`/api/entries/${entry.id}/share`); toast("Jalon partagé dans ton feed"); }
      else toast("Progression enregistrée");
      router.refresh();
    } catch (e) { toast(e instanceof ApiError ? e.message : "Erreur", "error"); }
    finally { setBusy(false); }
  }
```

- Afficher le bloc steppers quand `status === "in_progress"` et `workType !== "movie"`. Helper de stepper local :

```tsx
  const Stepper = ({ label, value, set, max }: { label: string; value: number; set: (n: number) => void; max: number | null }) => (
    <div className="flex items-center gap-2">
      <span className="w-16 text-sm text-[var(--color-text-muted)]">{label}</span>
      <button onClick={() => set(Math.max(1, value - 1))} className="h-8 w-8 rounded-full border border-[var(--color-border)]">−</button>
      <span className="min-w-10 text-center text-sm font-semibold">{value}{max ? <span className="text-[var(--color-text-muted)]"> / {max}</span> : null}</span>
      <button onClick={() => set(max ? Math.min(max, value + 1) : value + 1)} className="h-8 w-8 rounded-full border border-[var(--color-border)]">+</button>
    </div>
  );
```

Et le rendu (sous le sélecteur de statut, avant la note) :

```tsx
      {status === "in_progress" && workType === "tv" && (
        <div className="mb-4 flex flex-col gap-2 rounded-xl border border-[var(--color-border)] p-3">
          <Stepper label="Saison" value={season} set={setSeason} max={episodeCounts ? episodeCounts.length : null} />
          <Stepper label="Épisode" value={episode} set={setEpisode} max={episodeCounts?.[season - 1] ?? null} />
          <div className="flex gap-2 pt-1">
            <button onClick={() => saveProgress(false)} disabled={busy} className="rounded-full bg-[var(--color-primary)] px-4 py-1.5 text-sm font-semibold text-white disabled:opacity-50">Enregistrer</button>
            <button onClick={() => saveProgress(true)} disabled={busy} className="rounded-full border border-[var(--color-primary)] px-4 py-1.5 text-sm font-semibold text-[var(--color-primary)]">Partager ce jalon</button>
          </div>
        </div>
      )}
      {status === "in_progress" && workType === "book" && (
        <div className="mb-4 flex flex-col gap-2 rounded-xl border border-[var(--color-border)] p-3">
          <Stepper label="Tome" value={tome} set={setTome} max={null} />
          <Stepper label="Page" value={page} set={setPage} max={pageCount} />
          <div className="flex gap-2 pt-1">
            <button onClick={() => saveProgress(false)} disabled={busy} className="rounded-full bg-[var(--color-primary)] px-4 py-1.5 text-sm font-semibold text-white disabled:opacity-50">Enregistrer</button>
            <button onClick={() => saveProgress(true)} disabled={busy} className="rounded-full border border-[var(--color-primary)] px-4 py-1.5 text-sm font-semibold text-[var(--color-primary)]">Partager ce jalon</button>
          </div>
        </div>
      )}
```

- [ ] **Step 3: Typecheck**

Run: `node_modules/.bin/tsc --noEmit`
Expected: tsc 0.

- [ ] **Step 4: Vérification manuelle (dev)**

Démarrer le serveur si besoin (`MONGODB_URI="mongodb://127.0.0.1:43793/" npm run dev`), se connecter en démo, ouvrir une série (`/work/w-bear`), passer en « En cours », régler S2 E4, « Partager ce jalon », vérifier le toast + l'apparition dans le feed.

- [ ] **Step 5: Commit**

```bash
git add src/components/EntryEditor.tsx src/app/work/[id]/page.tsx
git commit -m "feat(vulu): EntryEditor — steppers saison/épisode et tome/page + partage de jalon"
```

---

### Task 10: UI Profil — section « En cours »

**Files:**
- Create: `src/components/InProgressShelf.tsx`
- Modify: `src/app/u/[username]/page.tsx`

**Interfaces:**
- Consumes: `deps.entries.listByUser(id, { status: "in_progress" })`, `formatProgress`, `PUT /api/works/progress`.
- Produces: composant `InProgressShelf` (client) affiché self-only au-dessus de `ProfileTabs`.

- [ ] **Step 1: Construire les données côté serveur**

Dans `src/app/u/[username]/page.tsx`, à côté de `planned`, charger les œuvres en cours (self-only) et les enrichir avec leur `Work` (titre, poster, type, totaux) + progression. Réutiliser le helper `toPosters` n'est pas adapté (il faut la progression) — construire un tableau dédié :

```tsx
  const inProgress = isSelf
    ? await Promise.all((await deps.entries.listByUser(target.id, { status: "in_progress" })).map(async (e) => {
        const w = await deps.works.findById(e.workId);
        return w ? { entryId: e.id, source: w.source, externalId: w.externalId, title: w.title, posterUrl: w.posterUrl,
          type: w.type, episodeCounts: w.episodeCounts, pageCount: w.pageCount, progress: e.progress } : null;
      })).then((xs) => xs.filter((x): x is NonNullable<typeof x> => x !== null))
    : [];
```

Passer `inProgress={inProgress}` à un nouveau rendu juste avant `<ProfileTabs .../>` :

```tsx
        {isSelf && inProgress.length > 0 && <InProgressShelf items={inProgress} />}
```

(importer `InProgressShelf`.)

- [ ] **Step 2: Créer le composant**

Créer `src/components/InProgressShelf.tsx` :

```tsx
"use client";
import { useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api-client";
import { toast } from "@/lib/toast";
import { formatProgress } from "@/lib/progress";
import type { EntryProgress, WorkSource, WorkType } from "@/server/domain/entities";

interface Item {
  entryId: string; source: WorkSource; externalId: string; title: string; posterUrl: string | null;
  type: WorkType; episodeCounts: number[] | null; pageCount: number | null; progress: EntryProgress | null;
}

export function InProgressShelf({ items }: { items: Item[] }) {
  const [state, setState] = useState(items);
  async function bump(it: Item) {
    const body: Record<string, unknown> = { ref: { source: it.source, externalId: it.externalId, type: it.type } };
    if (it.type === "tv") { body.season = it.progress?.season ?? 1; body.episode = (it.progress?.episode ?? 0) + 1; }
    else if (it.type === "book") { body.page = (it.progress?.page ?? 0) + 1; body.tome = it.progress?.tome ?? null; }
    else return;
    try {
      const { entry } = await api.put<{ entry: { progress: EntryProgress | null } }>("/api/works/progress", body);
      setState((prev) => prev.map((x) => x.entryId === it.entryId ? { ...x, progress: entry.progress } : x));
    } catch { toast("Action impossible", "error"); }
  }
  return (
    <section className="mb-6">
      <h2 className="mb-3 font-display text-lg font-bold">En cours</h2>
      <div className="flex gap-3 overflow-x-auto pb-1">
        {state.map((it) => (
          <div key={it.entryId} className="w-32 shrink-0">
            <Link href={`/work/${it.externalId}`} className="block">
              <div className="aspect-[2/3] overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-2)]"
                style={it.posterUrl ? { backgroundImage: `url(${it.posterUrl})`, backgroundSize: "cover", backgroundPosition: "center" } : undefined} />
              <p className="mt-1.5 line-clamp-1 text-sm font-semibold">{it.title}</p>
            </Link>
            <p className="text-xs text-[var(--color-text-muted)]">{formatProgress(it, it) ?? "Commencé"}</p>
            {it.type !== "movie" && (
              <button onClick={() => bump(it)} className="mt-1 w-full rounded-full border border-[var(--color-primary)] py-1 text-xs font-semibold text-[var(--color-primary)]">
                +1 {it.type === "book" ? "page" : "épisode"}
              </button>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
```

Note : `formatProgress(it, it)` fonctionne car `it` porte `progress` ET `type/episodeCounts/pageCount`.

- [ ] **Step 3: Typecheck + vérif manuelle**

Run: `node_modules/.bin/tsc --noEmit`
Puis ouvrir son propre profil après avoir mis une série en cours → la section « En cours » apparaît avec le bouton « +1 épisode ».

- [ ] **Step 4: Commit**

```bash
git add src/components/InProgressShelf.tsx src/app/u/[username]/page.tsx
git commit -m "feat(vulu): profil — section « En cours » avec reprise +1"
```

---

### Task 11: Seed + vérification end-to-end

**Files:**
- Modify: `scripts/seed-demo.mjs`

**Interfaces:**
- Consumes: tout l'existant. Aucun nouveau type.

- [ ] **Step 1: Mettre à jour les fabriques du seed**

Dans `scripts/seed-demo.mjs` :
- Dans `work(...)`, ajouter au littéral retourné `episodeCounts: type === "tv" ? [7, 13, 10] : null, pageCount: type === "book" ? 480 : null,`.
- Dans `entry(...)`, ajouter `progress: null, activityAt: new Date(now.getTime() - daysAgo * 86400000),` au littéral (les avis existants restent visibles dans le feed).
- Ajouter une fabrique d'entrée en cours, et deux entrées de démo :

```js
const progressEntry = (id, userId, workId, domain, progress, daysAgo, shared) => ({
  _id: id, id, userId, workId, domain, status: "in_progress", rating: null, text: null,
  visibility: "public", communityId: null, progress,
  activityAt: shared ? new Date(now.getTime() - daysAgo * 86400000) : null,
  createdAt: new Date(now.getTime() - daysAgo * 86400000),
  updatedAt: new Date(now.getTime() - daysAgo * 86400000),
});
```

Et dans le tableau des entrées insérées, ajouter :

```js
  progressEntry("e-ip1", "u-bob", "w-bear", "films", { season: 2, episode: 4, tome: null, page: null }, 0, true),
  progressEntry("e-ip2", "u-demo", "w-bear", "films", { season: 1, episode: 3, tome: null, page: null }, 1, false),
```

(`w-bear` est une série ; le seed la crée déjà — vérifier qu'elle a `episodeCounts` non-null via la fabrique modifiée.)

- [ ] **Step 2: Reseed**

Run: `MONGODB_URI="mongodb://127.0.0.1:43793/" node scripts/seed-demo.mjs`
Expected: `SEED_OK`.

- [ ] **Step 3: Vérification end-to-end (API)**

Avec un cookie de session démo (login `demo@vulu.app` / `password1`) :
- `PUT /api/works/progress` `{ ref:{source:"tmdb",externalId:"136315",type:"tv"}, season:1, episode:2 }` → 200, `entry.status === "in_progress"`, `entry.activityAt === null`.
- `POST /api/entries/<id>/share` → 200, `entry.activityAt !== null`.
- `GET /api/feed?scope=foryou` → l'entrée en cours partagée (`e-ip1`) apparaît ; `e-ip2` (non partagée) n'apparaît pas.
- Ouvrir `/u/demo` → section « En cours », cliquer « +1 épisode » → la progression s'incrémente.

- [ ] **Step 4: Suite complète + typecheck**

Run: `node_modules/.bin/tsc --noEmit && npx vitest run`
Expected: tsc 0, tous les tests verts.

- [ ] **Step 5: Commit + ROADMAP**

Mettre à jour `docs/superpowers/ROADMAP.md` (marquer la progression « en cours » comme livrée sous les mécaniques d'habitude), puis :

```bash
git add scripts/seed-demo.mjs docs/superpowers/ROADMAP.md
git commit -m "feat(vulu): seed des entrées « en cours » + roadmap progression livrée"
```

---

## Notes de cohérence (raffinements du spec)

- **`activityAt` est nullable** (le spec disait `Date`) : c'est le mécanisme de visibilité feed.
  `null` = pas dans le feed ; posé par un avis (`rateOrReviewWork`) ou un partage de jalon explicite
  (`shareMilestone`). Les incréments de progression (`updateProgress`) et les simples transitions
  de statut restent **silencieux** — conforme à « chaque MAJ partageable, sans surcharger ».
- **Films « en cours »** : statut seul, `progress: null`, pas de stepper.
- **`workRefSchema` élargi aux livres** (`googlebooks`/`book`) : nécessaire pour la progression livre,
  corrige au passage la notation des livres via l'EntryEditor.
- Le mur d'une œuvre et les tendances (`listByWork`, `listRecentPublic`) gardent `isPublishable`
  (vu + noté) — non impactés par `activityAt`.
- **Différé (YAGNI v1)** : la suggestion « Marquer comme terminé ? » à l'atteinte du dernier
  épisode / de la dernière page (spec §2) n'est pas implémentée dans ce lot — l'utilisateur
  bascule en « Vu » manuellement. À ajouter plus tard si le besoin se confirme.
