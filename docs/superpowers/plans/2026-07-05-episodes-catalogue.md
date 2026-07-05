# Épisodes Incrément 1 : catalogue & cache — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Récupérer et mettre en cache les métadonnées d'épisodes (numéro, titre, date, synopsis) d'une saison de série depuis TMDB, à la demande, exposées par une fonction application testable.

**Architecture:** Ports & adapters, comme le cache des œuvres. Nouveau type domaine `EpisodeSummary`/`SeasonEpisodes`, port `EpisodeCacheRepository` (adaptateurs mémoire + mongo), méthode catalogue `getSeasonEpisodes` (TMDB + composite + stub livres), et fonction `getSeasonEpisodes` avec cache TTL 7 jours + fallback.

**Tech Stack:** Next.js (version custom — lire `node_modules/next/dist/docs/` avant tout code), TypeScript strict (`noUncheckedIndexedAccess`), Vitest, MongoDB, TMDB API.

## Global Constraints

- **Typage strict sans `any`** ; accès indexés sécurisés (`noUncheckedIndexedAccess`).
- **Backend uniquement** : ni route API ni UI (→ incrément 2).
- **TTL cache épisodes** : `7 * 24 * 60 * 60 * 1000` ms (7 jours), copié verbatim.
- **Champs épisode** : `number`, `title`, `airDate` (`"YYYY-MM-DD"` ou null), `overview`. Pas d'image.
- **Granularité** : par saison ; clé de cache `(source, externalId, season)`.
- **Résilience** : sur échec du catalogue, retomber sur un cache périmé s'il existe ; sinon retourner `[]`.
- Tests : `npm test` (vitest run) ; typecheck `npx tsc --noEmit` ; build `npm run build`.

---

### Task 1: Fondations persistance — types, port cache, adaptateurs, câblage

**Files:**
- Modify: `src/server/domain/entities.ts` (ajout types)
- Modify: `src/server/ports/repositories.ts` (port `EpisodeCacheRepository`)
- Modify: `src/server/adapters/memory/index.ts` (`InMemoryEpisodeCache`)
- Modify: `src/server/adapters/mongo/mappers.ts` (mapper `SeasonEpisodes`)
- Modify: `src/server/adapters/mongo/repositories.ts` (`MongoEpisodeCache`)
- Modify: `src/server/container.ts` (`Deps.episodeCache` + 2 câblages + imports)
- Test: `tests/adapters/episode-cache.test.ts`

**Interfaces:**
- Produces:
  - `interface EpisodeSummary { number: number; title: string | null; airDate: string | null; overview: string | null }` (dans `entities.ts`)
  - `interface SeasonEpisodes { source: WorkSource; externalId: string; season: number; episodes: EpisodeSummary[]; cachedAt: Date }` (dans `entities.ts`)
  - `interface EpisodeCacheRepository { find(source: WorkSource, externalId: string, season: number): Promise<SeasonEpisodes | null>; upsert(entry: SeasonEpisodes): Promise<void> }`
  - `Deps.episodeCache: EpisodeCacheRepository`

- [ ] **Step 1: Écrire le test de l'adaptateur mémoire (rouge)**

Créer `tests/adapters/episode-cache.test.ts` :

```ts
import { describe, it, expect } from "vitest";
import { InMemoryEpisodeCache } from "@/server/adapters/memory";
import type { SeasonEpisodes } from "@/server/domain/entities";

const sample: SeasonEpisodes = {
  source: "tmdb", externalId: "1396", season: 1,
  episodes: [{ number: 1, title: "Pilote", airDate: "2008-01-20", overview: "Walter…" }],
  cachedAt: new Date("2026-07-01T00:00:00Z"),
};

describe("InMemoryEpisodeCache", () => {
  it("upsert puis find par (source, externalId, season)", async () => {
    const repo = new InMemoryEpisodeCache();
    expect(await repo.find("tmdb", "1396", 1)).toBeNull();
    await repo.upsert(sample);
    const found = await repo.find("tmdb", "1396", 1);
    expect(found?.episodes[0]?.title).toBe("Pilote");
    expect(await repo.find("tmdb", "1396", 2)).toBeNull();
  });
});
```

- [ ] **Step 2: Lancer le test, vérifier l'échec**

Run: `npm test -- episode-cache`
Expected: FAIL — `InMemoryEpisodeCache` / `SeasonEpisodes` n'existent pas.

- [ ] **Step 3: Ajouter les types domaine**

Dans `src/server/domain/entities.ts`, ajouter (près des autres interfaces d'œuvre) :

```ts
export interface EpisodeSummary {
  number: number;            // numéro d'épisode dans la saison
  title: string | null;      // nom de l'épisode
  airDate: string | null;    // "YYYY-MM-DD" ou null
  overview: string | null;   // synopsis
}

export interface SeasonEpisodes {
  source: WorkSource;
  externalId: string;
  season: number;
  episodes: EpisodeSummary[];
  cachedAt: Date;
}
```

- [ ] **Step 4: Déclarer le port**

Dans `src/server/ports/repositories.ts`, ajouter l'import de `SeasonEpisodes` à la ligne d'import des entités (elle importe déjà `Work`, `WorkSource`, etc. — ajouter `SeasonEpisodes`), puis :

```ts
export interface EpisodeCacheRepository {
  find(source: WorkSource, externalId: string, season: number): Promise<SeasonEpisodes | null>;
  upsert(entry: SeasonEpisodes): Promise<void>;
}
```

- [ ] **Step 5: Implémenter l'adaptateur mémoire**

Dans `src/server/adapters/memory/index.ts` : ajouter `SeasonEpisodes` à l'import des entités et `EpisodeCacheRepository` à l'import des ports, puis ajouter la classe :

```ts
export class InMemoryEpisodeCache implements EpisodeCacheRepository {
  private byKey = new Map<string, SeasonEpisodes>();
  private key(source: WorkSource, externalId: string, season: number) { return `${source}:${externalId}:${season}`; }
  async find(source: WorkSource, externalId: string, season: number) { return this.byKey.get(this.key(source, externalId, season)) ?? null; }
  async upsert(entry: SeasonEpisodes) { this.byKey.set(this.key(entry.source, entry.externalId, entry.season), entry); }
}
```

- [ ] **Step 6: Lancer le test, vérifier le succès**

Run: `npm test -- episode-cache`
Expected: PASS.

- [ ] **Step 7: Mapper Mongo**

Dans `src/server/adapters/mongo/mappers.ts`, ajouter `SeasonEpisodes` à l'import des entités, puis (près des autres mappers) :

```ts
export type WithIdSeasonEpisodes = WithId<SeasonEpisodes>;
export const toSeasonEpisodesDoc = (s: SeasonEpisodes): WithIdSeasonEpisodes => ({ _id: `${s.source}:${s.externalId}:${s.season}`, ...s });
export const fromSeasonEpisodesDoc = (d: WithIdSeasonEpisodes): SeasonEpisodes => strip(d);
```

- [ ] **Step 8: Adaptateur Mongo**

Dans `src/server/adapters/mongo/repositories.ts`, ajouter `EpisodeCacheRepository` à l'import des ports et `SeasonEpisodes`/`WorkSource` déjà importés si besoin, puis la classe :

```ts
export class MongoEpisodeCache implements EpisodeCacheRepository {
  constructor(private db: Db) {}
  private get col() { return this.db.collection<M.WithIdSeasonEpisodes>("episode_cache"); }
  async find(source: WorkSource, externalId: string, season: number) {
    const d = await this.col.findOne({ source, externalId, season });
    return d ? M.fromSeasonEpisodesDoc(d) : null;
  }
  async upsert(entry: SeasonEpisodes) {
    await this.col.replaceOne({ _id: `${entry.source}:${entry.externalId}:${entry.season}` }, M.toSeasonEpisodesDoc(entry), { upsert: true });
  }
}
```

(Vérifier que `SeasonEpisodes` et `WorkSource` sont importés depuis `@/server/domain/entities` en tête de fichier ; les ajouter à l'import existant sinon.)

- [ ] **Step 9: Câbler dans le container**

Dans `src/server/container.ts` :
- ajouter `InMemoryEpisodeCache` à l'import depuis `@/server/adapters/memory` ;
- ajouter `MongoEpisodeCache` à l'import depuis `@/server/adapters/mongo/repositories` ;
- ajouter `EpisodeCacheRepository` à l'import depuis `@/server/ports/repositories` ;
- ajouter le champ à l'interface `Deps` (près de `works`) :
  ```ts
  episodeCache: EpisodeCacheRepository;
  ```
- dans `makeInMemoryDeps`, ajouter (près de `works`) :
  ```ts
  episodeCache: new InMemoryEpisodeCache(),
  ```
- dans `getDeps`, ajouter (près de `works`) :
  ```ts
  episodeCache: new MongoEpisodeCache(db),
  ```

- [ ] **Step 10: Typecheck + build + suite complète**

Run: `npx tsc --noEmit`
Expected: aucune erreur.
Run: `npm test`
Expected: PASS (tout, y compris episode-cache).

- [ ] **Step 11: Commit**

```bash
git add src/server/domain/entities.ts src/server/ports/repositories.ts src/server/adapters/memory/index.ts src/server/adapters/mongo/mappers.ts src/server/adapters/mongo/repositories.ts src/server/container.ts tests/adapters/episode-cache.test.ts
git commit -m "feat(vulu): cache des métadonnées d'épisodes (entité SeasonEpisodes + repository mémoire/mongo)"
```

---

### Task 2: Catalogue — méthode `getSeasonEpisodes` (TMDB, composite, livres, fake)

**Files:**
- Modify: `src/server/ports/catalog.ts` (import `EpisodeSummary` + méthode)
- Modify: `src/server/adapters/catalog/tmdb-catalog.ts` (impl)
- Modify: `src/server/adapters/catalog/composite-catalog.ts` (délégation)
- Modify: `src/server/adapters/catalog/google-books-catalog.ts` (stub `[]`)
- Modify: `tests/helpers/fake-catalog.ts` (impl + compteur)
- Test: `tests/adapters/tmdb-catalog.test.ts` (nouveau cas)

**Interfaces:**
- Consumes: `EpisodeSummary` (Task 1, dans `entities.ts`).
- Produces: `CatalogProvider.getSeasonEpisodes(externalId: string, season: number): Promise<EpisodeSummary[]>` ; `FakeCatalog.seasonCalls: number`.

- [ ] **Step 1: Écrire le test TMDB (rouge)**

Dans `tests/adapters/tmdb-catalog.test.ts`, ajouter ce cas dans le `describe("TmdbCatalog", …)` :

```ts
  it("getSeasonEpisodes mappe numéro, titre, date, synopsis (trié)", async () => {
    const c = new TmdbCatalog(cfg, fakeFetch({
      "/tv/1396/season/1": { episodes: [
        { episode_number: 2, name: "Le Chat dans le sac", air_date: "2008-01-27", overview: "Suite…" },
        { episode_number: 1, name: "Pilote", air_date: "2008-01-20", overview: "Walter…" },
        { episode_number: 3, name: "", air_date: null, overview: "" },
      ] },
    }));
    const eps = await c.getSeasonEpisodes("1396", 1);
    expect(eps.map((e) => e.number)).toEqual([1, 2, 3]);
    expect(eps[0]).toEqual({ number: 1, title: "Pilote", airDate: "2008-01-20", overview: "Walter…" });
    expect(eps[2]).toEqual({ number: 3, title: null, airDate: null, overview: null });
  });
```

- [ ] **Step 2: Lancer, vérifier l'échec**

Run: `npm test -- tmdb-catalog`
Expected: FAIL — `getSeasonEpisodes` n'existe pas sur `TmdbCatalog`.

- [ ] **Step 3: Déclarer le type/méthode du port**

Dans `src/server/ports/catalog.ts` : ajouter `EpisodeSummary` à l'import depuis `@/server/domain/entities` (le fichier importe déjà `Domain, PersonRole, WorkSource, WorkType`), puis ajouter la méthode à l'interface `CatalogProvider` :

```ts
  getSeasonEpisodes(externalId: string, season: number): Promise<EpisodeSummary[]>;
```

- [ ] **Step 4: Implémenter dans TMDB**

Dans `src/server/adapters/catalog/tmdb-catalog.ts` :
- ajouter `EpisodeSummary` à l'import depuis `@/server/ports/catalog` ;
- ajouter le type de réponse près des autres interfaces TMDB :
  ```ts
  interface TmdbSeasonEpisode { episode_number: number; name?: string; air_date?: string | null; overview?: string; }
  ```
- ajouter la méthode dans la classe `TmdbCatalog` :
  ```ts
  async getSeasonEpisodes(externalId: string, season: number): Promise<EpisodeSummary[]> {
    let data: { episodes?: TmdbSeasonEpisode[] };
    try {
      data = await this.get<{ episodes?: TmdbSeasonEpisode[] }>(`/tv/${externalId}/season/${season}`);
    } catch {
      return [];
    }
    return (data.episodes ?? [])
      .map((e) => ({
        number: e.episode_number,
        title: e.name?.trim() ? e.name : null,
        airDate: e.air_date ?? null,
        overview: e.overview?.trim() ? e.overview : null,
      }))
      .sort((a, b) => a.number - b.number);
  }
  ```

- [ ] **Step 5: Lancer, vérifier le succès TMDB**

Run: `npm test -- tmdb-catalog`
Expected: PASS.

- [ ] **Step 6: Déléguer dans le composite + stub livres**

Dans `src/server/adapters/catalog/composite-catalog.ts` :
- ajouter `EpisodeSummary` à l'import depuis `@/server/ports/catalog` ;
- ajouter la méthode :
  ```ts
  getSeasonEpisodes(externalId: string, season: number): Promise<EpisodeSummary[]> {
    return this.films.getSeasonEpisodes(externalId, season);
  }
  ```

Dans `src/server/adapters/catalog/google-books-catalog.ts` :
- ajouter `EpisodeSummary` à l'import depuis `@/server/ports/catalog` ;
- ajouter la méthode :
  ```ts
  async getSeasonEpisodes(): Promise<EpisodeSummary[]> { return []; }
  ```

- [ ] **Step 7: Implémenter dans le FakeCatalog (+ compteur)**

Dans `tests/helpers/fake-catalog.ts` :
- ajouter `EpisodeSummary` à l'import depuis `@/server/ports/catalog` ;
- ajouter un champ compteur dans la classe : `seasonCalls = 0;`
- ajouter la méthode :
  ```ts
  async getSeasonEpisodes(externalId: string, season: number): Promise<EpisodeSummary[]> {
    this.seasonCalls++;
    if (externalId === "1396" && season === 1) {
      return [
        { number: 1, title: "Pilote", airDate: "2008-01-20", overview: "Walter…" },
        { number: 2, title: "Le Chat dans le sac", airDate: "2008-01-27", overview: "Suite…" },
      ];
    }
    return [];
  }
  ```

- [ ] **Step 8: Typecheck + suite complète**

Run: `npx tsc --noEmit`
Expected: aucune erreur (toutes les implémentations de `CatalogProvider` ont la méthode).
Run: `npm test`
Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add src/server/ports/catalog.ts src/server/adapters/catalog/tmdb-catalog.ts src/server/adapters/catalog/composite-catalog.ts src/server/adapters/catalog/google-books-catalog.ts tests/helpers/fake-catalog.ts tests/adapters/tmdb-catalog.test.ts
git commit -m "feat(vulu): catalogue — getSeasonEpisodes (TMDB endpoint saison + délégation composite)"
```

---

### Task 3: Application — `getSeasonEpisodes` avec cache TTL + fallback

**Files:**
- Create: `src/server/application/get-episodes.ts`
- Test: `tests/application/episodes.test.ts`

**Interfaces:**
- Consumes: `Deps.episodeCache` (Task 1) ; `Deps.catalog.getSeasonEpisodes` + `FakeCatalog.seasonCalls` (Task 2) ; `EpisodeSummary` (Task 1).
- Produces: `getSeasonEpisodes(deps: Deps, ref: { source: WorkSource; externalId: string; type: WorkType }, season: number): Promise<EpisodeSummary[]>`.

- [ ] **Step 1: Écrire les tests (rouge)**

Créer `tests/application/episodes.test.ts` :

```ts
import { describe, it, expect, beforeEach } from "vitest";
import { makeInMemoryDeps, type Deps } from "@/server/container";
import { FakeCatalog } from "../helpers/fake-catalog";
import { getSeasonEpisodes } from "@/server/application/get-episodes";

const tv = { source: "tmdb" as const, externalId: "1396", type: "tv" as const };
const book = { source: "googlebooks" as const, externalId: "book-1", type: "book" as const };
let deps: Deps; let catalog: FakeCatalog;
beforeEach(() => { catalog = new FakeCatalog(); deps = makeInMemoryDeps(catalog); });

describe("getSeasonEpisodes", () => {
  it("fetch + mappe la saison au premier appel", async () => {
    const eps = await getSeasonEpisodes(deps, tv, 1);
    expect(eps).toHaveLength(2);
    expect(eps[0]).toEqual({ number: 1, title: "Pilote", airDate: "2008-01-20", overview: "Walter…" });
    expect(catalog.seasonCalls).toBe(1);
  });
  it("sert du cache au deuxième appel (catalogue appelé une seule fois)", async () => {
    await getSeasonEpisodes(deps, tv, 1);
    await getSeasonEpisodes(deps, tv, 1);
    expect(catalog.seasonCalls).toBe(1);
  });
  it("refetch quand le cache est périmé (> 7 jours)", async () => {
    await deps.episodeCache.upsert({ source: "tmdb", externalId: "1396", season: 1, episodes: [], cachedAt: new Date(0) });
    const eps = await getSeasonEpisodes(deps, tv, 1);
    expect(eps).toHaveLength(2);
    expect(catalog.seasonCalls).toBe(1);
  });
  it("retourne [] sans appel catalogue pour un livre ou une saison < 1", async () => {
    expect(await getSeasonEpisodes(deps, book, 1)).toEqual([]);
    expect(await getSeasonEpisodes(deps, tv, 0)).toEqual([]);
    expect(catalog.seasonCalls).toBe(0);
  });
  it("retombe sur le cache périmé si le catalogue échoue", async () => {
    await deps.episodeCache.upsert({
      source: "tmdb", externalId: "1396", season: 1,
      episodes: [{ number: 1, title: "Ancien", airDate: null, overview: null }], cachedAt: new Date(0),
    });
    catalog.getSeasonEpisodes = async () => { throw new Error("TMDB down"); };
    const eps = await getSeasonEpisodes(deps, tv, 1);
    expect(eps[0]?.title).toBe("Ancien");
  });
});
```

- [ ] **Step 2: Lancer, vérifier l'échec**

Run: `npm test -- episodes`
Expected: FAIL — module `get-episodes` inexistant.

- [ ] **Step 3: Implémenter la fonction application**

Créer `src/server/application/get-episodes.ts` :

```ts
import type { Deps } from "@/server/container";
import type { EpisodeSummary, WorkSource, WorkType } from "@/server/domain/entities";

const EPISODE_CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 jours

export async function getSeasonEpisodes(
  deps: Deps,
  ref: { source: WorkSource; externalId: string; type: WorkType },
  season: number,
): Promise<EpisodeSummary[]> {
  if (ref.type !== "tv" || !Number.isInteger(season) || season < 1) return [];

  const cached = await deps.episodeCache.find(ref.source, ref.externalId, season);
  const now = deps.clock.now();
  if (cached && now.getTime() - cached.cachedAt.getTime() < EPISODE_CACHE_TTL_MS) {
    return cached.episodes;
  }

  try {
    const episodes = await deps.catalog.getSeasonEpisodes(ref.externalId, season);
    await deps.episodeCache.upsert({ source: ref.source, externalId: ref.externalId, season, episodes, cachedAt: now });
    return episodes;
  } catch {
    if (cached) return cached.episodes; // fallback sur cache périmé
    return [];
  }
}
```

- [ ] **Step 4: Lancer, vérifier le succès**

Run: `npm test -- episodes`
Expected: PASS (5 cas).

- [ ] **Step 5: Typecheck + suite complète + build**

Run: `npx tsc --noEmit`
Expected: aucune erreur.
Run: `npm test`
Expected: PASS.
Run: `npm run build`
Expected: build réussi.

- [ ] **Step 6: Commit**

```bash
git add src/server/application/get-episodes.ts tests/application/episodes.test.ts
git commit -m "feat(vulu): application getSeasonEpisodes (cache TTL 7j + fallback catalogue)"
```

---

## Self-Review

**Spec coverage :**
- Type `EpisodeSummary` (number/title/airDate/overview) → Task 1 Step 3 ✓
- Méthode port `getSeasonEpisodes` → Task 2 Step 3 ✓
- TMDB endpoint saison + mapping + tri + `[]` sur erreur → Task 2 Step 4 ✓
- Composite délègue à TMDB, Google Books stub → Task 2 Step 6 ✓
- Entité `SeasonEpisodes` + `EpisodeCacheRepository` + adaptateurs mémoire/mongo + collection `episode_cache` → Task 1 ✓
- Câblage `Deps.episodeCache` (mémoire + mongo) → Task 1 Step 9 ✓
- Application `getSeasonEpisodes` cache TTL 7j + type/season invalides → [] + fallback périmé → Task 3 ✓
- Tests : fetch+map, cache (1 appel), périmé→refetch, livre/saison→[], fallback → Task 3 Step 1 ✓
- Hors périmètre (route/UI) → absent du plan ✓

**Placeholder scan :** aucun TBD/TODO ; code complet à chaque étape.

**Type consistency :** `EpisodeSummary`/`SeasonEpisodes` (entities, Task 1) ⇔ port catalogue (Task 2) ⇔ repository (Task 1) ⇔ application (Task 3). Signature `getSeasonEpisodes(externalId, season)` identique côté catalogue (port/TMDB/composite/fake) et `getSeasonEpisodes(deps, ref, season)` côté application. `find(source, externalId, season)` / `upsert(entry)` cohérents mémoire/mongo. `seasonCalls` défini en Task 2, consommé en Task 3. `deps.clock.now()` renvoie un `Date` (usage existant `cachedAt: deps.clock.now()`).
