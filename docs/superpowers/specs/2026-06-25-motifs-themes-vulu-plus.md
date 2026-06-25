# Motifs d'arrière-plan par thème vulu+ — Design

Date : 2026-06-25
Statut : validé (brainstorming) — prêt pour le plan d'implémentation

## Objectif

Donner à chaque thème de couleur vulu+ un **motif d'arrière-plan subtil** (style fond d'écran
WhatsApp), en plus de la couleur d'accent qui change déjà, pour renforcer l'identité de chaque
thème et l'attrait de l'abonnement vulu+. Le thème gratuit « vulu » reste épuré, sans motif.

Contrainte absolue : **parfaitement compatible thème clair ET sombre**, motif discret, jamais
gênant pour la lisibilité.

## Périmètre

- Motifs pour les **5 thèmes vulu+** uniquement : Aurore, Forêt, Rétro, Océan, Crépuscule.
- Le thème **vulu** (gratuit) reste sans motif (fond uni).
- **Wallpaper plein écran** : le motif tapisse tout l'arrière-plan de l'app, derrière le contenu.
- Hors périmètre : nouveaux thèmes, motifs animés, gating spécifique (réutilise l'existant).

## Architecture

Tout vit dans **`src/app/globals.css`**. Aucun composant React, aucun JS : le système de palettes
existant (`applyPalette` dans `src/lib/theme.ts` pose l'attribut `data-palette` sur `<html>`)
déclenche le motif automatiquement via CSS.

### Couche de rendu

Une couche unique en pseudo-élément, plein écran, fixe, derrière tout le contenu :

```css
body::before {
  content: "";
  position: fixed;
  inset: 0;
  z-index: -1;
  pointer-events: none;
  background-color: var(--motif-ink);
  -webkit-mask-image: var(--motif-pattern);
  mask-image: var(--motif-pattern);
  -webkit-mask-repeat: repeat;
  mask-repeat: repeat;
  -webkit-mask-size: 150px;
  mask-size: 150px;
}
```

### Adaptation clair/sombre — le point clé

- **`--motif-pattern`** : un SVG tuilable encodé en data-URI, défini **par palette**. Valeur par
  défaut `none` (dans `:root`) → le thème vulu gratuit n'a aucun motif.
- **`--motif-ink`** : la couleur de l'encre du motif, qui **bascule une seule fois** selon le mode :
  - `:root` (clair) : `rgba(30, 20, 45, 0.05)`
  - `.dark` (sombre) : `rgba(255, 255, 255, 0.05)`
- Le SVG ne porte que la **forme** (utilisé comme masque alpha) ; la couleur vient de `--motif-ink`.
  → un seul SVG par thème fonctionne dans les deux modes, sans dupliquer d'assets.
- Le masque CSS (`mask-image` sur une `url()` d'image) utilise l'**alpha** du SVG : les zones opaques
  du SVG laissent voir `--motif-ink`, les zones transparentes restent invisibles. Les SVG doivent
  donc dessiner des formes pleines (fill opaque, n'importe quelle couleur) sur fond transparent.

### Visibilité dans la mise en page

Le motif vit dans le fond (`--color-bg`). Les surfaces de contenu (cartes, panneaux) utilisent
`--color-surface` (opaque) et **recouvrent** le motif → effet « fond WhatsApp derrière les bulles ».
Le motif n'apparaît que dans les zones de fond (marges, espaces entre cartes, colonnes latérales),
ce qui préserve la lisibilité du contenu.

## Les 5 motifs

Un SVG tuilable par palette, sous le sélecteur correspondant
(`:root[data-palette="…"]` et `.dark[data-palette="…"]` partagent la **même** valeur
`--motif-pattern` — l'encre est ce qui change selon le mode, pas la forme) :

| Palette | `data-palette` | Icônes éparses dans la tuile |
|---|---|---|
| Forêt | `foret` | feuilles / fougères + une silhouette de cerf |
| Océan | `ocean` | petits poissons + un dauphin + ondulations de vagues |
| Aurore | `aurore` | étoiles à 4 branches + voiles d'aurore boréale + un sommet |
| Rétro | `retro` | soleil 80s à rayures + triangles / zigzags géométriques |
| Crépuscule | `crepuscule` | demi-soleil couchant + nuages + oiseaux en V |

Style commun : line-art fin, formes simples et espacées (densité faible pour rester subtil), tuile
~150px conçue pour se répéter sans couture visible. Chaque SVG est monochrome (fill opaque), le
masque alpha prend le relais pour la teinte.

Comme `--motif-pattern` n'est défini que sous les 5 sélecteurs `[data-palette]` vulu+ et reste
`none` dans `:root`, le thème vulu gratuit (qui retire l'attribut `data-palette`) n'affiche aucun
motif — sans code conditionnel.

## Aperçu vulu+ / gating

Aucune logique nouvelle. La palette est déjà prévisualisable sans persistance pour les non-abonnés
(`applyPalette(id, persist)`), et le motif suit mécaniquement l'attribut `data-palette` : visible en
aperçu, non sauvegardé au rechargement pour les non-abonnés. Réutilise entièrement l'existant.

## Performance

- SVG inline en data-URI → aucune requête réseau.
- Une seule couche `position: fixed` (composée par le GPU), `pointer-events: none`.
- Tuiles ~150px, formes minimales → poids négligeable, pas de reflow au scroll.

## Tests

Pur CSS, aucun test unitaire.

- `npm run build` passe (CSS valide, pas de régression de compilation).
- Smoke manuel : pour chaque palette vulu+ (Aurore, Forêt, Rétro, Océan, Crépuscule), basculer
  **clair ↔ sombre** → le motif apparaît, subtil et lisible dans les deux modes ; le thème **vulu**
  gratuit reste sans motif ; le motif est bien **derrière** le contenu (cartes opaques le masquent)
  et ne capte pas les clics (`pointer-events: none`).

## Fichiers

- **Modifié** : `src/app/globals.css` (règle `body::before`, tokens `--motif-ink` clair/sombre,
  5 `--motif-pattern` sous les `[data-palette]` vulu+).
