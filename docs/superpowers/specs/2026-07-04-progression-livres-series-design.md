# Progression : saisie rapide livres + grille d'épisodes séries

Date : 2026-07-04
Statut : validé (design)

## Contexte

Aujourd'hui, l'avancement d'une œuvre en cours se saisit uniquement avec des
steppers `+1` / `−1` (`EntryEditor.tsx`, composant `Stepper`) :

- **Livres** : `progress = { tome, page }` — avancer d'une page = un clic. Pénible
  pour un livre de plusieurs centaines de pages.
- **Séries** : `progress = { season, episode }` — une seule **position courante**,
  pas de suivi épisode par épisode. On ne peut pas cocher au fur et à mesure.

Le `progress` est un sous-document persisté tel quel (Mongo `mappers.ts:61`,
spread de `e.progress`). **Ajouter un champ ne nécessite aucune migration** : les
entrées existantes auront simplement le champ absent (`undefined` → `null`).

## Objectifs

1. **Livres** — saisir la page rapidement : champ éditable + boutons rapides.
2. **Séries** — cocher librement les épisodes vus, saison par saison, pour un
   suivi immersif.

Non-objectifs : films (statut seul, inchangé), refonte du partage feed.

---

## Feature 1 — Livres : saisie de page rapide

**Périmètre : UI seule. Aucun changement d'API ni de modèle.**

Dans `EntryEditor.tsx`, pour `workType === "book"` en cours, le stepper « Page »
est remplacé par un contrôle composite :

- Un `<input type="number">` éditable affichant la page courante ; l'utilisateur
  peut taper directement le numéro.
- Une rangée de boutons : `−100  −10  −1  +1  +10  +100`.
- Valeur **clampée à `[1, pageCount]`** (si `pageCount` connu ; sinon borne basse
  = 1, pas de borne haute). Un bouton qui dépasserait plafonne à la borne plutôt
  que d'être bloqué (ex. à la page 5, `−100` → 1).
- Affichage `page / pageCount` conservé.

« Tome » reste un `Stepper` simple inchangé.

**Bonus retenu — `InProgressShelf.tsx`** : à côté du bouton `+1 page` / `+1 épisode`,
ajouter un bouton `+10`. Pour un livre : `+10 pages`. Pour une série : `+10` reste
hors sens (épisodes) → **le `+10` n'apparaît que pour les livres**. La série garde
son `+1 épisode`.

### Détail composant livre (esquisse)

```
Tome   [ − ]  1  [ + ]
Page   [ 247 ] / 512
       [−100][−10][−1]  [+1][+10][+100]
```

---

## Feature 2 — Séries : grille d'épisodes cochables

### Modèle

Ajout d'un champ à `EntryProgress` (`src/server/domain/entities.ts`) :

```ts
export interface EntryProgress {
  season: number | null;          // séries — position courante (DÉRIVÉE)
  episode: number | null;         // séries — position courante (DÉRIVÉE)
  tome: number | null;            // livres
  page: number | null;            // livres
  watchedEpisodes: number[][] | null;  // séries — index = (saison−1), valeurs = n° d'épisodes vus
}
```

- `watchedEpisodes[i]` = liste **triée, sans doublon** des numéros d'épisodes vus
  de la saison `i+1`. **Coche libre** : cocher l'épisode 5 sans 1-4 est autorisé.
- `season` / `episode` deviennent **dérivés** côté serveur à chaque sauvegarde :
  - `season` = plus haute saison ayant au moins un épisode coché (sinon 1),
  - `episode` = plus grand numéro d'épisode coché dans cette saison (sinon null si
    aucune coche → position `null`/début).
- Rétro-compat : `formatProgress`, le feed, `InProgressShelf` lisent
  `season`/`episode` → **rien à changer chez eux**.

### API

`progressSchema` (`src/lib/zod-schemas.ts`) accepte un champ optionnel :

```ts
watchedEpisodes: z.array(z.array(progInt)).nullable().optional()
```

`updateProgress` (`src/server/application/library-entry.ts`) :

- **Chemin grille** (nouveau, depuis EntryEditor) : le client envoie la **grille
  complète** `watchedEpisodes`. Idempotent. Le serveur :
  1. normalise chaque sous-liste (tri, dédoublonnage, filtre `1..episodeCounts[i]`),
  2. stocke `watchedEpisodes`,
  3. recalcule `season`/`episode` dérivés.
- **Chemin legacy** (existant, depuis `InProgressShelf` `+1 épisode`) : le client
  envoie `season`/`episode`. Le serveur **marque cet épisode comme vu** dans la
  grille (ajout à `watchedEpisodes[season-1]`) puis recalcule la position. Les deux
  chemins restent cohérents.

Validation : chaque numéro d'épisode entier `≥ 1` et `≤ episodeCounts[saison-1]`
quand connu (sinon `≥ 1`). Réutilise/étend la validation existante.

### UI (EntryEditor, séries en cours)

Depuis `episodeCounts` (déjà passé au composant), rendre une section par saison :

```
Saison 1                    [ Tout cocher ]   4/6
[✓1][✓2][✓3][✓4][ 5 ][ 6 ]
Saison 2                    [ Tout cocher ]   0/5
[ 1 ][ 2 ][ 3 ][ 4 ][ 5 ]
```

- Pastilles numérotées cliquables → toggle l'état vu (état local React).
- « Tout cocher » par saison : coche/décoche toute la saison (toggle selon si
  déjà complète).
- Compteur `x/total` par saison ; total global lisible en tête.
- Boutons **« Enregistrer »** et **« Partager ce jalon »** conservés (envoient la
  grille complète via `/api/works/progress`).
- L'état local initial vient de `initial?.progress?.watchedEpisodes ?? []`.

---

## Tests (TDD)

Cibler la logique métier de `updateProgress` (adapter mémoire `InMemory`) :

1. Grille : envoyer `watchedEpisodes` → stocké normalisé (trié, dédoublonné,
   hors-borne filtré).
2. Dérivation : `season`/`episode` = épisode le plus avancé coché (coche libre :
   cocher S2E5 sans S2E1-4 → position S2E5).
3. Aucune coche → position début (`episode` null), pas de crash.
4. Chemin legacy shelf : `season`/`episode` fournis → épisode ajouté à la grille +
   position recalculée ; idempotent si renvoyé.
5. Livres inchangés : `page`/`tome` continuent de fonctionner.

Vérification manuelle UI (EntryEditor livre + série, shelf `+10`) avant complétion.

---

## Fichiers touchés

- `src/server/domain/entities.ts` — champ `watchedEpisodes`.
- `src/lib/zod-schemas.ts` — `progressSchema`.
- `src/server/application/library-entry.ts` — `updateProgress` (grille + legacy + dérivation).
- `src/components/EntryEditor.tsx` — contrôle page livre + grille séries.
- `src/components/InProgressShelf.tsx` — bouton `+10` (livres).
- Tests unitaires `updateProgress`.
- Éventuel mapper Mongo/memory : vérifier que `watchedEpisodes` transite (spread
  déjà générique — a priori rien à ajouter, à confirmer).
