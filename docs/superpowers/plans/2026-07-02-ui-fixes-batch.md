# Batch corrections UI/UX + navigation feed + partage privé + scan mobile — Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Corriger un lot de bugs (route `/`, icônes tronquées, affiches manquantes, responsive iOS), revoir la navigation des cartes du feed, introduire des entrées « gardées pour soi » (non partagées), adapter le vocabulaire livres (à lire/lu), et fiabiliser le scan de code-barres sur mobile + l'ajout par scan depuis une collection.

**Architecture :** App Next.js 16 (App Router, Turbopack), hexagonale côté serveur (domain/application/ports/adapters). Les corrections logiques (visibilité feed, audiences, vocabulaire) passent par le domaine/application avec tests vitest ; les corrections UI/CSS sont vérifiées manuellement dans le navigateur (desktop + émulation mobile iOS).

**Tech Stack :** Next.js 16.2.9, React 19, Tailwind v4, TypeScript strict, MongoDB (Atlas en dev), vitest, @zxing/browser + @zxing/library (scan), service worker PWA maison (`public/sw.js`).

## Global Constraints

- Aucune mention IA / Claude / superpowers dans le code, l'app ou les commits ; aucun co-auteur Claude. (verbatim CLAUDE.md)
- Ne jamais toucher au dossier `lechatonfat/`.
- Architecture hexagonale obligatoire : toute dépendance externe derrière un port ; le domaine ne connaît aucun driver/SDK.
- Aucun secret en dur ; validation des entrées aux frontières ; jamais de parsing HTML par regex ; pas de `dangerouslySetInnerHTML` sans sanitisation.
- Typage strict, pas de `any`. Nommage explicite, une responsabilité par fonction.
- Commits fréquents, un par tâche, directement sur `master` (workflow établi de ce dépôt).
- Vérifier avant de conclure : `npx tsc --noEmit` propre + `npx vitest run` vert.
- Base de dev = MongoDB Atlas (voir `.env.local`, non versionné). Serveur relancé via `npm run dev`.

## Décisions prises (à corriger dans la session fresh si besoin)

1. **Partage par défaut** : une notation/avis avec commentaire reste partagé au Cercle par défaut (comportement actuel conservé). Un ajout « à voir/à lire » ou « vu/lu » **sans commentaire ni note** est **privé par défaut** (gardé pour soi, invisible au feed). Une case explicite « Partager dans le feed » permet de basculer.
2. **Entrée privée** = `audiences = { public:false, circle:false, communityIds:[] }`. La visibilité feed doit honorer `audiences.circle` (aujourd'hui ignoré).
3. **Vocabulaire livres** : planned = « À lire », done = « Lu ✓ », verbe d'activité = « lit » ; films/séries : « À voir » / « Vu ✓ » / « regarde ». (« En cours » commun.)
4. **Clic carte feed** : corps de carte → `/post/{entryId}` (page commentaires) ; affiche/cover → `/work/{workId}` ; avatar/pseudo → `/u/{username}`.
5. **Scan depuis collection** : bouton « Scanner » disponible dans le détail d'une liste de type livres (`ListDetailModal`) et dans l'onglet Livres de la bibliothèque ; ajoute le livre scanné à la collection courante (ou à la watchlist si hors liste).

---

## File Structure

**Bugs / rendu :**
- `public/sw.js` — stratégie de cache PWA (retirer `/` du precache, network-first navigations, bump version).
- `src/components/Icon.tsx` — ajout `shrink-0` sur le `<svg>` (fix icônes tronquées).
- `src/app/layout.tsx` — `viewport-fit=cover` + safe-area (iOS).
- `src/app/globals.css` — utilitaires safe-area si nécessaire.
- `src/components/SearchPanel.tsx` — bouton caméra hors-champ iOS.
- `src/components/ProfileEditModal.tsx` — bouton « Éditer le profil » responsive.
- Affiches manquantes : `src/server/adapters/catalog/tmdb-catalog.ts`, `google-books-catalog.ts` (déjà https), `src/components/FeedCard.tsx` + `PosterRow`/`Avatar` (rendu) — tâche de debug.

**Navigation feed :**
- `src/components/FeedCard.tsx` — restructurer les cibles de clic + « Lire plus ».

**Partage privé & statuts :**
- `src/components/EntryEditor.tsx` — libellés par type + option « Partager dans le feed » / privé.
- `src/server/application/feed.ts` — visibilité honorant `audiences.circle`.
- `src/server/application/feed.ts` (liste) + repo si le filtrage est en base : `src/server/adapters/mongo/repositories.ts`, `src/server/ports/repositories.ts`, `src/server/adapters/memory/index.ts`.
- Sites d'affichage du vocabulaire : `src/components/ProfileTabs.tsx`, `src/app/work/[id]/page.tsx`, `src/app/u/[username]/page.tsx`, `src/app/personne/[id]/PersonClient.tsx`, `src/app/bibliotheque/LibraryClient.tsx`, `src/lib/progress.ts` (déjà correct).

**Scan :**
- `src/components/BookScanner.tsx` — caméra arrière + décodage robuste.
- `src/components/ListDetailModal.tsx` + `src/app/bibliotheque/LibraryClient.tsx` — bouton scan → ajout collection.

---

## Phase A — Bugs bloquants

### Task 1: Corriger la route `/` « site inaccessible » (service worker)

**Cause racine :** `public/sw.js` précache `"/"` dans `SHELL`. `/` renvoie un **307 → /login**. Une réponse *redirigée* ne peut pas être mise en cache (`cache.addAll`/`put` lève sur `response.redirected === true`) et, servie à une requête de navigation, provoque « Ce site est inaccessible ». Un SW obsolète (installé lors d'un build prod antérieur) continue d'intercepter `/`.

**Files:**
- Modify: `public/sw.js`

- [ ] **Step 1 : Réécrire la stratégie du service worker**

Remplacer le contenu de `public/sw.js` par :

```js
// Service worker minimal pour vulu (PWA installable).
// - app shell mis en cache à l'installation (hors routes de redirection)
// - navigations : réseau d'abord (jamais servir une redirection depuis le cache)
// - assets statiques : cache-first avec revalidation
// - données API : réseau d'abord, jamais mises en cache (données privées/fraîches)
const CACHE = "vulu-v2"; // bump : évince l'ancien cache qui contenait "/" (redirection)
const SHELL = ["/login", "/icon.svg", "/manifest.webmanifest"]; // pas de "/" ni "/feed" (redirections/authentifié)

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Navigations (pages) : réseau d'abord. On ne met JAMAIS en cache une réponse
  // redirigée (redirect) et on ne la sert pas depuis le cache -> évite « site inaccessible ».
  if (request.mode === "navigate") {
    event.respondWith(fetch(request).catch(() => caches.match("/login")));
    return;
  }

  // Données API : réseau d'abord, jamais servi depuis le cache.
  if (url.pathname.startsWith("/api/")) {
    event.respondWith(fetch(request).catch(() => new Response(JSON.stringify({ error: "OFFLINE" }), { status: 503, headers: { "content-type": "application/json" } })));
    return;
  }

  // Assets statiques : cache-first avec mise à jour en arrière-plan. On ignore
  // les réponses redirigées pour ne jamais polluer le cache.
  event.respondWith(
    caches.match(request).then((cached) => {
      const network = fetch(request).then((res) => {
        if (res.ok && !res.redirected) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(request, copy)); }
        return res;
      }).catch(() => cached);
      return cached || network;
    }),
  );
});
```

- [ ] **Step 2 : Vérifier au niveau HTTP**

Run: `curl -sS -o /dev/null -w "%{http_code}\n" http://localhost:3000/ && curl -sS -o /dev/null -w "%{http_code}\n" http://localhost:3000/login`
Expected: `307` puis `200`.

- [ ] **Step 3 : Vérifier en navigateur (SW obsolète)**

Sur le device/onglet où le bug apparaît : DevTools → Application → Service Workers → **Unregister**, puis Storage → **Clear site data**, recharger `/`. Attendu : redirection propre vers `/login` (ou `/feed` si connecté). Note : en dev le SW ne s'enregistre pas (`ServiceWorkerRegister` sort si `NODE_ENV !== "production"`) ; le fix protège les installations PWA / builds prod.

- [ ] **Step 4 : Commit**

```bash
git add public/sw.js
git commit -m "fix(vulu): SW ne précache plus la route de redirection / (corrige « site inaccessible »)"
```

---

### Task 2: Corriger les icônes tronquées (heart, camera, etc.)

**Cause racine :** dans `Icon.tsx`, le `<svg>` n'a pas de `flex-shrink:0`. Placé dans un conteneur flex avec du texte (ex. bouton like `♥ {likes}`), le SVG est compressé sous sa taille intrinsèque → aspect « tronqué ». Correction globale : `shrink-0` sur le `<svg>`.

**Files:**
- Modify: `src/components/Icon.tsx`

- [ ] **Step 1 : Ajouter `shrink-0` à la classe de base du svg**

Dans `src/components/Icon.tsx`, la fonction `Icon` — remplacer :

```tsx
      className={className} aria-hidden="true"
```

par :

```tsx
      className={`shrink-0${className ? ` ${className}` : ""}`} aria-hidden="true"
```

- [ ] **Step 2 : Vérifier le typecheck**

Run: `npx tsc --noEmit`
Expected: aucune sortie.

- [ ] **Step 3 : Vérification visuelle**

Feed → l'icône cœur du bouton like n'est plus compressée ; page Recherche (onglet Livres) → l'icône caméra est ronde/complète. Tester en émulation mobile (DevTools responsive, iPhone).

- [ ] **Step 4 : Commit**

```bash
git add src/components/Icon.tsx
git commit -m "fix(vulu): icônes non tronquées (shrink-0 sur le svg)"
```

---

### Task 3: Affiches film/série/livre qui ne s'affichent pas (debug)

**REQUIRED SUB-SKILL : superpowers:systematic-debugging.** Reproduire avant de corriger.

**Contexte connu :**
- `FeedCard.tsx:69-70` rend l'affiche via `background-image: url(item.work.posterUrl)` sur un `<div>` (pas `next/image`). Poster `null` → boîte grise (normal).
- TMDB : `tmdb-catalog.ts:22` → `${imageBase}/${size}${path}` avec `imageBase = https://image.tmdb.org/t/p` ; `poster_path` `null` possible (films sans affiche).
- Google Books : `google-books-catalog.ts:34-37` `cover()` force déjà `https:`.

**Files:**
- Investigate: `src/server/adapters/catalog/tmdb-catalog.ts`, `google-books-catalog.ts`, `src/components/FeedCard.tsx`, `src/components/PosterRow.tsx`, `src/lib/serialize.ts`
- Modify: selon hypothèse confirmée.

- [ ] **Step 1 : Reproduire et instrumenter**

Ouvrir le feed avec des entrées film + livre. DevTools → Network → filtrer Images. Repérer les affiches qui échouent (statut, URL). Hypothèses à départager :
  - (H1) `posterUrl === null` en base (œuvre persistée sans affiche) → attendu, mais vérifier si des affiches existent chez le fournisseur.
  - (H2) Google Books : URL `http` (mixed content en https) — normalement corrigé ; vérifier qu'aucun autre champ (`smallThumbnail`) n'échappe au `replace`.
  - (H3) Google Books : miniature bloquée (referrer/hotlink) ou `zoom` trop petit.
  - (H4) URL avec caractères non échappés cassant `url(...)` en CSS (parenthèses/espaces) → besoin d'encoder ou de passer par `next/image`.

- [ ] **Step 2 : Confirmer l'hypothèse via une œuvre concrète**

Inspecter la valeur `posterUrl` renvoyée par l'API (Network → réponse `/api/feed` ou `/api/search`). Noter l'URL exacte d'une affiche cassée et l'ouvrir dans un onglet pour voir l'échec réel (404, mixed content, CORS).

- [ ] **Step 3 : Appliquer le correctif ciblé** (selon H confirmée)

  - Si **H4** (échappement CSS) : dans `FeedCard.tsx`, encoder l'URL — `backgroundImage: \`url("${item.work.posterUrl}")\`` (guillemets) au lieu de `url(${...})`. Appliquer le même correctif partout où une affiche est rendue en `background-image` (`PosterRow`, work page).
  - Si **H2/H3** (Google Books) : dans `google-books-catalog.ts`, normaliser aussi `smallThumbnail`, retirer `&edge=curl` et forcer un zoom lisible, ex. `url.replace(/^http:/, "https:").replace("&edge=curl", "")`. Ajouter `referrerPolicy="no-referrer"` sur les `<img>` concernées si le rendu passe par `next/image`/`img`.
  - Si **H1** (pas d'affiche) : ajouter un placeholder visuel propre (initiales/titre) dans le composant d'affiche plutôt qu'une boîte grise vide.

- [ ] **Step 4 : Vérifier**

Recharger le feed + la recherche : les affiches disponibles s'affichent (film, série, livre) ; les œuvres réellement sans affiche montrent le placeholder. `npx tsc --noEmit` propre.

- [ ] **Step 5 : Commit**

```bash
git add -A
git commit -m "fix(vulu): affichage fiable des affiches (<cause confirmée: échappement CSS / miniatures Google Books>)"
```

---

### Task 4: Responsive iOS/iPhone — caméra hors-champ, safe-area, bouton « Éditer le profil »

**Files:**
- Modify: `src/app/layout.tsx` (viewport), `src/app/globals.css` (utilitaires safe-area si besoin), `src/components/SearchPanel.tsx`, `src/components/BookScanner.tsx`, `src/components/ProfileEditModal.tsx`

- [ ] **Step 1 : Activer `viewport-fit=cover`**

Dans `src/app/layout.tsx`, s'assurer que l'export `viewport` contient `viewportFit: "cover"` (Next 16 : objet `export const viewport: Viewport = { ..., viewportFit: "cover" }`). Vérifier d'abord la forme existante (`grep -n "viewport" src/app/layout.tsx`) et compléter sans dupliquer.

- [ ] **Step 2 : Overlay scan — respecter la safe-area**

Dans `src/components/BookScanner.tsx`, l'en-tête superposé (`absolute inset-x-0 top-0 ... pt-3`) passe sous l'encoche iPhone. Ajouter le padding safe-area : remplacer `pt-3` par `pt-[max(0.75rem,env(safe-area-inset-top))]` et, sur le bouton fermer, garantir `min-w-11 min-h-11` (cible tactile). Idem pour le texte du bas : `bottom-10` → `bottom-[max(2.5rem,env(safe-area-inset-bottom))]`.

- [ ] **Step 3 : Bouton caméra recherche — jamais hors-champ**

Dans `src/components/SearchPanel.tsx` (bloc `flex items-center gap-2`), le bouton caméra est `shrink-0` (OK) mais l'`<input>` en `w-full` peut le pousser. Confirmer que le conteneur ne déborde pas : ajouter `min-w-0` sur l'input (`className="w-full min-w-0 ..."`) pour qu'il cède la place au bouton `shrink-0`. Vérifier en émulation iPhone SE (375px) que le bouton reste visible.

- [ ] **Step 4 : Bouton « Éditer le profil » responsive**

Dans `src/components/ProfileEditModal.tsx`, le bouton trigger (`flex items-center gap-1.5 rounded-full border ... px-4 py-2`) doit rester lisible/non tronqué sur mobile. Le rendre cohérent : `whitespace-nowrap`, et si le conteneur parent l'écrase, permettre `w-full sm:w-auto justify-center`. Vérifier le conteneur appelant (`grep -rn "ProfileEditModal" src`) pour aligner la largeur sur mobile (le header profil doit réserver la place du bouton, pas le chevaucher).

- [ ] **Step 5 : Vérifier en émulation mobile**

DevTools responsive (iPhone SE 375px + iPhone 14 Pro avec encoche) : overlay scan sous l'encoche OK, bouton caméra visible, bouton éditer profil propre. `npx tsc --noEmit` propre.

- [ ] **Step 6 : Commit**

```bash
git add src/app/layout.tsx src/app/globals.css src/components/SearchPanel.tsx src/components/BookScanner.tsx src/components/ProfileEditModal.tsx
git commit -m "fix(vulu): responsive iOS — safe-area, bouton caméra visible, bouton éditer profil"
```

---

## Phase B — Navigation & lisibilité du feed

### Task 5: Cibles de clic des cartes du feed

**Objectif :** corps de carte → `/post/{entryId}` ; affiche/cover → `/work/{workId}` ; avatar + pseudo → `/u/{username}`. Éviter les `<a>` imbriqués (invalide) : utiliser un overlay de lien + boutons/liens explicites au-dessus.

**Files:**
- Modify: `src/components/FeedCard.tsx`

**Interfaces:**
- Consumes: `FeedItem` (`item.entry.id`, `item.work.id`, `item.author.username`) depuis `@/server/application/feed`.

- [ ] **Step 1 : Restructurer la carte avec un lien-overlay vers le post**

Dans `src/components/FeedCard.tsx`, envelopper la carte pour que la zone « vide » mène au post, tout en gardant affiche → work et avatar/pseudo → profil cliquables au-dessus. Patron : `<article className="relative ...">` + un `<Link href={\`/post/${item.entry.id}\`} className="absolute inset-0 z-0" aria-label="Voir la publication" />`, puis remonter le contenu interactif en `relative z-10`. Les liens existants (avatar `/u/${username}`, titre/affiche `/work/${id}`) restent en `z-10` et prennent le clic prioritairement ; le reste de la carte tombe sur l'overlay `/post`.

Points de vigilance :
  - Le bouton like (`toggleLike`) et le lien commentaires (`/post/${id}`) du footer restent au-dessus (`z-10`).
  - Retirer le `<Link href={\`/post/...\`}>` du compteur de commentaires OU le garder (il pointe déjà au bon endroit) — l'overlay ne doit pas créer de `<a>` imbriqué : l'overlay est frère, pas parent, des liens internes.
  - L'affiche est actuellement dans le même `<Link href="/work/...">` que le titre (lignes 66-82) : conserver, en `z-10`.

- [ ] **Step 2 : Vérifier l'absence d'`<a>` imbriqués**

Run: `npx tsc --noEmit`
Expected: propre. Vérifier visuellement dans le DOM (DevTools) qu'aucun `<a>` ne contient un autre `<a>`.

- [ ] **Step 3 : Vérification comportementale**

Feed : clic sur le fond de carte → page `/post/{id}` (commentaires) ; clic sur l'avatar ou le pseudo → `/u/{username}` ; clic sur l'affiche/cover ou le titre → `/work/{id}`. Le like fonctionne toujours sans naviguer.

- [ ] **Step 4 : Commit**

```bash
git add src/components/FeedCard.tsx
git commit -m "feat(vulu): navigation carte feed — corps→post, affiche→œuvre, avatar→profil"
```

---

### Task 6: « Lire plus » sur les commentaires longs du feed

**Objectif :** remplacer le `line-clamp-3` muet par un extrait + bouton « Lire plus » qui déplie le texte intégral dans le feed, sans naviguer.

**Files:**
- Modify: `src/components/FeedCard.tsx`

- [ ] **Step 1 : État d'expansion + rendu conditionnel**

Dans `FeedCard`, ajouter `const [expanded, setExpanded] = useState(false);`. Remplacer le paragraphe du commentaire (ligne ~65) par :

```tsx
{item.entry.text && (
  <div className="mb-2">
    <p className={`whitespace-pre-wrap text-sm text-[var(--color-text)] ${expanded ? "" : "line-clamp-3"}`}>
      {item.entry.text}
    </p>
    {!expanded && item.entry.text.length > 180 && (
      <button
        type="button"
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); setExpanded(true); }}
        className="relative z-10 mt-0.5 text-sm font-semibold text-[var(--color-primary)] hover:underline"
      >
        Lire plus
      </button>
    )}
  </div>
)}
```

Note : `stopPropagation` évite que le clic déclenche l'overlay `/post` de la Task 5. Le seuil `180` est indicatif (≈ 3 lignes) ; garder `line-clamp-3` gère le cas où le texte est court mais multi-lignes.

- [ ] **Step 2 : Vérifier**

Run: `npx tsc --noEmit` (propre). Feed avec un commentaire long : extrait + « Lire plus » ; clic déplie sans naviguer ; un commentaire court n'affiche pas le bouton.

- [ ] **Step 3 : Commit**

```bash
git add src/components/FeedCard.tsx
git commit -m "feat(vulu): commentaires feed — « Lire plus » dépliable"
```

---

## Phase C — Partage privé & vocabulaire par type

### Task 7: Vocabulaire livres (à lire / lu) partout

**Objectif :** les statuts affichent « À lire / Lu » pour les livres et « À voir / Vu » pour films/séries. Centraliser dans un helper pour DRY.

**Files:**
- Create: `src/lib/status-label.ts`
- Test: `tests/lib/status-label.test.ts`
- Modify: `src/components/EntryEditor.tsx:109-111`, `src/components/ProfileTabs.tsx`, `src/app/work/[id]/page.tsx`, `src/app/u/[username]/page.tsx`, `src/app/personne/[id]/PersonClient.tsx`, `src/app/bibliotheque/LibraryClient.tsx`

**Interfaces:**
- Produces: `statusLabel(status: EntryStatus, type: WorkType): string` et `watchlistHeading(type?: WorkType): string`.

- [ ] **Step 1 : Test du helper (échoue)**

Créer `tests/lib/status-label.test.ts` :

```ts
import { describe, it, expect } from "vitest";
import { statusLabel } from "@/lib/status-label";

describe("statusLabel", () => {
  it("films/séries : à voir / en cours / vu", () => {
    expect(statusLabel("planned", "movie")).toBe("À voir");
    expect(statusLabel("planned", "tv")).toBe("À voir");
    expect(statusLabel("in_progress", "movie")).toBe("En cours");
    expect(statusLabel("done", "movie")).toBe("Vu");
  });
  it("livres : à lire / en cours / lu", () => {
    expect(statusLabel("planned", "book")).toBe("À lire");
    expect(statusLabel("in_progress", "book")).toBe("En cours");
    expect(statusLabel("done", "book")).toBe("Lu");
  });
});
```

- [ ] **Step 2 : Lancer le test → échoue**

Run: `npx vitest run tests/lib/status-label.test.ts`
Expected: FAIL (module introuvable).

- [ ] **Step 3 : Implémenter le helper**

Créer `src/lib/status-label.ts` :

```ts
import type { EntryStatus, WorkType } from "@/server/domain/entities";

/** Libellé de statut adapté au type d'œuvre (livres : à lire/lu ; sinon : à voir/vu). */
export function statusLabel(status: EntryStatus, type: WorkType): string {
  if (status === "in_progress") return "En cours";
  const book = type === "book";
  if (status === "planned") return book ? "À lire" : "À voir";
  return book ? "Lu" : "Vu"; // done
}
```

- [ ] **Step 4 : Test → passe**

Run: `npx vitest run tests/lib/status-label.test.ts`
Expected: PASS.

- [ ] **Step 5 : Utiliser le helper dans EntryEditor**

Dans `src/components/EntryEditor.tsx`, remplacer les libellés en dur (lignes ~109-111) par `statusLabel(...)` en fonction de `workType` (déjà disponible dans le composant). Exemple pour le segment « done » : `{statusLabel("done", workType)} ✓`. Importer `statusLabel` depuis `@/lib/status-label`.

- [ ] **Step 6 : Propager aux autres sites d'affichage**

`grep -rn "À voir\|Vu ✓\|\"Vu\"\|à voir" src/components src/app --include=*.tsx` puis remplacer chaque libellé de statut par `statusLabel(status, type)` là où le type d'œuvre est connu. Pour l'en-tête bibliothèque « À voir / à lire » (`LibraryClient.tsx:120`), garder la forme combinée (liste mixte) — elle est déjà correcte.

- [ ] **Step 7 : Vérifier**

Run: `npx tsc --noEmit && npx vitest run`
Expected: propre + vert. Vérifier une œuvre livre (À lire/Lu) et un film (À voir/Vu) dans l'éditeur, le profil, la page œuvre.

- [ ] **Step 8 : Commit**

```bash
git add src/lib/status-label.ts tests/lib/status-label.test.ts src/components/EntryEditor.tsx src/components/ProfileTabs.tsx "src/app/work/[id]/page.tsx" "src/app/u/[username]/page.tsx" "src/app/personne/[id]/PersonClient.tsx" src/app/bibliotheque/LibraryClient.tsx
git commit -m "feat(vulu): vocabulaire livres (à lire/lu) via helper statusLabel"
```

---

### Task 8: Entrées « gardées pour soi » (non partagées au feed)

**Cause racine (visibilité) :** `src/server/application/feed.ts` détermine la visibilité via `audiences.public` + appartenance au **cercle social** (mutual-follow), mais **n'honore pas** `audiences.circle`. Conséquence : une entrée où l'utilisateur a décoché « Cercle » reste visible de ses abonnés mutuels. Il faut filtrer sur `audiences.circle`.

**Files:**
- Modify: `src/server/application/feed.ts`, `src/components/EntryEditor.tsx`
- Test: `tests/application/feed.test.ts` (ajout de cas), éventuellement `tests/application/feed-visibility.test.ts` (nouveau)

**Interfaces:**
- Une entrée est **visible d'un tiers** ssi : `audiences.public === true` OU (`audiences.circle === true` ET viewer ∈ cercle du propriétaire) OU (`audiences.communityIds` ∩ communautés du viewer ≠ ∅). Le propriétaire voit toujours ses propres entrées.

- [ ] **Step 1 : Test de visibilité (échoue)**

Ajouter dans les tests feed un cas : un utilisateur A suivi mutuellement par B publie une entrée `audiences = {public:false, circle:false, communityIds:[]}`. Attendu : l'entrée **n'apparaît pas** dans le feed de B, mais apparaît pour A (sa bibliothèque/son propre feed). Écrire le test en s'appuyant sur les helpers existants de `tests/application/` (voir `feed.test.ts` pour le style : `makeInMemoryDeps`, `registerUser`, follow mutuel, création d'entrée via l'use-case d'écriture).

```ts
it("une entrée privée (circle=false) n'apparaît pas chez un abonné mutuel", async () => {
  // A et B se suivent mutuellement (cercle)
  // A crée une entrée privée: audiences {public:false, circle:false, communityIds:[]}
  // getFeed(deps, B) NE contient PAS cette entrée
  // getFeed(deps, A) la contient
});
```

- [ ] **Step 2 : Lancer → échoue**

Run: `npx vitest run tests/application/feed.test.ts`
Expected: FAIL (l'entrée fuite chez B).

- [ ] **Step 3 : Corriger le filtrage de visibilité**

Dans `src/server/application/feed.ts` :
  - Fonction unitaire (`assertVisible`/`enrich`, ~ligne 67) : remplacer `if (entry.userId !== viewerId && !entry.audiences.public)` par une condition qui **exige** `audiences.circle` pour la voie cercle :
    ```ts
    if (entry.userId !== viewerId && !entry.audiences.public) {
      const inCommunity = entry.audiences.communityIds.some((id) => viewerCommunityIds.has(id));
      const inCircle = entry.audiences.circle && (await getCircle(deps, viewerId)).has(entry.userId);
      if (!inCircle && !inCommunity) throw new NotFoundError("Publication introuvable");
    }
    ```
  - Liste du feed : appliquer le même prédicat (`audiences.public || (audiences.circle && circle.has(userId)) || communautés`) au filtrage de la requête liste. **Vérifier où le filtrage list est fait** : si en base (`src/server/adapters/mongo/repositories.ts`, index `feed`/`by_community`), adapter la requête Mongo pour n'inclure `circle` que si `audiences.circle: true` ; conserver l'équivalent in-memory (`src/server/adapters/memory/index.ts`) synchronisé pour que les tests reflètent la prod. Ne pas dupliquer la règle : factoriser un prédicat `isVisibleTo(entry, viewer)` si la structure s'y prête.

- [ ] **Step 4 : Test → passe**

Run: `npx vitest run tests/application/feed.test.ts`
Expected: PASS (B ne voit pas ; A voit).

- [ ] **Step 5 : EntryEditor — option « Partager dans le feed » + privé par défaut pour ajouts simples**

Dans `src/components/EntryEditor.tsx` :
  - Ajouter une bascule claire « Garder pour moi / Partager dans le feed » pilotant `sharePublic`/`shareCircle`. Défaut (décision 1) : si l'entrée est un simple ajout de statut **sans note ni commentaire** (`status !== "done" && rating === 0 && !text.trim()`), défaut **privé** (`public:false, circle:false, communityIds:[]`). Si note/commentaire présents, défaut Cercle (comportement actuel).
  - Aujourd'hui le chemin « planned sans review » (`{ ref, status:"planned" }`, ligne ~78) crée une entrée sans audiences : s'assurer que l'API d'écriture pose des audiences **privées** dans ce cas (vérifier `src/server/application/*set-status*` / route `/api/entries` correspondante et `EntryEditor` payload). Le résultat attendu : ajouter un film « à voir » sans commentaire n'apparaît pas dans le feed tant que l'utilisateur ne coche pas « Partager ».
  - Permettre explicitement : noter (rating > 0) **sans** commentaire tout en choisissant « Garder pour moi » → l'entrée porte la note mais reste privée.

- [ ] **Step 6 : Test d'intégration écriture (recommandé)**

Ajouter un test use-case : créer une entrée `planned` sans review → vérifier `audiences = {public:false, circle:false, communityIds:[]}` en base. Créer une notation avec « garder pour moi » → note enregistrée, audiences privées, absente du feed d'un tiers.

- [ ] **Step 7 : Vérifier**

Run: `npx tsc --noEmit && npx vitest run`
Expected: propre + vert. Manuel : ajouter un film « à voir » sans commentaire → absent du feed ; cocher « Partager » → présent.

- [ ] **Step 8 : Commit**

```bash
git add src/server/application/feed.ts src/server/adapters/mongo/repositories.ts src/server/adapters/memory/index.ts src/server/ports/repositories.ts src/components/EntryEditor.tsx tests/application/feed.test.ts
git commit -m "feat(vulu): entrées gardées pour soi — le feed honore audiences.circle ; ajouts simples privés par défaut"
```

---

## Phase D — Scan de code-barres

### Task 9: Fiabiliser le scan sur mobile (caméra arrière)

**Cause racine probable :** `BookScanner.tsx` appelle `reader.decodeFromVideoDevice(undefined, video, cb)`. Sur mobile, `deviceId=undefined` sélectionne souvent la **caméra frontale**, inadaptée au scan (mauvaise mise au point, mauvais angle) → aucune détection. Il faut forcer la caméra **arrière** (`facingMode: environment`) et durcir le décodage.

**Files:**
- Modify: `src/components/BookScanner.tsx`

- [ ] **Step 1 : Acquérir la caméra arrière via contraintes**

Dans `src/components/BookScanner.tsx`, remplacer l'acquisition (`decodeFromVideoDevice(undefined, ...)`) par un décodage à partir d'un flux contraint sur la caméra arrière. Deux options selon l'API @zxing/browser disponible :
  - **Option A (recommandée)** — obtenir soi-même le flux puis décoder :
    ```ts
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } },
      audio: false,
    });
    if (cancelled || !videoRef.current) { stream.getTracks().forEach((t) => t.stop()); return; }
    videoRef.current.srcObject = stream;
    controls = await reader.decodeFromVideoElement(videoRef.current, (result, _err, ctrl) => { /* idem */ });
    ```
    Et au cleanup : `stream.getTracks().forEach((t) => t.stop())` en plus de `controls?.stop()`.
  - **Option B** — énumérer les périphériques et choisir celui dont le label contient « back »/« arrière »/« environment », puis `decodeFromVideoDevice(deviceId, ...)`.

Vérifier l'API réelle exposée (`grep -rn "decodeFrom" node_modules/@zxing/browser/esm 2>/dev/null | head`) avant de figer l'option.

- [ ] **Step 2 : Durcir le décodage**

Ajouter les hints : conserver `POSSIBLE_FORMATS = [EAN_13]` et ajouter `hints.set(DecodeHintType.TRY_HARDER, true)`. Garder la validation `^(978|979)\d{10}$` avant d'appeler `onIsbn`.

- [ ] **Step 3 : Gestion d'erreurs & permissions**

Conserver la table d'erreurs (`NotAllowedError`, `NotFoundError`) ; ajouter le cas `OverconstrainedError` (aucune caméra arrière) → repli sur `facingMode: "user"` ou message « Aucune caméra arrière détectée ». S'assurer que le flux est bien arrêté dans tous les chemins (cleanup + erreur).

- [ ] **Step 4 : Vérifier**

Run: `npx tsc --noEmit` (propre). Test réel sur téléphone (le desktop n'a pas de caméra arrière) : la caméra arrière s'ouvre, un code-barres EAN-13 de livre est détecté et déclenche l'ajout/recherche. À défaut de device, vérifier en desktop que la caméra s'ouvre et qu'un code EAN-13 présenté est lu.

- [ ] **Step 5 : Commit**

```bash
git add src/components/BookScanner.tsx
git commit -m "fix(vulu): scan code-barres — caméra arrière (facingMode environment) + TRY_HARDER"
```

---

### Task 10: Ajouter un livre à une collection en le scannant

**Objectif :** depuis une collection de livres (détail de liste) et depuis l'onglet Livres de la bibliothèque, un bouton « Scanner » ouvre `BookScanner`, résout l'ISBN via l'API existante, puis ajoute le livre à la collection courante.

**Files:**
- Modify: `src/components/ListDetailModal.tsx`, `src/app/bibliotheque/LibraryClient.tsx`
- Réutilise: `src/components/BookScanner.tsx`, la route ISBN existante (`/api/books/isbn` ou équivalent — voir `find-book-by-isbn` / `isbnSchema`), l'API d'ajout à une liste.

**Interfaces:**
- Consumes: `BookScanner` (`onIsbn`, `onClose`), la résolution ISBN → œuvre (route existante utilisée par `SearchPanel.handleIsbn`), l'endpoint d'ajout à une liste (celui utilisé par `ListDetailModal` pour ajouter une œuvre).

- [ ] **Step 1 : Repérer les endpoints réutilisables**

`grep -rn "isbn\|Isbn\|ISBN" src/app/api src/lib/api-client.ts src/components/SearchPanel.tsx` pour retrouver la route ISBN et le handler `handleIsbn`. `grep -rn "lists/\|addToList\|items" src/app/api/lists src/components/ListDetailModal.tsx` pour l'ajout d'une œuvre à une liste. Réutiliser ces contrats — ne pas en créer de nouveaux.

- [ ] **Step 2 : Bouton scan dans le détail de liste (livres)**

Dans `src/components/ListDetailModal.tsx`, quand la liste accepte les livres (`kind === "books" || kind === "mixed"`), afficher un bouton « Scanner un livre » (icône `camera`) qui ouvre `BookScanner`. `onIsbn(isbn)` : résoudre l'œuvre via la route ISBN, puis appeler l'ajout à la liste courante (même chemin que l'ajout manuel), fermer le scanner, rafraîchir (`onChanged`). Toast de confirmation / erreur (« Livre introuvable pour ce code-barres »).

- [ ] **Step 3 : Bouton scan dans l'onglet Livres de la bibliothèque**

Dans `src/app/bibliotheque/LibraryClient.tsx`, ajouter un bouton « Scanner » visible quand le filtre type est `book` (ou toujours, avec domaine livre), ouvrant `BookScanner`. Par défaut, un scan hors liste ajoute le livre à la **watchlist** (« à lire ») via l'API de statut existante, puis `load()` pour rafraîchir. Toast de confirmation.

- [ ] **Step 4 : Vérifier**

Run: `npx tsc --noEmit` (propre). Manuel : ouvrir une collection de livres → « Scanner » → présenter un ISBN → le livre est ajouté à la collection ; onglet Livres → « Scanner » → le livre entre dans « à lire ».

- [ ] **Step 5 : Commit**

```bash
git add src/components/ListDetailModal.tsx src/app/bibliotheque/LibraryClient.tsx
git commit -m "feat(vulu): ajout d'un livre à une collection par scan de code-barres"
```

---

## Self-Review (couverture spec)

| Demande utilisateur | Tâche |
|---|---|
| Scan ne marche pas sur mobile (caméra ouvre, pas de détection) | Task 9 |
| Ajouter à une collection de livres par scan (comme la recherche) | Task 10 |
| Noter un livre sans commentaire et le garder privé | Task 8 |
| Ajouter un film « à voir »/« vu » sans qu'il s'affiche dans le feed | Task 8 |
| Vocabulaire livres « à lire / lu » (au lieu de à voir/vu) | Task 7 |
| Commentaire long tronqué → « Lire plus » dépliable | Task 6 |
| Clic carte → page commentaires (pas profil) | Task 5 |
| Clic photo de profil → profil | Task 5 |
| Clic affiche/cover → page œuvre | Task 5 |
| Certaines affiches ne s'affichent pas | Task 3 |
| Icônes tronquées (cœur, caméra), surtout mobile | Task 2 |
| Responsive iPhone : caméra tronquée/hors-champ | Task 4 |
| Bouton « Éditer le profil » mal fait sur mobile | Task 4 |
| Route `/` « site inaccessible » alors que `/feed` charge | Task 1 |

Toutes les demandes du batch sont couvertes. Ordre conseillé : A (bugs bloquants) → B (feed) → C (partage/vocabulaire) → D (scan). Chaque tâche est indépendamment testable et livrable.

## Notes pour la session fresh

- Base de dev : MongoDB Atlas (déjà provisionnée, collections vides). Serveur : `npm run dev` (relancer après changement d'`.env`).
- Le service worker ne s'enregistre qu'en prod ; pour reproduire le bug `/`, tester une PWA installée ou désenregistrer/vider le cache du navigateur du device.
- Tâche 3 (affiches) et tâche 9 (scan) nécessitent une reproduction réelle : prévoir un device mobile ou l'émulation appropriée.
