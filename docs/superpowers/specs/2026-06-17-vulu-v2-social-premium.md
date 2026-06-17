# vulu v2 — Social, dense & premium (design)

**Date :** 2026-06-17 · **Statut :** validé, implémentation directe (itération sur app existante)

## Objectif
Densifier l'interface (façon Twitter/Insta), rendre le profil éditable (avatar + bannière + nom + bio + onglets), remplacer tous les émojis par un **jeu d'icônes SVG sur mesure**, et hisser l'UI/UX au niveau « crème de la crème ».

## A. Stockage d'images (hexagonal)
- Port **`MediaStorage`** : `save(bytes, ext) → url`, `delete(url)`.
- Adaptateur **`LocalDiskStorage`** : écrit dans `UPLOADS_DIR` (env, défaut `<cwd>/uploads`), nom = `uuid.ext`, renvoie `/uploads/<name>`. Servi par une route `GET /uploads/[name]`. Adaptateur S3 plus tard, sans toucher au domaine.
- `User` gagne **`bannerUrl: string | null`**.
- Routes `POST /api/me/avatar` et `POST /api/me/banner` : valident le **type réel** (magic bytes JPEG/PNG/WebP) et le **poids** (avatar ≤ 512 Ko, bannière ≤ 1,5 Mo), stockent, mettent à jour le user, suppriment l'ancienne image.
- Redimensionnement **côté client** (canvas) avant upload (avatar 512², bannière 1500×500) pour limiter le poids.

## B. Icônes sur mesure
- Composant `<Icon name size />` avec set SVG lignes maison (stroke 1.75, linecap/linejoin round) : `home, search, lists, profile, theme-sun, theme-moon, heart, heart-filled, comment, star, plus, settings, camera, check, trending, user-plus, back`. Aucun émoji dans nav/actions.

## C. Densification
- **Cartes feed riches** : affiche de l'œuvre (vignette), avatar réel ou dégradé+initiales, temps relatif, méta, badge visibilité, actions en icônes, like animé.
- **Commentaires inline** : déplier + composer sous la carte (optimiste) via les routes existantes.
- **Rail droit** (desktop ≥ lg) : « À suivre » + « Tendances ». Use-case `discover` + route `GET /api/discover` (suggestions = users non suivis ; tendances = œuvres avec le plus d'avis récents).
- **Profil éditable** : page dédiée `/settings/profil` (avatar overlay caméra, bannière, nom, bio, onglets) → `PATCH /api/me` + uploads.

## D. Polish
- `Avatar` (image|gradient+initiales), `Banner` (image|dégradé). Micro-interactions, focus visibles, skeletons, états vides soignés, respect `prefers-reduced-motion`.

## E. Tests
- `LocalDiskStorage` (save/delete round-trip tmp dir), validation upload (type/poids), util `relativeTime`, `discover` use-case, `updateProfile` avec bannière.

## Hors scope
S3, messagerie, notifications push, reco algorithmique.
