# Séries : statut dérivé des épisodes + grille rapide Aperçu + migration

Date : 2026-07-05
Statut : validé (design)

## Contexte

Depuis la chaîne « épisodes », le suivi par épisode vit dans `EpisodeEntry` ; la
`LibraryEntry` d'une série a un `progress.watchedEpisodes` (grille dérivée) et un
`status`. Aujourd'hui `updateEpisode` passe une série `planned` en `in_progress`
dès qu'un épisode est coché, mais ne la marque **jamais** `done` ; à l'inverse,
`rateOrReviewWork` et le bouton « Vu » forcent `done` sans lien avec les épisodes.
Résultat : des séries apparaissent « Vu » alors que tous les épisodes ne sont pas
cochés, et l'onglet Aperçu n'a plus d'accès rapide de cochage (grille retirée en 2a).

## Décisions validées

- **Statut de série dérivé des épisodes** : « Vu » (done) **ssi tous** les épisodes
  cochés (total = somme `episodeCounts`) ; au moins un coché → `in_progress` ;
  aucun → `planned`. Décocher le dernier repasse `in_progress`.
- **Bouton « Vu » d'une série** coche toute la série ; **noter** une série ne force
  plus `done` (statut suit les épisodes).
- **Grille rapide** rétablie sur l'onglet **Aperçu**, source unique = `EpisodeEntry`.
- **Migration** : les séries `done` dont tous les épisodes ne sont pas cochés
  passent `in_progress` (script idempotent, dry-run d'abord).
- `episodeCounts` inconnu → on ne peut pas prouver l'incomplétude → statut inchangé.

## Conception

### 1. Dérivation du statut — `src/server/application/series-status.ts` (nouveau)

Fonction pure, réutilisée partout :

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

### 2. `updateEpisode` applique la dérivation — `episode-entry.ts`

Là où `updateEpisode` recalcule `progress`, remplacer la logique de statut
(`status: libEntry.status === "planned" ? "in_progress" : libEntry.status`) par :

```ts
const derived = deriveSeriesStatus(hasAny ? norm : null, work.episodeCounts);
// completedAt posé quand on bascule en done et qu'il est absent
```
- `status = derived` ;
- si `derived === "done"` et `completedAt` absent → `completedAt = now` ;
- si `derived !== "done"` → `completedAt = null` (on ne « garde » pas une date de
  fin quand la série redevient en cours).

### 3. Cocher toute la série — `markAllEpisodes`

Nouvelle fonction application :

```ts
export async function markAllEpisodes(deps, userId, ref, watched: boolean): Promise<void>
```
- charge l'œuvre ; pour chaque saison `i` (0..episodeCounts.length-1) et chaque
  épisode `1..episodeCounts[i]`, `upsert` une `EpisodeEntry` `watched` (avec
  `watchedAt = now` si `watched`, sinon `null`) — en une passe ;
- recalcule `progress` + `status` (dérivé) de la `LibraryEntry` comme `updateEpisode`.

Route : `PUT /api/works/[id]/episodes/all` body `{ watched: boolean }` → `markAllEpisodes`.

### 4. Note d'une série ne force plus `done` — `rateOrReviewWork`

Dans `rateOrReviewWork`, pour une œuvre de type **tv**, ne pas écrire
`status: "done"` : conserver le statut dérivé des épisodes existants
(`deriveSeriesStatus(entry.progress?.watchedEpisodes ?? null, work.episodeCounts)`).
Films/livres : comportement inchangé (`done`). `activityAt`/note/texte inchangés.
(`rateOrReviewWork` charge déjà l'œuvre via `loadOrCreateEntry`/`getOrImportWork` —
récupérer `work.type`/`episodeCounts`.)

### 5. UI

**Aperçu — `SeasonGrid`** (`src/components/SeasonGrid.tsx`, client) :
- props `workId`, `episodeCounts`, `initialWatched: number[][]` ;
- rend par saison les pastilles numérotées + « tout cocher » (agencement de
  l'ancienne grille) ; état local initialisé depuis `initialWatched` ;
- toggle épisode → `PUT /api/works/[id]/episodes` (`{ season, episode, watched }`) ;
  « tout cocher » saison → plusieurs PUT (ou un par épisode). `router.refresh()` en
  fin pour rafraîchir le statut affiché.
- Rendu dans `SeriesTabs` onglet **Aperçu**, au-dessus des `children`, uniquement
  pour les séries : `SeriesTabs` reçoit `initialWatched={entry?.progress?.watchedEpisodes ?? null}`
  et affiche `<SeasonGrid …/>` avant `children`.

**EntryEditor — bouton « Vu » série** : pour `workType === "tv"`, le clic sur le
segment « Vu ✓ » n'ouvre plus le flux note→done ; il appelle
`PUT /api/works/[id]/episodes/all { watched: true }` puis `router.refresh()`. (Le
segment « À voir » reste `planned` ; « En cours » reste l'état intermédiaire.)

### 6. Migration — `scripts/migrate-series-in-progress.mjs`

Script Node ESM autonome (pattern de `scripts/seed-demo.mjs`, driver `mongodb`) :
- URI `process.env.MONGODB_URI`, base `process.env.MONGODB_DB` (défaut `"vulu"`) ;
- collection `entries` : pour chaque entrée `status === "done"`, charger le `works`
  correspondant (`workId`) ; ne traiter que `work.type === "tv"` ;
- calcul « tous cochés » : `watched = somme(progress.watchedEpisodes)` ,
  `total = somme(work.episodeCounts)` ; si `episodeCounts` absent → **ignorer**
  (statut inchangé) ; si `watched < total` → `updateOne({ status: "in_progress",
  completedAt: null })` ;
- **idempotent** : une entrée déjà `in_progress` n'est pas reconsidérée (filtre
  `status: "done"`) ; relancer ne change rien de plus ;
- **`--dry-run`** (défaut si `--apply` absent) : ne fait qu'afficher le nombre
  d'entrées qui seraient modifiées, sans écrire ; `--apply` pour exécuter ;
- rapport final : `X séries done → in_progress (sur Y séries done, Z ignorées faute d'episodeCounts)`.

Exécution : `MONGODB_URI=… MONGODB_DB=vulu node scripts/migrate-series-in-progress.mjs`
(dry-run), puis `… --apply`. Films/livres jamais touchés.

### 7. Tests

- `deriveSeriesStatus` : 0 coché → planned ; partiel → in_progress ; tous → done ;
  `episodeCounts` null + coché → in_progress (jamais done).
- `updateEpisode` : cocher tous les épisodes → `done` + `completedAt` ; décocher le
  dernier → `in_progress` + `completedAt` null.
- `markAllEpisodes` : `watched:true` → toutes les `EpisodeEntry` cochées + `done` ;
  `watched:false` → toutes décochées + `planned`.
- `rateOrReviewWork` sur une série partiellement vue → **reste `in_progress`**
  (pas `done`) ; sur un film → `done` (inchangé).

## Fichiers touchés

- `src/server/application/series-status.ts` — `deriveSeriesStatus` (nouveau).
- `src/server/application/episode-entry.ts` — dérivation dans `updateEpisode` + `markAllEpisodes`.
- `src/server/application/library-entry.ts` — `rateOrReviewWork` (tv : statut dérivé).
- `src/app/api/works/[id]/episodes/all/route.ts` — PUT (nouveau).
- `src/components/SeasonGrid.tsx` — grille Aperçu (nouveau).
- `src/components/SeriesTabs.tsx` — rend `SeasonGrid` sur Aperçu + prop `initialWatched`.
- `src/app/work/[id]/page.tsx` — passe `initialWatched` à `SeriesTabs`.
- `src/components/EntryEditor.tsx` — bouton « Vu » série → markAll.
- `scripts/migrate-series-in-progress.mjs` — migration (nouveau).
- Tests : `series-status`, `episode-entry`, `library-entry`.

## Hors périmètre

Notifications ; changement du modèle de complétion pour films/livres.
