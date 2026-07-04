# Progression : saisie rapide livres + grille d'épisodes séries — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permettre de saisir vite l'avancement d'un livre (champ éditable + boutons ±1/±10/±100) et de cocher librement, saison par saison, les épisodes vus d'une série.

**Architecture:** Le livre est une modification UI pure (`EntryEditor`). La série ajoute un champ `watchedEpisodes: number[][]` à `EntryProgress` ; `season`/`episode` deviennent dérivés côté serveur (rétro-compat feed/shelf). Le client envoie la grille complète (idempotent) ; le chemin legacy `+1 épisode` de la shelf marque l'épisode dans la grille.

**Tech Stack:** Next.js (version custom — lire `node_modules/next/dist/docs/` avant tout code), React, TypeScript strict, Zod, Vitest, architecture ports & adapters (domaine → application → adapters mémoire/mongo).

## Global Constraints

- **Aucun secret hardcodé, entrées validées à la frontière (Zod), typage strict sans `any`.**
- **Aucune migration Mongo** : `watchedEpisodes` transite via le spread de `e.progress` ; les docs existants ont le champ absent → normaliser à `null` à la lecture.
- **Rétro-compatibilité** : `formatProgress`, le feed et `InProgressShelf` continuent de lire `season`/`episode` sans changement.
- **Coche libre** : cocher l'épisode 5 sans 1-4 est autorisé.
- Copie FR existante conservée (labels « Saison », « Épisode », « Enregistrer », « Partager ce jalon »).
- Tests : `npm test` (vitest run). Les composants React n'ont pas d'infra de test dans ce repo → vérification manuelle pour les tâches UI, cohérent avec le codebase.

---

### Task 1: Backend séries — champ `watchedEpisodes`, dérivation, chemin grille + legacy

**Files:**
- Modify: `src/server/domain/entities.ts` (interface `EntryProgress`, ~ligne 11-16)
- Modify: `src/lib/zod-schemas.ts` (`progressSchema`, ~ligne 35-38)
- Modify: `src/server/application/library-entry.ts` (`updateProgress`, ~ligne 65-92 ; ajout helpers)
- Modify: `src/server/adapters/mongo/mappers.ts` (`fromEntryDoc`, ligne 61)
- Test: `tests/application/progress.test.ts` (mise à jour + nouveaux cas)
- Test: `tests/lib/progress.test.ts` (mise à jour des littéraux)

**Interfaces:**
- Produces:
  - `EntryProgress.watchedEpisodes: number[][] | null` (index = saison−1, valeurs = n° d'épisodes vus, triés/dédoublonnés).
  - `updateProgress(deps, userId, ref, input)` où `input` accepte désormais `watchedEpisodes?: number[][] | null`.
  - Sémantique : si `watchedEpisodes` fourni → grille complète normalisée ; sinon chemin legacy (`season`/`episode` → épisode ajouté à la grille existante). `season`/`episode` recalculés = saison la plus avancée cochée + max épisode coché ; `{null, null}` si grille vide.
- Consumes: `clampPositive(n, max)` existant.

- [ ] **Step 1: Mettre à jour les tests existants pour le nouveau champ (rouge)**

Dans `tests/application/progress.test.ts`, remplacer les deux assertions `toEqual` :

```ts
    expect(e.progress).toEqual({ season: 1, episode: 5, tome: null, page: null, watchedEpisodes: [[5]] });
```
```ts
    expect(e.progress).toEqual({ season: null, episode: null, tome: 3, page: 120, watchedEpisodes: null });
```

Dans `tests/lib/progress.test.ts`, ajouter `watchedEpisodes: null` aux trois littéraux `progress` (lignes 6, 10, 14), ex. :

```ts
    expect(formatProgress({ progress: { season: 1, episode: 5, tome: null, page: null, watchedEpisodes: null } },
      { type: "tv", episodeCounts: [7, 13], pageCount: null })).toBe("S1 E5/7");
```
(idem pour `{ season: 2, episode: 3, ... }` et `{ season: null, episode: null, tome: 3, page: 120, ... }`)

- [ ] **Step 2: Ajouter les nouveaux cas de test grille (rouge)**

Dans `tests/application/progress.test.ts`, dans le `describe("updateProgress", ...)` :

```ts
  it("série grille : stocke watchedEpisodes normalisé (trié, dédoublonné, borné)", async () => {
    const e = await updateProgress(deps, "u1", tv, { watchedEpisodes: [[3, 1, 1, 2, 99], [5]] });
    // saison 1 = 7 épisodes → 99 filtré ; saison 2 = 13 épisodes → 5 gardé
    expect(e.progress?.watchedEpisodes).toEqual([[1, 2, 3], [5]]);
  });
  it("série grille : season/episode dérivés = saison la plus avancée + max épisode (coche libre)", async () => {
    const e = await updateProgress(deps, "u1", tv, { watchedEpisodes: [[1, 2], [5]] });
    expect(e.progress?.season).toBe(2);
    expect(e.progress?.episode).toBe(5); // coche libre : S2E5 sans S2E1-4
  });
  it("série grille vide : position nulle, watchedEpisodes null", async () => {
    const e = await updateProgress(deps, "u1", tv, { watchedEpisodes: [[], []] });
    expect(e.progress?.watchedEpisodes).toBeNull();
    expect(e.progress?.season).toBeNull();
    expect(e.progress?.episode).toBeNull();
  });
  it("chemin legacy (+1 épisode shelf) : ajoute l'épisode à la grille et recalcule", async () => {
    const first = await updateProgress(deps, "u1", tv, { season: 1, episode: 3 });
    expect(first.progress?.watchedEpisodes).toEqual([[3]]);
    const next = await updateProgress(deps, "u1", tv, { season: 1, episode: 4 });
    expect(next.progress?.watchedEpisodes).toEqual([[3, 4]]);
    expect(next.progress?.episode).toBe(4);
  });
```

- [ ] **Step 3: Lancer les tests, vérifier l'échec**

Run: `npm test -- progress`
Expected: FAIL — `watchedEpisodes` absent du type / assertions non satisfaites.

- [ ] **Step 4: Ajouter le champ au domaine**

Dans `src/server/domain/entities.ts`, interface `EntryProgress` :

```ts
export interface EntryProgress {
  season: number | null;   // séries — position courante (dérivée)
  episode: number | null;  // séries — position courante (dérivée)
  tome: number | null;     // livres
  page: number | null;     // livres
  watchedEpisodes: number[][] | null;  // séries — index = saison−1, valeurs = n° d'épisodes vus
}
```

- [ ] **Step 5: Étendre le schéma Zod**

Dans `src/lib/zod-schemas.ts`, `progressSchema` :

```ts
export const progressSchema = z.object({
  ref: workRefSchema,
  season: progInt, episode: progInt, tome: progInt, page: progInt,
  watchedEpisodes: z.array(z.array(z.number().int().min(1))).nullable().optional(),
});
```

- [ ] **Step 6: Implémenter dérivation + chemins dans `updateProgress`**

Dans `src/server/application/library-entry.ts`, ajouter ces helpers juste au-dessus de `updateProgress` :

```ts
function normalizeGrid(grid: number[][] | null | undefined, counts: number[] | null): number[][] {
  if (!grid) return [];
  const out: number[][] = [];
  for (let i = 0; i < grid.length; i++) {
    if (counts && i >= counts.length) continue; // saison inexistante
    const max = counts?.[i] ?? null;
    out[i] = [...new Set(grid[i] ?? [])]
      .filter((n) => Number.isInteger(n) && n >= 1 && (max === null || n <= max))
      .sort((a, b) => a - b);
  }
  return out;
}

function derivePosition(grid: number[][]): { season: number | null; episode: number | null } {
  for (let i = grid.length - 1; i >= 0; i--) {
    if (grid[i] && grid[i].length) return { season: i + 1, episode: Math.max(...grid[i]) };
  }
  return { season: null, episode: null };
}

function gridWithEpisode(grid: number[][] | null | undefined, season: number, episode: number): number[][] {
  const out = (grid ?? []).map((s) => [...(s ?? [])]);
  const idx = season - 1;
  while (out.length <= idx) out.push([]);
  if (!out[idx].includes(episode)) out[idx].push(episode);
  return out;
}
```

Étendre la signature de `input` et remplacer la branche `tv` :

```ts
export async function updateProgress(
  deps: Deps, userId: string, ref: Ref,
  input: { season?: number | null; episode?: number | null; tome?: number | null; page?: number | null; watchedEpisodes?: number[][] | null },
): Promise<LibraryEntry> {
```

Remplacer le bloc `if (work.type === "tv") { ... }` par :

```ts
  if (work.type === "tv") {
    const counts = work.episodeCounts;
    let grid: number[][];
    if (input.watchedEpisodes !== undefined && input.watchedEpisodes !== null) {
      grid = normalizeGrid(input.watchedEpisodes, counts);
    } else {
      const s = clampPositive(input.season, null) ?? base.progress?.season ?? 1;
      const epMax = counts?.[s - 1] ?? null;
      const e = clampPositive(input.episode, epMax);
      const start = base.progress?.watchedEpisodes ?? [];
      grid = normalizeGrid(e !== null ? gridWithEpisode(start, s, e) : start, counts);
    }
    const pos = derivePosition(grid);
    progress = { season: pos.season, episode: pos.episode, tome: null, page: null, watchedEpisodes: grid.some((s) => s.length) ? grid : null };
  } else if (work.type === "book") {
```

Dans la branche `book`, ajouter `watchedEpisodes: null` à l'objet `progress` :

```ts
    progress = {
      season: null, episode: null,
      tome: clampPositive(input.tome, null) ?? base.progress?.tome ?? null,
      page: clampPositive(input.page, work.pageCount) ?? base.progress?.page ?? null,
      watchedEpisodes: null,
    };
```

(La boucle de validation `for (const v of [input.season, input.episode, input.tome, input.page])` reste inchangée ; Zod borne déjà les entiers de la grille, `normalizeGrid` filtre le reste.)

- [ ] **Step 7: Normaliser le champ à la lecture Mongo**

Dans `src/server/adapters/mongo/mappers.ts`, `fromEntryDoc`, remplacer ligne 61 :

```ts
  const progress = e.progress ? { ...e.progress, watchedEpisodes: e.progress.watchedEpisodes ?? null } : null;
```

- [ ] **Step 8: Lancer les tests, vérifier le succès**

Run: `npm test -- progress`
Expected: PASS (tous les cas progress + formatProgress).

- [ ] **Step 9: Vérifier la suite complète (pas de régression de type)**

Run: `npm test`
Expected: PASS. Corriger tout littéral `EntryProgress` résiduel signalé.

- [ ] **Step 10: Commit**

```bash
git add src/server/domain/entities.ts src/lib/zod-schemas.ts src/server/application/library-entry.ts src/server/adapters/mongo/mappers.ts tests/application/progress.test.ts tests/lib/progress.test.ts
git commit -m "feat(vulu): suivi épisode par épisode des séries (watchedEpisodes, position dérivée)"
```

---

### Task 2: Livres — champ page éditable + boutons ±1/±10/±100

**Files:**
- Modify: `src/components/EntryEditor.tsx` (bloc `status === "in_progress" && workType === "book"`, ~ligne 126-135 ; ajout d'un composant `PageInput`)

**Interfaces:**
- Consumes: `pageCount: number | null`, état `page`/`setPage` existants.
- Produces: rien de réutilisé ailleurs (composant interne).

- [ ] **Step 1: Ajouter le composant `PageInput` dans `EntryEditor.tsx`**

Juste après la définition de `Stepper` (~ligne 104), ajouter :

```tsx
  const clampPage = (n: number) => Math.max(1, pageCount ? Math.min(pageCount, n) : n);
  const PageInput = () => (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <span className="w-16 text-sm text-[var(--color-text-muted)]">Page</span>
        <input
          type="number" min={1} max={pageCount ?? undefined} value={page}
          onChange={(e) => setPage(clampPage(Number(e.target.value) || 1))}
          className="w-24 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-1.5 text-center text-sm font-semibold"
        />
        {pageCount ? <span className="text-sm text-[var(--color-text-muted)]">/ {pageCount}</span> : null}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {[-100, -10, -1, 1, 10, 100].map((d) => (
          <button key={d} onClick={() => setPage((p) => clampPage(p + d))}
            className="min-w-12 rounded-full border border-[var(--color-border)] px-3 py-1 text-sm font-semibold text-[var(--color-text)] disabled:opacity-40"
            disabled={(d < 0 && page <= 1) || (d > 0 && pageCount != null && page >= pageCount)}>
            {d > 0 ? `+${d}` : d}
          </button>
        ))}
      </div>
    </div>
  );
```

- [ ] **Step 2: Remplacer le stepper « Page » par `PageInput`**

Dans le bloc `status === "in_progress" && workType === "book"`, remplacer :

```tsx
          <Stepper label="Page" value={page} set={setPage} max={pageCount} />
```
par :
```tsx
          <PageInput />
```
(« Tome » garde son `Stepper` inchangé.)

- [ ] **Step 3: Vérification manuelle**

Run: `npm run dev`, ouvrir une œuvre livre, statut « En cours ».
Expected : taper une page dans le champ met à jour la valeur ; `+100`/`−100`/`+10`/`−10`/`±1` ajustent et plafonnent à `[1, pageCount]` ; « Enregistrer » persiste (vérifier via rechargement). Lancer aussi `npm test` (aucune régression).

- [ ] **Step 4: Commit**

```bash
git add src/components/EntryEditor.tsx
git commit -m "feat(vulu): saisie rapide de la page d'un livre (champ éditable + ±1/±10/±100)"
```

---

### Task 3: Séries — grille d'épisodes cochables dans `EntryEditor`

**Files:**
- Modify: `src/components/EntryEditor.tsx` (état initial `watchedEpisodes` ~ligne 31-34 ; bloc `status === "in_progress" && workType === "tv"`, ~ligne 116-125 ; `saveProgress` ~ligne 36-49)

**Interfaces:**
- Consumes: `episodeCounts: number[] | null`, `initial?.progress?.watchedEpisodes`, `api.put("/api/works/progress", { ref, watchedEpisodes })` (Task 1).
- Produces: rien de réutilisé ailleurs.

- [ ] **Step 1: État local de la grille**

Après la ligne `const [episode, setEpisode] = useState(...)` (~ligne 32), ajouter :

```tsx
  const [watched, setWatched] = useState<number[][]>(() => {
    const init = initial?.progress?.watchedEpisodes;
    if (init) return init.map((s) => [...s]);
    return (episodeCounts ?? []).map(() => []);
  });

  const toggleEp = (si: number, ep: number) =>
    setWatched((prev) => {
      const next = prev.map((s) => [...s]);
      while (next.length <= si) next.push([]);
      const i = next[si].indexOf(ep);
      if (i >= 0) next[si].splice(i, 1); else next[si].push(ep);
      next[si].sort((a, b) => a - b);
      return next;
    });

  const toggleSeason = (si: number, count: number) =>
    setWatched((prev) => {
      const next = prev.map((s) => [...s]);
      while (next.length <= si) next.push([]);
      const full = next[si].length === count;
      next[si] = full ? [] : Array.from({ length: count }, (_, k) => k + 1);
      return next;
    });
```

- [ ] **Step 2: Envoyer la grille dans `saveProgress`**

Dans `saveProgress`, remplacer la ligne qui construit le corps pour la TV :

```tsx
      if (workType === "tv") { body.season = season; body.episode = episode; }
```
par :
```tsx
      if (workType === "tv") { body.watchedEpisodes = watched; }
```
(La branche `book` `body.tome`/`body.page` reste inchangée.)

- [ ] **Step 3: Remplacer les steppers TV par la grille**

Remplacer le contenu du bloc `status === "in_progress" && workType === "tv"` (les deux `<Stepper .../>`) par la grille, en gardant les boutons Enregistrer/Partager :

```tsx
      {status === "in_progress" && workType === "tv" && (
        <div className="mb-4 flex flex-col gap-3 rounded-xl border border-[var(--color-border)] p-3">
          {(episodeCounts ?? []).map((count, si) => {
            const done = watched[si]?.length ?? 0;
            return (
              <div key={si} className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold">Saison {si + 1}
                    <span className="ml-2 text-xs font-normal text-[var(--color-text-muted)]">{done}/{count}</span>
                  </span>
                  <button onClick={() => toggleSeason(si, count)}
                    className="rounded-full border border-[var(--color-border)] px-3 py-0.5 text-xs font-semibold text-[var(--color-text-muted)]">
                    {done === count ? "Tout décocher" : "Tout cocher"}
                  </button>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {Array.from({ length: count }, (_, k) => k + 1).map((ep) => {
                    const on = watched[si]?.includes(ep) ?? false;
                    return (
                      <button key={ep} onClick={() => toggleEp(si, ep)}
                        className={`h-8 min-w-8 rounded-full border px-2 text-sm font-semibold ${on ? "border-[var(--color-primary)] bg-[var(--color-primary)] text-white" : "border-[var(--color-border)] text-[var(--color-text-muted)]"}`}>
                        {on ? "✓" : ""}{ep}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
          {!episodeCounts && <p className="text-sm text-[var(--color-text-muted)]">Nombre d'épisodes inconnu pour cette série.</p>}
          <div className="flex gap-2 pt-1">
            <button onClick={() => saveProgress(false)} disabled={busy} className="rounded-full bg-[var(--color-primary)] px-4 py-1.5 text-sm font-semibold text-white disabled:opacity-50">Enregistrer</button>
            <button onClick={() => saveProgress(true)} disabled={busy} className="rounded-full border border-[var(--color-primary)] px-4 py-1.5 text-sm font-semibold text-[var(--color-primary)]">Partager ce jalon</button>
          </div>
        </div>
      )}
```

- [ ] **Step 4: Nettoyer les états devenus inutiles**

Les états `season`/`episode`/`setSeason`/`setEpisode` ne sont plus lus dans le rendu TV. Les retirer **uniquement s'ils ne sont plus référencés ailleurs** dans le fichier (vérifier avec une recherche `season`/`episode` dans `EntryEditor.tsx`). S'ils subsistent (ex. usage résiduel), les laisser. Ne pas toucher `tome`/`page`.

Run: `grep -n "season\|episode" src/components/EntryEditor.tsx`
Expected : plus aucune référence à `season`/`episode`/`setSeason`/`setEpisode` hors éventuel commentaire → supprimer leurs `useState`.

- [ ] **Step 5: Vérification manuelle**

Run: `npm run dev`, ouvrir une série (ex. Breaking Bad), statut « En cours ».
Expected : une section par saison ; cliquer une pastille la coche/décoche (coche libre) ; « Tout cocher » remplit/vide la saison ; compteur `x/total` à jour ; « Enregistrer » persiste (recharger → grille conservée, « En cours » affiche la position dérivée S/E). Lancer `npm test`.

- [ ] **Step 6: Commit**

```bash
git add src/components/EntryEditor.tsx
git commit -m "feat(vulu): grille d'épisodes cochables par saison pour les séries"
```

---

### Task 4: Shelf « En cours » — bouton `+10` pour les livres

**Files:**
- Modify: `src/components/InProgressShelf.tsx` (`bump` ~ligne 16-25 ; rendu du bouton ~ligne 38-42)

**Interfaces:**
- Consumes: `updateProgress` via `api.put("/api/works/progress", ...)` ; `body.page`.
- Produces: rien.

- [ ] **Step 1: Paramétrer `bump` avec un pas**

Remplacer la signature et le corps concerné de `bump` :

```tsx
  async function bump(it: Item, step = 1) {
    const body: Record<string, unknown> = { ref: { source: it.source, externalId: it.externalId, type: it.type } };
    if (it.type === "tv") { body.season = it.progress?.season ?? 1; body.episode = (it.progress?.episode ?? 0) + 1; }
    else if (it.type === "book") { body.page = (it.progress?.page ?? 0) + step; body.tome = it.progress?.tome ?? null; }
    else return;
```
(le reste de `bump` — `api.put` puis `setState` — inchangé.)

- [ ] **Step 2: Ajouter le bouton `+10` (livres uniquement)**

Remplacer le bloc du bouton (`it.type !== "movie" && (...)`) par :

```tsx
            {it.type !== "movie" && (
              <div className="mt-1 flex gap-1">
                <button onClick={() => bump(it)} className="flex-1 rounded-full border border-[var(--color-primary)] py-1 text-xs font-semibold text-[var(--color-primary)]">
                  +1 {it.type === "book" ? "page" : "épisode"}
                </button>
                {it.type === "book" && (
                  <button onClick={() => bump(it, 10)} className="rounded-full border border-[var(--color-primary)] px-2 py-1 text-xs font-semibold text-[var(--color-primary)]">
                    +10
                  </button>
                )}
              </div>
            )}
```

- [ ] **Step 3: Vérification manuelle**

Run: `npm run dev`, page avec l'étagère « En cours » contenant un livre en cours.
Expected : `+1 page` incrémente de 1, `+10` de 10 ; la série n'affiche que `+1 épisode`. Lancer `npm test`.

- [ ] **Step 4: Commit**

```bash
git add src/components/InProgressShelf.tsx
git commit -m "feat(vulu): bouton +10 pages sur l'étagère « En cours » (livres)"
```

---

## Self-Review

**Spec coverage :**
- Livres saisie rapide (champ + ±1/±10/±100, clamp `[1,pageCount]`) → Task 2 ✓
- Bonus `+10` shelf livres uniquement → Task 4 ✓
- Séries `watchedEpisodes: number[][]`, position dérivée, coche libre, chemin grille + legacy, normalisation Mongo, aucune migration → Task 1 ✓
- Grille UI par saison, « Tout cocher », compteur, Enregistrer/Partager conservés → Task 3 ✓
- Tests dérivation/toggle/legacy/livres → Task 1 steps 1-2 ✓

**Placeholder scan :** aucun TBD/TODO ; tout le code est fourni.

**Type consistency :** `watchedEpisodes: number[][] | null` cohérent (entities, zod `.nullable().optional()`, input `updateProgress`, helpers `normalizeGrid`/`derivePosition`/`gridWithEpisode`, état UI `watched: number[][]`, corps `body.watchedEpisodes`). `bump(it, step=1)` cohérent avec ses deux appels.
