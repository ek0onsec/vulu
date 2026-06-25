# Motifs d'arrière-plan par thème vulu+ — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Donner à chacun des 5 thèmes vulu+ un motif d'arrière-plan subtil (style fond WhatsApp), compatible clair/sombre, le thème gratuit « vulu » restant épuré.

**Architecture:** Pur CSS dans `globals.css` + 5 fichiers SVG dans `public/motifs/`. Une couche `body::before` plein écran, fixe, masquée par un SVG tuilable propre à chaque palette (`--motif-pattern`), teintée par un token `--motif-ink` qui bascule clair/sombre. Le système de palettes existant (`data-palette` sur `<html>`) déclenche le motif sans aucun JS.

**Tech Stack:** CSS (Tailwind v4 / `@theme`), SVG, Next.js 16 (assets statiques `public/`).

## Global Constraints

- Motifs pour les **5 thèmes vulu+ uniquement** : `aurore`, `foret`, `retro`, `ocean`, `crepuscule`. Le thème `vulu` (gratuit) reste sans motif.
- **Compatible clair ET sombre** : la forme (SVG) est commune aux deux modes ; seule l'encre (`--motif-ink`) bascule.
- Motif **subtil** (opacité d'encre ~0.05), **derrière** le contenu (`z-index:-1`), **non cliquable** (`pointer-events:none`).
- Tuile **150px**, SVG monochrome (formes/traits opaques sur fond transparent) servant de **masque alpha**.
- Aucune dépendance externe, aucun composant React, aucun JS.
- **Écart assumé vs spec** : SVG en **fichiers** `public/motifs/*.svg` (référencés `url("/motifs/x.svg")`) plutôt qu'en data-URI inline — même rendu, bien plus maintenable, perf négligeable (assets minuscules, mis en cache, chargés seulement quand la palette vulu+ correspondante est active).

---

### Task 1: Socle CSS + motif Forêt (preuve de bout en bout)

**Files:**
- Create: `public/motifs/foret.svg`
- Modify: `src/app/globals.css`

**Interfaces:**
- Consumes: variables de thème existantes (`--color-bg`, `.dark`), attribut `data-palette` posé par `applyPalette` (`src/lib/theme.ts`).
- Produces: la couche `body::before`, les tokens `--motif-ink` (clair/sombre) et `--motif-pattern` (défaut `none`), la règle d'activation `:root[data-palette] body::before { display:block }`, et le motif `[data-palette="foret"]`.

- [ ] **Step 1: Create the Forêt motif file**

Créer `public/motifs/foret.svg` (tuile 150×150, traits noirs opaques sur fond transparent — la couleur réelle viendra du masque) :

```svg
<svg xmlns="http://www.w3.org/2000/svg" width="150" height="150" viewBox="0 0 150 150">
  <g fill="none" stroke="#000" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
    <!-- feuille -->
    <path d="M34 26c-11 10-11 26 0 36 11-10 11-26 0-36z"/>
    <path d="M34 30v28"/>
    <!-- fronde de fougère -->
    <path d="M116 22v34"/>
    <path d="M116 27l-8-5m8 5l8-5m-8 13l-9-5m9 5l9-5m-9 13l-8-5m8 5l8-5"/>
    <!-- petit cerf stylisé -->
    <path d="M58 116v-12l7-7h14l7 7v12"/>
    <path d="M65 97l-5-12m5 12l5-12"/>
    <path d="M60 85l-4 5m4-5l4 5m6-5l-4 5m4-5l4 5"/>
  </g>
</svg>
```

- [ ] **Step 2: Add the rendering layer + ink tokens in globals.css**

Dans `src/app/globals.css`, à la fin du bloc `:root { … }` (thème clair), ajouter les tokens motif :

```css
  --motif-pattern: none;
  --motif-ink: rgba(30, 20, 45, 0.05);
```

À la fin du bloc `.dark { … }`, ajouter l'override d'encre sombre :

```css
  --motif-ink: rgba(255, 255, 255, 0.05);
```

Puis, après les déclarations de palettes (`[data-palette=…]`), ajouter la couche de rendu et son activation (masquée par défaut pour que le thème vulu, sans `data-palette`, n'affiche rien) :

```css
body::before {
  content: "";
  position: fixed;
  inset: 0;
  z-index: -1;
  pointer-events: none;
  display: none;
  background-color: var(--motif-ink);
  -webkit-mask-image: var(--motif-pattern);
  mask-image: var(--motif-pattern);
  -webkit-mask-repeat: repeat;
  mask-repeat: repeat;
  -webkit-mask-size: 150px 150px;
  mask-size: 150px 150px;
}
:root[data-palette] body::before { display: block; }
```

- [ ] **Step 3: Wire the Forêt pattern**

Toujours dans `src/app/globals.css`, sous la ligne existante de la palette forêt
(`:root[data-palette="foret"] { … }` / `.dark[data-palette="foret"] { … }`), ajouter une règle
partagée par les deux modes (la forme est commune ; seule l'encre change) :

```css
:root[data-palette="foret"], .dark[data-palette="foret"] { --motif-pattern: url("/motifs/foret.svg"); }
```

- [ ] **Step 4: Build + visual check**

Run: `npm run build`
Expected: build OK (CSS valide).

Vérif manuelle (`npm run dev`) : passer la palette sur **Forêt** via le sélecteur de thème, basculer **clair ↔ sombre**. Attendu : motif feuillages/fougère/cerf subtil dans les zones de fond, lisible dans les deux modes ; passer sur **vulu** → plus aucun motif ; le contenu (cartes) recouvre le motif et reste cliquable.

- [ ] **Step 5: Commit**

```bash
git add public/motifs/foret.svg src/app/globals.css
git commit -m "feat(vulu): motifs de thème vulu+ — socle + motif Forêt"
```

---

### Task 2: Motif Océan

**Files:**
- Create: `public/motifs/ocean.svg`
- Modify: `src/app/globals.css`

**Interfaces:**
- Consumes: socle de Task 1 (`body::before`, `--motif-ink`, activation `[data-palette]`).
- Produces: `--motif-pattern` pour `[data-palette="ocean"]`.

- [ ] **Step 1: Create the Océan motif file**

Créer `public/motifs/ocean.svg` (poissons + dauphin + vagues) :

```svg
<svg xmlns="http://www.w3.org/2000/svg" width="150" height="150" viewBox="0 0 150 150">
  <g fill="none" stroke="#000" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
    <!-- poisson -->
    <path d="M26 40c10-8 22-8 30 0-8 8-20 8-30 0z"/>
    <path d="M26 40l-8-6v12z"/>
    <circle cx="48" cy="38" r="1.4" fill="#000"/>
    <!-- vagues -->
    <path d="M14 118c8-7 16-7 24 0s16 7 24 0 16-7 24 0"/>
    <path d="M14 128c8-7 16-7 24 0s16 7 24 0 16-7 24 0"/>
    <!-- dauphin stylisé -->
    <path d="M96 34c14-2 24 8 22 22-4-9-9-12-16-12 6 4 8 9 6 15-5-8-12-10-20-8 8-7 8-13 8-17z"/>
  </g>
</svg>
```

- [ ] **Step 2: Wire the Océan pattern**

Dans `src/app/globals.css`, sous la palette océan, ajouter :

```css
:root[data-palette="ocean"], .dark[data-palette="ocean"] { --motif-pattern: url("/motifs/ocean.svg"); }
```

- [ ] **Step 3: Build + visual check**

Run: `npm run build`
Expected: build OK.

Vérif : palette **Océan**, clair ↔ sombre → poissons/dauphin/vagues subtils, lisibles dans les deux modes.

- [ ] **Step 4: Commit**

```bash
git add public/motifs/ocean.svg src/app/globals.css
git commit -m "feat(vulu): motif de thème Océan"
```

---

### Task 3: Motif Aurore

**Files:**
- Create: `public/motifs/aurore.svg`
- Modify: `src/app/globals.css`

**Interfaces:**
- Consumes: socle de Task 1.
- Produces: `--motif-pattern` pour `[data-palette="aurore"]`.

- [ ] **Step 1: Create the Aurore motif file**

Créer `public/motifs/aurore.svg` (étoiles à 4 branches + voiles d'aurore + sommet) :

```svg
<svg xmlns="http://www.w3.org/2000/svg" width="150" height="150" viewBox="0 0 150 150">
  <g fill="none" stroke="#000" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
    <!-- voiles d'aurore -->
    <path d="M26 18c8 14 0 22-6 32s2 22 8 34"/>
    <path d="M40 16c8 14 0 22-6 32s2 22 8 34"/>
    <!-- étoiles 4 branches -->
    <path d="M104 30c1 0 1 0 0 0m0-9c2 5 4 7 9 9-5 2-7 4-9 9-2-5-4-7-9-9 5-2 7-4 9-9z" fill="#000" stroke="none"/>
    <path d="M126 64c1.4 3.5 2.8 4.9 6.3 6.3-3.5 1.4-4.9 2.8-6.3 6.3-1.4-3.5-2.8-4.9-6.3-6.3 3.5-1.4 4.9-2.8 6.3-6.3z" fill="#000" stroke="none"/>
    <!-- sommet -->
    <path d="M96 122l16-26 16 26"/>
    <path d="M108 102l4 6 4-6"/>
  </g>
</svg>
```

- [ ] **Step 2: Wire the Aurore pattern**

Dans `src/app/globals.css`, sous la palette aurore, ajouter :

```css
:root[data-palette="aurore"], .dark[data-palette="aurore"] { --motif-pattern: url("/motifs/aurore.svg"); }
```

- [ ] **Step 3: Build + visual check**

Run: `npm run build`
Expected: build OK.

Vérif : palette **Aurore**, clair ↔ sombre → étoiles/voiles/sommet subtils.

- [ ] **Step 4: Commit**

```bash
git add public/motifs/aurore.svg src/app/globals.css
git commit -m "feat(vulu): motif de thème Aurore"
```

---

### Task 4: Motif Rétro

**Files:**
- Create: `public/motifs/retro.svg`
- Modify: `src/app/globals.css`

**Interfaces:**
- Consumes: socle de Task 1.
- Produces: `--motif-pattern` pour `[data-palette="retro"]`.

- [ ] **Step 1: Create the Rétro motif file**

Créer `public/motifs/retro.svg` (soleil 80s à rayures + triangles/zigzags) :

```svg
<svg xmlns="http://www.w3.org/2000/svg" width="150" height="150" viewBox="0 0 150 150">
  <g fill="none" stroke="#000" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
    <!-- soleil 80s à rayures -->
    <path d="M34 52a18 18 0 0 0-36 0" transform="translate(18 0)"/>
    <path d="M16 46h36M19 52h30M23 58h22"/>
    <!-- zigzag -->
    <path d="M96 30l10-12 10 12 10-12 10 12"/>
    <!-- triangles -->
    <path d="M30 120l12-20 12 20z"/>
    <path d="M104 124l9-15 9 15z"/>
  </g>
</svg>
```

- [ ] **Step 2: Wire the Rétro pattern**

Dans `src/app/globals.css`, sous la palette rétro, ajouter :

```css
:root[data-palette="retro"], .dark[data-palette="retro"] { --motif-pattern: url("/motifs/retro.svg"); }
```

- [ ] **Step 3: Build + visual check**

Run: `npm run build`
Expected: build OK.

Vérif : palette **Rétro**, clair ↔ sombre → soleil rayé/triangles/zigzags subtils.

- [ ] **Step 4: Commit**

```bash
git add public/motifs/retro.svg src/app/globals.css
git commit -m "feat(vulu): motif de thème Rétro"
```

---

### Task 5: Motif Crépuscule

**Files:**
- Create: `public/motifs/crepuscule.svg`
- Modify: `src/app/globals.css`

**Interfaces:**
- Consumes: socle de Task 1.
- Produces: `--motif-pattern` pour `[data-palette="crepuscule"]`.

- [ ] **Step 1: Create the Crépuscule motif file**

Créer `public/motifs/crepuscule.svg` (demi-soleil couchant + nuages + oiseaux en V) :

```svg
<svg xmlns="http://www.w3.org/2000/svg" width="150" height="150" viewBox="0 0 150 150">
  <g fill="none" stroke="#000" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
    <!-- demi-soleil couchant + rayons -->
    <path d="M30 60a18 18 0 0 1 36 0"/>
    <path d="M22 60h52M48 34v-8M30 40l-5-5m46 5l5-5"/>
    <!-- nuage -->
    <path d="M96 108a8 8 0 0 1 15-3 7 7 0 0 1 6 11h-26a7 7 0 0 1 5-8z"/>
    <!-- oiseaux en V -->
    <path d="M100 34c4-5 8-5 12 0"/>
    <path d="M116 30c4-5 8-5 12 0"/>
  </g>
</svg>
```

- [ ] **Step 2: Wire the Crépuscule pattern**

Dans `src/app/globals.css`, sous la palette crépuscule, ajouter :

```css
:root[data-palette="crepuscule"], .dark[data-palette="crepuscule"] { --motif-pattern: url("/motifs/crepuscule.svg"); }
```

- [ ] **Step 3: Build + full visual sweep**

Run: `npm run build`
Expected: build OK.

Vérif finale : parcourir les **5 palettes** (Aurore, Forêt, Rétro, Océan, Crépuscule) en **clair puis sombre** → chaque motif est présent, subtil, lisible ; **vulu** reste sans motif ; aucun motif ne capte les clics ni ne gêne la lecture du contenu.

- [ ] **Step 4: Commit**

```bash
git add public/motifs/crepuscule.svg src/app/globals.css
git commit -m "feat(vulu): motif de thème Crépuscule"
```

---

## Self-review

- **Couverture spec :** couche `body::before` + masque + ink flip → Task 1 (steps 2-3) ✓ ; `--motif-ink` clair/sombre → Task 1 step 2 ✓ ; les 5 motifs (foret, ocean, aurore, retro, crepuscule) → Tasks 1-5 ✓ ; vulu sans motif → gating `display:none` + `:root[data-palette] body::before{display:block}` (Task 1 step 2) ✓ ; aperçu/gating réutilisé (aucun code) ✓ ; tests = `npm run build` + smoke clair/sombre par palette → chaque task ✓.
- **Écart documenté :** fichiers SVG `public/motifs/` au lieu de data-URI inline (raison : maintenabilité ; rendu identique ; perf négligeable). Signalé en tête de plan.
- **Piège traité :** `mask-image: none` afficherait un aplat d'encre plein écran → la couche est `display:none` par défaut et activée seulement sous `[data-palette]` (présent uniquement pour les 5 thèmes vulu+, car `applyPalette("vulu")` retire l'attribut).
- **Placeholders :** aucun — chaque SVG est fourni en entier, chaque ligne CSS est explicite.
- **Cohérence :** nom de token `--motif-pattern`/`--motif-ink` identique partout ; tuile 150px cohérente entre `mask-size` (Task 1) et `width/height` des SVG (Tasks 1-5) ; sélecteurs `:root[data-palette="x"], .dark[data-palette="x"]` homogènes sur les 5 palettes.
- **Note exécution :** la qualité des tracés SVG (surtout cerf/dauphin) sera vérifiée sur l'aperçu live et affinée si une forme rend mal — itération visuelle normale, pas une lacune du plan.
