# Recherche de membres `@pseudo` — Design

Date : 2026-06-23
Statut : approuvé (à implémenter)

## Objectif

Permettre de rechercher des membres depuis la barre de recherche en tapant `@`. Dès que
la requête commence par `@`, une section **« Membres »** apparaît au-dessus de la grille
catalogue, sans masquer cette dernière. Sans `@`, la recherche reste strictement celle
d'aujourd'hui (catalogue films/livres uniquement).

Décisions de cadrage (validées) :
- Déclencheur : préfixe `@` → section « Membres » **en plus** du catalogue.
- Critère de match : `username` **ou** `displayName`, insensible à la casse, `contains`.

## 1. Flux UI (`SearchClient`)

- À chaque frappe (debounce 300 ms partagé) : si `q.trim()` commence par `@`, on dérive
  `memberQuery = q.trim().slice(1).trim()`.
- Si `memberQuery` est non vide, on appelle `GET /api/users/search?q=<memberQuery>` et on
  remplit l'état `members`. On lance **aussi** la recherche catalogue existante sur
  `memberQuery` (le `@` retiré), pour que les deux soient pertinentes.
- Sans `@` : `members` est vidé, aucun appel `/api/users/search`, catalogue inchangé.
- La section « Membres » s'affiche au-dessus de la grille catalogue quand `members.length > 0`.

## 2. Backend (hexagonal)

### Port
`UserRepository` gagne :
```ts
searchByText(query: string, limit: number): Promise<User[]>;
```

### Adapter mémoire
Filtre `contains` insensible à la casse sur `username` OU `displayName` ; tri par
`username` ; `slice(0, limit)`.

### Adapter Mongo
`$or` de deux `$regex` (`username`, `displayName`) avec `$options: "i"`, sur une **query
échappée** (les métacaractères regex `. * + ? ( ) [ ] { } ^ $ | \` sont neutralisés) pour
éviter toute injection regex / ReDoS. Tri `{ username: 1 }`, `.limit(limit)`.

### Application
```ts
searchUsers(deps, viewerId: string, query: string, limit = 10): Promise<PublicUserDto[]>
```
- `query.trim()` vide → renvoie `[]` (pas d'erreur ; l'UI n'appelle pas dans ce cas, mais
  garde-fou défensif).
- Exclut le viewer lui-même des résultats.
- Mappe chaque `User` en DTO public : `{ id, username, displayName, avatarUrl, plus, staff }`.

### API
`GET /api/users/search?q=...` :
- auth requise (`requireUser`).
- zod : `q` chaîne 1–50 caractères.
- réponse : `{ users: PublicUserDto[] }`.

## 3. UI — section Membres

Sous le champ, quand `members.length > 0` :
- titre « Membres ».
- une ligne par membre : `Avatar` (taille ~40) + nom affiché + badges (`StaffBadge` si
  `staff`, `CertifiedBadge` si `plus`) + `@username` en muted, le tout dans un `Link`
  vers `/u/<username>`.
- Réutilise les composants existants `Avatar`, `CertifiedBadge`, `StaffBadge`.

## 4. Tests (TDD)

- **Mémoire** : `searchByText` matche sur `username` ET sur `displayName`, insensible à la
  casse, respecte `limit`.
- **Mongo** : mêmes invariants + une query contenant des métacaractères regex (`.`, `(`)
  est traitée **littéralement** (garde-fou anti-injection : aucun crash, résultat attendu).
- **Application** : `searchUsers` exclut le viewer, renvoie `[]` sur query vide, mappe le
  DTO public (pas de `email`/`passwordHash`).
- **Schéma** : `userSearchSchema` exige `q` (1–50 caractères).

## Hors périmètre (YAGNI)

- Pas de recherche floue / classement par pertinence avancé (simple `contains` + tri
  alphabétique).
- Pas de pagination des membres (limite fixe 10).
- Pas de recherche de communautés via la barre (uniquement membres ici).
- Pas de masquage du catalogue en mode `@` (décision actée : section en plus).
