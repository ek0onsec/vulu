# Séries : statut dérivé + grille Aperçu + migration — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Une série est « Vu » seulement si tous ses épisodes sont cochés (sinon « En cours ») ; grille de cochage rapide sur l'Aperçu ; migration des séries « done » incomplètes vers « in_progress ».

**Architecture:** Fonction pure `deriveSeriesStatus` réutilisée par `updateEpisode`, `markAllEpisodes` et `rateOrReviewWork`. Grille `SeasonGrid` sur l'Aperçu écrivant via l'API épisodes. Script Node idempotent pour la migration.

**Tech Stack:** Next.js (version custom — lire `node_modules/next/dist/docs/`), TypeScript strict, Vitest, MongoDB (driver direct pour le script).

## Global Constraints

- **Typage strict sans `any`** ; accès indexés sécurisés.
- Statut série **dérivé** : `done` ssi tous cochés (total = somme `episodeCounts`) ; ≥1 → `in_progress` ; 0 → `planned`. `episodeCounts` inconnu → jamais `done`.
- Migration **idempotente**, **dry-run par défaut**, `--apply` pour écrire ; films/livres jamais touchés.
- Tests : `npm test` ; typecheck `npx tsc --noEmit` ; build `npm run build`.

---

### Task 1: `deriveSeriesStatus` (fonction pure)

**Files:**
- Create: `src/server/application/series-status.ts`
- Test: `tests/application/series-status.test.ts`

**Interfaces:**
- Produces: `deriveSeriesStatus(watchedGrid: number[][] | null, episodeCounts: number[] | null): "planned" | "in_progress" | "done"`

- [ ] **Step 1: Test (rouge)**

Créer `tests/application/series-status.test.ts` :

```ts
import { describe, it, expect } from "vitest";
import { deriveSeriesStatus } from "@/server/application/series-status";

describe("deriveSeriesStatus", () => {
  it("aucun coché → planned", () => { expect(deriveSeriesStatus(null, [7, 13])).toBe("planned"); expect(deriveSeriesStatus([[], []], [7, 13])).toBe("planned"); });
  it("partiel → in_progress", () => { expect(deriveSeriesStatus([[1, 2, 3], []], [7, 13])).toBe("in_progress"); });
  it("tous cochés → done", () => { expect(deriveSeriesStatus([[1,2,3,4,5,6,7], [1,2,3,4,5,6,7,8,9,10,11,12,13]], [7, 13])).toBe("done"); });
  it("episodeCounts inconnu + coché → in_progress (jamais done)", () => { expect(deriveSeriesStatus([[1, 2]], null)).toBe("in_progress"); });
});
```

- [ ] **Step 2: Lancer, vérifier l'échec**

Run: `npm test -- series-status`
Expected: FAIL — module inexistant.

- [ ] **Step 3: Implémenter**

Créer `src/server/application/series-status.ts` :

```ts
export function deriveSeriesStatus(
  watchedGrid: number[][] | null, episodeCounts: number[] | null,
): "planned" | "in_progress" | "done" {
  const watched = (watchedGrid ?? []).reduce((n, s) => n + s.length, 0);
  if (watched === 0) return "planned";
  const total = episodeCounts && episodeCounts.length ? episodeCounts.reduce((a, b) => a + b, 0) : null;
  if (total !== null && watched >= total) return "done";
  return "in_progress";
}
```

- [ ] **Step 4: Lancer, vérifier le succès**

Run: `npm test -- series-status`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/server/application/series-status.ts tests/application/series-status.test.ts
git commit -m "feat(vulu): deriveSeriesStatus (statut série dérivé des épisodes cochés)"
```

---

### Task 2: `updateEpisode` + `markAllEpisodes` appliquent la dérivation

**Files:**
- Modify: `src/server/application/episode-entry.ts`
- Test: `tests/application/episode-entry.test.ts`

**Interfaces:**
- Consumes: `deriveSeriesStatus` (Task 1).
- Produces: `markAllEpisodes(deps: Deps, userId: string, ref: Ref, watched: boolean): Promise<void>` ; `updateEpisode` dérive désormais `done`/`in_progress`/`planned` + gère `completedAt`.

- [ ] **Step 1: Tests (rouge)**

Ajouter à `tests/application/episode-entry.test.ts` (importer `markAllEpisodes` depuis le module et le work id helper déjà présent `workId()`) :

```ts
  it("cocher tous les épisodes → status done + completedAt", async () => {
    const { markAllEpisodes } = await import("@/server/application/episode-entry");
    await markAllEpisodes(deps, "u1", tv, true);
    const lib = await deps.entries.findByUserAndWork("u1", await workId());
    expect(lib?.status).toBe("done");
    expect(lib?.completedAt).not.toBeNull();
  });
  it("décocher le dernier épisode repasse en in_progress + completedAt null", async () => {
    const { markAllEpisodes } = await import("@/server/application/episode-entry");
    await markAllEpisodes(deps, "u1", tv, true);
    await updateEpisode(deps, "u1", tv, 2, 13, { watched: false });
    const lib = await deps.entries.findByUserAndWork("u1", await workId());
    expect(lib?.status).toBe("in_progress");
    expect(lib?.completedAt).toBeNull();
  });
  it("markAllEpisodes false → status planned", async () => {
    const { markAllEpisodes } = await import("@/server/application/episode-entry");
    await markAllEpisodes(deps, "u1", tv, true);
    await markAllEpisodes(deps, "u1", tv, false);
    const lib = await deps.entries.findByUserAndWork("u1", await workId());
    expect(lib?.status).toBe("planned");
  });
```

- [ ] **Step 2: Lancer, vérifier l'échec**

Run: `npm test -- application/episode-entry`
Expected: FAIL — `markAllEpisodes` inexistant / statut non `done`.

- [ ] **Step 3: Extraire `recomputeSeriesEntry` et appliquer la dérivation**

Dans `src/server/application/episode-entry.ts` :
- ajouter l'import : `import { deriveSeriesStatus } from "./series-status";` ; ajouter `Work` à l'import des entités ;
- ajouter le helper (au-dessus de `updateEpisode`) :

```ts
async function recomputeSeriesEntry(deps: Deps, userId: string, ref: Ref, work: Work): Promise<void> {
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
  const status = deriveSeriesStatus(hasAny ? norm : null, work.episodeCounts);
  const now = deps.clock.now();
  const completedAt = status === "done" ? (libEntry.completedAt ?? now) : null;
  const updatedLib: LibraryEntry = {
    ...libEntry, status, completedAt,
    progress: { season: pos.season, episode: pos.episode, tome: null, page: null, watchedEpisodes: hasAny ? norm : null },
    updatedAt: now,
  };
  await deps.entries.upsert(updatedLib);
}
```

- remplacer, dans `updateEpisode`, tout le bloc « Recalcule la progression … » (de
  `const libEntry = await loadOrCreateEntry(...)` jusqu'au `await deps.entries.upsert(updatedLib);`)
  par :

```ts
  await recomputeSeriesEntry(deps, userId, ref, work);
  return next;
```

(le `return next;` final existant est ainsi conservé une seule fois — supprimer l'ancien `return next;` s'il devient dupliqué.)

- [ ] **Step 4: Ajouter `markAllEpisodes`**

Ajouter dans `src/server/application/episode-entry.ts` :

```ts
export async function markAllEpisodes(deps: Deps, userId: string, ref: Ref, watched: boolean): Promise<void> {
  const work = await getOrImportWork(deps, ref);
  const now = deps.clock.now();
  const counts = work.episodeCounts ?? [];
  for (let si = 0; si < counts.length; si++) {
    const count = counts[si]!;
    for (let ep = 1; ep <= count; ep++) {
      const existing = await deps.episodeEntries.findOne(userId, work.id, si + 1, ep);
      const base = existing ?? {
        id: deps.ids.next(), userId, workId: work.id, season: si + 1, episode: ep,
        watched: false, watchedAt: null, rating: null, text: null,
        audiences: { public: false, circle: false, communityIds: [] }, activityAt: null,
        createdAt: now, updatedAt: now,
      };
      await deps.episodeEntries.upsert({ ...base, watched, watchedAt: watched ? (base.watchedAt ?? now) : null, updatedAt: now });
    }
  }
  await recomputeSeriesEntry(deps, userId, ref, work);
}
```

- [ ] **Step 5: Lancer + suite**

Run: `npm test -- application/episode-entry` → PASS.
Run: `npm test` → PASS ; `npx tsc --noEmit` → aucune erreur.

- [ ] **Step 6: Commit**

```bash
git add src/server/application/episode-entry.ts tests/application/episode-entry.test.ts
git commit -m "feat(vulu): statut série dérivé dans updateEpisode + markAllEpisodes"
```

---

### Task 3: Route `PUT /api/works/[id]/episodes/all`

**Files:**
- Create: `src/app/api/works/[id]/episodes/all/route.ts`

**Interfaces:**
- Consumes: `markAllEpisodes` (Task 2).

- [ ] **Step 1: Route**

Créer `src/app/api/works/[id]/episodes/all/route.ts` :

```ts
import { getDeps } from "@/server/container";
import { markAllEpisodes } from "@/server/application/episode-entry";
import { requireUser, json } from "@/server/http/session";
import { toErrorResponse } from "@/server/http/errors";
import { NotFoundError } from "@/server/domain/errors";
import { z } from "zod";

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const deps = await getDeps();
    const work = await deps.works.findById(id);
    if (!work || work.type !== "tv") throw new NotFoundError("Série introuvable");
    const { watched } = z.object({ watched: z.boolean() }).parse(await req.json());
    await markAllEpisodes(deps, user.id, { source: work.source, externalId: work.externalId, type: work.type }, watched);
    return json({ ok: true });
  } catch (e) { return toErrorResponse(e); }
}
```

- [ ] **Step 2: Typecheck + build**

Run: `npx tsc --noEmit` → aucune erreur.
Run: `npm run build` → la route `/api/works/[id]/episodes/all` apparaît.

- [ ] **Step 3: Commit**

```bash
git add "src/app/api/works/[id]/episodes/all/route.ts"
git commit -m "feat(vulu): route PUT episodes/all (marquer toute la série vue/non vue)"
```

---

### Task 4: `rateOrReviewWork` — statut dérivé pour les séries

**Files:**
- Modify: `src/server/application/library-entry.ts`
- Test: `tests/application/library-entry.test.ts`

**Interfaces:**
- Consumes: `deriveSeriesStatus` (Task 1).

- [ ] **Step 1: Test (rouge)**

Ajouter à `tests/application/library-entry.test.ts` (importer `deriveSeriesStatus` non nécessaire ; utiliser `updateEpisode` pour cocher un épisode) :

```ts
  it("noter une série partiellement vue ne la passe pas en done", async () => {
    const tv = { source: "tmdb" as const, externalId: "1396", type: "tv" as const };
    const { updateEpisode } = await import("@/server/application/library-entry").then(() => import("@/server/application/episode-entry"));
    await updateEpisode(deps, "u1", tv, 1, 1, { watched: true }); // 1/20 → in_progress
    const e = await rateOrReviewWork(deps, "u1", tv, { rating: 5, text: null, audiences: { public: true, circle: true, communityIds: [] } });
    expect(e.status).toBe("in_progress");
    expect(e.rating).toBe(5);
  });
```

(Vérifier l'entête du fichier de test : `deps` initialisé via `makeInMemoryDeps(new FakeCatalog())`, `rateOrReviewWork` importé.)

- [ ] **Step 2: Lancer, vérifier l'échec**

Run: `npm test -- application/library-entry`
Expected: FAIL — `e.status` vaut `done`.

- [ ] **Step 3: Dériver le statut pour les séries**

Dans `src/server/application/library-entry.ts` :
- ajouter `import { deriveSeriesStatus } from "./series-status";` ;
- dans `rateOrReviewWork`, après `const entry = await loadOrCreateEntry(deps, userId, ref);`, ajouter :

```ts
  const work = await getOrImportWork(deps, ref);
  const status = work.type === "tv"
    ? deriveSeriesStatus(entry.progress?.watchedEpisodes ?? null, work.episodeCounts)
    : "done";
```

- remplacer, dans la construction de `updated`, `status: "done"` par `status,` et adapter `completedAt` :

```ts
  const updated: LibraryEntry = { ...entry, status, rating: input.rating,
    text: input.text?.trim() ? input.text.trim() : null, audiences,
    completedAt: input.completedAt !== undefined ? input.completedAt : (status === "done" ? entry.completedAt ?? deps.clock.now() : entry.completedAt),
    activityAt: deps.clock.now(), updatedAt: deps.clock.now() };
```

- [ ] **Step 4: Lancer + suite**

Run: `npm test -- application/library-entry` → PASS.
Run: `npm test` → PASS ; `npx tsc --noEmit` → aucune erreur. Si un test de feed/bibliothèque supposait qu'une **série** notée passe `done`, l'ajuster (les cas existants notent des **films** `603` → inchangés).

- [ ] **Step 5: Commit**

```bash
git add src/server/application/library-entry.ts tests/application/library-entry.test.ts
git commit -m "feat(vulu): noter une série ne force plus done (statut dérivé des épisodes)"
```

---

### Task 5: UI — grille Aperçu + bouton « Vu » série

**Files:**
- Create: `src/components/SeasonGrid.tsx`
- Modify: `src/components/SeriesTabs.tsx`
- Modify: `src/app/work/[id]/page.tsx`
- Modify: `src/components/EntryEditor.tsx`

**Interfaces:**
- Consumes: `PUT /api/works/[id]/episodes` et `.../episodes/all` (Tasks 2-3).

- [ ] **Step 1: `SeasonGrid` (client)**

Créer `src/components/SeasonGrid.tsx` :

```tsx
"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api-client";
import { toast } from "@/lib/toast";

export function SeasonGrid({ workId, episodeCounts, initialWatched }: {
  workId: string; episodeCounts: number[] | null; initialWatched: number[][] | null;
}) {
  const router = useRouter();
  const seasons = episodeCounts ?? [];
  const [watched, setWatched] = useState<number[][]>(() => seasons.map((_, i) => [...(initialWatched?.[i] ?? [])]));
  const [busy, setBusy] = useState(false);
  if (!seasons.length) return null;

  async function put(season: number, episode: number, on: boolean) {
    setBusy(true);
    try { await api.put(`/api/works/${workId}/episodes`, { season, episode, watched: on }); router.refresh(); }
    catch { toast("Action impossible", "error"); }
    finally { setBusy(false); }
  }
  function toggle(si: number, ep: number) {
    const on = !(watched[si]?.includes(ep));
    setWatched((prev) => {
      const next = prev.map((s) => [...s]);
      while (next.length <= si) next.push([]);
      const arr = next[si]!;
      const idx = arr.indexOf(ep);
      if (idx >= 0) arr.splice(idx, 1); else arr.push(ep);
      arr.sort((a, b) => a - b);
      return next;
    });
    void put(si + 1, ep, on);
  }
  async function toggleSeason(si: number, count: number, fill: boolean) {
    setWatched((prev) => { const next = prev.map((s) => [...s]); while (next.length <= si) next.push([]); next[si] = fill ? Array.from({ length: count }, (_, k) => k + 1) : []; return next; });
    setBusy(true);
    try { for (let ep = 1; ep <= count; ep++) await api.put(`/api/works/${workId}/episodes`, { season: si + 1, episode: ep, watched: fill }); router.refresh(); }
    catch { toast("Action impossible", "error"); } finally { setBusy(false); }
  }

  return (
    <section className="mb-4 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
      <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">Cocher les épisodes vus</p>
      <div className="flex flex-col gap-3">
        {seasons.map((count, si) => {
          const done = watched[si]?.length ?? 0;
          return (
            <div key={si} className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold">Saison {si + 1}<span className="ml-2 text-xs font-normal text-[var(--color-text-muted)]">{done}/{count}</span></span>
                <button disabled={busy} onClick={() => toggleSeason(si, count, done !== count)}
                  className="rounded-full border border-[var(--color-border)] px-3 py-0.5 text-xs font-semibold text-[var(--color-text-muted)] disabled:opacity-50">
                  {done === count ? "Tout décocher" : "Tout cocher"}
                </button>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {Array.from({ length: count }, (_, k) => k + 1).map((ep) => {
                  const on = watched[si]?.includes(ep) ?? false;
                  return (
                    <button key={ep} disabled={busy} onClick={() => toggle(si, ep)}
                      className={`h-8 min-w-8 rounded-full border px-2 text-sm font-semibold disabled:opacity-50 ${on ? "border-[var(--color-primary)] bg-[var(--color-primary)] text-white" : "border-[var(--color-border)] text-[var(--color-text-muted)]"}`}>
                      {on ? "✓" : ""}{ep}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
```

- [ ] **Step 2: `SeriesTabs` rend `SeasonGrid` sur l'Aperçu**

Dans `src/components/SeriesTabs.tsx` :
- importer `SeasonGrid` ;
- ajouter la prop `initialWatched: number[][] | null` à la signature ;
- dans l'onglet Aperçu, rendre la grille avant `children` :

```tsx
      {tab === "apercu" ? (
        <>
          <SeasonGrid workId={workId} episodeCounts={episodeCounts} initialWatched={initialWatched} />
          {children}
        </>
      ) : <EpisodesTab workId={workId} episodeCounts={episodeCounts} />}
```

- [ ] **Step 3: Page œuvre passe `initialWatched`**

Dans `src/app/work/[id]/page.tsx`, l'appel `<SeriesTabs workId={work.id} episodeCounts={work.episodeCounts}>` devient :

```tsx
        <SeriesTabs workId={work.id} episodeCounts={work.episodeCounts} initialWatched={entry?.progress?.watchedEpisodes ?? null}>
```

- [ ] **Step 4: EntryEditor — prop `workId` + bouton « Vu » série**

Dans `src/components/EntryEditor.tsx` :
- ajouter `workId` aux props : signature `{ workRef, initial, workType, episodeCounts, pageCount, workId }` et au type `workId: string;` ;
- remplacer le bouton du segment « Vu » :

```tsx
        <button className={seg(status === "done")} disabled={busy} onClick={async () => {
          if (workType === "tv") {
            setBusy(true);
            try { await api.put(`/api/works/${workId}/episodes/all`, { watched: true }); toast("Série marquée comme vue"); router.refresh(); }
            catch { toast("Action impossible", "error"); } finally { setBusy(false); }
            return;
          }
          setStatus("done"); if (!completedAt) setCompletedAt(new Date().toISOString().slice(0, 10));
        }}>{statusLabel("done", workType)} ✓</button>
```

Dans `src/app/work/[id]/page.tsx`, ajouter `workId={work.id}` aux **deux** rendus de `<EntryEditor …/>` (branche tv et branche non-tv).

- [ ] **Step 5: Typecheck + build**

Run: `npx tsc --noEmit` → aucune erreur.
Run: `npm run build` → build réussi.

- [ ] **Step 6: Vérification manuelle**

Run: `npm run dev`. Ouvrir une série : l'Aperçu montre la grille « Cocher les épisodes vus » + l'éditeur ; cocher des épisodes met à jour le statut (En cours) ; tout cocher → « Vu » ; le bouton « Vu ✓ » coche toute la série ; l'onglet Épisodes reste fonctionnel. Lancer `npm test`.

- [ ] **Step 7: Commit**

```bash
git add src/components/SeasonGrid.tsx src/components/SeriesTabs.tsx "src/app/work/[id]/page.tsx" src/components/EntryEditor.tsx
git commit -m "feat(vulu): grille de cochage rapide sur l'Aperçu série + bouton Vu = tout cocher"
```

---

### Task 6: Migration `scripts/migrate-series-in-progress.mjs`

**Files:**
- Create: `scripts/migrate-series-in-progress.mjs`

**Interfaces:**
- Consomme MongoDB directement (driver `mongodb`), collections `entries` + `works`.

- [ ] **Step 1: Script**

Créer `scripts/migrate-series-in-progress.mjs` :

```js
// Passe en "in_progress" les séries "done" dont tous les épisodes ne sont pas cochés.
// Idempotent. Dry-run par défaut ; --apply pour écrire.
// Usage : MONGODB_URI=… MONGODB_DB=vulu node scripts/migrate-series-in-progress.mjs [--apply]
import { MongoClient } from "mongodb";

const apply = process.argv.includes("--apply");
const uri = process.env.MONGODB_URI;
const dbName = process.env.MONGODB_DB || "vulu";
if (!uri) { console.error("MONGODB_URI manquant"); process.exit(1); }

const client = new MongoClient(uri);
await client.connect();
const db = client.db(dbName);

const doneEntries = await db.collection("entries").find({ status: "done" }).toArray();
let series = 0, ignored = 0, toChange = 0;
const ids = [];
for (const e of doneEntries) {
  const work = await db.collection("works").findOne({ _id: e.workId });
  if (!work || work.type !== "tv") continue;
  series++;
  const counts = Array.isArray(work.episodeCounts) ? work.episodeCounts : null;
  if (!counts || counts.length === 0) { ignored++; continue; }
  const total = counts.reduce((a, b) => a + b, 0);
  const grid = e.progress && Array.isArray(e.progress.watchedEpisodes) ? e.progress.watchedEpisodes : [];
  const watched = grid.reduce((n, s) => n + (Array.isArray(s) ? s.length : 0), 0);
  if (watched < total) { toChange++; ids.push(e._id); }
}

console.log(`Séries "done" : ${series} | ignorées (episodeCounts inconnu) : ${ignored} | à passer en in_progress : ${toChange}`);
if (apply && ids.length) {
  const res = await db.collection("entries").updateMany(
    { _id: { $in: ids } },
    { $set: { status: "in_progress", completedAt: null } },
  );
  console.log(`Appliqué : ${res.modifiedCount} entrées modifiées.`);
} else if (!apply) {
  console.log("Dry-run : aucune écriture. Relancer avec --apply pour appliquer.");
}
await client.close();
```

- [ ] **Step 2: Vérifier la syntaxe (chargement du module)**

Run: `node --check scripts/migrate-series-in-progress.mjs`
Expected: aucune sortie (syntaxe valide). (La logique de comptage est celle de `deriveSeriesStatus`, déjà couverte par les tests unitaires Task 1.)

- [ ] **Step 3: Commit**

```bash
git add scripts/migrate-series-in-progress.mjs
git commit -m "chore(vulu): script de migration séries done incomplètes → in_progress (idempotent, dry-run)"
```

---

## Self-Review

**Spec coverage :**
- `deriveSeriesStatus` → Task 1 ✓
- `updateEpisode` dérivation + completedAt → Task 2 ✓
- `markAllEpisodes` + route → Tasks 2-3 ✓
- `rateOrReviewWork` tv dérivé → Task 4 ✓
- `SeasonGrid` Aperçu + `SeriesTabs` + page + bouton « Vu » → Task 5 ✓
- Migration idempotente dry-run/apply, films/livres épargnés → Task 6 ✓
- Tests : dérivation, updateEpisode/markAll, rateOrReviewWork série → Tasks 1-4 ✓

**Placeholder scan :** aucun TBD/TODO ; code complet.

**Type consistency :** `deriveSeriesStatus(number[][]|null, number[]|null)` identique dans les 3 consommateurs. `markAllEpisodes(deps, userId, ref, watched)` ⇔ route ⇔ bouton Vu. `SeasonGrid(workId, episodeCounts, initialWatched)` ⇔ `SeriesTabs` ⇔ page. `EntryEditor` gagne `workId` (2 rendus mis à jour). Le script mirroir la logique de `deriveSeriesStatus` (watched < total), couverte par tests.
