# « Mes données » : import + export ZIP complet — Design

**Date :** 2026-07-15
**Statut :** Design validé
**Portée :** Regrouper import et export dans une section « Mes données » des
paramètres, et produire un export ZIP complet et propre de toutes les données de
l'utilisateur.

## Contexte

L'import TV Time existe (section « Importer mes données »). Un export existe aussi
mais il est **incomplet** : `exportUserData` (via `GET /api/me/export`, lié depuis
« Votre compte ») renvoie un JSON avec seulement `profile + entries + lists`, sans
épisodes, likes, commentaires, social, ni images.

Objectif : une section unique « Mes données » contenant l'import ET un export ZIP
complet, propre, lisible.

### Décisions produit (utilisateur)
- Format : **JSON structuré (un par type) + CSV lisible de la bibliothèque + README**, zippé.
- **Inclure les binaires images** (avatar + bannière) dans le ZIP.
- **Retirer** l'ancien lien JSON de « Votre compte » ; le nouvel export ZIP le remplace dans « Mes données ».
- Inclure **likes et commentaires** de l'utilisateur.

### État des lieux technique
- `src/app/api/me/export/route.ts` → `exportUserData(deps, userId)` (à remplacer).
- Section `import` dans `SettingsClient.tsx` (`SectionId` + `SECTIONS` + `Panel()`), lien JSON dans le panneau `account`.
- `MediaStorage` (port) : `save`/`delete` uniquement — **pas de `load`**. Seul implémenteur : `LocalDiskStorage` (a un `resolve(name)` privé, lit `UPLOADS_DIR`).
- Repos : `entries.listByUser` ✓, `lists.listByUser` ✓ ; **absents** : `episodeEntries.listByUser`, `likes.listByUser`, `comments.listByUser` (mais champ `userId` présent partout, cf. `removeAllForUser({ userId })`).
- `follows.followeeIdsOf(userId)` / `followerIdsOf(userId)` → ids ; `users.findByIds` → pseudos ; `works.findByIds` → titres.
- `fflate` disponible (`zipSync`).
- Entités : `Like { entryId, userId, createdAt }` ; `Comment { id, entryId, userId, text, createdAt }`.

## Contenu de l'archive

`vulu-<username>-export.zip` :

```
README.txt          — description du contenu, date d'export, notes de format
profile.json        — user sans passwordHash ni twoFactorSecret ; avatarUrl/bannerUrl conservés + noms de fichiers dans media/
library.json        — toutes les LibraryEntry de l'utilisateur
library.csv         — colonnes lisibles : title, type, status, rating, completedAt, domain
episodes.json       — toutes les EpisodeEntry de l'utilisateur
lists.json          — toutes les List de l'utilisateur
social.json         — { following: string[]/*pseudos*/, followers: string[]/*pseudos*/ }
likes.json          — Like[] de l'utilisateur (entryId, createdAt)
comments.json       — Comment[] de l'utilisateur
media/avatar.<ext>  — binaire (si avatarUrl défini et lisible)
media/banner.<ext>  — binaire (si bannerUrl défini et lisible)
```

- `library.csv` : titres résolus via `works.findByIds` (les entrées ne portent que `workId`). Échappement CSV correct (guillemets, virgules, retours ligne).
- `media/` : n'inclut que les images réellement présentes et lisibles (best-effort, jamais d'échec bloquant). Extension déduite de l'URL.

## Architecture (Ports & Adapters)

### Constructeur d'archive
`src/server/export/user-archive.ts` :
```ts
export async function buildUserArchive(deps: Deps, userId: string): Promise<Record<string, Uint8Array>>;
```
- Retourne une map **chemin → octets** (README, profile.json, library.json, library.csv, episodes.json, lists.json, social.json, likes.json, comments.json, et media/… si présents).
- Utilise uniquement les ports (`deps.*`). Aucune écriture disque, aucun zip ici (séparation des responsabilités → testable sans dézipper).
- Lève `NotFoundError` si l'utilisateur est introuvable.

### Route
`GET /api/me/export` (repurposée) :
- `requireUser()` → `buildUserArchive(deps, user.id)` → `zipSync(map)` (fflate) → `Response` avec
  `content-type: application/zip` et `content-disposition: attachment; filename="vulu-<username>-export.zip"`.
- `exportUserData` (application/account.ts) est **supprimé** (plus aucun consommateur).

### Ajouts de ports / adaptateurs (mécaniques)
- `MediaStorage.load(url: string): Promise<Uint8Array | null>` — lecture best-effort ; `null` si absent/non géré.
  - `LocalDiskStorage.load` : lit le fichier sous `dir` via `basename(url)` (anti-traversée) ; `null` en cas d'erreur.
- `EpisodeEntryRepository.listByUser(userId): Promise<EpisodeEntry[]>` — Mongo `find({ userId })` ; in-memory filtre par `userId`.
- `LikeRepository.listByUser(userId): Promise<Like[]>` — idem.
- `CommentRepository.listByUser(userId): Promise<Comment[]>` — idem.

### UI
`src/app/parametres/SettingsClient.tsx` :
- `SectionId` : `import` → `data`.
- `SECTIONS` : `{ id: "data", label: "Mes données", icon: "download", desc: "Importer et exporter" }`.
- `Panel()` branche `cur === "data"` : deux blocs — **Importer** (contenu TV Time existant) et **Exporter** (carte + bouton `<a href="/api/me/export">` « Télécharger mon archive (.zip) »).
- Panneau `account` : retirer le lien « Télécharger une archive de vos données ».

## Sécurité
- `requireUser` ; export limité à l'utilisateur courant (tous les `listByUser`/`findById` sur `user.id`).
- Aucun secret dans l'archive : `profile.json` exclut `passwordHash` et `twoFactorSecret`.
- `media` : `basename` sur l'URL (pas de traversée de chemin), lecture best-effort.

## Tests
`tests/export/user-archive.test.ts` (repos in-memory + `FakeCatalog`) :
- Toutes les clés attendues présentes (README, profile.json, library.json, library.csv, episodes.json, lists.json, social.json, likes.json, comments.json).
- `profile.json` ne contient ni `passwordHash` ni `twoFactorSecret`.
- `library.csv` contient le titre de l'œuvre (résolu via works).
- `social.json` liste les pseudos des abonnements/abonnés.
- `media/avatar.*` présent si avatar défini et lisible (fake MediaStorage.load renvoyant des octets) ; absent sinon.
- Nouveaux `listByUser` (episodes/likes/comments) renvoient les enregistrements du bon utilisateur.

## Hors périmètre
- Ré-import de l'archive Vulu (le ZIP est un export ; l'import reste TV Time).
- Communautés/memberships dans l'export (données partagées, pas « les données de l'utilisateur » au sens strict).
