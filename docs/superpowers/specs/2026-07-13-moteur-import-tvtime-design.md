# Moteur d'import TV Time → Vulu — Design

**Date :** 2026-07-13
**Statut :** Design validé
**Portée :** Moteur d'import (parsing + mapping + service) et CLI de dev pour le
valider sur le bac à sable local. L'endpoint HTTP d'upload ZIP et le câblage du
bouton UI (avec exécution asynchrone) font l'objet d'un plan de suivi séparé.

## Contexte

Suite de l'étape 1 (voir `2026-07-13-import-tvtime-etape1-design.md`). L'UI coquille
et le bac à sable Mongo local (données clonées de Margot) existent. Ce design
définit le moteur qui transforme un export GDPR TV Time en entrées Vulu.

L'export est un **dossier de CSV** (`/home/chamberlain/Desktop/gdpr-data-tvtime-margot/`).
Le moteur est développé et validé via un **CLI de dev** tournant contre le Mongo
local, sans HTTP ni ZIP à ce stade.

### Audit des données — ce que l'export permet réellement

| Objectif | Faisabilité | Source |
|---|---|---|
| Séries vues + épisodes vus + dates | ✅ Fiable | `followed_tv_show.csv` (séries suivies, `tv_show_id` = **TheTVDB**) + `tracking-prod-records-v2.csv` (9055 visionnages, `s_id`=TheTVDB, saison, épisode, `created_at`) |
| Séries « à voir » | ⚠️ Approximé | Suivie mais 0 épisode vu → `planned` (pas de vraie watchlist dans l'export) |
| Films vus + dates | ⚠️ Nom+année | `tracking-prod-records.csv` (entity_type=movie, 466 lignes, 445 films) — **aucun ID**, seulement `movie_name` + `release_date`. Date ≈ `created_at` |
| Notes | ❌ Écarté | Aucune colonne de note fiable ; valeurs en fin de `vote_key` erratiques (emotions TV Time). Décision : ne pas importer |
| Commentaires | ❌ Écarté | `comments-prod-comments.csv` **sans colonne de texte** — contenu absent de l'export |

**Mapping d'ID validé** :
- Séries : `GET /find/{tvdbId}?external_source=tvdb_id` → `tv_results[0].id` (TMDB). Ex. 73762 → 1416 (Grey's Anatomy).
- Films : `GET /search/movie?query={title}&year={year}` → `results[0].id`. Ex. « The Hunger Games: Mockingjay - Part 1 » 2014 → 131631.

### Primitives Vulu réutilisées

- `getOrImportWork(deps, ref)` — dédup catalogue par `(source, externalId, type)`, importe si absent.
- `recomputeSeriesEntry(deps, userId, ref, work)` — recalcule statut/progression d'une série depuis ses épisodes vus (à **exporter** depuis `episode-entry.ts`, aujourd'hui privé). Réutilise `normalizeGrid`/`derivePosition`/`deriveSeriesStatus`.
- Repos : `deps.works`, `deps.entries`, `deps.episodeEntries` ; `deps.ids`, `deps.clock`.
- Par défaut, un épisode/entry créé a `audiences {public:false, circle:false, communityIds:[]}` et `activityAt: null` → **privé, hors feed**.

## Règles d'import (dédup stricte — le contenu Vulu prime)

**Principe absolu : aucun doublon, aucun écrasement. Ce qui est déjà sur Vulu prime sur l'import.**

### Séries + épisodes vus

Pour chaque série (union de `followed_tv_show` et des `s_id` présents dans
`tracking-prod-records-v2`) :

1. Mapper `tvdbId` → TMDB via `findByTvdbId`. Si échec → ajouter au rapport
   (`unmatched.series`) et passer à la suivante.
2. `getOrImportWork` (type `tv`) pour obtenir/importer le `Work`.
3. Pour chaque épisode vu `(season, episode)` distinct (dédupliqué des rewatch,
   `watchedAt` = plus ancien `created_at`) :
   - Si un `EpisodeEntry` existe déjà pour `(userId, workId, season, episode)` →
     **skip** (compté dans `episodesSkipped`, jamais modifié).
   - Sinon → créer l'`EpisodeEntry` (`watched: true`, `watchedAt`, privé) et
     compter dans `episodesAdded`.
4. Après avoir traité les épisodes de la série, appeler `recomputeSeriesEntry`
   **une fois** : la progression/le statut de l'entrée série sont recalculés
   depuis l'ensemble des épisodes vus (existants + ajoutés). L'ensemble ne fait
   que croître → statut monotone (jamais de recul). `recomputeSeriesEntry` ne
   touche ni la note ni le texte de l'entrée existante.

### Séries « à voir »

Série suivie sans aucun épisode vu (ni dans l'import ni sur Vulu) :
- Si **aucune** `LibraryEntry` n'existe pour ce `Work` → créer une entrée
  `status: "planned"` (privée). Compté dans `seriesToWatch`.
- Si une entrée existe déjà (quel que soit son statut) → **skip total**.

### Films vus

Pour chaque film distinct `(movie_name, année)` de `tracking-prod-records.csv`
(entity_type=movie), `watchedAt` = plus ancien `created_at` :

1. Mapper via `findMovieByTitleYear(title, year)`. Si échec/ambigu → ajouter à
   `unmatched.movies` et passer au suivant.
2. `getOrImportWork` (type `movie`).
3. Si une `LibraryEntry` existe déjà pour ce `Work` → **skip total** (le film est
   une unité indivisible). Sinon → créer une entrée `status: "done"`,
   `completedAt: watchedAt`, privée. Compté dans `moviesImported`.

## Architecture (Ports & Adapters)

### Unités et frontières

- **Parser** — `src/server/import/tvtime-parser.ts`
  - Fonction **pure** `parseTvTimeExport(files: TvTimeCsvFiles): TvTimeExport`.
  - `TvTimeCsvFiles` = `{ followedShows: string; trackingV2: string; trackingV1: string }` (contenu texte des CSV concernés).
  - Sortie :
    ```ts
    interface TvTimeExport {
      series: TvTimeSeries[];   // union followed + vus
      movies: TvTimeMovie[];
    }
    interface TvTimeSeries {
      tvdbId: string;
      name: string;
      followedAt: Date | null;
      watched: { season: number; episode: number; watchedAt: Date }[]; // dédupliqué, trié
    }
    interface TvTimeMovie { name: string; year: number | null; watchedAt: Date }
    ```
  - Inclut un parseur CSV interne robuste (guillemets doubles, virgules dans les
    champs, `""` échappé). Ignore les lignes sans saison/épisode valides.
  - Zéro I/O, entièrement testable.

- **Mapping catalogue** — extension du port `CatalogProvider`
  (`src/server/ports/catalog.ts`) + adapter TMDB + `FakeCatalog` :
  ```ts
  findByTvdbId(tvdbId: string): Promise<{ externalId: string } | null>;
  findMovieByTitleYear(title: string, year: number | null): Promise<{ externalId: string } | null>;
  ```
  - TMDB : `findByTvdbId` → `/find/{tvdbId}?external_source=tvdb_id`, renvoie
    `tv_results[0].id` en string ou `null`. `findMovieByTitleYear` →
    `/search/movie?query&year`, renvoie `results[0].id` ou `null`.
  - FakeCatalog : implémentations déterministes pour les tests.

- **Service d'import** — `src/server/application/import-tvtime.ts`
  ```ts
  interface ImportReport {
    seriesImported: number;    // séries avec ≥1 épisode traité
    seriesToWatch: number;
    episodesAdded: number;
    episodesSkipped: number;
    moviesImported: number;
    unmatched: { series: string[]; movies: string[] };
  }
  async function importTvTime(deps: Deps, userId: string, data: TvTimeExport): Promise<ImportReport>;
  ```
  - Orchestration des règles ci-dessus. Injecté via `Deps`. Aucun accès direct à
    Mongo/HTTP : uniquement les ports.

- **CLI de dev** — `scripts/import-tvtime.mjs`
  - Usage : `node scripts/import-tvtime.mjs <chemin-dossier-export>` contre le
    Mongo local (`local-mongo` doit tourner ; email cible = Margot).
  - Lit les CSV du dossier, appelle `parseTvTimeExport` puis `importTvTime` avec
    un `Deps` câblé sur Mongo local + catalogue TMDB réel, affiche l'`ImportReport`.
  - Script npm `import:tvtime`.

### Modification annexe

- `src/server/application/episode-entry.ts` : **exporter** `recomputeSeriesEntry`
  (aujourd'hui fonction module privée) pour réutilisation par le service d'import.
  Aucun changement de comportement.

## Rapport d'import

`ImportReport` renvoyé par le service et affiché par le CLI. Les non-mappés
(série TVDB introuvable, film nom+année sans résultat) sont **listés** dans
`unmatched`, jamais silencieusement perdus.

## Tests

- **Parser** (`tests/import/tvtime-parser.test.ts`) : champs entre guillemets avec
  virgules (titres), dédup des rewatch, `watchedAt` = plus ancien `created_at`,
  lignes sans saison/épisode ignorées, union séries followed + vues, films
  nom+année.
- **Service** (`tests/application/import-tvtime.test.ts`) avec `FakeCatalog` +
  repos in-memory :
  - dédup épisode : un épisode déjà présent n'est pas modifié (`episodesSkipped`),
    les manquants sont ajoutés (`episodesAdded`), statut recalculé.
  - film déjà en biblio → skip total.
  - série « à voir » créée seulement si aucune entrée n'existe.
  - **privacy** : toute entrée/épisode créé a `audiences` tout à false et
    `activityAt: null`.
  - non-mappés listés dans `unmatched`.
- **Validation manuelle** : `npm run import:tvtime <dossier>` sur le bac à sable,
  puis inspection de la bibliothèque de Margot (aucun doublon, épisodes manquants
  ajoutés, rien de public).

## Hors périmètre (plan de suivi)

- Endpoint HTTP `/api/import/tvtime` (upload ZIP, dézip serveur, auth).
- Câblage du bouton « Analyser mon export » de la section paramètres.
- Exécution asynchrone (job + progression) pour absorber les ~1300 appels TMDB
  sans timeout HTTP.
- Notes et commentaires (écartés faute de données exploitables dans l'export).
