# Squelettes de chargement fidèles au rendu des pages

Date : 2026-07-05
Statut : validé (design)

## Contexte

Chaque route a un `src/app/**/loading.tsx` (fallback Suspense de Next). Actuellement
ces squelettes sont **génériques** (ex. `feed/loading.tsx` = 4 blocs gris `h-40`) et
**hors de l'`AppShell`** — l'`AppShell` étant inclus dans chaque page, pas dans un
layout partagé. Pendant le chargement/navigation, la barre de navigation disparaît
et un squelette sans rapport avec la page finale flotte dans le vide.

`AppShell` (`src/components/AppShell.tsx`) : grille `max-w-[1320px]` en
`grid-cols-[240px_1fr]` (md) / `[240px_minmax(0,1fr)_340px]` (lg) — sidebar gauche
(logo + nav + carte utilisateur), colonne `main` (barre mobile + contenu), rail
droit (Discover), nav mobile basse.

`loading.tsx` existants : `feed`, `search`, `work/[id]`, `u/[username]`,
`bibliotheque`, `communautes`.

## Décisions validées

- **Approche : shell partagé sous forme de squelette.** Un composant
  `AppShellSkeleton` reproduit le gabarit de l'`AppShell` (nav en placeholder,
  aucune donnée) ; chaque `loading.tsx` rend son squelette de contenu **dans** ce
  shell.
- **Fidélité structurelle** (bonnes zones/formes), pas pixel-perfect.
- Pas de refactor des pages (l'`AppShell` reste dans chaque page).
- Squelettes purement présentationnels : validation par typecheck + build + contrôle
  visuel ; pas de tests unitaires (cohérent avec les `loading.tsx` actuels).

## Conception

### 1. `AppShellSkeleton` — `src/components/AppShellSkeleton.tsx`

Composant serveur statique (aucun `use client`, aucune donnée). Reproduit la grille
externe de l'`AppShell` :

- Conteneur : `mx-auto grid min-h-screen max-w-[1320px] grid-cols-1 md:grid-cols-[240px_1fr] lg:grid-cols-[240px_minmax(0,1fr)_340px]` (identique à l'AppShell).
- **Sidebar gauche** (`hidden md:flex`, mêmes classes de bordure/padding) : un
  bloc logo (`h-7 w-24`), ~6 pastilles de nav (`h-9 rounded-full`), un espaceur
  `mt-auto` + carte utilisateur (`h-14 rounded-2xl border`).
- **Colonne `main`** (mêmes classes `border-x px-3 pb-24 pt-4 md:px-5`) : barre mobile
  (`md:hidden`, logo `h-6 w-20` + rond avatar `h-8 w-8`) puis `{children}`.
- **Rail droit** (`hidden lg:block`, padding identique) : 3 blocs placeholder
  (`h-24 rounded-2xl`).
- **Nav mobile basse** (`fixed inset-x-0 bottom-0 md:hidden`) : 4 ronds
  `h-6 w-6` répartis.

Signature : `export function AppShellSkeleton({ children }: { children: React.ReactNode })`.

Toutes les zones vides utilisent `animate-pulse bg-[var(--color-border)]` (ou
`bg-[var(--color-surface)]` pour les cartes) et les rayons cohérents avec les vrais
composants.

Facultatif (DRY) : petit helper interne `Skel` (`<div className={"animate-pulse bg-[var(--color-border)] " + cls} />`) réutilisé.

### 2. Squelettes de contenu par page (chaque `loading.tsx`)

Chaque fichier devient :

```tsx
import { AppShellSkeleton } from "@/components/AppShellSkeleton";
export default function Loading() {
  return <AppShellSkeleton>{/* squelette de contenu spécifique */}</AppShellSkeleton>;
}
```

Contenu à imiter (structure réelle) :

- **`feed/loading.tsx`** : rangée d'onglets (pastilles `h-10` en flex), barre de
  recherche (`h-11 rounded-2xl`), puis **3 cartes-feed** : chacune `rounded-2xl
  border p-4` avec rond avatar `h-10 w-10` + 2 lignes de texte (`h-3 w-32`, `h-3
  w-24`) + bloc contenu (`h-24`) + rangée d'actions (2 pastilles `h-7 w-16`).
- **`bibliotheque/loading.tsx`** : ligne titre (`h-8 w-40`) + bouton (`h-9 w-28`),
  rangée de 4 pastilles de filtre (`h-8 w-16`), rangée « En cours » (titre `h-5 w-24`
  + 4 posters `w-32 aspect-[2/3]` en flex horizontal), grille collections
  (`grid-cols-2 sm:grid-cols-3 md:grid-cols-4`, 4 cartes `aspect-[4/3]`), grille
  posters (`grid-cols-3 sm:grid-cols-4 md:grid-cols-5`, 10 `aspect-[2/3]`).
- **`u/[username]/loading.tsx`** : bandeau (`h-28 rounded-2xl`), rond avatar
  (`h-20 w-20 -mt-10`), lignes nom/@ (`h-5 w-40`, `h-3 w-24`), rangée de stats
  (`h-4 w-56`), rangée d'onglets (3 pastilles `h-9`), grille posters
  (`grid-cols-3 sm:grid-cols-4 md:grid-cols-5`, 9 `aspect-[2/3]`).
- **`work/[id]/loading.tsx`** : backdrop (`h-32 rounded-t-2xl`), poster (`-mt-12
  h-36 w-24`), lignes titre/méta (`h-6 w-48`, `h-3 w-32`), 3 pastilles genres
  (`h-5 w-16`), 3 lignes synopsis (`h-3`), rangée d'onglets (2 pastilles `h-9`),
  bloc éditeur (`h-40 rounded-2xl`).
- **`communautes/loading.tsx`** : ligne titre (`h-8 w-40`) + bouton (`h-9 w-28`),
  **3 cartes communauté** : chacune `overflow-hidden rounded-2xl border` avec
  bandeau `h-16` + zone `p-4` (nom `h-5 w-40`, ligne membres `h-3 w-20`).
- **`search/loading.tsx`** : barre de recherche (`h-11 rounded-full`), puis 6 lignes
  de résultats (`flex gap-3` : vignette `h-16 w-11` + 2 lignes texte).

### 3. Cohérence

Rayons/couleurs alignés sur les vrais composants (`rounded-2xl` cartes, `rounded-xl`
posters, `rounded-full` pastilles ; `border-[var(--color-border)]`). Aucune donnée,
aucune requête, aucun état.

## Fichiers touchés

- `src/components/AppShellSkeleton.tsx` — nouveau.
- `src/app/feed/loading.tsx`
- `src/app/search/loading.tsx`
- `src/app/work/[id]/loading.tsx`
- `src/app/u/[username]/loading.tsx`
- `src/app/bibliotheque/loading.tsx`
- `src/app/communautes/loading.tsx`

## Hors périmètre

Refactor de l'`AppShell` dans un layout ; squelettes des états de chargement
**client** (ex. `FeedClient` après montage) — déjà présents et hors sujet ici ;
autres routes sans `loading.tsx`.
