# Moteur d'import TV Time → Vulu — Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Construire le moteur d'import TV Time (parser CSV pur + mapping TheTVDB/nom→TMDB + service d'import avec dédup stricte, tout privé) et un CLI de dev pour le valider sur le bac à sable local (données de Margot).

**Architecture:** Ports & Adapters. Un parser pur transforme les CSV en structure normalisée ; deux nouvelles méthodes du port `CatalogProvider` mappent les IDs vers TMDB ; un service applicatif injecté orchestre l'import en réutilisant `getOrImportWork` et `recomputeSeriesEntry` ; un CLI `tsx` câble le tout sur le Mongo local.

**Tech Stack:** TypeScript strict, Node v24, driver `mongodb`, Vitest, `tsx` (nouveau devDep, pour exécuter un script TS avec alias `@/`).

## Global Constraints

- **Dédup stricte, aucun écrasement, le contenu Vulu prime.** Épisode déjà présent → skip (jamais modifié). Film/série « à voir » déjà en biblio → skip total.
- **Import 100 % privé** : toute entrée/épisode créé a `audiences { public:false, circle:false, communityIds:[] }` et `activityAt: null`. Rien dans le feed.
- Notes et commentaires : **hors périmètre** (données absentes/non fiables).
- Mapping : séries via `/find/{tvdbId}?external_source=tvdb_id` → `tv_results[0].id` ; films via `/search/movie?query&year` → `results[0].id`.
- Typage strict, pas de `any` en code de prod (les tests peuvent caster un fake `fetch` via `as unknown as typeof fetch`).
- Pas d'attribution AI dans les commits.
- L'alias `@/` ne résout PAS sous `node` nu (seulement Vitest/Next/tsx). Le CLI est un `.ts` lancé par `tsx`.
- La série n'est traitée « à voir » que si elle n'a AUCUN épisode vu (ni import ni Vulu).

## File Structure

- `src/server/ports/catalog.ts` — **Modifier** : 2 méthodes au port `CatalogProvider`.
- `src/server/adapters/catalog/tmdb-catalog.ts` — **Modifier** : implémenter les 2 méthodes (appels TMDB).
- `src/server/adapters/catalog/composite-catalog.ts` — **Modifier** : déléguer les 2 méthodes à `films`.
- `tests/helpers/fake-catalog.ts` — **Modifier** : implémenter les 2 méthodes (déterministes) + map `tvdbToTmdb`.
- `src/server/import/tvtime-parser.ts` — **Créer** : parser CSV pur + `parseTvTimeExport`.
- `src/server/application/episode-entry.ts` — **Modifier** : exporter `recomputeSeriesEntry`.
- `src/server/application/import-tvtime.ts` — **Créer** : service `importTvTime` + type `ImportReport`.
- `scripts/import-tvtime.ts` — **Créer** : CLI de dev (tsx) contre le Mongo local.
- `package.json` — **Modifier** : devDep `tsx` + script `import:tvtime`.
- Tests : `tests/adapters/tmdb-mapping.test.ts`, `tests/import/tvtime-parser.test.ts`, `tests/application/import-tvtime.test.ts`.

---

### Task 1 : Méthodes de mapping du catalogue (TheTVDB→TMDB, film nom+année)

**Files:**
- Modify: `src/server/ports/catalog.ts`
- Modify: `src/server/adapters/catalog/tmdb-catalog.ts`
- Modify: `src/server/adapters/catalog/composite-catalog.ts`
- Modify: `tests/helpers/fake-catalog.ts`
- Test: `tests/adapters/tmdb-mapping.test.ts`

**Interfaces:**
- Produces :
  - `CatalogProvider.findByTvdbId(tvdbId: string): Promise<{ externalId: string } | null>`
  - `CatalogProvider.findMovieByTitleYear(title: string, year: number | null): Promise<{ externalId: string } | null>`
  - `FakeCatalog.tvdbToTmdb: Record<string,string>` (réglable par les tests)

- [ ] **Step 1 : Écrire le test de l'adapter TMDB**

Créer `tests/adapters/tmdb-mapping.test.ts` :

```ts
import { describe, it, expect } from "vitest";
import { TmdbCatalog } from "@/server/adapters/catalog/tmdb-catalog";

function fakeFetch(bodyFor: (url: string) => unknown): typeof fetch {
  return (async (url: string) => ({
    ok: true,
    json: async () => bodyFor(url),
  })) as unknown as typeof fetch;
}
const cfg = { apiKey: "k", baseUrl: "https://api.themoviedb.org/3", imageBase: "https://img" };

describe("TmdbCatalog mapping", () => {
  it("findByTvdbId renvoie l'id TMDB de la 1re série", async () => {
    const c = new TmdbCatalog(cfg, fakeFetch((u) => u.includes("/find/73762") ? { tv_results: [{ id: 1416 }] } : {}));
    expect(await c.findByTvdbId("73762")).toEqual({ externalId: "1416" });
  });
  it("findByTvdbId renvoie null si aucune série", async () => {
    const c = new TmdbCatalog(cfg, fakeFetch(() => ({ tv_results: [] })));
    expect(await c.findByTvdbId("000")).toBeNull();
  });
  it("findMovieByTitleYear passe le titre et l'année et renvoie le 1er résultat", async () => {
    let seen = "";
    const c = new TmdbCatalog(cfg, fakeFetch((u) => { seen = u; return { results: [{ id: 131631 }] }; }));
    expect(await c.findMovieByTitleYear("Mockingjay", 2014)).toEqual({ externalId: "131631" });
    expect(seen).toContain("/search/movie");
    expect(seen).toContain("year=2014");
  });
  it("findMovieByTitleYear renvoie null si aucun résultat", async () => {
    const c = new TmdbCatalog(cfg, fakeFetch(() => ({ results: [] })));
    expect(await c.findMovieByTitleYear("Zzz", null)).toBeNull();
  });
});
```

- [ ] **Step 2 : Lancer le test (échec attendu)**

Run: `npx vitest run tests/adapters/tmdb-mapping.test.ts`
Expected: FAIL — `findByTvdbId is not a function`.

- [ ] **Step 3 : Ajouter les méthodes au port**

Dans `src/server/ports/catalog.ts`, dans l'interface `CatalogProvider`, après `getPersonCredits(...)` :

```ts
  findByTvdbId(tvdbId: string): Promise<{ externalId: string } | null>;
  findMovieByTitleYear(title: string, year: number | null): Promise<{ externalId: string } | null>;
```

- [ ] **Step 4 : Implémenter dans l'adapter TMDB**

Dans `src/server/adapters/catalog/tmdb-catalog.ts`, ajouter ces méthodes dans la classe `TmdbCatalog` (après `getPersonCredits`) :

```ts
  async findByTvdbId(tvdbId: string): Promise<{ externalId: string } | null> {
    const d = await this.get<{ tv_results?: { id: number }[] }>(`/find/${tvdbId}`, { external_source: "tvdb_id" });
    const id = d.tv_results?.[0]?.id;
    return id ? { externalId: String(id) } : null;
  }
  async findMovieByTitleYear(title: string, year: number | null): Promise<{ externalId: string } | null> {
    const params: Record<string, string> = { query: title };
    if (year) params.year = String(year);
    const d = await this.get<{ results?: { id: number }[] }>("/search/movie", params);
    const id = d.results?.[0]?.id;
    return id ? { externalId: String(id) } : null;
  }
```

- [ ] **Step 5 : Déléguer dans CompositeCatalog**

Dans `src/server/adapters/catalog/composite-catalog.ts`, ajouter dans la classe (après `getPersonCredits`) :

```ts
  findByTvdbId(tvdbId: string): Promise<{ externalId: string } | null> {
    return this.films.findByTvdbId(tvdbId);
  }
  findMovieByTitleYear(title: string, year: number | null): Promise<{ externalId: string } | null> {
    return this.films.findMovieByTitleYear(title, year);
  }
```

- [ ] **Step 6 : Implémenter dans FakeCatalog**

Dans `tests/helpers/fake-catalog.ts`, ajouter la propriété et les méthodes dans la classe `FakeCatalog` (par ex. juste après la déclaration `works: Record<...>`), le champ :

```ts
  tvdbToTmdb: Record<string, string> = {};
```

et les méthodes (n'importe où dans la classe) :

```ts
  async findByTvdbId(tvdbId: string): Promise<{ externalId: string } | null> {
    const id = this.tvdbToTmdb[tvdbId];
    return id ? { externalId: id } : null;
  }
  async findMovieByTitleYear(title: string, year: number | null): Promise<{ externalId: string } | null> {
    const w = Object.values(this.works).find(
      (x) => x.type === "movie" && x.title.toLowerCase() === title.toLowerCase() && (year === null || x.year === year),
    );
    return w ? { externalId: w.externalId } : null;
  }
```

- [ ] **Step 7 : Lancer les tests (succès attendu) + typecheck**

Run: `npx vitest run tests/adapters/tmdb-mapping.test.ts && npx tsc --noEmit`
Expected: 4 tests PASS, aucune erreur de typage (le port est bien implémenté partout).

- [ ] **Step 8 : Commit**

```bash
git add src/server/ports/catalog.ts src/server/adapters/catalog/tmdb-catalog.ts src/server/adapters/catalog/composite-catalog.ts tests/helpers/fake-catalog.ts tests/adapters/tmdb-mapping.test.ts
git commit -m "feat(vulu): mapping catalogue TheTVDB→TMDB et film nom+année"
```

---

### Task 2 : Parser TV Time (pur)

**Files:**
- Create: `src/server/import/tvtime-parser.ts`
- Test: `tests/import/tvtime-parser.test.ts`

**Interfaces:**
- Produces :
  ```ts
  interface TvTimeSeries { tvdbId: string; name: string; followedAt: Date | null; watched: { season: number; episode: number; watchedAt: Date }[]; }
  interface TvTimeMovie { name: string; year: number | null; watchedAt: Date; }
  interface TvTimeExport { series: TvTimeSeries[]; movies: TvTimeMovie[]; }
  interface TvTimeCsvFiles { followedShows: string; trackingV2: string; trackingV1: string; }
  function parseTvTimeExport(files: TvTimeCsvFiles): TvTimeExport;
  ```

- [ ] **Step 1 : Écrire les tests du parser**

Créer `tests/import/tvtime-parser.test.ts` :

```ts
import { describe, it, expect } from "vitest";
import { parseTvTimeExport } from "@/server/import/tvtime-parser";

const followed = [
  "active,diffusion,notification_type,notification_offset,user_id,tv_show_id,created_at,tv_show_name,updated_at,folder_id,archived",
  "1,original,2,1440,7105043,73762,2016-04-30 20:18:17,Grey's Anatomy,2017-05-21 20:32:42,,0",
  "1,original,2,1440,7105043,80000,2020-01-01 10:00:00,To Watch Show,2020-01-01 10:00:00,,0",
].join("\n");

// series_name avec virgule entre guillemets + rewatch dédupliqué + ligne sans épisode
const trackingV2 = [
  "ep_id,ep_no,s_no,runtime,user_id,s_id,gsi,created_at,key,series_follow_count,total_series_runtime,movie_watch_count,total_movies_runtime,updated_at,ep_watch_count,is_archived,uuid,is_followed,most_recent_ep_watched,is_for_later,followed_at,is_unitary,rewatch_count,bulk_type,is_special,movie_name,series_name,season_number,episode_number",
  "1,1,1,40,7105043,73762,k,2018-01-02 20:00:00,watch-episode-1,,,,,,,,,,,,,,,,,,\"Grey's Anatomy, Meredith\",1,1",
  "1,1,1,40,7105043,73762,k,2018-01-01 20:00:00,rewatch-episode-1,,,,,,,,,,,,,,,,,,\"Grey's Anatomy, Meredith\",1,1",
  "2,2,1,40,7105043,73762,k,2018-01-03 20:00:00,watch-episode-2,,,,,,,,,,,,,,,,,,\"Grey's Anatomy, Meredith\",1,2",
  "3,,,,7105043,73762,k,2018-01-04 20:00:00,watch-episode-3,,,,,,,,,,,,,,,,,,\"Grey's Anatomy, Meredith\",,",
].join("\n");

const trackingV1 = [
  "created_at,watch_count,type-uuid-n,user_id,series_id,type,updated_at,uuid,watches,series_uuid,runtime,entity_type,watch_date,episode_number,episode_id,season_number,alpha_range_key,release_date,release_date_range_key,rewatch_count,total_series_runtime,total_movies_runtime,watch_date_range_key,watched_episode_range_key,country,unitarian,bulk_type,movie_name,series_name",
  "2025-05-10 21:50:59,1,x,7105043,,movie,2025-05-10 21:50:59,u,,,7380,movie,,,,,,2014-11-19 00:00:00,,1,,,,,,,,\"The Hunger Games: Mockingjay - Part 1\",",
  "2020-01-01 10:00:00,1,x,7105043,,episode,2020-01-01 10:00:00,u,,,40,episode,,,,,,,,,,,,,,,,,Some Series",
].join("\n");

describe("parseTvTimeExport", () => {
  const out = parseTvTimeExport({ followedShows: followed, trackingV2, trackingV1 });

  it("regroupe les épisodes vus par série, dédupliqués, plus ancienne date", () => {
    const grey = out.series.find((s) => s.tvdbId === "73762")!;
    expect(grey.watched).toHaveLength(2); // (1,1) et (1,2), la ligne sans épisode ignorée
    const e11 = grey.watched.find((w) => w.season === 1 && w.episode === 1)!;
    expect(e11.watchedAt).toEqual(new Date("2018-01-01T20:00:00")); // rewatch antérieur gagne
  });
  it("inclut les séries suivies sans épisode vu (à voir)", () => {
    const toWatch = out.series.find((s) => s.tvdbId === "80000")!;
    expect(toWatch.watched).toHaveLength(0);
    expect(toWatch.name).toBe("To Watch Show");
  });
  it("extrait les films (entity_type=movie) avec année depuis release_date", () => {
    expect(out.movies).toHaveLength(1);
    expect(out.movies[0]).toMatchObject({ name: "The Hunger Games: Mockingjay - Part 1", year: 2014 });
  });
});
```

- [ ] **Step 2 : Lancer les tests (échec attendu)**

Run: `npx vitest run tests/import/tvtime-parser.test.ts`
Expected: FAIL — module introuvable.

- [ ] **Step 3 : Écrire le parser**

Créer `src/server/import/tvtime-parser.ts` :

```ts
export interface TvTimeSeries {
  tvdbId: string;
  name: string;
  followedAt: Date | null;
  watched: { season: number; episode: number; watchedAt: Date }[];
}
export interface TvTimeMovie { name: string; year: number | null; watchedAt: Date; }
export interface TvTimeExport { series: TvTimeSeries[]; movies: TvTimeMovie[]; }
export interface TvTimeCsvFiles { followedShows: string; trackingV2: string; trackingV1: string; }

/** Parseur CSV (RFC 4180 simplifié) : guillemets doubles, virgules et retours ligne dans les champs, "" échappé. */
function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = [];
  let field = "";
  let row: string[] = [];
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i]!;
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; } else inQuotes = false;
      } else field += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\n") { row.push(field); rows.push(row); row = []; field = ""; }
    else if (c === "\r") { /* ignoré */ }
    else field += c;
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  if (!rows.length) return [];
  const header = rows[0]!;
  return rows.slice(1)
    .filter((r) => r.length > 1 || (r.length === 1 && r[0] !== ""))
    .map((r) => Object.fromEntries(header.map((h, idx) => [h, r[idx] ?? ""])));
}

/** "2018-01-01 20:00:00" → Date (heure locale). */
function parseDate(s: string): Date | null {
  const t = s.trim();
  if (!t) return null;
  const d = new Date(t.replace(" ", "T"));
  return Number.isNaN(d.getTime()) ? null : d;
}
function toInt(s: string): number | null {
  const n = Number.parseInt(s, 10);
  return Number.isInteger(n) ? n : null;
}

export function parseTvTimeExport(files: TvTimeCsvFiles): TvTimeExport {
  const seriesById = new Map<string, TvTimeSeries>();
  const get = (tvdbId: string, name: string): TvTimeSeries => {
    let s = seriesById.get(tvdbId);
    if (!s) { s = { tvdbId, name, followedAt: null, watched: [] }; seriesById.set(tvdbId, s); }
    return s;
  };

  // Séries suivies (donne le nom + date de suivi + les « à voir »)
  for (const r of parseCsv(files.followedShows)) {
    const tvdbId = r.tv_show_id?.trim();
    if (!tvdbId) continue;
    const s = get(tvdbId, r.tv_show_name ?? "");
    s.followedAt = parseDate(r.created_at ?? "");
    if (r.tv_show_name) s.name = r.tv_show_name;
  }

  // Épisodes vus (tracking v2), dédupliqués par (saison, épisode), plus ancienne date
  const watchedKey = new Map<string, Map<string, { season: number; episode: number; watchedAt: Date }>>();
  for (const r of parseCsv(files.trackingV2)) {
    const tvdbId = r.s_id?.trim();
    const season = toInt(r.season_number ?? "");
    const episode = toInt(r.episode_number ?? "");
    const watchedAt = parseDate(r.created_at ?? "");
    if (!tvdbId || season === null || episode === null || !watchedAt) continue;
    get(tvdbId, r.series_name ?? "");
    let m = watchedKey.get(tvdbId);
    if (!m) { m = new Map(); watchedKey.set(tvdbId, m); }
    const k = `${season}-${episode}`;
    const prev = m.get(k);
    if (!prev || watchedAt < prev.watchedAt) m.set(k, { season, episode, watchedAt });
  }
  for (const [tvdbId, m] of watchedKey) {
    const s = seriesById.get(tvdbId)!;
    s.watched = [...m.values()].sort((a, b) => a.season - b.season || a.episode - b.episode);
  }

  // Films (tracking v1, entity_type=movie), dédupliqués par (nom, année), plus ancienne date
  const movieKey = new Map<string, TvTimeMovie>();
  for (const r of parseCsv(files.trackingV1)) {
    if ((r.entity_type ?? "").trim() !== "movie") continue;
    const name = (r.movie_name ?? "").trim();
    const watchedAt = parseDate(r.created_at ?? "");
    if (!name || !watchedAt) continue;
    const year = r.release_date ? toInt(r.release_date.slice(0, 4)) : null;
    const k = `${name.toLowerCase()}-${year ?? ""}`;
    const prev = movieKey.get(k);
    if (!prev || watchedAt < prev.watchedAt) movieKey.set(k, { name, year, watchedAt });
  }

  return { series: [...seriesById.values()], movies: [...movieKey.values()] };
}
```

- [ ] **Step 4 : Lancer les tests (succès attendu)**

Run: `npx vitest run tests/import/tvtime-parser.test.ts`
Expected: 3 tests PASS.

- [ ] **Step 5 : Commit**

```bash
git add src/server/import/tvtime-parser.ts tests/import/tvtime-parser.test.ts
git commit -m "feat(vulu): parser d'export TV Time (séries, épisodes vus, films)"
```

---

### Task 3 : Service d'import (dédup stricte, privé)

**Files:**
- Modify: `src/server/application/episode-entry.ts` (exporter `recomputeSeriesEntry`)
- Create: `src/server/application/import-tvtime.ts`
- Test: `tests/application/import-tvtime.test.ts`

**Interfaces:**
- Consumes : `parseTvTimeExport`/types de Task 2 ; `CatalogProvider.findByTvdbId`/`findMovieByTitleYear` de Task 1 ; `getOrImportWork`, `domainOf` (get-work), `loadOrCreateEntry` (library-entry), `recomputeSeriesEntry` (episode-entry).
- Produces :
  ```ts
  interface ImportReport { seriesImported: number; seriesToWatch: number; episodesAdded: number; episodesSkipped: number; moviesImported: number; unmatched: { series: string[]; movies: string[] }; }
  function importTvTime(deps: Deps, userId: string, data: TvTimeExport): Promise<ImportReport>;
  ```

- [ ] **Step 1 : Exporter `recomputeSeriesEntry`**

Dans `src/server/application/episode-entry.ts`, remplacer :

```ts
async function recomputeSeriesEntry(deps: Deps, userId: string, ref: Ref, work: Work): Promise<void> {
```
par :
```ts
export async function recomputeSeriesEntry(deps: Deps, userId: string, ref: Ref, work: Work): Promise<void> {
```

- [ ] **Step 2 : Écrire les tests du service**

Créer `tests/application/import-tvtime.test.ts` :

```ts
import { describe, it, expect, beforeEach } from "vitest";
import { makeInMemoryDeps, type Deps } from "@/server/container";
import { FakeCatalog } from "../helpers/fake-catalog";
import { importTvTime } from "@/server/application/import-tvtime";
import type { TvTimeExport } from "@/server/import/tvtime-parser";
import { updateEpisode } from "@/server/application/episode-entry";

let deps: Deps;
let fake: FakeCatalog;
const USER = "user-1";
beforeEach(() => {
  fake = new FakeCatalog();
  // 1396 = Breaking Bad (tv, episodeCounts [7,13]) ; 603 = The Matrix (movie, 1999)
  fake.tvdbToTmdb["999"] = "1396";
  deps = makeInMemoryDeps(fake);
});

const bbSeries: TvTimeExport = {
  series: [{ tvdbId: "999", name: "Breaking Bad", followedAt: null,
    watched: [ { season: 1, episode: 1, watchedAt: new Date("2020-01-01") },
               { season: 1, episode: 2, watchedAt: new Date("2020-01-02") } ] }],
  movies: [],
};

describe("importTvTime", () => {
  it("crée les épisodes manquants en privé et hors feed", async () => {
    const report = await importTvTime(deps, USER, bbSeries);
    expect(report.episodesAdded).toBe(2);
    expect(report.seriesImported).toBe(1);
    const ep = await deps.episodeEntries.findOne(USER, (await firstWork(deps)).id, 1, 1);
    expect(ep!.watched).toBe(true);
    expect(ep!.audiences).toEqual({ public: false, circle: false, communityIds: [] });
    expect(ep!.activityAt).toBeNull();
  });

  it("ne modifie pas un épisode déjà présent (dédup, Vulu prime)", async () => {
    // Margot a déjà coché S1E1 manuellement
    await updateEpisode(deps, USER, { source: "tmdb", externalId: "1396", type: "tv" }, 1, 1, { watched: true, watchedAt: new Date("2019-06-06") });
    const report = await importTvTime(deps, USER, bbSeries);
    expect(report.episodesSkipped).toBe(1); // S1E1 sauté
    expect(report.episodesAdded).toBe(1);   // S1E2 ajouté
    const ep = await deps.episodeEntries.findOne(USER, (await firstWork(deps)).id, 1, 1);
    expect(ep!.watchedAt).toEqual(new Date("2019-06-06")); // date d'origine conservée
  });

  it("crée une série « à voir » (planned) si aucun épisode vu et pas d'entrée", async () => {
    const report = await importTvTime(deps, USER, { series: [{ tvdbId: "999", name: "Breaking Bad", followedAt: null, watched: [] }], movies: [] });
    expect(report.seriesToWatch).toBe(1);
    const entry = await deps.entries.findByUserAndWork(USER, (await firstWork(deps)).id);
    expect(entry!.status).toBe("planned");
    expect(entry!.audiences.public).toBe(false);
  });

  it("importe un film vu (done) et le saute s'il existe déjà", async () => {
    const data: TvTimeExport = { series: [], movies: [{ name: "The Matrix", year: 1999, watchedAt: new Date("2021-03-03") }] };
    const r1 = await importTvTime(deps, USER, data);
    expect(r1.moviesImported).toBe(1);
    const entry = await deps.entries.findByUserAndWork(USER, (await firstWork(deps)).id);
    expect(entry!.status).toBe("done");
    expect(entry!.completedAt).toEqual(new Date("2021-03-03"));
    const r2 = await importTvTime(deps, USER, data); // 2e passage : skip total
    expect(r2.moviesImported).toBe(0);
  });

  it("liste les non-mappés", async () => {
    const r = await importTvTime(deps, USER, {
      series: [{ tvdbId: "inconnu", name: "Série Inconnue", followedAt: null, watched: [{ season: 1, episode: 1, watchedAt: new Date() }] }],
      movies: [{ name: "Film Inconnu", year: 2000, watchedAt: new Date() }],
    });
    expect(r.unmatched.series).toContain("Série Inconnue");
    expect(r.unmatched.movies).toContain("Film Inconnu");
  });
});

async function firstWork(deps: Deps) {
  const w = await deps.works.findByExternal("tmdb", "1396", "tv") ?? await deps.works.findByExternal("tmdb", "603", "movie");
  return w!;
}
```

- [ ] **Step 3 : Lancer les tests (échec attendu)**

Run: `npx vitest run tests/application/import-tvtime.test.ts`
Expected: FAIL — module `import-tvtime` introuvable.

- [ ] **Step 4 : Écrire le service**

Créer `src/server/application/import-tvtime.ts` :

```ts
import type { Deps } from "@/server/container";
import type { LibraryEntry } from "@/server/domain/entities";
import type { TvTimeExport } from "@/server/import/tvtime-parser";
import { getOrImportWork, domainOf } from "./get-work";
import { loadOrCreateEntry } from "./library-entry";
import { recomputeSeriesEntry } from "./episode-entry";

export interface ImportReport {
  seriesImported: number;
  seriesToWatch: number;
  episodesAdded: number;
  episodesSkipped: number;
  moviesImported: number;
  unmatched: { series: string[]; movies: string[] };
}

const PRIVATE = { public: false, circle: false, communityIds: [] as string[] };

export async function importTvTime(deps: Deps, userId: string, data: TvTimeExport): Promise<ImportReport> {
  const report: ImportReport = {
    seriesImported: 0, seriesToWatch: 0, episodesAdded: 0, episodesSkipped: 0,
    moviesImported: 0, unmatched: { series: [], movies: [] },
  };

  for (const s of data.series) {
    const mapped = await deps.catalog.findByTvdbId(s.tvdbId);
    if (!mapped) { report.unmatched.series.push(s.name); continue; }
    const ref = { source: "tmdb" as const, externalId: mapped.externalId, type: "tv" as const };
    const work = await getOrImportWork(deps, ref);

    if (s.watched.length === 0) {
      const existing = await deps.entries.findByUserAndWork(userId, work.id);
      if (!existing) {
        await deps.entries.upsert(await loadOrCreateEntry(deps, userId, ref)); // planned privé par défaut
        report.seriesToWatch++;
      }
      continue;
    }

    let added = 0;
    for (const w of s.watched) {
      const ex = await deps.episodeEntries.findOne(userId, work.id, w.season, w.episode);
      if (ex) { report.episodesSkipped++; continue; }
      const now = deps.clock.now();
      await deps.episodeEntries.upsert({
        id: deps.ids.next(), userId, workId: work.id, season: w.season, episode: w.episode,
        watched: true, watchedAt: w.watchedAt, rating: null, text: null,
        audiences: { ...PRIVATE }, activityAt: null, createdAt: now, updatedAt: now,
      });
      added++; report.episodesAdded++;
    }
    if (added > 0) { await recomputeSeriesEntry(deps, userId, ref, work); report.seriesImported++; }
  }

  for (const m of data.movies) {
    const mapped = await deps.catalog.findMovieByTitleYear(m.name, m.year);
    if (!mapped) { report.unmatched.movies.push(m.name); continue; }
    const ref = { source: "tmdb" as const, externalId: mapped.externalId, type: "movie" as const };
    const work = await getOrImportWork(deps, ref);
    const existing = await deps.entries.findByUserAndWork(userId, work.id);
    if (existing) continue; // skip total
    const base = await loadOrCreateEntry(deps, userId, ref);
    const now = deps.clock.now();
    const entry: LibraryEntry = {
      ...base, domain: domainOf(work.type), status: "done", completedAt: m.watchedAt,
      audiences: { ...PRIVATE }, activityAt: null, updatedAt: now,
    };
    await deps.entries.upsert(entry);
    report.moviesImported++;
  }

  return report;
}
```

- [ ] **Step 5 : Lancer les tests (succès attendu) + typecheck + suite complète**

Run: `npx vitest run tests/application/import-tvtime.test.ts && npx tsc --noEmit && npm test`
Expected: tous les tests d'import PASS, aucune erreur de type, suite complète verte.

- [ ] **Step 6 : Commit**

```bash
git add src/server/application/episode-entry.ts src/server/application/import-tvtime.ts tests/application/import-tvtime.test.ts
git commit -m "feat(vulu): service d'import TV Time (dédup stricte au niveau épisode, privé)"
```

---

### Task 4 : CLI de dev + validation sur le bac à sable

**Files:**
- Create: `scripts/import-tvtime.ts`
- Modify: `package.json` (devDep `tsx` + script `import:tvtime`)

**Interfaces:**
- Consumes : `parseTvTimeExport` (Task 2), `importTvTime` (Task 3), `getDeps` (container). Mongo local (Task 2 de l'étape 1) doit tourner.

- [ ] **Step 1 : Installer tsx (runner TS avec alias)**

Run: `npm i -D tsx`
Expected: `tsx` ajouté aux devDependencies.

- [ ] **Step 2 : Ajouter le script npm**

Dans `package.json`, bloc `scripts`, après `"clone:margot"` :

```json
    "import:tvtime": "tsx scripts/import-tvtime.ts"
```
(virgule de séparation correcte.)

- [ ] **Step 3 : Écrire le CLI**

Créer `scripts/import-tvtime.ts` :

```ts
// CLI de dev : importe un export TV Time dans le Mongo LOCAL pour l'utilisatrice cible.
// Prérequis : `npm run local-mongo` doit tourner. Usage : npm run import:tvtime <dossier-export>
import { readFileSync } from "node:fs";
import { resolve, join } from "node:path";

const MARGOT_EMAIL = "delettremargot03@gmail.com";

const dir = process.argv[2];
if (!dir) { console.error("Usage: npm run import:tvtime <dossier-export>"); process.exit(1); }

// TMDB_* + JWT_SECRET depuis .env.local ; Mongo forcé sur le bac à sable local.
for (const line of readFileSync(resolve(process.cwd(), ".env.local"), "utf8").split("\n")) {
  const t = line.trim();
  if (!t || t.startsWith("#")) continue;
  const i = t.indexOf("=");
  if (i === -1) continue;
  const k = t.slice(0, i).trim();
  if (!process.env[k]) process.env[k] = t.slice(i + 1).trim();
}
process.env.MONGODB_URI = "mongodb://127.0.0.1:27017";
process.env.MONGODB_DB = "vulu";

const { getDeps } = await import("@/server/container");
const { parseTvTimeExport } = await import("@/server/import/tvtime-parser");
const { importTvTime } = await import("@/server/application/import-tvtime");

const read = (f: string) => readFileSync(join(dir, f), "utf8");
const data = parseTvTimeExport({
  followedShows: read("followed_tv_show.csv"),
  trackingV2: read("tracking-prod-records-v2.csv"),
  trackingV1: read("tracking-prod-records.csv"),
});
console.log(`Parsé : ${data.series.length} séries, ${data.movies.length} films.`);

const deps = await getDeps();
const user = await deps.users.findByEmail(MARGOT_EMAIL);
if (!user) { console.error(`Utilisatrice introuvable en local : ${MARGOT_EMAIL}`); process.exit(1); }

const report = await importTvTime(deps, user.id, data);
console.log(JSON.stringify(report, null, 2));
process.exit(0);
```

- [ ] **Step 4 : Exécuter l'import sur le bac à sable** (local-mongo doit tourner)

Run: `npm run import:tvtime /home/chamberlain/Desktop/gdpr-data-tvtime-margot`
Expected: affiche `Parsé : N séries, M films.` puis l'`ImportReport` JSON. Vu que Margot a déjà tout saisi à la main, on s'attend à `episodesSkipped` élevé et `episodesAdded` faible (dédup effective).

- [ ] **Step 5 : Vérifier l'idempotence**

Run: `npm run import:tvtime /home/chamberlain/Desktop/gdpr-data-tvtime-margot` (2e fois)
Expected: `episodesAdded: 0`, `moviesImported: 0`, `seriesToWatch: 0` (tout est déjà là).

- [ ] **Step 6 : Vérifier l'absence de fuite dans le feed**

Run:
```bash
node --input-type=module -e '
import { MongoClient } from "mongodb";
const c = new MongoClient("mongodb://127.0.0.1:27017"); await c.connect();
const D = c.db("vulu");
const pub = await D.collection("episode_entries").countDocuments({ "audiences.public": true });
const act = await D.collection("episode_entries").countDocuments({ activityAt: { $ne: null } });
console.log("épisodes publics:", pub, "| avec activityAt:", act);
await c.close();'
```
Expected: cohérent avec l'état avant import (l'import n'ajoute aucun épisode public ni aucun `activityAt`).

- [ ] **Step 7 : Commit**

```bash
git add scripts/import-tvtime.ts package.json package-lock.json
git commit -m "chore(vulu): CLI de dev pour l'import TV Time sur le bac à sable local"
```

---

## Self-Review

**Couverture spec :**
- Parser pur (séries, épisodes vus dédupliqués, films nom+année) → Task 2. ✔
- Mapping TheTVDB→TMDB + film nom+année (port + tmdb + composite + fake) → Task 1. ✔
- Export `recomputeSeriesEntry` → Task 3 step 1. ✔
- Service : dédup épisode (skip existant, ajoute manquant), série « à voir », film done + skip total, privacy, non-mappés listés → Task 3 + tests. ✔
- CLI de dev contre le bac à sable → Task 4. ✔
- Import 100 % privé → constante `PRIVATE` + `activityAt:null` + tests de privacy + vérif Mongo Task 4 step 6. ✔
- Notes/commentaires hors périmètre → non implémentés. ✔

**Placeholders :** aucun ; tout le code (parser, service, tests, CLI) est complet.

**Cohérence des types/noms :** `TvTimeExport`/`TvTimeSeries`/`TvTimeMovie`/`TvTimeCsvFiles` identiques entre Task 2 (définition) et Tasks 3–4 (consommation) ; `ImportReport` cohérent entre spec, service et tests ; `findByTvdbId`/`findMovieByTitleYear` mêmes signatures port/tmdb/composite/fake/service ; `recomputeSeriesEntry(deps, userId, ref, work)` cohérent ; `findByExternal(source, externalId, type)` conforme au correctif de dédup œuvres déjà en place ; `loadOrCreateEntry` réutilisé pour garantir le défaut privé/planned.
