# Import TV Time — Endpoint + modal de prévisualisation — Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Exposer le moteur d'import via HTTP (preview / commit-job-async / status), stocker les jobs, et brancher une modal qui liste la détection, demande validation, puis affiche la progression et le rapport.

**Architecture:** Ports & Adapters. Nouvel agrégat `ImportJob` (entité + port + adaptateurs Mongo/in-memory). Le service `importTvTime` gagne un callback `onProgress` optionnel ; `runImportJob` le pilote en tâche de fond. Trois routes fines réutilisent des helpers purs (dézip + preview) testables. Une modal client orchestre preview → commit → polling.

**Tech Stack:** Next 16.2.9 (App Router, route handlers), driver `mongodb`, `fflate` (nouveau, dézip en mémoire), Vitest.

## Global Constraints

- **Import 100 % privé** (hérité du moteur) : rien dans le feed.
- **Dédup stricte** (hérité) : jamais d'écrasement.
- `userId` = **utilisateur courant** (`requireUser`), jamais Margot en dur.
- Upload : plafond de taille avant bufferisation (anti-DoS mémoire). Dézip en mémoire, lecture des 3 CSV **par nom** (pas de zip-slip).
- `onProgress` **optionnel** → les tests existants du service restent valides.
- Fire-and-forget : les erreurs du job sont capturées dans le job (`status:"error"`), jamais de rejet non géré.
- Typage strict, pas de `any`. Pas d'attribution AI dans les commits.
- Limite prod (worker durable) **hors périmètre** ; le modèle job le permet plus tard sans changer l'API/UI.

## File Structure

- `src/server/domain/entities.ts` — **Modifier** : types `ImportReport`, `ImportJob`, `ImportJobStatus`.
- `src/server/ports/repositories.ts` — **Modifier** : `ImportJobRepository`.
- `src/server/adapters/mongo/mappers.ts` — **Modifier** : mappers `ImportJob`.
- `src/server/adapters/mongo/repositories.ts` — **Modifier** : `MongoImportJobRepository`.
- `src/server/adapters/memory/index.ts` — **Modifier** : `InMemoryImportJobRepository`.
- `src/server/container.ts` — **Modifier** : `importJobs` dans `Deps` + 2 wirings.
- `src/server/application/import-tvtime.ts` — **Modifier** : `onProgress` + importer `ImportReport` depuis entities + `runImportJob`.
- `src/server/import/tvtime-zip.ts` — **Créer** : dézip + extraction CSV + `buildPreview`.
- `src/server/http/read-upload-body.ts` — **Créer** : lecture body binaire plafonnée.
- `src/app/api/import/tvtime/preview/route.ts` — **Créer** : POST preview.
- `src/app/api/import/tvtime/route.ts` — **Créer** : POST commit (job).
- `src/app/api/import/tvtime/status/route.ts` — **Créer** : GET status.
- `src/components/TvTimeImportModal.tsx` — **Créer** : modal du flux.
- `src/app/parametres/SettingsClient.tsx` — **Modifier** : brancher la sélection de fichier → modal.
- Tests : `tests/adapters/import-job-repo.test.ts`, `tests/application/import-tvtime-job.test.ts`, `tests/import/tvtime-zip.test.ts`.

**Note test harness :** pas de tests de composants React ni de tests d'intégration HTTP (session par cookie). Les routes fines sont couvertes par les helpers purs (dézip/preview/job) + `npx tsc --noEmit` + validation manuelle.

---

### Task 1 : Agrégat ImportJob (entité, port, adaptateurs, wiring)

**Files:**
- Modify: `src/server/domain/entities.ts`
- Modify: `src/server/ports/repositories.ts`
- Modify: `src/server/adapters/mongo/mappers.ts`
- Modify: `src/server/adapters/mongo/repositories.ts`
- Modify: `src/server/adapters/memory/index.ts`
- Modify: `src/server/container.ts`
- Modify: `src/server/application/import-tvtime.ts` (déplacer `ImportReport` vers entities)
- Test: `tests/adapters/import-job-repo.test.ts`

**Interfaces:**
- Produces :
  - `entities.ts` : `ImportReport`, `ImportJobStatus`, `ImportJob`.
  - `ImportJobRepository { create(job): Promise<void>; findById(id): Promise<ImportJob|null>; update(job): Promise<void>; }`
  - `Deps.importJobs: ImportJobRepository`.

- [ ] **Step 1 : Déplacer `ImportReport` et ajouter `ImportJob` dans entities**

Dans `src/server/domain/entities.ts`, ajouter à la fin :

```ts
export interface ImportReport {
  seriesImported: number;
  seriesToWatch: number;
  episodesAdded: number;
  episodesSkipped: number;
  moviesImported: number;
  unmatched: { series: string[]; movies: string[] };
}

export type ImportJobStatus = "pending" | "running" | "done" | "error";
export interface ImportJob {
  id: string;
  userId: string;
  status: ImportJobStatus;
  phase: "series" | "movies";
  done: number;
  total: number;
  report: ImportReport | null;
  error: string | null;
  createdAt: Date;
  updatedAt: Date;
}
```

- [ ] **Step 2 : Faire pointer le service vers le type d'entités**

Dans `src/server/application/import-tvtime.ts`, remplacer la déclaration locale :

```ts
export interface ImportReport {
  seriesImported: number;
  seriesToWatch: number;
  episodesAdded: number;
  episodesSkipped: number;
  moviesImported: number;
  unmatched: { series: string[]; movies: string[] };
}
```
par un ré-export depuis le domaine (les consommateurs existants continuent d'importer `ImportReport` depuis ce module) :
```ts
import type { ImportReport } from "@/server/domain/entities";
export type { ImportReport };
```
Et compléter l'import de types en tête si besoin (garder `LibraryEntry`).

- [ ] **Step 3 : Écrire le test du repo in-memory**

Créer `tests/adapters/import-job-repo.test.ts` :

```ts
import { describe, it, expect } from "vitest";
import { InMemoryImportJobRepository } from "@/server/adapters/memory";
import type { ImportJob } from "@/server/domain/entities";

function job(): ImportJob {
  const now = new Date();
  return { id: "j1", userId: "u1", status: "pending", phase: "series", done: 0, total: 3,
    report: null, error: null, createdAt: now, updatedAt: now };
}

describe("InMemoryImportJobRepository", () => {
  it("crée, relit et met à jour un job", async () => {
    const repo = new InMemoryImportJobRepository();
    await repo.create(job());
    expect((await repo.findById("j1"))!.status).toBe("pending");
    await repo.update({ ...job(), status: "done", done: 3 });
    const j = await repo.findById("j1");
    expect(j!.status).toBe("done");
    expect(j!.done).toBe(3);
  });
  it("renvoie null si absent", async () => {
    expect(await new InMemoryImportJobRepository().findById("x")).toBeNull();
  });
});
```

- [ ] **Step 4 : Lancer le test (échec attendu)**

Run: `npx vitest run tests/adapters/import-job-repo.test.ts`
Expected: FAIL — `InMemoryImportJobRepository` introuvable.

- [ ] **Step 5 : Ajouter le port**

Dans `src/server/ports/repositories.ts` : ajouter `ImportJob` à l'import de types depuis entities (à la ligne d'import existante), puis ajouter l'interface :

```ts
export interface ImportJobRepository {
  create(job: ImportJob): Promise<void>;
  findById(id: string): Promise<ImportJob | null>;
  update(job: ImportJob): Promise<void>;
}
```

- [ ] **Step 6 : Mappers Mongo**

Dans `src/server/adapters/mongo/mappers.ts`, ajouter (à la suite des autres) :

```ts
export type WithIdImportJob = WithId<ImportJob>;
export const toImportJobDoc = (j: ImportJob): WithIdImportJob => ({ _id: j.id, ...j });
export const fromImportJobDoc = (d: WithIdImportJob): ImportJob => { const { _id, ...rest } = d; return { id: _id, ...rest }; };
```
Ajouter `ImportJob` à l'import de types depuis `@/server/domain/entities` en tête du fichier.

- [ ] **Step 7 : Adaptateur Mongo**

Dans `src/server/adapters/mongo/repositories.ts`, ajouter `ImportJob` à l'import d'entités (ligne existante) et `ImportJobRepository` à l'import des ports, puis la classe :

```ts
export class MongoImportJobRepository implements ImportJobRepository {
  constructor(private db: Db) {}
  private get col() { return this.db.collection<M.WithIdImportJob>("import_jobs"); }
  async create(j: ImportJob) { await this.col.insertOne(M.toImportJobDoc(j)); }
  async findById(id: string) { const d = await this.col.findOne({ _id: id }); return d ? M.fromImportJobDoc(d) : null; }
  async update(j: ImportJob) { await this.col.replaceOne({ _id: j.id }, M.toImportJobDoc(j)); }
}
```

- [ ] **Step 8 : Adaptateur in-memory**

Dans `src/server/adapters/memory/index.ts`, ajouter `ImportJob` à l'import d'entités et `ImportJobRepository` à l'import des ports, puis la classe :

```ts
export class InMemoryImportJobRepository implements ImportJobRepository {
  private byId = new Map<string, ImportJob>();
  async create(j: ImportJob) { this.byId.set(j.id, j); }
  async findById(id: string) { return this.byId.get(id) ?? null; }
  async update(j: ImportJob) { this.byId.set(j.id, j); }
}
```

- [ ] **Step 9 : Câbler dans le container**

Dans `src/server/container.ts` :
- Ajouter à l'interface `Deps` : `importJobs: ImportJobRepository;`
- Importer `ImportJobRepository` (ports) + `InMemoryImportJobRepository` (memory) + `MongoImportJobRepository` (mongo).
- Dans `makeInMemoryDeps` : `importJobs: new InMemoryImportJobRepository(),`
- Dans `getDeps` : `importJobs: new MongoImportJobRepository(db),`

- [ ] **Step 10 : Lancer les tests + typecheck**

Run: `npx vitest run tests/adapters/import-job-repo.test.ts && npx tsc --noEmit`
Expected: 2 tests PASS, aucune erreur de type (toutes les fabriques `Deps` fournissent `importJobs`).

- [ ] **Step 11 : Commit**

```bash
git add src/server/domain/entities.ts src/server/ports/repositories.ts src/server/adapters/mongo/mappers.ts src/server/adapters/mongo/repositories.ts src/server/adapters/memory/index.ts src/server/container.ts src/server/application/import-tvtime.ts tests/adapters/import-job-repo.test.ts
git commit -m "feat(vulu): agrégat ImportJob (entité, port, adaptateurs Mongo/in-memory)"
```

---

### Task 2 : Progression du service + traitement de fond

**Files:**
- Modify: `src/server/application/import-tvtime.ts`
- Test: `tests/application/import-tvtime-job.test.ts`

**Interfaces:**
- Consumes : `ImportJobRepository` (Deps), `FakeCatalog` (tests).
- Produces :
  - `type ImportProgress = (p: { phase: "series" | "movies"; done: number; total: number }) => void | Promise<void>;`
  - `importTvTime(deps, userId, data, onProgress?: ImportProgress): Promise<ImportReport>` (param ajouté)
  - `runImportJob(deps: Deps, jobId: string, userId: string, data: TvTimeExport): Promise<void>`

- [ ] **Step 1 : Écrire les tests**

Créer `tests/application/import-tvtime-job.test.ts` :

```ts
import { describe, it, expect, beforeEach } from "vitest";
import { makeInMemoryDeps, type Deps } from "@/server/container";
import { FakeCatalog } from "../helpers/fake-catalog";
import { importTvTime, runImportJob } from "@/server/application/import-tvtime";
import type { TvTimeExport } from "@/server/import/tvtime-parser";
import type { ImportJob } from "@/server/domain/entities";

let deps: Deps;
let fake: FakeCatalog;
const USER = "user-1";
beforeEach(() => {
  fake = new FakeCatalog();
  fake.tvdbToTmdb["999"] = "1396";
  deps = makeInMemoryDeps(fake);
});

const data: TvTimeExport = {
  series: [{ tvdbId: "999", name: "Breaking Bad", followedAt: null,
    watched: [{ season: 1, episode: 1, watchedAt: new Date("2020-01-01") }] }],
  movies: [{ name: "The Matrix", year: 1999, watchedAt: new Date("2021-03-03") }],
};

describe("progression et job", () => {
  it("importTvTime appelle onProgress avec des total corrects", async () => {
    const calls: { phase: string; done: number; total: number }[] = [];
    await importTvTime(deps, USER, data, (p) => { calls.push(p); });
    expect(calls.some((c) => c.phase === "series" && c.total === 1)).toBe(true);
    expect(calls.some((c) => c.phase === "movies" && c.total === 1)).toBe(true);
  });

  it("runImportJob fait passer le job à done avec un rapport", async () => {
    const now = deps.clock.now();
    const job: ImportJob = { id: "j1", userId: USER, status: "pending", phase: "series",
      done: 0, total: 1, report: null, error: null, createdAt: now, updatedAt: now };
    await deps.importJobs.create(job);
    await runImportJob(deps, "j1", USER, data);
    const done = await deps.importJobs.findById("j1");
    expect(done!.status).toBe("done");
    expect(done!.report!.moviesImported).toBe(1);
  });

  it("runImportJob marque error si le job n'existe pas au démarrage", async () => {
    // aucun job créé → le chargement initial échoue → pas de crash non géré
    await expect(runImportJob(deps, "absent", USER, data)).resolves.toBeUndefined();
  });
});
```

- [ ] **Step 2 : Lancer les tests (échec attendu)**

Run: `npx vitest run tests/application/import-tvtime-job.test.ts`
Expected: FAIL — `runImportJob` non exporté / `onProgress` inexistant.

- [ ] **Step 3 : Ajouter `onProgress` au service**

Dans `src/server/application/import-tvtime.ts` :
- Ajouter en tête l'import du type export : `import type { TvTimeExport } from "@/server/import/tvtime-parser";` (déjà présent — sinon l'ajouter) et l'import `Deps`.
- Ajouter le type et le param :

```ts
export type ImportProgress = (p: { phase: "series" | "movies"; done: number; total: number }) => void | Promise<void>;
```
Modifier la signature :
```ts
export async function importTvTime(deps: Deps, userId: string, data: TvTimeExport, onProgress?: ImportProgress): Promise<ImportReport> {
```
À la **fin** de la boucle `for (const s of data.series)` (juste avant sa `}` de fermeture), après le bloc de recompute, ajouter :
```ts
    await onProgress?.({ phase: "series", done: seriesIndex + 1, total: data.series.length });
```
et transformer la boucle en boucle indexée : remplacer `for (const s of data.series) {` par `for (let seriesIndex = 0; seriesIndex < data.series.length; seriesIndex++) { const s = data.series[seriesIndex]!;`
De même pour les films : remplacer `for (const m of data.movies) {` par `for (let movieIndex = 0; movieIndex < data.movies.length; movieIndex++) { const m = data.movies[movieIndex]!;` et, avant la `}` de fermeture de cette boucle, ajouter :
```ts
    await onProgress?.({ phase: "movies", done: movieIndex + 1, total: data.movies.length });
```

- [ ] **Step 4 : Ajouter `runImportJob`**

Toujours dans `src/server/application/import-tvtime.ts`, ajouter en fin de fichier :

```ts
/** Exécute un import en tâche de fond, en reflétant l'avancement dans le job. */
export async function runImportJob(deps: Deps, jobId: string, userId: string, data: TvTimeExport): Promise<void> {
  try {
    const start = await deps.importJobs.findById(jobId);
    if (!start) throw new Error(`Job introuvable: ${jobId}`);
    await deps.importJobs.update({ ...start, status: "running", updatedAt: deps.clock.now() });

    let last = 0;
    const onProgress: ImportProgress = async (p) => {
      if (p.done !== p.total && p.done - last < 5) return; // throttle des écritures Mongo
      last = p.done;
      const cur = await deps.importJobs.findById(jobId);
      if (cur) await deps.importJobs.update({ ...cur, phase: p.phase, done: p.done, total: p.total, updatedAt: deps.clock.now() });
    };

    const report = await importTvTime(deps, userId, data, onProgress);
    const end = await deps.importJobs.findById(jobId);
    if (end) await deps.importJobs.update({ ...end, status: "done", report, updatedAt: deps.clock.now() });
  } catch (e) {
    const cur = await deps.importJobs.findById(jobId);
    if (cur) await deps.importJobs.update({ ...cur, status: "error", error: e instanceof Error ? e.message : String(e), updatedAt: deps.clock.now() });
  }
}
```

- [ ] **Step 5 : Lancer les tests + suite complète + typecheck**

Run: `npx vitest run tests/application/import-tvtime-job.test.ts && npm test && npx tsc --noEmit`
Expected: nouveaux tests PASS, suite complète verte (les tests d'import existants passent sans `onProgress`), typecheck OK.

- [ ] **Step 6 : Commit**

```bash
git add src/server/application/import-tvtime.ts tests/application/import-tvtime-job.test.ts
git commit -m "feat(vulu): progression d'import (onProgress) et exécution en job de fond"
```

---

### Task 3 : Dézip + preview (helpers purs)

**Files:**
- Create: `src/server/import/tvtime-zip.ts`
- Create: `src/server/http/read-upload-body.ts`
- Modify: `package.json` (dep `fflate`)
- Test: `tests/import/tvtime-zip.test.ts`

**Interfaces:**
- Produces :
  - `extractCsvFiles(zip: Uint8Array): TvTimeCsvFiles`
  - `parseZip(zip: Uint8Array): TvTimeExport`
  - `interface ImportPreview { seriesTotal; seriesToWatch; episodesTotal; moviesTotal; seriesNames: string[]; movieNames: string[]; }`
  - `buildPreview(data: TvTimeExport): ImportPreview`
  - `readUploadBody(req: Request, max: number): Promise<Uint8Array>`

- [ ] **Step 1 : Installer fflate**

Run: `npm i fflate`
Expected: `fflate` ajouté aux dependencies.

- [ ] **Step 2 : Écrire les tests**

Créer `tests/import/tvtime-zip.test.ts` :

```ts
import { describe, it, expect } from "vitest";
import { zipSync, strToU8 } from "fflate";
import { parseZip, buildPreview, extractCsvFiles } from "@/server/import/tvtime-zip";

const followed = "active,diffusion,notification_type,notification_offset,user_id,tv_show_id,created_at,tv_show_name,updated_at,folder_id,archived\n1,original,2,1440,7,73762,2016-04-30 20:18:17,Grey's Anatomy,2017-05-21 20:32:42,,0\n1,original,2,1440,7,80000,2020-01-01 10:00:00,To Watch,2020-01-01 10:00:00,,0";
const trackingV2 = "ep_id,ep_no,s_no,runtime,user_id,s_id,gsi,created_at,key,series_follow_count,total_series_runtime,movie_watch_count,total_movies_runtime,updated_at,ep_watch_count,is_archived,uuid,is_followed,most_recent_ep_watched,is_for_later,followed_at,is_unitary,rewatch_count,bulk_type,is_special,movie_name,series_name,season_number,episode_number\n1,1,1,40,7,73762,k,2018-01-02 20:00:00,watch-episode-1,,,,,,,,,,,,,,,,,,Grey,1,1";
const trackingV1 = "created_at,watch_count,type-uuid-n,user_id,series_id,type,updated_at,uuid,watches,series_uuid,runtime,entity_type,watch_date,episode_number,episode_id,season_number,alpha_range_key,release_date,release_date_range_key,rewatch_count,total_series_runtime,total_movies_runtime,watch_date_range_key,watched_episode_range_key,country,unitarian,bulk_type,movie_name,series_name\n2025-05-10 21:50:59,1,x,7,,movie,2025-05-10 21:50:59,u,,,7380,movie,,,,,,2014-11-19 00:00:00,,1,,,,,,,,The Matrix,";

function makeZip(withFolder = false): Uint8Array {
  const p = withFolder ? "gdpr-data/" : "";
  return zipSync({
    [`${p}followed_tv_show.csv`]: strToU8(followed),
    [`${p}tracking-prod-records-v2.csv`]: strToU8(trackingV2),
    [`${p}tracking-prod-records.csv`]: strToU8(trackingV1),
  });
}

describe("tvtime-zip", () => {
  it("extrait les CSV même sous un dossier racine", () => {
    const files = extractCsvFiles(makeZip(true));
    expect(files.followedShows).toContain("Grey's Anatomy");
  });
  it("buildPreview compte séries, à voir, épisodes, films", () => {
    const preview = buildPreview(parseZip(makeZip()));
    expect(preview.seriesTotal).toBe(2);
    expect(preview.seriesToWatch).toBe(1);
    expect(preview.episodesTotal).toBe(1);
    expect(preview.moviesTotal).toBe(1);
    expect(preview.movieNames).toContain("The Matrix");
  });
  it("échoue si un CSV attendu manque", () => {
    const bad = zipSync({ "autre.csv": strToU8("x") });
    expect(() => extractCsvFiles(bad)).toThrow();
  });
});
```

- [ ] **Step 3 : Lancer les tests (échec attendu)**

Run: `npx vitest run tests/import/tvtime-zip.test.ts`
Expected: FAIL — module `tvtime-zip` introuvable.

- [ ] **Step 4 : Écrire `tvtime-zip.ts`**

Créer `src/server/import/tvtime-zip.ts` :

```ts
import { unzipSync, strFromU8 } from "fflate";
import { ValidationError } from "@/server/domain/errors";
import { parseTvTimeExport, type TvTimeExport, type TvTimeCsvFiles } from "./tvtime-parser";

const NEEDED = {
  followedShows: "followed_tv_show.csv",
  trackingV2: "tracking-prod-records-v2.csv",
  trackingV1: "tracking-prod-records.csv",
} as const;

export function extractCsvFiles(zip: Uint8Array): TvTimeCsvFiles {
  const files = unzipSync(zip);
  const names = Object.keys(files);
  const pick = (needle: string): string => {
    const key = names.find((k) => k.endsWith(needle));
    if (!key) throw new ValidationError(`Fichier manquant dans l'archive : ${needle}`);
    return strFromU8(files[key]!);
  };
  return {
    followedShows: pick(NEEDED.followedShows),
    trackingV2: pick(NEEDED.trackingV2),
    trackingV1: pick(NEEDED.trackingV1),
  };
}

export function parseZip(zip: Uint8Array): TvTimeExport {
  return parseTvTimeExport(extractCsvFiles(zip));
}

export interface ImportPreview {
  seriesTotal: number;
  seriesToWatch: number;
  episodesTotal: number;
  moviesTotal: number;
  seriesNames: string[];
  movieNames: string[];
}

export function buildPreview(data: TvTimeExport): ImportPreview {
  return {
    seriesTotal: data.series.length,
    seriesToWatch: data.series.filter((s) => s.watched.length === 0).length,
    episodesTotal: data.series.reduce((n, s) => n + s.watched.length, 0),
    moviesTotal: data.movies.length,
    seriesNames: data.series.map((s) => s.name),
    movieNames: data.movies.map((m) => m.name),
  };
}
```

- [ ] **Step 5 : Écrire `read-upload-body.ts`**

Créer `src/server/http/read-upload-body.ts` :

```ts
import { ValidationError } from "@/server/domain/errors";

/** Plafond par défaut pour l'upload d'un export (octets) — garde anti-DoS mémoire. */
export const UPLOAD_MAX = 30 * 1024 * 1024;

/** Lit le corps binaire d'une requête d'upload, en rejetant si trop lourd (avant/après bufferisation). */
export async function readUploadBody(req: Request, max: number = UPLOAD_MAX): Promise<Uint8Array> {
  const declared = Number(req.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > max) throw new ValidationError("Fichier trop lourd");
  const bytes = new Uint8Array(await req.arrayBuffer());
  if (bytes.length > max) throw new ValidationError("Fichier trop lourd");
  return bytes;
}
```

- [ ] **Step 6 : Lancer les tests + typecheck**

Run: `npx vitest run tests/import/tvtime-zip.test.ts && npx tsc --noEmit`
Expected: 3 tests PASS, typecheck OK.

- [ ] **Step 7 : Commit**

```bash
git add src/server/import/tvtime-zip.ts src/server/http/read-upload-body.ts package.json package-lock.json tests/import/tvtime-zip.test.ts
git commit -m "feat(vulu): dézip en mémoire + preview d'export TV Time (fflate)"
```

---

### Task 4 : Endpoints preview / commit / status

**Files:**
- Create: `src/app/api/import/tvtime/preview/route.ts`
- Create: `src/app/api/import/tvtime/route.ts`
- Create: `src/app/api/import/tvtime/status/route.ts`

**Interfaces:**
- Consumes : `readUploadBody`, `parseZip`, `buildPreview` (Task 3) ; `runImportJob` (Task 2) ; `getDeps`, `requireUser`, `json`, `toErrorResponse`, `NotFoundError`.
- Produces (contrats HTTP) : preview → `ImportPreview` ; commit → `{ jobId: string }` ; status → `{ status, phase, done, total, report, error }`.

- [ ] **Step 1 : Endpoint preview**

Créer `src/app/api/import/tvtime/preview/route.ts` :

```ts
import { parseZip, buildPreview } from "@/server/import/tvtime-zip";
import { readUploadBody } from "@/server/http/read-upload-body";
import { requireUser, json } from "@/server/http/session";
import { toErrorResponse } from "@/server/http/errors";

export async function POST(req: Request) {
  try {
    await requireUser();
    const bytes = await readUploadBody(req);
    return json(buildPreview(parseZip(bytes)));
  } catch (e) { return toErrorResponse(e); }
}
```

- [ ] **Step 2 : Endpoint commit (job)**

Créer `src/app/api/import/tvtime/route.ts` :

```ts
import { getDeps } from "@/server/container";
import { parseZip } from "@/server/import/tvtime-zip";
import { runImportJob } from "@/server/application/import-tvtime";
import { readUploadBody } from "@/server/http/read-upload-body";
import { requireUser, json } from "@/server/http/session";
import { toErrorResponse } from "@/server/http/errors";
import type { ImportJob } from "@/server/domain/entities";

export async function POST(req: Request) {
  try {
    const user = await requireUser();
    const bytes = await readUploadBody(req);
    const data = parseZip(bytes);
    const deps = await getDeps();
    const now = deps.clock.now();
    const job: ImportJob = {
      id: deps.ids.next(), userId: user.id, status: "pending", phase: "series",
      done: 0, total: data.series.length, report: null, error: null, createdAt: now, updatedAt: now,
    };
    await deps.importJobs.create(job);
    // Fire-and-forget : en local (process persistant) l'import va au bout ; les erreurs sont capturées dans le job.
    void runImportJob(deps, job.id, user.id, data).catch(() => {});
    return json({ jobId: job.id });
  } catch (e) { return toErrorResponse(e); }
}
```

- [ ] **Step 3 : Endpoint status**

Créer `src/app/api/import/tvtime/status/route.ts` :

```ts
import { getDeps } from "@/server/container";
import { requireUser, json } from "@/server/http/session";
import { toErrorResponse } from "@/server/http/errors";
import { NotFoundError } from "@/server/domain/errors";

export async function GET(req: Request) {
  try {
    const user = await requireUser();
    const jobId = new URL(req.url).searchParams.get("jobId") ?? "";
    const deps = await getDeps();
    const job = await deps.importJobs.findById(jobId);
    if (!job || job.userId !== user.id) throw new NotFoundError("Job introuvable");
    return json({ status: job.status, phase: job.phase, done: job.done, total: job.total, report: job.report, error: job.error });
  } catch (e) { return toErrorResponse(e); }
}
```

- [ ] **Step 4 : Typecheck**

Run: `npx tsc --noEmit`
Expected: aucune erreur (les 3 routes compilent, contrats cohérents).

- [ ] **Step 5 : Commit**

```bash
git add src/app/api/import/tvtime
git commit -m "feat(vulu): endpoints import TV Time (preview, commit-job, status)"
```

---

### Task 5 : Modal de prévisualisation + câblage UI

**Files:**
- Create: `src/components/TvTimeImportModal.tsx`
- Modify: `src/app/parametres/SettingsClient.tsx`

**Interfaces:**
- Consumes : endpoints Task 4 ; composant `Modal` ; `toast`.
- Produces : composant `TvTimeImportModal` ouvert depuis la section « Import ».

**Sous-skill :** utiliser `frontend-design:frontend-design` pour la modal (aspect production-grade, pas une grille grise).

- [ ] **Step 1 : Créer `TvTimeImportModal.tsx`**

Créer `src/components/TvTimeImportModal.tsx` (le style suit le design system existant : variables `--color-*`, `Modal`, boutons arrondis) :

```tsx
"use client";
import { useEffect, useRef, useState } from "react";
import { Modal } from "@/components/Modal";
import { toast } from "@/lib/toast";
import type { ImportPreview } from "@/server/import/tvtime-zip";
import type { ImportReport } from "@/server/domain/entities";

type Status = { status: "pending" | "running" | "done" | "error"; phase: "series" | "movies"; done: number; total: number; report: ImportReport | null; error: string | null };

export function TvTimeImportModal({ file, preview, onClose }: { file: File; preview: ImportPreview; onClose: () => void }) {
  const [phase, setPhase] = useState<"confirm" | "running" | "done">("confirm");
  const [status, setStatus] = useState<Status | null>(null);
  const poll = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => () => { if (poll.current) clearInterval(poll.current); }, []);

  async function startImport() {
    setPhase("running");
    try {
      const res = await fetch("/api/import/tvtime", { method: "POST", body: file, credentials: "same-origin" });
      const { jobId } = (await res.json()) as { jobId: string };
      if (!res.ok || !jobId) throw new Error();
      poll.current = setInterval(async () => {
        const s = (await (await fetch(`/api/import/tvtime/status?jobId=${jobId}`, { credentials: "same-origin" })).json()) as Status;
        setStatus(s);
        if (s.status === "done" || s.status === "error") {
          if (poll.current) clearInterval(poll.current);
          setPhase("done");
        }
      }, 1500);
    } catch {
      toast("Échec du lancement de l'import", "error");
      setPhase("confirm");
    }
  }

  const pct = status && status.total > 0 ? Math.round((status.done / status.total) * 100) : 0;

  return (
    <Modal open onClose={onClose} title="Importer depuis TV Time">
      {phase === "confirm" && (
        <>
          <p className="text-sm text-[var(--color-text)]">Voici ce qui a été détecté dans ton export :</p>
          <ul className="my-3 grid grid-cols-2 gap-2 text-sm">
            <li className="rounded-xl border border-[var(--color-border)] p-3"><strong>{preview.seriesTotal}</strong> séries<br /><span className="text-xs text-[var(--color-text-muted)]">dont {preview.seriesToWatch} à voir</span></li>
            <li className="rounded-xl border border-[var(--color-border)] p-3"><strong>{preview.episodesTotal}</strong> épisodes vus</li>
            <li className="rounded-xl border border-[var(--color-border)] p-3"><strong>{preview.moviesTotal}</strong> films vus</li>
          </ul>
          <details className="mb-3 text-xs text-[var(--color-text-muted)]">
            <summary className="cursor-pointer">Voir la liste</summary>
            <div className="mt-2 max-h-40 overflow-y-auto">
              {preview.seriesNames.concat(preview.movieNames).join(" · ")}
            </div>
          </details>
          <p className="mb-3 text-xs text-[var(--color-text-muted)]">Rien ne sera partagé : tout reste privé dans ta bibliothèque. Les éléments déjà présents ne seront pas modifiés.</p>
          <div className="flex gap-2">
            <button onClick={startImport} className="flex-1 rounded-full bg-[var(--color-primary)] py-2.5 text-sm font-bold text-white">Importer</button>
            <button onClick={onClose} className="rounded-full border border-[var(--color-border)] px-4 py-2.5 text-sm font-semibold">Annuler</button>
          </div>
        </>
      )}

      {phase === "running" && (
        <>
          <p className="mb-3 text-sm text-[var(--color-text)]">Import en cours… ({status?.phase === "movies" ? "films" : "séries"})</p>
          <div className="h-2 w-full overflow-hidden rounded-full bg-[var(--color-border)]">
            <div className="h-full bg-[var(--color-primary)] transition-all" style={{ width: `${pct}%` }} />
          </div>
          <p className="mt-2 text-xs text-[var(--color-text-muted)]">{status ? `${status.done}/${status.total}` : "Préparation…"}</p>
        </>
      )}

      {phase === "done" && status?.status === "done" && status.report && (
        <>
          <p className="mb-3 text-sm font-semibold">Import terminé ✅</p>
          <ul className="mb-3 space-y-1 text-sm">
            <li>{status.report.seriesImported} séries importées, {status.report.seriesToWatch} ajoutées « à voir »</li>
            <li>{status.report.episodesAdded} épisodes ajoutés, {status.report.episodesSkipped} déjà présents (ignorés)</li>
            <li>{status.report.moviesImported} films importés</li>
          </ul>
          {(status.report.unmatched.series.length > 0 || status.report.unmatched.movies.length > 0) && (
            <details className="mb-3 text-xs text-[var(--color-text-muted)]">
              <summary className="cursor-pointer">{status.report.unmatched.series.length + status.report.unmatched.movies.length} éléments non associés (à ajouter à la main)</summary>
              <div className="mt-2 max-h-40 overflow-y-auto">{status.report.unmatched.series.concat(status.report.unmatched.movies).filter(Boolean).join(" · ")}</div>
            </details>
          )}
          <button onClick={onClose} className="w-full rounded-full bg-[var(--color-primary)] py-2.5 text-sm font-bold text-white">Fermer</button>
        </>
      )}

      {phase === "done" && status?.status === "error" && (
        <>
          <p className="mb-3 text-sm font-semibold text-red-500">L'import a échoué.</p>
          <p className="mb-3 text-xs text-[var(--color-text-muted)]">{status.error}</p>
          <button onClick={onClose} className="w-full rounded-full border border-[var(--color-border)] py-2.5 text-sm font-semibold">Fermer</button>
        </>
      )}
    </Modal>
  );
}
```

- [ ] **Step 2 : Brancher dans `SettingsClient.tsx`**

Dans `src/app/parametres/SettingsClient.tsx` :
- Ajouter l'import : `import { TvTimeImportModal } from "@/components/TvTimeImportModal";` et `import type { ImportPreview } from "@/server/import/tvtime-zip";`
- Ajouter l'état (près de `importFile`) :
```tsx
  const [importPreview, setImportPreview] = useState<ImportPreview | null>(null);
```
- Remplacer la fonction `analyzeImport` par :
```tsx
  async function analyzeImport() {
    if (!importFile) return;
    setBusy(true);
    try {
      const res = await fetch("/api/import/tvtime/preview", { method: "POST", body: importFile, credentials: "same-origin" });
      if (!res.ok) throw new Error();
      setImportPreview((await res.json()) as ImportPreview);
    } catch {
      toast("Fichier illisible : dépose bien l'archive .zip de ton export TV Time", "error");
    } finally { setBusy(false); }
  }
```
- Avant la fermeture `</div>` finale du composant (à côté du `Modal` de suppression), monter la modal :
```tsx
      {importFile && importPreview && (
        <TvTimeImportModal file={importFile} preview={importPreview} onClose={() => { setImportPreview(null); setImportFile(null); }} />
      )}
```

- [ ] **Step 3 : Typecheck**

Run: `npx tsc --noEmit`
Expected: aucune erreur.

- [ ] **Step 4 : Validation manuelle bout-en-bout** (local-mongo actif, données de Margot clonées)

Run: `npm run dev`, puis dans `/parametres` → « Importer mes données » → sélectionner l'export zippé de Margot.
Attendu :
1. La modal s'ouvre en listant la détection (séries / à voir / épisodes / films).
2. « Importer » → barre de progression qui avance (séries puis films).
3. Rapport final : ajoutés / ignorés / non associés.
4. Re-lancer l'import → rapport avec `episodesAdded: 0` (idempotent, rien de dupliqué).
5. Vérifier qu'aucune entrée importée n'est publique / dans le feed.

- [ ] **Step 5 : Commit**

```bash
git add src/components/TvTimeImportModal.tsx src/app/parametres/SettingsClient.tsx
git commit -m "feat(vulu): modal de prévisualisation et suivi d'import TV Time"
```

---

## Self-Review

**Couverture spec :**
- 3 endpoints preview/commit/status → Task 4. ✔
- Job store (entité, port, Mongo + in-memory, Deps) → Task 1. ✔
- `onProgress` + `runImportJob` (fond, throttle) → Task 2. ✔
- Dézip fflate en mémoire + preview + garde de taille → Task 3. ✔
- Modal preview → validation → progression → rapport → Task 5. ✔
- Sécurité (plafond upload, lecture par nom, autorisation du job) → Task 3 (`readUploadBody`, `extractCsvFiles`) + Task 4 (status vérifie `userId`). ✔
- Privé/dédup : hérités du moteur (inchangés). ✔
- Limite prod (worker durable) : documentée, hors périmètre. ✔

**Placeholders :** aucun ; tout le code est fourni.

**Cohérence des types/noms :** `ImportReport`/`ImportJob`/`ImportJobStatus` définis en entities (Task 1) et consommés partout ; `ImportPreview`/`buildPreview`/`parseZip`/`extractCsvFiles` cohérents entre Task 3, Task 4 et Task 5 ; `runImportJob(deps, jobId, userId, data)` et `importTvTime(..., onProgress?)` cohérents entre Task 2, Task 4 ; `ImportJobRepository.create/findById/update` identique entre port, adaptateurs et `runImportJob` ; contrat status `{ status, phase, done, total, report, error }` identique entre endpoint (Task 4) et type `Status` de la modal (Task 5).
