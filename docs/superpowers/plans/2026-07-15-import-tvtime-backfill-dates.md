# Import TV Time — Backfill des dates manquantes — Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** L'import complète les dates absentes des épisodes/films déjà vus (sans écraser), et le rapport final détaille le nombre de dates complétées.

**Architecture:** Changement localisé du service `importTvTime` : au lieu de skipper tout élément existant, on remplit uniquement un champ date `null` sur un élément déjà marqué comme vu. Un nouveau compteur `datesBackfilled` est ajouté à `ImportReport` (entité) et affiché dans la modal de fin.

**Tech Stack:** TypeScript, Vitest.

## Global Constraints

- **Strict, jamais d'écrasement** : on ne remplit qu'un champ date `null` ; on ne touche jamais une date existante, ni le statut vu/non-vu, ni « à voir ».
- **Épisode backfill** : uniquement si `ex.watched === true && ex.watchedAt === null`.
- **Film backfill** : uniquement si `existing.status === "done" && existing.completedAt === null`.
- Import toujours **privé** : les entrées touchées gardent leurs audiences existantes (on ne modifie que le champ date).
- Recompute série si la série est **touchée** (épisode ajouté **ou** date complétée).
- `datesBackfilled` cumule épisodes + films complétés ; `episodesSkipped` ne compte plus que les épisodes réellement inchangés.
- Pas d'attribution AI dans les commits.

## File Structure

- `src/server/domain/entities.ts` — **Modifier** : champ `datesBackfilled` dans `ImportReport`.
- `src/server/application/import-tvtime.ts` — **Modifier** : logique de backfill (épisodes + films) + init du compteur.
- `tests/application/import-tvtime.test.ts` — **Modifier** : cas de backfill.
- `src/components/TvTimeImportModal.tsx` — **Modifier** : ligne « dates complétées » dans le rapport.

---

### Task 1 : Backfill des dates dans le service

**Files:**
- Modify: `src/server/domain/entities.ts`
- Modify: `src/server/application/import-tvtime.ts`
- Test: `tests/application/import-tvtime.test.ts`

**Interfaces:**
- Produces : `ImportReport.datesBackfilled: number` ; comportement de backfill de `importTvTime`.

- [ ] **Step 1 : Ajouter `datesBackfilled` à l'entité**

Dans `src/server/domain/entities.ts`, dans l'interface `ImportReport`, ajouter le champ après `episodesSkipped` :

```ts
export interface ImportReport {
  seriesImported: number;
  seriesToWatch: number;
  episodesAdded: number;
  episodesSkipped: number;
  datesBackfilled: number;
  moviesImported: number;
  unmatched: { series: string[]; movies: string[] };
}
```

- [ ] **Step 2 : Écrire les tests de backfill**

Dans `tests/application/import-tvtime.test.ts`, ajouter l'import de `setEntryStatus` en tête (à côté de `updateEpisode`) :

```ts
import { updateEpisode } from "@/server/application/episode-entry";
import { setEntryStatus } from "@/server/application/library-entry";
```

Puis ajouter ces tests dans le `describe("importTvTime", ...)` :

```ts
  it("complète la date d'un épisode déjà vu mais sans date (backfill)", async () => {
    const ref = { source: "tmdb" as const, externalId: "1396", type: "tv" as const };
    await updateEpisode(deps, USER, ref, 1, 1, { watched: true, watchedAt: null }); // vu, sans date
    const report = await importTvTime(deps, USER, bbSeries);
    expect(report.datesBackfilled).toBe(1);         // S1E1 : date complétée
    expect(report.episodesSkipped).toBe(0);
    expect(report.episodesAdded).toBe(1);           // S1E2 : nouveau
    const ep = await deps.episodeEntries.findOne(USER, (await firstWork(deps)).id, 1, 1);
    expect(ep!.watchedAt).toEqual(new Date("2020-01-01")); // date de l'import
    expect(ep!.watched).toBe(true);
  });

  it("n'écrase pas la date d'un épisode déjà daté", async () => {
    const ref = { source: "tmdb" as const, externalId: "1396", type: "tv" as const };
    await updateEpisode(deps, USER, ref, 1, 1, { watched: true, watchedAt: new Date("2019-06-06") });
    const report = await importTvTime(deps, USER, bbSeries);
    expect(report.datesBackfilled).toBe(0);
    expect(report.episodesSkipped).toBe(1);
    const ep = await deps.episodeEntries.findOne(USER, (await firstWork(deps)).id, 1, 1);
    expect(ep!.watchedAt).toEqual(new Date("2019-06-06")); // inchangé
  });

  it("complète la date d'un film déjà 'done' sans date", async () => {
    const ref = { source: "tmdb" as const, externalId: "603", type: "movie" as const };
    await setEntryStatus(deps, USER, ref, "done", null); // done, sans date
    const data: TvTimeExport = { series: [], movies: [{ name: "The Matrix", year: 1999, watchedAt: new Date("2021-03-03") }] };
    const report = await importTvTime(deps, USER, data);
    expect(report.datesBackfilled).toBe(1);
    expect(report.moviesImported).toBe(0);
    const entry = await deps.entries.findByUserAndWork(USER, (await firstWork(deps)).id);
    expect(entry!.completedAt).toEqual(new Date("2021-03-03"));
  });

  it("ne touche pas un film déjà daté ou en 'à voir'", async () => {
    const ref = { source: "tmdb" as const, externalId: "603", type: "movie" as const };
    await setEntryStatus(deps, USER, ref, "planned"); // à voir → ne doit pas devenir 'done'
    const data: TvTimeExport = { series: [], movies: [{ name: "The Matrix", year: 1999, watchedAt: new Date("2021-03-03") }] };
    const report = await importTvTime(deps, USER, data);
    expect(report.datesBackfilled).toBe(0);
    expect(report.moviesImported).toBe(0);
    const entry = await deps.entries.findByUserAndWork(USER, (await firstWork(deps)).id);
    expect(entry!.status).toBe("planned");   // inchangé
    expect(entry!.completedAt).toBeNull();
  });
```

- [ ] **Step 3 : Lancer les tests (échec attendu)**

Run: `npx vitest run tests/application/import-tvtime.test.ts`
Expected: FAIL — `datesBackfilled` absent / backfill non implémenté (les nouveaux tests échouent).

- [ ] **Step 4 : Initialiser le compteur**

Dans `src/server/application/import-tvtime.ts`, dans l'objet `report` initial, ajouter `datesBackfilled: 0` :

```ts
  const report: ImportReport = {
    seriesImported: 0, seriesToWatch: 0, episodesAdded: 0, episodesSkipped: 0,
    datesBackfilled: 0, moviesImported: 0, unmatched: { series: [], movies: [] },
  };
```

- [ ] **Step 5 : Backfill des épisodes**

Dans la boucle des épisodes, remplacer :

```ts
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
```
par :
```ts
    let added = 0;
    let touched = false;
    for (const w of s.watched) {
      const ex = await deps.episodeEntries.findOne(userId, work.id, w.season, w.episode);
      if (ex) {
        // Backfill : uniquement si déjà vu et sans date. Jamais d'écrasement.
        if (ex.watched && ex.watchedAt === null) {
          await deps.episodeEntries.upsert({ ...ex, watchedAt: w.watchedAt, updatedAt: deps.clock.now() });
          report.datesBackfilled++; touched = true;
        } else {
          report.episodesSkipped++;
        }
        continue;
      }
      const now = deps.clock.now();
      await deps.episodeEntries.upsert({
        id: deps.ids.next(), userId, workId: work.id, season: w.season, episode: w.episode,
        watched: true, watchedAt: w.watchedAt, rating: null, text: null,
        audiences: { ...PRIVATE }, activityAt: null, createdAt: now, updatedAt: now,
      });
      added++; report.episodesAdded++; touched = true;
    }
    if (touched) await recomputeSeriesEntry(deps, userId, ref, work);
    if (added > 0) report.seriesImported++;
```

- [ ] **Step 6 : Backfill des films**

Dans la boucle des films, remplacer :

```ts
    const existing = await deps.entries.findByUserAndWork(userId, work.id);
    if (existing) continue; // skip total
    const base = await loadOrCreateEntry(deps, userId, ref);
```
par :
```ts
    const existing = await deps.entries.findByUserAndWork(userId, work.id);
    if (existing) {
      // Backfill : uniquement un film déjà 'done' sans date. Jamais de changement de statut.
      if (existing.status === "done" && existing.completedAt === null) {
        await deps.entries.upsert({ ...existing, completedAt: m.watchedAt, updatedAt: deps.clock.now() });
        report.datesBackfilled++;
      }
      continue;
    }
    const base = await loadOrCreateEntry(deps, userId, ref);
```

- [ ] **Step 7 : Lancer les tests + suite complète + typecheck**

Run: `npx vitest run tests/application/import-tvtime.test.ts && npm test && npx tsc --noEmit`
Expected: nouveaux tests PASS, suite complète verte, typecheck OK.

- [ ] **Step 8 : Commit**

```bash
git add src/server/domain/entities.ts src/server/application/import-tvtime.ts tests/application/import-tvtime.test.ts
git commit -m "feat(vulu): backfill des dates manquantes à l'import (sans écrasement)"
```

---

### Task 2 : Affichage « dates complétées » dans la modal

**Files:**
- Modify: `src/components/TvTimeImportModal.tsx`

**Interfaces:**
- Consumes : `report.datesBackfilled` (Task 1).

- [ ] **Step 1 : Ajouter la ligne au rapport**

Dans `src/components/TvTimeImportModal.tsx`, dans le bloc `phase === "done" && status?.status === "done" && status.report`, dans la `<ul>`, ajouter une ligne conditionnelle après la ligne des épisodes :

```tsx
            <li>{status.report.episodesAdded} épisodes ajoutés, {status.report.episodesSkipped} déjà présents (ignorés)</li>
            {status.report.datesBackfilled > 0 && (
              <li>{status.report.datesBackfilled} dates complétées sur des éléments déjà présents</li>
            )}
            <li>{status.report.moviesImported} films importés</li>
```

- [ ] **Step 2 : Typecheck**

Run: `npx tsc --noEmit`
Expected: aucune erreur.

- [ ] **Step 3 : Commit**

```bash
git add src/components/TvTimeImportModal.tsx
git commit -m "feat(vulu): affiche les dates complétées dans le rapport d'import"
```

---

## Self-Review

**Couverture spec :**
- Backfill épisode (vu + date null) → Task 1 step 5 + tests. ✔
- Backfill film (done + completedAt null) → Task 1 step 6 + tests. ✔
- Jamais d'écrasement date/statut/à-voir → gardes `ex.watched && ex.watchedAt === null` / `status === "done" && completedAt === null` + tests « n'écrase pas » / « ne touche pas ». ✔
- Compteur `datesBackfilled` dans `ImportReport` → Task 1 step 1/4. ✔
- Recompute si série touchée (ajout ou backfill) → Task 1 step 5 (`if (touched)`). ✔
- Affichage rapport → Task 2. ✔
- Preview inchangée → non touchée. ✔

**Placeholders :** aucun ; tout le code est fourni.

**Cohérence des types/noms :** `datesBackfilled` identique entité/service/tests/modal ; gardes `ex.watched`/`ex.watchedAt`/`existing.status`/`existing.completedAt` conformes aux entités `EpisodeEntry`/`LibraryEntry` ; `setEntryStatus(deps, userId, ref, status, completedAt?)` et `updateEpisode(..., { watched, watchedAt })` conformes aux signatures existantes ; `firstWork(deps)` réutilisé du fichier de test.
