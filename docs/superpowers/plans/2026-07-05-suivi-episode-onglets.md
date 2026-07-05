# Épisodes Incrément 2a : suivi par épisode + page en onglets — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cocher (vu), noter, commenter et dater chaque épisode d'une série via une page série en onglets (Aperçu / Épisodes), en personnel.

**Architecture:** Nouvelle entité `EpisodeEntry` + repository (mémoire/mongo). Application `updateEpisode` qui recalcule la progression de la `LibraryEntry` parente depuis les épisodes vus (réutilise `normalizeGrid`/`derivePosition`). Routes GET saison / PUT épisode. Page série refactorée en onglets client (`SeriesTabs` + `EpisodesTab`), grille retirée de `EntryEditor`.

**Tech Stack:** Next.js (version custom — lire `node_modules/next/dist/docs/` avant tout code), React, TypeScript strict (`noUncheckedIndexedAccess`), Vitest, MongoDB, Zod.

## Global Constraints

- **Typage strict sans `any`** ; accès indexés sécurisés.
- **Personnel uniquement** : ni audiences, ni feed (→ 2b).
- **Note** : 0–5 par pas de 0,1 (validation `isValidRating` existante).
- **Date de visionnage** : auto (`clock.now()`) à la coche si non fournie ; éditable ; `null` à la décoche.
- **Source unique du « vu »** : `EpisodeEntry` ; `LibraryEntry.progress.watchedEpisodes`/`season`/`episode` sont **dérivés**.
- `json()` sérialise les `Date` en ISO automatiquement (pas de sérialisation manuelle).
- Tests : `npm test` ; typecheck `npx tsc --noEmit` ; build `npm run build`.

---

### Task 1: Modèle `EpisodeEntry` + repository (mémoire/mongo) + câblage

**Files:**
- Modify: `src/server/domain/entities.ts`
- Modify: `src/server/ports/repositories.ts`
- Modify: `src/server/adapters/memory/index.ts`
- Modify: `src/server/adapters/mongo/mappers.ts`
- Modify: `src/server/adapters/mongo/repositories.ts`
- Modify: `src/server/container.ts`
- Test: `tests/adapters/episode-entry.test.ts`

**Interfaces:**
- Produces:
  - `interface EpisodeEntry { id: string; userId: string; workId: string; season: number; episode: number; watched: boolean; watchedAt: Date | null; rating: number | null; text: string | null; createdAt: Date; updatedAt: Date }`
  - `interface EpisodeEntryRepository { upsert(entry: EpisodeEntry): Promise<void>; findOne(userId: string, workId: string, season: number, episode: number): Promise<EpisodeEntry | null>; listByUserAndWork(userId: string, workId: string): Promise<EpisodeEntry[]> }`
  - `Deps.episodeEntries: EpisodeEntryRepository`

- [ ] **Step 1: Écrire le test du repository mémoire (rouge)**

Créer `tests/adapters/episode-entry.test.ts` :

```ts
import { describe, it, expect } from "vitest";
import { InMemoryEpisodeEntryRepository } from "@/server/adapters/memory";
import type { EpisodeEntry } from "@/server/domain/entities";

const mk = (season: number, episode: number): EpisodeEntry => ({
  id: `${season}-${episode}`, userId: "u1", workId: "w1", season, episode,
  watched: true, watchedAt: new Date("2026-07-01T00:00:00Z"), rating: 4, text: "top",
  createdAt: new Date(0), updatedAt: new Date(0),
});

describe("InMemoryEpisodeEntryRepository", () => {
  it("upsert / findOne / listByUserAndWork", async () => {
    const repo = new InMemoryEpisodeEntryRepository();
    expect(await repo.findOne("u1", "w1", 1, 1)).toBeNull();
    await repo.upsert(mk(1, 1));
    await repo.upsert(mk(1, 2));
    expect((await repo.findOne("u1", "w1", 1, 2))?.rating).toBe(4);
    expect(await repo.listByUserAndWork("u1", "w1")).toHaveLength(2);
    expect(await repo.listByUserAndWork("u2", "w1")).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Lancer, vérifier l'échec**

Run: `npm test -- episode-entry`
Expected: FAIL — `InMemoryEpisodeEntryRepository` / `EpisodeEntry` inexistants.

- [ ] **Step 3: Type domaine**

Dans `src/server/domain/entities.ts`, ajouter (après `SeasonEpisodes`) :

```ts
export interface EpisodeEntry {
  id: string;
  userId: string;
  workId: string;
  season: number;
  episode: number;
  watched: boolean;
  watchedAt: Date | null;
  rating: number | null;   // 0–5, pas de 0,1
  text: string | null;
  createdAt: Date;
  updatedAt: Date;
}
```

- [ ] **Step 4: Port**

Dans `src/server/ports/repositories.ts` : ajouter `EpisodeEntry` à l'import des entités, puis :

```ts
export interface EpisodeEntryRepository {
  upsert(entry: EpisodeEntry): Promise<void>;
  findOne(userId: string, workId: string, season: number, episode: number): Promise<EpisodeEntry | null>;
  listByUserAndWork(userId: string, workId: string): Promise<EpisodeEntry[]>;
}
```

- [ ] **Step 5: Adaptateur mémoire**

Dans `src/server/adapters/memory/index.ts` : ajouter `EpisodeEntry` à l'import des entités et `EpisodeEntryRepository` à l'import des ports, puis :

```ts
export class InMemoryEpisodeEntryRepository implements EpisodeEntryRepository {
  private byId = new Map<string, EpisodeEntry>();
  async upsert(e: EpisodeEntry) { this.byId.set(e.id, e); }
  async findOne(userId: string, workId: string, season: number, episode: number) {
    return [...this.byId.values()].find((e) => e.userId === userId && e.workId === workId && e.season === season && e.episode === episode) ?? null;
  }
  async listByUserAndWork(userId: string, workId: string) {
    return [...this.byId.values()].filter((e) => e.userId === userId && e.workId === workId);
  }
}
```

- [ ] **Step 6: Lancer, vérifier le succès mémoire**

Run: `npm test -- episode-entry`
Expected: PASS.

- [ ] **Step 7: Mapper Mongo**

Dans `src/server/adapters/mongo/mappers.ts` : ajouter `EpisodeEntry` à l'import des entités, puis :

```ts
export type WithIdEpisodeEntry = WithId<EpisodeEntry>;
export const toEpisodeEntryDoc = (e: EpisodeEntry): WithIdEpisodeEntry => ({ _id: e.id, ...e });
export const fromEpisodeEntryDoc = (d: WithIdEpisodeEntry): EpisodeEntry => strip(d);
```

- [ ] **Step 8: Adaptateur Mongo**

Dans `src/server/adapters/mongo/repositories.ts` : ajouter `EpisodeEntryRepository` à l'import des ports et `EpisodeEntry` à l'import des entités, puis :

```ts
export class MongoEpisodeEntryRepository implements EpisodeEntryRepository {
  constructor(private db: Db) {}
  private get col() { return this.db.collection<M.WithIdEpisodeEntry>("episode_entries"); }
  async upsert(e: EpisodeEntry) { await this.col.replaceOne({ _id: e.id }, M.toEpisodeEntryDoc(e), { upsert: true }); }
  async findOne(userId: string, workId: string, season: number, episode: number) {
    const d = await this.col.findOne({ userId, workId, season, episode });
    return d ? M.fromEpisodeEntryDoc(d) : null;
  }
  async listByUserAndWork(userId: string, workId: string) {
    return (await this.col.find({ userId, workId }).toArray()).map(M.fromEpisodeEntryDoc);
  }
}
```

- [ ] **Step 9: Câblage container**

Dans `src/server/container.ts` :
- ajouter `InMemoryEpisodeEntryRepository` à l'import mémoire ;
- ajouter `MongoEpisodeEntryRepository` à l'import mongo ;
- ajouter `EpisodeEntryRepository` à l'import des ports ;
- interface `Deps` (après `episodeCache`) : `episodeEntries: EpisodeEntryRepository;`
- `makeInMemoryDeps` (après `episodeCache`) : `episodeEntries: new InMemoryEpisodeEntryRepository(),`
- `getDeps` (après `episodeCache`) : `episodeEntries: new MongoEpisodeEntryRepository(db),`

- [ ] **Step 10: Typecheck + suite complète**

Run: `npx tsc --noEmit`
Expected: aucune erreur.
Run: `npm test`
Expected: PASS.

- [ ] **Step 11: Commit**

```bash
git add src/server/domain/entities.ts src/server/ports/repositories.ts src/server/adapters/memory/index.ts src/server/adapters/mongo/mappers.ts src/server/adapters/mongo/repositories.ts src/server/container.ts tests/adapters/episode-entry.test.ts
git commit -m "feat(vulu): entité EpisodeEntry + repository (mémoire/mongo)"
```

---

### Task 2: Application `updateEpisode` + `getEpisodeEntries`

**Files:**
- Modify: `src/server/application/library-entry.ts` (exporter helpers)
- Create: `src/server/application/episode-entry.ts`
- Test: `tests/application/episode-entry.test.ts`

**Interfaces:**
- Consumes: `Deps.episodeEntries`, `Deps.entries`, `getOrImportWork`, `EpisodeEntry` (Task 1).
- Produces:
  - `updateEpisode(deps: Deps, userId: string, ref: { source: WorkSource; externalId: string; type: WorkType }, season: number, episode: number, input: { watched?: boolean; watchedAt?: Date | null; rating?: number | null; text?: string | null }): Promise<EpisodeEntry>`
  - `getEpisodeEntries(deps: Deps, userId: string, workId: string): Promise<EpisodeEntry[]>`

- [ ] **Step 1: Écrire les tests (rouge)**

Créer `tests/application/episode-entry.test.ts` :

```ts
import { describe, it, expect, beforeEach } from "vitest";
import { makeInMemoryDeps, type Deps } from "@/server/container";
import { FakeCatalog } from "../helpers/fake-catalog";
import { updateEpisode, getEpisodeEntries } from "@/server/application/episode-entry";
import { ValidationError } from "@/server/domain/errors";

const tv = { source: "tmdb" as const, externalId: "1396", type: "tv" as const };
let deps: Deps;
beforeEach(() => { deps = makeInMemoryDeps(new FakeCatalog()); });

async function workId() {
  const { getOrImportWork } = await import("@/server/application/get-work");
  return (await getOrImportWork(deps, tv)).id;
}

describe("updateEpisode", () => {
  it("coche vu → watchedAt auto, LibraryEntry in_progress, progress dérivé", async () => {
    const e = await updateEpisode(deps, "u1", tv, 1, 3, { watched: true });
    expect(e.watched).toBe(true);
    expect(e.watchedAt).not.toBeNull();
    const lib = await deps.entries.findByUserAndWork("u1", await workId());
    expect(lib?.status).toBe("in_progress");
    expect(lib?.progress?.watchedEpisodes).toEqual([[3]]);
    expect(lib?.progress?.season).toBe(1);
    expect(lib?.progress?.episode).toBe(3);
  });
  it("décoche → watchedAt null, grille recalculée", async () => {
    await updateEpisode(deps, "u1", tv, 1, 3, { watched: true });
    const e = await updateEpisode(deps, "u1", tv, 1, 3, { watched: false });
    expect(e.watchedAt).toBeNull();
    const lib = await deps.entries.findByUserAndWork("u1", await workId());
    expect(lib?.progress?.watchedEpisodes).toBeNull();
  });
  it("watchedAt fourni respecté", async () => {
    const d = new Date("2008-01-20T00:00:00Z");
    const e = await updateEpisode(deps, "u1", tv, 1, 1, { watched: true, watchedAt: d });
    expect(e.watchedAt?.toISOString()).toBe(d.toISOString());
  });
  it("note et commentaire persistés, autres champs inchangés", async () => {
    await updateEpisode(deps, "u1", tv, 1, 1, { watched: true });
    const e = await updateEpisode(deps, "u1", tv, 1, 1, { rating: 4.5, text: "  génial  " });
    expect(e.rating).toBe(4.5);
    expect(e.text).toBe("génial");
    expect(e.watched).toBe(true); // inchangé
  });
  it("rejette saison/épisode < 1 et note invalide", async () => {
    await expect(updateEpisode(deps, "u1", tv, 0, 1, { watched: true })).rejects.toThrow(ValidationError);
    await expect(updateEpisode(deps, "u1", tv, 1, 1, { rating: 4.05 })).rejects.toThrow(ValidationError);
  });
  it("getEpisodeEntries renvoie les entrées de l'utilisateur", async () => {
    await updateEpisode(deps, "u1", tv, 1, 1, { watched: true });
    await updateEpisode(deps, "u1", tv, 1, 2, { watched: true });
    expect(await getEpisodeEntries(deps, "u1", await workId())).toHaveLength(2);
  });
});
```

- [ ] **Step 2: Lancer, vérifier l'échec**

Run: `npm test -- application/episode-entry`
Expected: FAIL — module `episode-entry` inexistant.

- [ ] **Step 3: Exporter les helpers de `library-entry.ts`**

Dans `src/server/application/library-entry.ts`, préfixer par `export` les déclarations existantes suivantes :
- `function isValidRating` → `export function isValidRating`
- `async function loadOrCreateEntry` → `export async function loadOrCreateEntry`
- `function normalizeGrid` → `export function normalizeGrid`
- `function derivePosition` → `export function derivePosition`

- [ ] **Step 4: Implémenter l'application**

Créer `src/server/application/episode-entry.ts` :

```ts
import type { Deps } from "@/server/container";
import type { EpisodeEntry, LibraryEntry, WorkSource, WorkType } from "@/server/domain/entities";
import { ValidationError } from "@/server/domain/errors";
import { getOrImportWork } from "./get-work";
import { loadOrCreateEntry, normalizeGrid, derivePosition, isValidRating } from "./library-entry";

type Ref = { source: WorkSource; externalId: string; type: WorkType };

export async function updateEpisode(
  deps: Deps, userId: string, ref: Ref, season: number, episode: number,
  input: { watched?: boolean; watchedAt?: Date | null; rating?: number | null; text?: string | null },
): Promise<EpisodeEntry> {
  if (!Number.isInteger(season) || season < 1 || !Number.isInteger(episode) || episode < 1) {
    throw new ValidationError("Saison/épisode invalide");
  }
  if (input.rating !== undefined && input.rating !== null && !isValidRating(input.rating)) {
    throw new ValidationError("Note invalide (0 à 5, par pas de 0,1)");
  }
  const work = await getOrImportWork(deps, ref);
  const now = deps.clock.now();
  const existing = await deps.episodeEntries.findOne(userId, work.id, season, episode);
  const base: EpisodeEntry = existing ?? {
    id: deps.ids.next(), userId, workId: work.id, season, episode,
    watched: false, watchedAt: null, rating: null, text: null, createdAt: now, updatedAt: now,
  };
  const next: EpisodeEntry = { ...base, updatedAt: now };
  if (input.watched !== undefined) {
    next.watched = input.watched;
    next.watchedAt = input.watched
      ? (input.watchedAt !== undefined ? input.watchedAt : (base.watchedAt ?? now))
      : null;
  } else if (input.watchedAt !== undefined) {
    next.watchedAt = input.watchedAt;
  }
  if (input.rating !== undefined) next.rating = input.rating;
  if (input.text !== undefined) next.text = input.text?.trim() ? input.text.trim() : null;
  await deps.episodeEntries.upsert(next);

  // Recalcule la progression de la LibraryEntry parente depuis les épisodes vus.
  const libEntry = await loadOrCreateEntry(deps, userId, ref);
  const all = await deps.episodeEntries.listByUserAndWork(userId, work.id);
  const grid: number[][] = [];
  for (const e of all) {
    if (!e.watched) continue;
    const idx = e.season - 1;
    while (grid.length <= idx) grid.push([]);
    grid[idx]!.push(e.episode);
  }
  const norm = normalizeGrid(grid, work.episodeCounts);
  const pos = derivePosition(norm);
  const hasAny = norm.some((s) => s.length);
  const updatedLib: LibraryEntry = {
    ...libEntry,
    status: libEntry.status === "planned" ? "in_progress" : libEntry.status,
    progress: { season: pos.season, episode: pos.episode, tome: null, page: null, watchedEpisodes: hasAny ? norm : null },
    updatedAt: now,
  };
  await deps.entries.upsert(updatedLib);
  return next;
}

export async function getEpisodeEntries(deps: Deps, userId: string, workId: string): Promise<EpisodeEntry[]> {
  return deps.episodeEntries.listByUserAndWork(userId, workId);
}
```

- [ ] **Step 5: Lancer, vérifier le succès**

Run: `npm test -- application/episode-entry`
Expected: PASS (6 cas).

- [ ] **Step 6: Typecheck + suite complète**

Run: `npx tsc --noEmit`
Expected: aucune erreur.
Run: `npm test`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/server/application/library-entry.ts src/server/application/episode-entry.ts tests/application/episode-entry.test.ts
git commit -m "feat(vulu): updateEpisode/getEpisodeEntries (suivi par épisode + dérivation progression)"
```

---

### Task 3: API — GET saison + PUT épisode

**Files:**
- Modify: `src/lib/zod-schemas.ts`
- Create: `src/app/api/works/[id]/seasons/[season]/route.ts`
- Create: `src/app/api/works/[id]/episodes/route.ts`

**Interfaces:**
- Consumes: `getSeasonEpisodes` (incr. 1), `updateEpisode`/`getEpisodeEntries` (Task 2).
- Produces: `episodeUpdateSchema` ; endpoints `GET /api/works/[id]/seasons/[season]`, `PUT /api/works/[id]/episodes`.

- [ ] **Step 1: Schéma Zod**

Dans `src/lib/zod-schemas.ts`, ajouter :

```ts
export const episodeUpdateSchema = z.object({
  season: z.number().int().min(1),
  episode: z.number().int().min(1),
  watched: z.boolean().optional(),
  watchedAt: z.string().datetime().nullable().optional(),
  rating: z.number().min(0).max(5).nullable().optional(),
  text: z.string().max(1000).nullable().optional(),
});
```

- [ ] **Step 2: Route GET saison**

Créer `src/app/api/works/[id]/seasons/[season]/route.ts` :

```ts
import { getDeps } from "@/server/container";
import { getSeasonEpisodes } from "@/server/application/get-episodes";
import { getEpisodeEntries } from "@/server/application/episode-entry";
import { requireUser, json } from "@/server/http/session";
import { toErrorResponse } from "@/server/http/errors";
import { NotFoundError } from "@/server/domain/errors";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string; season: string }> }) {
  try {
    const user = await requireUser();
    const { id, season } = await params;
    const deps = await getDeps();
    const work = await deps.works.findById(id);
    if (!work || work.type !== "tv") throw new NotFoundError("Série introuvable");
    const seasonNum = Number(season);
    const [episodes, allEntries] = await Promise.all([
      getSeasonEpisodes(deps, { source: work.source, externalId: work.externalId, type: work.type }, seasonNum),
      getEpisodeEntries(deps, user.id, work.id),
    ]);
    return json({ episodes, entries: allEntries.filter((e) => e.season === seasonNum) });
  } catch (e) { return toErrorResponse(e); }
}
```

- [ ] **Step 3: Route PUT épisode**

Créer `src/app/api/works/[id]/episodes/route.ts` :

```ts
import { getDeps } from "@/server/container";
import { updateEpisode } from "@/server/application/episode-entry";
import { episodeUpdateSchema } from "@/lib/zod-schemas";
import { requireUser, json } from "@/server/http/session";
import { toErrorResponse } from "@/server/http/errors";
import { NotFoundError } from "@/server/domain/errors";

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const deps = await getDeps();
    const work = await deps.works.findById(id);
    if (!work || work.type !== "tv") throw new NotFoundError("Série introuvable");
    const input = episodeUpdateSchema.parse(await req.json());
    const watchedAt = input.watchedAt === undefined ? undefined : (input.watchedAt === null ? null : new Date(input.watchedAt));
    const entry = await updateEpisode(
      deps, user.id, { source: work.source, externalId: work.externalId, type: work.type },
      input.season, input.episode,
      { watched: input.watched, watchedAt, rating: input.rating, text: input.text },
    );
    return json({ entry });
  } catch (e) { return toErrorResponse(e); }
}
```

- [ ] **Step 4: Typecheck + build**

Run: `npx tsc --noEmit`
Expected: aucune erreur.
Run: `npm run build`
Expected: build réussi ; les routes `/api/works/[id]/seasons/[season]` et `/api/works/[id]/episodes` apparaissent dans la liste.

- [ ] **Step 5: Commit**

```bash
git add src/lib/zod-schemas.ts "src/app/api/works/[id]/seasons/[season]/route.ts" "src/app/api/works/[id]/episodes/route.ts"
git commit -m "feat(vulu): API épisodes (GET saison catalogue+entrées, PUT mise à jour d'épisode)"
```

---

### Task 4: Retirer la grille TV de `EntryEditor`

**Files:**
- Modify: `src/components/EntryEditor.tsx`

**Interfaces:**
- Consumes: rien de nouveau.

- [ ] **Step 1: Retirer l'état et les handlers de la grille**

Dans `src/components/EntryEditor.tsx`, supprimer le bloc d'état `watched` et les fonctions `toggleEp` / `toggleSeason` (introduit précédemment ; il commence à `const [watched, setWatched] = useState<number[][]>(() => {` et va jusqu'à la fin de `toggleSeason`).

- [ ] **Step 2: Simplifier `saveProgress` pour la TV**

Dans `saveProgress`, remplacer :

```tsx
      if (workType === "tv") { body.watchedEpisodes = watched; }
      else if (workType === "book") { body.tome = tome; body.page = page; }
```
par :
```tsx
      if (workType === "book") { body.tome = tome; body.page = page; }
```
(Pour une série, le corps reste `{ ref }` : `updateProgress` conserve le statut `in_progress` et la progression dérivée.)

- [ ] **Step 3: Retirer le bloc de rendu de la grille TV**

Supprimer entièrement le bloc JSX `{status === "in_progress" && workType === "tv" && ( … )}` (la grille par saison avec « Tout cocher », les pastilles d'épisodes, et ses boutons Enregistrer/Partager). Le bloc livre (`workType === "book"`) reste inchangé.

- [ ] **Step 4: Typecheck + build**

Run: `npx tsc --noEmit`
Expected: aucune erreur. Si `episodeCounts` devient un paramètre inutilisé, c'est sans conséquence (prop destructurée non lue — pas d'erreur `tsc`). Ne pas retirer la prop (la page la passe toujours).
Run: `npm run build`
Expected: build réussi.

- [ ] **Step 5: Commit**

```bash
git add src/components/EntryEditor.tsx
git commit -m "feat(vulu): EntryEditor — retrait de la grille d'épisodes (remplacée par l'onglet Épisodes)"
```

---

### Task 5: Page série en onglets — `SeriesTabs` + `EpisodesTab`

**Files:**
- Create: `src/components/SeriesTabs.tsx`
- Create: `src/components/EpisodesTab.tsx`
- Modify: `src/app/work/[id]/page.tsx`

**Interfaces:**
- Consumes: `GET /api/works/[id]/seasons/[season]`, `PUT /api/works/[id]/episodes` (Task 3) ; `api` client, `toast`, `RatingStars`.

- [ ] **Step 1: `SeriesTabs` (client, onglets)**

Créer `src/components/SeriesTabs.tsx` :

```tsx
"use client";
import { useState, type ReactNode } from "react";
import { EpisodesTab } from "./EpisodesTab";

export function SeriesTabs({ workId, episodeCounts, children }: {
  workId: string; episodeCounts: number[] | null; children: ReactNode;
}) {
  const [tab, setTab] = useState<"apercu" | "episodes">("apercu");
  const seg = (on: boolean) =>
    `flex-1 rounded-full px-4 py-2 text-sm font-semibold transition-colors ${on ? "bg-[var(--color-primary)] text-white" : "text-[var(--color-text-muted)]"}`;
  return (
    <div className="mt-4">
      <div className="mb-4 inline-flex w-full gap-1 rounded-full border border-[var(--color-border)] p-1">
        <button className={seg(tab === "apercu")} onClick={() => setTab("apercu")}>Aperçu</button>
        <button className={seg(tab === "episodes")} onClick={() => setTab("episodes")}>Épisodes</button>
      </div>
      {tab === "apercu" ? children : <EpisodesTab workId={workId} episodeCounts={episodeCounts} />}
    </div>
  );
}
```

- [ ] **Step 2: `EpisodesTab` (client) — chargement par saison + rendu**

Créer `src/components/EpisodesTab.tsx` :

```tsx
"use client";
import { useState } from "react";
import { api } from "@/lib/api-client";
import { toast } from "@/lib/toast";

interface EpisodeSummary { number: number; title: string | null; airDate: string | null; overview: string | null }
interface EpisodeEntry { season: number; episode: number; watched: boolean; watchedAt: string | null; rating: number | null; text: string | null }
interface SeasonData { episodes: EpisodeSummary[]; entries: EpisodeEntry[] }

export function EpisodesTab({ workId, episodeCounts }: { workId: string; episodeCounts: number[] | null }) {
  const seasons = episodeCounts ?? [];
  const [open, setOpen] = useState<number | null>(seasons.length ? 1 : null);
  const [data, setData] = useState<Record<number, SeasonData>>({});

  async function loadSeason(season: number) {
    if (data[season]) return;
    try {
      const d = await api.get<SeasonData>(`/api/works/${workId}/seasons/${season}`);
      setData((prev) => ({ ...prev, [season]: d }));
    } catch { toast("Chargement impossible", "error"); }
  }

  function toggleSeason(season: number) {
    const next = open === season ? null : season;
    setOpen(next);
    if (next) loadSeason(next);
  }

  function entryFor(season: number, episode: number): EpisodeEntry | undefined {
    return data[season]?.entries.find((e) => e.episode === episode);
  }

  async function patch(season: number, episode: number, body: Record<string, unknown>) {
    try {
      const { entry } = await api.put<{ entry: EpisodeEntry }>(`/api/works/${workId}/episodes`, { season, episode, ...body });
      setData((prev) => {
        const sd = prev[season]; if (!sd) return prev;
        const entries = [...sd.entries.filter((e) => e.episode !== episode), entry];
        return { ...prev, [season]: { ...sd, entries } };
      });
    } catch { toast("Action impossible", "error"); }
  }

  if (!seasons.length) return <p className="text-sm text-[var(--color-text-muted)]">Épisodes indisponibles pour cette série.</p>;

  return (
    <div className="flex flex-col gap-3">
      {seasons.map((count, si) => {
        const season = si + 1;
        const sd = data[season];
        return (
          <div key={season} className="overflow-hidden rounded-2xl border border-[var(--color-border)]">
            <button onClick={() => toggleSeason(season)} className="flex w-full items-center justify-between px-4 py-3 text-left font-display font-bold">
              Saison {season} <span className="text-xs font-normal text-[var(--color-text-muted)]">{count} épisodes</span>
            </button>
            {open === season && (
              <div className="border-t border-[var(--color-border)] p-3">
                {!sd ? <p className="text-sm text-[var(--color-text-muted)]">Chargement…</p> : (
                  <ul className="flex flex-col gap-3">
                    {Array.from({ length: count }, (_, k) => k + 1).map((ep) => {
                      const meta = sd.episodes.find((e) => e.number === ep);
                      const entry = entryFor(season, ep);
                      return (
                        <li key={ep} className="rounded-xl border border-[var(--color-border)] p-3">
                          <div className="flex items-start gap-3">
                            <button aria-label={entry?.watched ? "Marquer non vu" : "Marquer vu"}
                              onClick={() => patch(season, ep, { watched: !entry?.watched })}
                              className={`mt-0.5 h-6 w-6 shrink-0 rounded-full border text-sm font-bold ${entry?.watched ? "border-[var(--color-primary)] bg-[var(--color-primary)] text-white" : "border-[var(--color-border)] text-transparent"}`}>
                              ✓
                            </button>
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-semibold">{season}×{String(ep).padStart(2, "0")}{meta?.title ? ` · ${meta.title}` : ""}
                                {meta?.airDate ? <span className="ml-1 font-normal text-[var(--color-text-muted)]">· {new Date(meta.airDate).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" })}</span> : null}
                              </p>
                              {meta?.overview && <p className="mt-1 line-clamp-3 text-sm text-[var(--color-text-muted)]">{meta.overview}</p>}
                              <div className="mt-2 flex items-center gap-1">
                                {[1, 2, 3, 4, 5].map((n) => (
                                  <button key={n} aria-label={`Noter ${n}`}
                                    onClick={() => patch(season, ep, { rating: entry?.rating === n ? null : n })}
                                    className={`text-lg leading-none ${entry && entry.rating !== null && entry.rating >= n ? "text-[var(--color-accent)]" : "text-[var(--color-border)]"}`}>★</button>
                                ))}
                              </div>
                              {entry?.watched && (
                                <input type="date" value={entry.watchedAt ? entry.watchedAt.slice(0, 10) : ""}
                                  onChange={(e) => patch(season, ep, { watchedAt: e.target.value ? new Date(e.target.value).toISOString() : null })}
                                  className="mt-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-1 text-xs" />
                              )}
                              <textarea defaultValue={entry?.text ?? ""} placeholder="Ton commentaire (privé)…"
                                onBlur={(e) => { const v = e.target.value.trim(); if (v !== (entry?.text ?? "")) patch(season, ep, { text: v || null }); }}
                                className="mt-2 min-h-9 w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] p-2 text-sm" />
                            </div>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 3: Brancher les onglets dans la page œuvre (tv uniquement)**

Dans `src/app/work/[id]/page.tsx` : importer `SeriesTabs` (`import { SeriesTabs } from "@/components/SeriesTabs";`). Remplacer le bloc actuel qui suit le `</div>` de fermeture de la carte header (les `<div className="mt-4">…EntryEditor…</div>`, `AddToListButton`, « Ta note », `WorkReviews`) par un rendu conditionnel :

- pour `work.type === "tv"`, envelopper ce contenu dans `SeriesTabs` :
  ```tsx
      {work.type === "tv" ? (
        <SeriesTabs workId={work.id} episodeCounts={work.episodeCounts}>
          <EntryEditor workRef={{ source: work.source, externalId: work.externalId, type: work.type }} initial={entry} workType={work.type} episodeCounts={work.episodeCounts} pageCount={work.pageCount} />
          <div className="mt-3">
            <AddToListButton workRef={{ source: work.source, externalId: work.externalId, type: work.type }} workId={work.id} />
          </div>
          {entry?.status === "done" && entry.rating !== null && (
            <p className="mt-4 flex items-center gap-2 text-sm text-[var(--color-text-muted)]">
              Ta note : <RatingStars value={entry.rating} /> {entry.rating.toFixed(1).replace(".", ",")}/5
            </p>
          )}
          <WorkReviews workId={work.id} />
        </SeriesTabs>
      ) : (
        <>
          <div className="mt-4">
            <EntryEditor workRef={{ source: work.source, externalId: work.externalId, type: work.type }} initial={entry} workType={work.type} episodeCounts={work.episodeCounts} pageCount={work.pageCount} />
          </div>
          <div className="mt-3">
            <AddToListButton workRef={{ source: work.source, externalId: work.externalId, type: work.type }} workId={work.id} />
          </div>
          {entry?.status === "done" && entry.rating !== null && (
            <p className="mt-4 flex items-center gap-2 text-sm text-[var(--color-text-muted)]">
              Ta note : <RatingStars value={entry.rating} /> {entry.rating.toFixed(1).replace(".", ",")}/5
            </p>
          )}
          <WorkReviews workId={work.id} />
        </>
      )}
  ```

(Garder les mêmes imports `EntryEditor`, `AddToListButton`, `RatingStars`, `WorkReviews` déjà présents.)

- [ ] **Step 4: Typecheck + build**

Run: `npx tsc --noEmit`
Expected: aucune erreur.
Run: `npm run build`
Expected: build réussi.

- [ ] **Step 5: Vérification manuelle**

Run: `npm run dev`, ouvrir une série.
Expected : deux onglets « Aperçu » / « Épisodes ». Aperçu = contenu habituel (sans la grille). Épisodes = saisons dépliables ; ouvrir une saison charge titres/dates/synopsis ; cocher « vu » marque l'épisode (date du jour), noter en étoiles, commenter, corriger la date ; la série apparaît dans « En cours » de la bibliothèque et la position S/E se met à jour. Lancer `npm test`.

- [ ] **Step 6: Commit**

```bash
git add src/components/SeriesTabs.tsx src/components/EpisodesTab.tsx "src/app/work/[id]/page.tsx"
git commit -m "feat(vulu): page série en onglets Aperçu/Épisodes (suivi par épisode)"
```

---

## Self-Review

**Spec coverage :**
- Entité `EpisodeEntry` + repository mémoire/mongo + câblage → Task 1 ✓
- `updateEpisode` (date auto/éditable, dérivation progression, statut in_progress) + `getEpisodeEntries` → Task 2 ✓
- Export helpers `normalizeGrid`/`derivePosition`/`loadOrCreateEntry`/`isValidRating` → Task 2 Step 3 ✓
- API GET saison (catalogue + entrées) + PUT épisode + `episodeUpdateSchema` → Task 3 ✓
- Retrait grille `EntryEditor` + `saveProgress` tv `{ ref }` → Task 4 ✓
- Page onglets `SeriesTabs` + `EpisodesTab` (coche/note/commentaire/date, synopsis) → Task 5 ✓
- Tests : repository, updateEpisode (dérivation/date/note/validation), getEpisodeEntries → Tasks 1-2 ✓

**Placeholder scan :** aucun TBD/TODO ; code complet à chaque étape.

**Type consistency :** `EpisodeEntry` (Task 1) ⇔ repository ⇔ `updateEpisode`/`getEpisodeEntries` (Task 2) ⇔ routes (Task 3) ⇔ types front `EpisodeEntry`/`EpisodeSummary` (Task 5, dupliqués côté client comme les autres composants). `episodeUpdateSchema` (Task 3) ⇔ corps PUT (Task 5). `SeriesTabs(workId, episodeCounts, children)` ⇔ appel page (Task 5 Step 3). `EpisodesTab(workId, episodeCounts)` ⇔ `SeriesTabs`. Helpers exportés (Task 2 Step 3) consommés par `episode-entry.ts`.
