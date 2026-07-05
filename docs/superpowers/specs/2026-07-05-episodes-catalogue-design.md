# Épisodes — Incrément 1 : catalogue & cache des métadonnées d'épisodes

Date : 2026-07-05
Statut : validé (design)

## Contexte

Feature globale : **notation/commentaire par épisode + page série en onglets**
(voir la décomposition en 2 incréments). Cet incrément 1 est la brique
**catalogue** dont dépend tout l'affichage.

Aujourd'hui le catalogue ne connaît que le **nombre d'épisodes par saison**
(`WorkDetails.episodeCounts`), pas les titres/dates/synopsis. Les œuvres sont mises
en cache dans Mongo via `WorkRepository` (`findByExternal` / `upsert`, champ
`cachedAt`), fetchées une seule fois depuis TMDB (`get-work.ts` →
`getOrImportWork`). On calque ce mécanisme pour les épisodes.

## Objectif

Étant donné une série (`source`, `externalId`) et un numéro de saison, retourner
les épisodes de cette saison — numéro, titre, date de diffusion, synopsis —
fetchés une fois chez TMDB puis mis en cache Mongo, avec rafraîchissement par TTL.

## Décisions validées

- **Champs par épisode** : numéro, titre, date de diffusion, synopsis. **Pas
  d'image**.
- **Granularité** : **par saison, à la demande** (1 appel TMDB par saison
  consultée). Clé de cache = `(source, externalId, season)`.
- **TTL de cache** : **7 jours** (les dates/épisodes à venir des séries en cours
  évoluent). Cache périmé → refetch ; si le refetch échoue mais qu'un cache
  périmé existe, on retombe dessus (résilience).
- **Périmètre** : backend uniquement. Route API et UI → incrément 2. Vérifiable
  isolément par tests application.

## Conception (ports & adapters)

### 1. Port catalogue — `src/server/ports/catalog.ts`

Nouveau type :

```ts
export interface EpisodeSummary {
  number: number;            // numéro d'épisode dans la saison
  title: string | null;      // nom de l'épisode
  airDate: string | null;    // "YYYY-MM-DD" ou null
  overview: string | null;   // synopsis
}
```

Nouvelle méthode sur `CatalogProvider` :

```ts
getSeasonEpisodes(externalId: string, season: number): Promise<EpisodeSummary[]>;
```

Série uniquement ; retourne `[]` si la saison est absente ou vide.

### 2. Adaptateur TMDB — `src/server/adapters/catalog/tmdb-catalog.ts`

Implémente `getSeasonEpisodes` :
- Appel `GET /tv/{externalId}/season/{season}?language=fr-FR` (mêmes helpers de
  requête/clé API que les appels existants du fichier).
- Map `episodes[]` → `{ number: episode_number, title: name ?? null,
  airDate: air_date ?? null, overview: overview?.trim() ? overview : null }`.
- Réponse absente / `episodes` manquant / erreur réseau → `[]`.
- Trie par `number` croissant.

Autres implémentations de `CatalogProvider` (obligatoire, sinon le build casse) :
- `CompositeCatalog` (`composite-catalog.ts`) : délègue `getSeasonEpisodes(externalId, season)`
  à `this.films.getSeasonEpisodes(externalId, season)` (TMDB ; les livres n'ont pas
  d'épisodes).
- `GoogleBooksCatalog` (`google-books-catalog.ts`) : stub retournant `[]`.

### 3. Cache — entité + repository (miroir de `WorkRepository`)

Entité (dans `src/server/domain/entities.ts`) :

```ts
export interface SeasonEpisodes {
  source: WorkSource;
  externalId: string;
  season: number;
  episodes: EpisodeSummary[];
  cachedAt: Date;
}
```

`EpisodeSummary` est réexporté/importé depuis le port catalogue pour éviter la
duplication (l'entité référence le type du port ; suivre le sens d'import déjà en
place dans le repo — sinon définir `EpisodeSummary` dans `entities.ts` et l'importer
dans le port). **Décision : définir `EpisodeSummary` dans `entities.ts`** (couche
domaine) et l'importer dans `ports/catalog.ts`, cohérent avec `WorkType`/`PersonRole`
déjà définis dans les entités et importés par le port.

Port (dans `src/server/ports/repositories.ts`) :

```ts
export interface EpisodeCacheRepository {
  find(source: WorkSource, externalId: string, season: number): Promise<SeasonEpisodes | null>;
  upsert(entry: SeasonEpisodes): Promise<void>;
}
```

Adaptateurs :
- **Mémoire** (`src/server/adapters/memory/index.ts`) : `Map` clé
  `${source}:${externalId}:${season}`.
- **Mongo** (`src/server/adapters/mongo/repositories.ts` + `mappers.ts`) :
  collection `episode_cache`, document clé composite `(source, externalId, season)`
  (index unique), mapper `toEpisodeCacheDoc` / `fromEpisodeCacheDoc`.

Câblage : ajouter `episodeCache` à `Deps` et au container (mémoire + mongo), comme
les autres repositories.

### 4. Application — `src/server/application/get-episodes.ts`

```ts
const EPISODE_CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 jours

export async function getSeasonEpisodes(
  deps: Deps,
  ref: { source: WorkSource; externalId: string; type: WorkType },
  season: number,
): Promise<EpisodeSummary[]>
```

Logique :
1. Si `ref.type !== "tv"` → retourner `[]`.
2. `cached = await deps.episodeCache.find(ref.source, ref.externalId, season)`.
3. Si `cached` **et** `now - cached.cachedAt < TTL` → retourner `cached.episodes`.
4. Sinon : `episodes = await deps.catalog.getSeasonEpisodes(ref.externalId, season)`.
   - En cas d'exception du catalogue **et** `cached` existant → retourner
     `cached.episodes` (fallback périmé).
   - Sinon `upsert({ source, externalId, season, episodes, cachedAt: now })` et
     retourner `episodes`.

Validation : `season` doit être un entier ≥ 1 (sinon `[]`).

### 5. Tests — `tests/application/episodes.test.ts`

Extension du `FakeCatalog` (`tests/helpers/fake-catalog.ts`) : ajouter
`getSeasonEpisodes` retournant des épisodes canned pour la saison 1 de « 1396 »
(Breaking Bad), avec un compteur d'appels pour vérifier le cache.

Cas de test :
1. Premier appel → fetch catalogue + map correct (numéro, titre, date, synopsis).
2. Deuxième appel (même saison) → servi du cache : le catalogue n'est appelé
   **qu'une fois**.
3. Cache périmé (cachedAt ancien, via horloge injectable) → refetch (compteur = 2).
4. `type` livre ou `season` < 1 → `[]` sans appel catalogue.
5. Fallback : si le catalogue lève une exception alors qu'un cache existe →
   renvoie le cache.

## Fichiers touchés

- `src/server/domain/entities.ts` — `EpisodeSummary`, `SeasonEpisodes`.
- `src/server/ports/catalog.ts` — import `EpisodeSummary`, méthode `getSeasonEpisodes`.
- `src/server/ports/repositories.ts` — `EpisodeCacheRepository`.
- `src/server/adapters/catalog/tmdb-catalog.ts` — impl `getSeasonEpisodes`.
- `src/server/adapters/catalog/composite-catalog.ts` — délègue `getSeasonEpisodes` à TMDB.
- `src/server/adapters/catalog/google-books-catalog.ts` — impl stub `[]`.
- `src/server/adapters/memory/index.ts` — `InMemoryEpisodeCache`.
- `src/server/adapters/mongo/repositories.ts` + `mappers.ts` — `MongoEpisodeCache`.
- `src/server/container.ts` (et types `Deps`) — câblage `episodeCache`.
- `src/server/application/get-episodes.ts` — `getSeasonEpisodes` + TTL.
- `tests/helpers/fake-catalog.ts` — `getSeasonEpisodes` + compteur.
- `tests/application/episodes.test.ts` — cas ci-dessus.

## Hors périmètre (→ incrément 2)

Route API (`GET` épisodes), page série en onglets, onglet Épisodes, modèle de
suivi par épisode (vu/date/note/commentaire).
