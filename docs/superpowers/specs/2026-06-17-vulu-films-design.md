# vulu — Design (Phase 1 : tranche verticale Films & Séries)

**Date :** 2026-06-17
**Statut :** validé en brainstorming, à relire avant plan d'implémentation
**Auteur :** Thomas

---

## 1. Vision

**vulu** (vu & lu) est un réseau social du film/série et du livre. On suit ses amis, on tient sa
bibliothèque (œuvres vues/à voir), on note et commente, et on découvre les avis des autres via un
feed. Objectif produit explicite : une interface **belle, fluide et désirable**, à l'opposé des
interfaces « éclatées » des concurrents (Letterboxd, etc.).

Ce document spécifie la **Phase 1** : une **tranche verticale complète sur le domaine Films & Séries**
(auth → profil → follow → listes → statut/note/commentaire → feed → likes/commentaires). Le domaine
**Livres** (Phase 2) réutilisera le même moteur. La **PWA polish** et l'**algorithme de recommandation**
sont des phases ultérieures (voir §11).

### Décisions de cadrage actées

| Sujet | Décision |
|---|---|
| Catalogue | **TMDB** (films/séries). Google Books en Phase 2. |
| Auth | **Email + mot de passe**, sessions JWT en cookies `httpOnly`. |
| Découpage | **Tranche verticale Films d'abord**, puis Livres, puis PWA polish. |
| Hébergement | **Agnostique** (12-factor, config par env), tranché plus tard. |
| Stack | **Next.js (App Router) + TypeScript + Tailwind + MongoDB**. |
| Architecture | **Ports & Adapters (hexagonal)** dans un mono-repo Next.js. |

---

## 2. Architecture (Approche A — Next.js full-stack, hexagonal interne)

Une seule application Next.js. La logique métier vit dans une couche serveur **isolée de Next, de
Mongo et de TMDB**, testable indépendamment.

```
src/
  app/                    # routes Next : pages (UI) + route handlers (API REST interne)
  components/             # UI React (client)
  server/
    domain/              # entités pures : User, Work, LibraryEntry, List, Like, Comment
    application/         # use-cases : RegisterUser, FollowUser, RateWork, BuildFeed…
    ports/               # interfaces : repositories, CatalogProvider, PasswordHasher, TokenService
    adapters/
      mongo/             # implémentations Mongo des repositories
      catalog/           # TmdbCatalog (derrière CatalogProvider)
      auth/              # BcryptHasher, JwtTokenService
    container.ts         # wiring / DI — seul point à changer pour swapper un adapter
  lib/                   # utilitaires client
```

**Règles d'architecture (issues de CLAUDE.md, non négociables) :**

- `domain/` et `application/` n'importent **jamais** Next, le driver Mongo, ni un SDK TMDB.
- Toute dépendance externe est derrière un **port** (interface). Mongo, TMDB, bcrypt, JWT sont des
  **adapters**.
- **Injection de dépendances** : aucun `new MongoClient()` dans un use-case. Le wiring se fait dans
  `container.ts`.
- Flux strict : `route handler → use-case → port → adapter`. Pas de logique métier dans les handlers,
  pas de SQL/Mongo dans les services.
- Changer de base de données = écrire un nouvel adapter + 1 ligne dans `container.ts`. Zéro touche au
  domaine.

**Pourquoi pas un backend séparé :** un MVP solo n'a pas besoin de deux déploiements, de CORS, ni de
la latence réseau interne. L'isolation hexagonale permet d'extraire le backend plus tard sans toucher
au domaine.

---

## 3. Modèle de domaine

Entités pures (`server/domain/`), pensées pour généraliser au domaine Livres.

### 3.1 User

| Champ | Type | Notes |
|---|---|---|
| `id` | string | identifiant interne |
| `email` | string | unique, validé |
| `passwordHash` | string | bcrypt, jamais exposé ni loggé |
| `username` | string | handle unique (`@thomas`) |
| `displayName` | string | nom affiché |
| `bio` | string \| null | |
| `avatarUrl` | string \| null | |
| `activeTabs` | `('films' \| 'books')[]` | **min. 1 actif** (invariant métier) |
| `tastes` | objet | voir §3.7 |
| `createdAt` | Date | |

### 3.2 Follow (arête du graphe social)

| Champ | Type |
|---|---|
| `followerId` | string |
| `followeeId` | string |
| `createdAt` | Date |

> **Cercle** d'un utilisateur = `{ gens qu'il suit } ∪ { gens qui le suivent }` (union, pas
> intersection).

### 3.3 Work (œuvre du catalogue, cache local de TMDB)

| Champ | Type | Notes |
|---|---|---|
| `id` | string | identifiant interne |
| `source` | `'tmdb'` | (`'googlebooks'` en Phase 2) |
| `externalId` | string | id TMDB |
| `type` | `'movie' \| 'tv'` | (`'book'` en Phase 2) |
| `domain` | `'films'` | (`'books'` en Phase 2) — dérivé du type |
| `title` | string | |
| `year` | number \| null | |
| `posterUrl` | string \| null | |
| `backdropUrl` | string \| null | |
| `overview` | string \| null | synopsis |
| `genres` | string[] | noms de genres (issus de TMDB) |
| `people` | `{ tmdbId, name, role }[]` | cast principal + réalisateur (pour la fiche) |
| `cachedAt` | Date | |

> Une `Work` est **persistée en cache la 1re fois qu'elle est référencée** (ajout à une liste, note,
> commentaire). Évite de re-solliciter TMDB et garantit l'absence de doublons via l'index unique
> `(source, externalId)`.

### 3.4 LibraryEntry (relation user ↔ œuvre — pièce centrale)

Une **seule entrée par couple `(userId, workId)`**. Porte le statut, et optionnellement la note +
le commentaire. C'est aussi **l'item de feed** (pas de double-écriture).

| Champ | Type | Notes |
|---|---|---|
| `id` | string | |
| `userId` | string | |
| `workId` | string | |
| `domain` | `'films'` | filtrage feed/onglets |
| `status` | `'planned' \| 'done'` | affiché **« À voir » / « Vu »** (films), « À lire » / « Lu » (livres) |
| `rating` | number \| null | **décimal 0,0–5,0, pas de 0,1** ; pertinent si `status='done'` |
| `text` | string \| null | commentaire ; pertinent si `status='done'` |
| `visibility` | `'circle' \| 'public'` | défaut **`circle`** |
| `createdAt` | Date | |
| `updatedAt` | Date | |

**Règles métier :**

- Marquer « À voir » crée une entrée `status:'planned'`, sans note ni commentaire → **watchlist
  privée**, **jamais dans le feed**.
- Renseigner une `rating` **ou** un `text` force `status:'done'` (on ne note pas ce qu'on n'a pas vu).
- Passer de « À voir » à « Vu » **met à jour la même entrée** (l'unicité `(userId, workId)` est
  préservée).

### 3.5 List (collection thématique)

| Champ | Type | Notes |
|---|---|---|
| `id` | string | |
| `userId` | string | |
| `name` | string | ex. « SF culte » |
| `domain` | `'films'` | |
| `description` | string \| null | |
| `visibility` | `'public' \| 'private'` | |
| `workIds` | string[] | **ordonné** ; une œuvre peut appartenir à plusieurs listes |
| `createdAt` / `updatedAt` | Date | |

> La note d'une œuvre vit sur la `LibraryEntry`, **pas** sur l'appartenance à une liste : une œuvre
> a une seule note perso, quelles que soient les listes où elle est rangée.

### 3.6 Like & Comment (engagement sur une LibraryEntry visible dans le feed)

**Like** : `{ entryId, userId, createdAt }`.
**Comment** : `{ id, entryId, userId, text, createdAt }` — **plat, un seul niveau** (pas de threads
en Phase 1).

### 3.7 Tastes (profil de goûts — collecté dès la Phase 1)

Stocké sur `User.tastes`. Alimente l'onboarding et la future reco.

```ts
tastes: {
  filmGenreIds: number[];                                  // genres TMDB aimés (min. 3 à l'onboarding)
  people: { tmdbId: number; name: string; role: 'actor' | 'director' }[]; // facultatif
  // Phase 2 : bookGenres: string[]; authors: {...}[]
}
```

> **Périmètre Phase 1** : collecte + stockage + édition des goûts. **L'algorithme de
> recommandation et l'injection de suggestions dans le feed sont une phase ultérieure** (§11).

---

## 4. Collections MongoDB & index

| Collection | Index |
|---|---|
| `users` | unique `email` ; unique `username` |
| `follows` | unique `(followerId, followeeId)` ; index `followeeId` |
| `works` | unique `(source, externalId)` |
| `entries` | unique `(userId, workId)` ; index `(visibility, domain, createdAt)` ; index `(userId, status)` ; index `(userId, createdAt)` |
| `lists` | index `userId` |
| `likes` | unique `(entryId, userId)` |
| `comments` | index `(entryId, createdAt)` |

- Un **seul `MongoClient` poolé** partagé (pas de connexion par requête).
- Requêtes **paramétrées** via le driver ; assainissement des opérateurs ; pas de `$where`, pas de
  `SELECT *`/projection « tout ».
- Les index uniques servent de **garde-fous anti-doublon** (œuvre, entrée, like, follow).

---

## 5. Ports (interfaces) & adapters

### Ports (`server/ports/`)

- `UserRepository`, `FollowRepository`, `WorkRepository`, `LibraryEntryRepository`, `ListRepository`,
  `LikeRepository`, `CommentRepository`
- `CatalogProvider` :
  - `searchWorks(query): WorkSummary[]`
  - `getWork(externalId, type): WorkDetails`
  - `listGenres(): Genre[]`
  - `searchPeople(query): Person[]`
- `PasswordHasher` : `hash(plain)`, `verify(plain, hash)`
- `TokenService` : `issue(payload)`, `verify(token)`

### Adapters (`server/adapters/`)

- `mongo/` : une implémentation par repository.
- `catalog/TmdbCatalog` : implémente `CatalogProvider` via l'API TMDB (clé en env). Mappe les DTO TMDB
  vers les types du domaine. **Aucune fuite** de structure TMDB hors de l'adapter.
- `auth/BcryptHasher`, `auth/JwtTokenService`.
- Tests : repositories **in-memory** implémentant les mêmes ports.

---

## 6. Use-cases (`server/application/`)

Chaque use-case = une responsabilité, dépendances injectées.

| Use-case | Rôle |
|---|---|
| `RegisterUser` | crée le compte (hash mdp, unicité email/username, `activeTabs` ≥ 1, tastes initiaux) |
| `AuthenticateUser` | vérifie identifiants, émet le token |
| `GetCurrentUser` | résout l'utilisateur depuis le token |
| `UpdateProfile` | displayName, bio, avatar, `activeTabs` (invariant ≥ 1) |
| `UpdateTastes` | met à jour genres/personnes aimés |
| `FollowUser` / `UnfollowUser` | gèrent les arêtes ; calcul du cercle |
| `SearchCatalog` | recherche TMDB via `CatalogProvider` |
| `GetWorkDetails` | détails œuvre (cache `works` puis TMDB si absent) |
| `SetEntryStatus` | « À voir » / « Vu » (crée/maj l'entrée, persiste la Work en cache) |
| `RateOrReviewWork` | note + commentaire + visibilité ; force `status:'done'` |
| `RemoveEntry` | supprime l'entrée |
| `CreateList` / `UpdateList` / `AddWorkToList` / `RemoveWorkFromList` | gestion des listes |
| `BuildFeed` | feed paginé, filtré (voir §7) |
| `LikeEntry` / `UnlikeEntry` | engagement |
| `CommentOnEntry` / `DeleteComment` | engagement |
| `GetUserProfile` | profil + onglets + listes + entrées (avec filtrage visibilité, §8) |

---

## 7. Feed — règle de composition

Le feed agrège les `entries` **publiables** :

```
entry visible dans MON feed  ⟺
      entry.status = 'done'
  ET (entry.rating ≠ null OU entry.text ≠ null)        -- pas les watchlists nues
  ET (entry.visibility = 'public'  OU  auteur ∈ mon cercle)
  ET  entry.domain ∈ mes activeTabs                    -- un user « films only » ne voit aucun livre
```

Tri par `createdAt` décroissant, **paginé** (curseur sur `createdAt`/`id`). Chaque item porte ses
compteurs `likes`/`comments` et l'état « ai-je liké ». Les badges **● Cercle / ● Public** reflètent
`visibility`.

> Les **suggestions personnalisées** (issues de `tastes`) seront **interleavées** dans ce feed comme
> des cartes distinctes « Suggéré pour toi », avec plafond de fréquence — **phase ultérieure**.

---

## 8. Sécurité & autorisation

(Respect strict de CLAUDE.md.)

- **Mots de passe** : bcrypt via le port `PasswordHasher`. Jamais en clair, jamais loggés.
- **Sessions** : JWT court (+ refresh) en **cookies `httpOnly`, `Secure`, `SameSite=Lax`**. Pas de
  token en `localStorage`.
- **Authentification ≠ autorisation** : un middleware identifie l'utilisateur ; **chaque use-case
  revérifie les droits** :
  - voir une entrée `circle` ⇒ être l'auteur **ou** dans son cercle ;
  - modifier/supprimer une entrée, une liste, un commentaire ⇒ en être le propriétaire ;
  - voir une liste `private` ⇒ en être le propriétaire.
- **Validation à chaque frontière** : tout payload de route handler validé par un **schéma Zod** avant
  d'atteindre un use-case. Rejet au plus tôt.
- **Moindre privilège** : un seul utilisateur Mongo applicatif. Secrets (URI Mongo, clé TMDB, secret
  JWT) **uniquement en variables d'env** (`.env.local` non versionné, `.env.example` versionné).
- **Rate-limiting** basique sur `register`/`login` (anti-bruteforce).
- **Pas de données sensibles dans les logs** (mdp, tokens).

---

## 9. Surface API (route handlers internes, `src/app/api/…`)

Indicatif — REST, payloads validés Zod, réponses typées.

| Méthode & route | Use-case |
|---|---|
| `POST /api/auth/register` | RegisterUser |
| `POST /api/auth/login` | AuthenticateUser |
| `POST /api/auth/logout` | invalide la session |
| `GET  /api/me` | GetCurrentUser |
| `PATCH /api/me` | UpdateProfile |
| `PUT  /api/me/tastes` | UpdateTastes |
| `GET  /api/catalog/search?q=` | SearchCatalog |
| `GET  /api/catalog/genres` | listGenres |
| `GET  /api/catalog/people?q=` | searchPeople |
| `GET  /api/works/:id` | GetWorkDetails |
| `PUT  /api/works/:id/entry` | SetEntryStatus / RateOrReviewWork |
| `DELETE /api/works/:id/entry` | RemoveEntry |
| `GET/POST/PATCH/DELETE /api/lists…` | CRUD listes + items |
| `POST/DELETE /api/users/:id/follow` | Follow / Unfollow |
| `GET  /api/users/:username` | GetUserProfile |
| `GET  /api/feed?cursor=` | BuildFeed |
| `POST/DELETE /api/entries/:id/like` | Like / Unlike |
| `GET/POST /api/entries/:id/comments` | CommentOnEntry / liste |
| `DELETE /api/comments/:id` | DeleteComment |

---

## 10. UI / Design

### Identité visuelle

**Thème clair** (dérivé de la palette fournie) :

| Rôle | Hex |
|---|---|
| Primaire | `#9461C0` |
| Accent (notes/étoiles) | `#F8C84E` |
| Fond | `#F6F2FB` |
| Surface | `#FFFFFF` |
| Bordure | `#E7DDED` |
| Texte | `#2A2233` ; texte secondaire `#6B6276` |

**Thème sombre « Aubergine nuit »** :

| Rôle | Hex |
|---|---|
| Fond | `#16121C` |
| Surface | `#211B2A` ; surface élevée `#2C2438` |
| Primaire | `#B98DE0` |
| Accent | `#F6C24B` |
| Texte | `#ECE6F2` ; texte secondaire `#9C93AB` ; bordure `#352C44` |

Bascule clair/sombre persistée (préférence utilisateur + respect `prefers-color-scheme` par défaut).
Tokens de thème via variables CSS + config Tailwind. UI travaillée avec le skill **frontend-design**
(distinctive, pas templatée).

### Écrans (validés en maquette)

1. **Shell + Feed** — desktop : sidebar gauche (Feed, Recherche, Mes listes, Profil, bascule thème) ·
   feed central avec onglets **🎬 Films & Séries / 📚 Livres** · rail droit (à suivre + tendances).
   Mobile/PWA : header (logo, recherche, thème) · onglets · barre d'onglets bas avec **＋** central.
2. **Profil** — bannière + avatar + nom/handle + bio + stats (vus / abonnés / abonnements) ·
   **✎ Éditer** (ou **[ Suivre ] / [ Suivi ✓ ]** sur un autre profil) · onglets Films/Livres +
   **⚙ Gérer mes onglets** · sous-filtres **Vus / À voir / Mes listes** · grille de posters (note en
   overlay) · cartes de listes + **＋ Nouvelle liste**.
3. **Fiche œuvre** — backdrop/poster + métadonnées TMDB + synopsis · panneau **« Mon entrée »**
   (bascule À voir/Vu · **slider de note décimale** au pas de 0,1 avec jauge d'étoiles partielle +
   valeur littérale `4,2/5` · commentaire · visibilité Cercle/Public · ajout à une liste ·
   Enregistrer) · **avis communauté** (onglets Mon cercle / Public, likables et commentables).
4. **Mes goûts** (onboarding 2/3 + éditable) — chips de **genres** (min. 3) · recherche + vignettes
   **acteurs/réalisateurs** (facultatif).

### Composant clé : le sélecteur de note

Slider continu 0,0→5,0 au **pas de 0,1**, rendu en **jauge d'étoiles à remplissage partiel** + valeur
littérale `x,y/5`. Accessible au clavier, et utilisable au tap sur mobile.

---

## 11. PWA & non-fonctionnel

- **PWA** : `manifest.webmanifest` (icônes maskable, couleurs thème, `display: standalone`) ;
  service worker (next-pwa/Workbox) — *network-first* pour les données API, *cache-first* pour
  assets/affiches ; lecture offline du dernier feed en cache. Installable web + mobile. **Pas de
  push** en Phase 1. (Polish offline = Phase 3.)
- **Tests** (TDD, le test vérifie le **comportement**) :
  - Domaine + use-cases : unitaires avec repos **in-memory** (cercle, filtrage feed, visibilité,
    auto-passage « Vu », invariant `activeTabs ≥ 1`).
  - Adapters Mongo : intégration sur **mongodb-memory-server** (mapping + index).
  - Adapter TMDB : réponses HTTP mockées (contrat `CatalogProvider`).
  - API : quelques parcours bout-en-bout (register→login→noter→feed).
  - Stack : **Vitest** + Testing Library. E2E (Playwright) en Phase 3.
- **Config** : 12-factor, tout par env, `.env.example` versionné. Migrations/indexes appliqués via un
  script d'init idempotent.

---

## 12. Hors périmètre Phase 1 (phases ultérieures)

- **Phase 2 — Livres** : adapter Google Books, types `book`, genres littéraires + auteurs dans
  `tastes`, onglet Livres complet (même moteur).
- **Algorithme de recommandation** : scoring contenu (recoupement goûts ↔ œuvres TMDB, exclusion des
  déjà-vus/listés), cartes « Suggéré pour toi » interleavées dans le feed avec plafond de fréquence.
- **PWA polish** : offline avancé, notifications push.
- **App mobile native** : à terme.
- Threads de commentaires multi-niveaux, messagerie privée, modération avancée.

---

## 13. Risques & points d'attention

- **Quotas/limites API TMDB** : mettre en cache agressivement les `works`, débattre la recherche.
- **Cohérence des compteurs** like/comment : calculer à la lecture (agrégation) en Phase 1 plutôt que
  dénormaliser prématurément ; dénormaliser si la charge l'exige.
- **Confidentialité du cercle** : le filtrage `circle` doit être vérifié côté serveur à **chaque**
  lecture, jamais seulement côté client.
- **Accessibilité du slider de note** : prévoir saisie clavier + lecteur d'écran (valeur annoncée).
```
