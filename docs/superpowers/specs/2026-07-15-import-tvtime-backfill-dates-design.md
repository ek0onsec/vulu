# Import TV Time — Backfill des dates manquantes — Design

**Date :** 2026-07-15
**Statut :** Design validé
**Portée :** Étendre la dédup de l'import pour compléter les dates manquantes des
éléments déjà présents, sans rien écraser, et détailler l'opération dans le
rapport final.

## Contexte

Le moteur d'import TV Time (parser, mapping, service `importTvTime`, endpoints,
modal) est livré. Aujourd'hui la dédup **skippe entièrement** tout épisode/film
déjà présent dans la bibliothèque de l'utilisateur.

Problème remonté : si l'utilisateur a déjà coché ses épisodes/films **mais sans
renseigner les dates**, l'import ne complète pas ces dates (il skippe). L'objectif
est que l'import **remplisse uniquement les dates absentes** des éléments déjà vus,
sans jamais écraser une donnée existante, et l'indique dans le rapport.

Décision produit (utilisateur) : preview rapide inchangée ; le détail
(nouveaux / dates complétées / déjà à jour) apparaît dans le **rapport final**
(une seule passe, pas d'analyse lente avant validation).

### État actuel (référence)

Dans `src/server/application/import-tvtime.ts` :
- Épisode : `const ex = await deps.episodeEntries.findOne(...)`; si `ex` existe →
  `episodesSkipped++`, `continue`. Sinon → création (`episodesAdded`).
- Film : `const existing = await deps.entries.findByUserAndWork(...)`; si existe →
  `continue` (skip total). Sinon → création `done` (`moviesImported`).
- `recomputeSeriesEntry` appelé si `added > 0`.

Modèle : `EpisodeEntry.watchedAt: Date | null`, `LibraryEntry.completedAt: Date | null`.

## Règles de backfill (strictes — on ne remplit qu'un champ date vide)

### Épisodes

Pour chaque épisode vu de l'import `(season, episode, watchedAt)` :
- **N'existe pas** → créé (`watched: true`, `watchedAt`, privé). → `episodesAdded`.
- **Existe, vu, sans date** (`ex.watched === true && ex.watchedAt === null`) →
  on met à jour **uniquement** `watchedAt` (import), en conservant tout le reste
  (audiences, note, texte). → `datesBackfilled`.
- **Existe avec une date** (`ex.watchedAt !== null`) → inchangé. → `episodesSkipped`.
- **Existe mais non vu** (`ex.watched === false`) → inchangé (on ne re-coche pas
  ce que l'utilisateur a laissé/retiré). → `episodesSkipped`.

### Films

Pour chaque film vu de l'import `(name, year, watchedAt)` mappé vers un `Work` :
- **N'existe pas** en bibliothèque → créé `status: "done"`, `completedAt`, privé.
  → `moviesImported`.
- **Existe en `done` sans date** (`entry.status === "done" && entry.completedAt === null`)
  → on met à jour **uniquement** `completedAt` (import), reste inchangé.
  → `datesBackfilled`.
- **Existe autrement** (déjà daté, ou statut ≠ `done` comme « à voir ») →
  inchangé (skip total).

### Invariants
- On ne modifie **jamais** une date déjà renseignée.
- On ne change **jamais** le statut vu/non-vu ni « à voir ».
- On ne remplit qu'un champ date **null** sur un élément déjà marqué comme vu.
- Import toujours **privé** (les entrées touchées gardent leurs audiences existantes ; aucune n'est rendue publique).

### Recompute série
`recomputeSeriesEntry` est appelé si la série a été **touchée** : au moins un
épisode ajouté **ou** une date complétée (`added > 0 || backfilledInSeries > 0`).

## Rapport enrichi

Ajout d'un compteur à `ImportReport` (dans `src/server/domain/entities.ts`) :

```ts
export interface ImportReport {
  seriesImported: number;
  seriesToWatch: number;
  episodesAdded: number;
  episodesSkipped: number;
  datesBackfilled: number;   // épisodes + films dont la date manquante a été complétée
  moviesImported: number;
  unmatched: { series: string[]; movies: string[] };
}
```

`datesBackfilled` cumule les épisodes et les films dont la date a été complétée.
`episodesSkipped` ne compte plus que les épisodes réellement inchangés (déjà datés
ou non vus).

## UI — modal de fin

La modal (`TvTimeImportModal`, état « done ») ajoute une ligne quand
`report.datesBackfilled > 0` :

> **{datesBackfilled} dates complétées sur des éléments déjà présents**

La modal de **prévalidation** (détection) reste inchangée.

## Tests

Dans `tests/application/import-tvtime.test.ts` (repos in-memory + `FakeCatalog`) :
- Épisode déjà vu **sans date** → après import, `watchedAt` = date de l'import,
  `datesBackfilled = 1`, `episodesSkipped = 0`.
- Épisode déjà vu **avec date** → `watchedAt` inchangé, `episodesSkipped = 1`,
  `datesBackfilled = 0`.
- Épisode existant **non vu** → inchangé.
- Film `done` **sans date** → `completedAt` complété, `datesBackfilled = 1`.
- Film déjà daté ou « à voir » (`planned`) → inchangé.
- Aucune entrée touchée ne devient publique (audiences inchangées).

## Hors périmètre

- Détection exacte du backfill **avant** validation (nécessiterait le mapping TMDB
  complet, lent). Le détail reste dans le rapport final.
- Notes et commentaires (déjà écartés).
