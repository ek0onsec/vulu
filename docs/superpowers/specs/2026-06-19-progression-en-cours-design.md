# Progression « en cours » — Design

Date : 2026-06-19
Statut : approuvé (à implémenter)

## Objectif

Transformer le suivi binaire (`à voir` / `vu`) en un vrai suivi de progression — moteur
d'ouverture quotidienne. Permettre de reprendre une série à `S1 E5`, un livre à `Tome 3, p. 230`,
et de partager des jalons sans surcharger le feed.

Décisions de cadrage (validées) :
- Livres : suivi **tome + page**.
- Feed : **chaque mise à jour est partageable** (jalon explicite), mais les incréments
  silencieux ne remontent pas le feed.
- Films : statut **« en cours »** possible, **sans détail** (`progress: null`).
- Bandeau « Reprends où tu en étais » : **sur le profil uniquement** (pas sur le feed).

## 1. Modèle de données

`EntryStatus` : `"planned" | "in_progress" | "done"` (ajout de `in_progress`).

`LibraryEntry` gagne :

```ts
progress: {
  season: number | null;   // séries
  episode: number | null;  // séries
  tome: number | null;     // livres
  page: number | null;     // livres
} | null;                  // film « en cours » = null (statut seul)
activityAt: Date;          // timestamp d'ordonnancement du feed (cf. §4)
```

`Work` gagne deux champs optionnels (remplis best-effort au cache, **aucun appel API
supplémentaire** : TMDB renvoie déjà `seasons[]`/`number_of_episodes` dans l'appel détail,
Google Books expose `pageCount` dans `volumeInfo`) :

```ts
episodeCounts: number[] | null;  // tv : nb d'épisodes par saison ; total = somme ; "S1 E5/10"
pageCount: number | null;        // livre : pages totales ; "p. 230/480"
```

`tome` n'a pas de total fiable côté API → affiché sans dénominateur (« Tome 3 »).

`WorkDetails` (port catalogue) reçoit les mêmes champs optionnels `episodeCounts`/`pageCount`.
Mappers Mongo + memory et seed mis à jour ; migration : `activityAt = createdAt`,
`progress = null`, `episodeCounts/pageCount = null` pour l'existant.

## 2. Couche application

- **`updateProgress(deps, userId, ref, progress)`** : charge/crée l'entrée, valide selon le
  type d'œuvre (tv : `season`/`episode` entiers ≥ 1, `episode` clampé ≤ total de la saison si
  connu ; livre : `tome`/`page` entiers ≥ 1, `page` clampée ≤ `pageCount` si connu ; film :
  `progress` ignoré → `null`), passe le statut à `in_progress`. **Silencieux** : ne modifie pas
  `activityAt`. Met `updatedAt`.
- **`setEntryStatus`** étendu pour accepter `in_progress`. Transition `planned → in_progress`
  pose `activityAt = now` (jalon « a commencé »). Transition `→ done` pose `activityAt = now`
  (jalon « a terminé »).
- **`shareMilestone(deps, userId, entryId)`** : pose `activityAt = now` → l'entrée remonte
  dans le feed comme jalon. Garde-fou : seul ce partage explicite (ou commencer/terminer) fait
  surface ; un +1 d'épisode silencieux ne remonte rien.
- Atteindre la fin connue (dernier épisode du dernier season, ou `page === pageCount`) →
  l'UI propose `done` (toast « Marquer comme terminé ? »), sans forcer côté domaine.
- Validation au plus tôt, erreurs typées (`ValidationError`, `ForbiddenError`,
  `NotFoundError`) cohérentes avec l'existant.

## 3. UI — EntryEditor

Quand statut = `in_progress`, steppers adaptés au type d'œuvre :

- **Série** : `Saison [−][n][+]`, `Épisode [−][n][+] / total`, bouton rapide **« +1 épisode »**
  (incrémente l'épisode ; au-delà du total de la saison, passe à la saison suivante épisode 1).
- **Livre** : `Tome [−][n][+]`, `Page [−][n][+] / pageCount`.
- **Film** : segment `À voir / En cours / Vu` seulement, pas de stepper.

Sous les steppers : bouton **« Partager ce jalon »** (→ `shareMilestone`) + le sélecteur de
cible de partage existant (cercle / public / communauté de l'EntryEditor actuel).

## 4. Feed

`FeedItem` reflète le statut via un verbe et un badge :
- `in_progress` → « regarde » (tv/film) / « lit » (livre) + badge `S2 E4` ou `Tome 3 · p.120`.
- `done` → présentation actuelle (note + avis).

Le feed est **ordonné par `activityAt`** (au lieu de `createdAt`). Le curseur de pagination
passe de `{ createdAt, id }` à `{ activityAt, id }` dans `LibraryEntryRepository.feed` /
`feedByCommunity` (adaptateurs memory + Mongo) ; index Mongo correspondant mis à jour.

## 5. UI — Profil

Nouvelle section **« En cours »** (profil uniquement) : vignettes des œuvres `in_progress`
avec leur badge de progression et un bouton **+1 rapide** inline (appelle `updateProgress`,
reste silencieux). Aucun bandeau de reprise sur le feed.

## 6. Tests (TDD)

- `updateProgress` : validation tv (saison/épisode), livre (tome/page), film (progress
  ignoré) ; clamp aux totaux connus ; passage à `in_progress`.
- `shareMilestone` : bump `activityAt` et remontée dans le feed ; un bump silencieux
  (`updateProgress`) ne remonte pas.
- `setEntryStatus` : `planned → in_progress → done` pose `activityAt` aux bons moments.
- Mappers Work memory + Mongo : `episodeCounts` / `pageCount` persistés et relus.
- Feed ordonné par `activityAt` (memory + Mongo).

## Hors périmètre (YAGNI)

- Pas de bandeau de reprise sur le feed (profil uniquement).
- Pas de total de tomes (non disponible côté API).
- Pas d'historique multi-jalons par œuvre : une seule entrée par (user, œuvre), elle porte
  l'état courant ; le partage de jalon refait surface la même entrée.
