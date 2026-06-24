# Compatibilité de goûts (« Match % ») — Design

Date : 2026-06-24
Statut : validé (brainstorming) — prêt pour le plan d'implémentation
Sous-projet : 1/2 du chantier « connivence » (le suivant : avis pondérés par affinité, puis Rétrospective/Wrapped).

## Objectif

Afficher sur le profil d'un autre membre un **score de compatibilité de goûts** (« 87 % de goûts
communs ») calculé à partir des œuvres que les deux ont **notées**, plus une ligne d'affinité
« vous aimez tous les deux : X, Y, Z ». Le score est un aimant social (« qui me ressemble ? ») et
la brique de similarité sera réutilisée plus tard (recos, avis pondérés, Wrapped).

Périmètre de CE sous-projet : moteur de similarité + affichage sur le profil. **Hors périmètre** :
pondération des avis par affinité, recos, Wrapped (sous-projets suivants).

## Métrique

Match % sur les **œuvres co-notées** (les deux membres ont une `rating` non nulle sur l'œuvre) :

```
score = round(100 × (1 − moyenne(|noteA − noteB|) / 5))
```

- Échelle de note : décimale 0–5 (`LibraryEntry.rating`).
- Borne : score ∈ [0, 100], jamais négatif (contrairement à Pearson, écarté car contre-intuitif
  et négatif possible).
- **Seuil de significativité : minimum 3 œuvres co-notées.** En dessous, on n'affiche rien.

`overlap` = nombre d'œuvres co-notées. Le domaine calcule toujours le score ; c'est la couche
application/présentation qui applique le seuil d'affichage.

## Architecture (hexagonale)

```
Domaine (pur)        tasteMatchScore(pairs) → { score, overlap }
Port                 EntryRepository.listRatedByUser(userId)
Application          computeTasteMatch(deps, viewerId, targetId) → { score, overlap, sample }
API (entrée)         GET /api/users/[username] → ajoute `tasteMatch: … | null`
UI (présentation)    <TasteMatchBadge> piloté par la donnée serveur
```

### Domaine — `src/server/domain/taste-match.ts`

Fonction pure, sans dépendance externe, testable isolément.

```ts
export interface TasteMatch {
  score: number;   // 0–100, arrondi entier
  overlap: number; // nombre d'œuvres co-notées
}

export function tasteMatchScore(pairs: { a: number; b: number }[]): TasteMatch;
```

- `pairs` vide → `{ score: 0, overlap: 0 }` (aucune division par zéro).
- Ne connaît ni Mongo, ni users, ni le seuil d'affichage (responsabilité du caller).

### Port — `EntryRepository.listRatedByUser`

Ajout au port `EntryRepository` (`src/server/ports/repositories.ts`) :

```ts
listRatedByUser(userId: string): Promise<{ ref: WorkRef; rating: number }[]>;
```

- Ne remonte **que** les entries dont `rating != null`.
- Mémoire et Mongo doivent avoir une parité de comportement stricte (testée des deux côtés).
- Le croisement viewer/target est fait dans la couche application (logique métier), **pas** dans
  l'adaptateur — on évite de faire fuir la logique de compatibilité dans Mongo.

### Application — `src/server/application/taste-match.ts`

```ts
import type { WorkRef } from "../domain/entities";

export interface TasteMatchResult {
  score: number;
  overlap: number;
  sample: WorkRef[]; // jusqu'à 3 œuvres aimées des deux côtés
}

export async function computeTasteMatch(
  deps: Deps,
  viewerId: string,
  targetUserId: string,
): Promise<TasteMatchResult>;
```

Règles :

1. **No self-match.** Si `viewerId === targetUserId` → `{ score: 0, overlap: 0, sample: [] }`.
2. **Visibilité respectée.** Si `canViewProfile(deps, viewerId, targetUserId)` est faux →
   `{ score: 0, overlap: 0, sample: [] }`. Le Match% ne doit **jamais** révéler les notes d'un
   profil que le viewer n'a pas le droit de voir.
3. **Co-notation.** On charge `listRatedByUser(viewerId)` et `listRatedByUser(targetUserId)`, on
   croise par `WorkRef` (domaine + id), on ne garde que les œuvres notées des deux côtés, on passe
   les paires à `tasteMatchScore`.
4. **Sample.** Jusqu'à 3 œuvres où les deux ont mis une note **haute** : `a ≥ 4 && b ≥ 4 &&
   |a − b| ≤ 1`. Sert la ligne « vous aimez tous les deux ».

La résolution du seuil d'affichage (overlap ≥ 3) se fait au niveau de l'API (voir ci-dessous).

### API — `GET /api/users/[username]`

La route renvoie déjà `{ profile, stats, relation, entries, lists }`. On ajoute :

```ts
tasteMatch: { score: number; overlap: number; sample: WorkRef[] } | null;
```

- `null` si : self, profil non visible, ou `overlap < 3`. → rien ne s'affiche, pas de « 0 % ».
- Sinon le bloc est renvoyé et affiché. Le client n'affiche que ce que le serveur envoie ;
  aucune logique de seuil côté client.
- Pas de fetch client supplémentaire : la donnée arrive avec le profil.

### UI — `src/components/TasteMatchBadge.tsx`

Composant présentationnel pur, rendu conditionnellement dans la page profil quand `tasteMatch`
n'est pas `null` :

- **Badge Match%** — pastille colorée selon le score : ≥ 80 % accent fort, 60–79 % moyen,
  < 60 % neutre. Texte « **87 % de goûts communs** ».
- **Ligne d'affinité** — si `sample` non vide : « Vous aimez tous les deux : *Titre1*, *Titre2*,
  *Titre3* », chaque titre cliquable vers la fiche œuvre.
- **Sous-texte discret** : « sur N œuvres notées en commun » (`overlap`).

## Tests

### Domaine — `tests/domain/taste-match.test.ts`
- notes identiques partout → 100 %.
- écart maximal (0 vs 5) → 0 %.
- arrondi (moyenne d'écart 0,65 → 87 %).
- `overlap < 3` → score calculé, `overlap` remonté tel quel (le caller gère le seuil).
- liste vide → `{ score: 0, overlap: 0 }` sans division par zéro.

### Application — `tests/application/taste-match.test.ts` (`makeInMemoryDeps(catalog)`)
- notes croisées → score + `sample` attendus.
- œuvres notées d'un seul côté → ignorées.
- profil cible non visible → résultat neutre `{ 0, 0, [] }`.
- self → résultat neutre.
- `sample` plafonné à 3, filtré sur note haute (≥ 4 des deux côtés, écart ≤ 1).

### Adaptateurs — parité mémoire/Mongo
- `tests/adapters/memory.test.ts` et `tests/adapters/mongo-repositories.test.ts` :
  `listRatedByUser` ne remonte que les entries avec `rating != null`, même forme de sortie.

Pas de test E2E du rendu : le badge est piloté par la donnée serveur déjà couverte.

## Réutilisabilité

`tasteMatchScore` (domaine pur) et `listRatedByUser` (port) sont conçus pour resservir aux
sous-projets suivants : avis pondérés par affinité (même score), Rétrospective/Wrapped (mêmes
notes agrégées). Aucune donnée nouvelle stockée — on s'appuie sur les `rating` existants.
