# Partage multi-cibles + badge d'origine communauté — Design

Date : 2026-06-22
Statut : approuvé (à implémenter)

## Objectif

Permettre de partager un avis vers **plusieurs destinations à la fois** (Public, Cercle,
une ou plusieurs communautés) sans jamais afficher deux fois la même publication dans un
même onglet de feed. Une publication partagée dans une communauté apparaît **aussi dans
« Pour vous »**, avec une indication **« via \<communauté\> »**.

Décisions de cadrage (validées) :
- Une **seule** `LibraryEntry` par (user, œuvre) — la déduplication est structurelle.
- Une communauté ciblée implique la visibilité **« Pour vous »** + un **badge d'origine**.
- Pour un avis (note/commentaire), **au moins une destination** est requise ; **Cercle**
  est pré-coché par défaut.

## 1. Modèle de données

`LibraryEntry` remplace `visibility: "circle" | "public"` + `communityId: string | null` par :

```ts
audiences: {
  public: boolean;        // visible par tous dans « Pour vous »
  circle: boolean;        // visible par le cercle (onglet « Mon cercle »)
  communityIds: string[]; // fils de communautés ciblés (implique aussi « Pour vous »)
};
```

`EntryProgress`, `activityAt`, etc. restent inchangés.

### Migration / rétro-compat (mappers Mongo)
`fromEntryDoc` backfille `audiences` depuis les anciens champs si absent :
- `public = visibility === "public"`
- `circle = true` (préserve le comportement actuel : l'onglet « Mon cercle » montrait toutes
  les entrées des auteurs du cercle, quelle que soit la visibilité)
- `communityIds = communityId ? [communityId] : []`

Les anciens champs `visibility`/`communityId` ne sont plus écrits ; `toEntryDoc` n'émet que
`audiences`. (Pas de communauté ni d'entrée multi-audience en base de démo avant ce lot ;
le seed est mis à jour pour écrire `audiences`.)

## 2. Feed & déduplication

Comme chaque entrée est une **seule ligne**, toute requête la renvoie au plus une fois.
Les filtres deviennent (memory + Mongo) :

- **Pour vous** (`foryou`) : `audiences.public OR audiences.communityIds.length > 0 OR (audiences.circle ET auteur ∈ cercle du viewer)`
- **Mon cercle** (`circle`) : `audiences.circle ET auteur ∈ cercle du viewer`
- **Fil communauté X** (`feedByCommunity`) : `audiences.communityIds` inclut X

`isFeedVisible` (basé sur `activityAt`) et `isPublishable` (mur d'œuvre / tendances) restent
inchangés. `listRecentPublic` / `listByWork` continuent d'utiliser `isPublishable`.

Côté Mongo : index `{ "audiences.communityIds": 1, activityAt: -1 }` pour le fil communauté ;
le tri `activityAt` existant couvre Pour vous/Cercle.

## 3. Badge d'origine communauté

`FeedItem` gagne `communities: { id: string; name: string }[]` — les communautés d'origine,
résolues dans `enrichEntries` (via `deps.communities.listByIds(entry.audiences.communityIds)`).
`FeedCard` affiche un badge **« via \<nom\> »** (et **« via \<nom\> +N »** au-delà d'une), à
côté du badge Public/Cercle, lien vers `/communaute/<id>`.

Le badge Public/Cercle de l'en-tête de carte reflète `audiences` : « Public » si
`audiences.public` ou une communauté, sinon « Cercle ».

## 4. UI — EntryEditor (multi-select)

La section « Partager dans » passe de boutons **radio** (un seul `target`) à des **chips à
bascule multi-sélection** :
- État : `pub: boolean`, `circle: boolean`, `Set<communityId>`.
- Chips : `Public`, `Cercle`, puis une chip par communauté rejointe (`/api/communities/mine`).
- Un clic ajoute/retire ; coche ✓ visible sur les chips actives.
- Défaut à l'ouverture (nouvelle entrée) : `circle = true`. Pour une entrée existante,
  reconstruire depuis `initial.audiences`.
- À l'enregistrement d'un avis (note ou texte) : si aucune audience → bloquer avec message
  « Choisis au moins une destination ».

## 5. Validation & couche application

- `rateSchema` (zod) : remplace `visibility` + `communityId` par
  `audiences: z.object({ public: z.boolean(), circle: z.boolean(), communityIds: z.array(z.string()) })`.
- `rateOrReviewWork(deps, userId, ref, input)` : `input.audiences` ; valide
  `public || circle || communityIds.length > 0` (sinon `ValidationError`) ; pour **chaque**
  `communityId`, vérifie l'appartenance (`memberships.find`, sinon `ForbiddenError`) ; pose
  `activityAt = now`. Écrit `audiences` sur l'entrée.
- `loadOrCreateEntry` initialise `audiences: { public: false, circle: true, communityIds: [] }`
  (défaut « cercle », pour préserver le comportement actuel : un **jalon de progression**
  partagé via `shareMilestone` — qui ne passe pas par `rateOrReviewWork` — reste visible par
  le cercle comme avec l'ancien défaut `visibility: "circle"`).
- L'API `/api/works/entry` PUT transmet `audiences` (le `rateSchema` élargi le valide).

## 6. Tests (TDD)

- Mappers Mongo : `fromEntryDoc` backfille `audiences` depuis `visibility`/`communityId` legacy.
- `rateOrReviewWork` : multi-audiences enregistrées ; `ValidationError` si zéro audience ;
  `ForbiddenError` si non-membre d'une communauté ciblée ; `activityAt` posé.
- Feed memory : entrée `{public, circle, communityIds:[X]}` renvoyée **une seule fois** en
  Pour vous ; présente en Mon cercle pour un membre du cercle ; présente dans le fil X.
- Feed Mongo : mêmes invariants (un test d'intégration sur Pour vous + fil communauté).
- `enrichEntries` : `communities` d'origine résolues (nom).
- Schéma `rateSchema` : `audiences` requis et typé (garde-fou frontière HTTP, comme le
  garde-fou `communityId` existant).

## Hors périmètre (YAGNI)

- Pas de note « privée » : un avis doit cibler au moins une audience (zéro interdit).
- Pas d'UI dédiée de re-partage a posteriori : modifier les cibles passe par l'édition de
  l'entrée existante.
- Pas de réglage par communauté du type « ne pas propager à Pour vous » : toute communauté
  ciblée implique « Pour vous » + badge (décision actée).
