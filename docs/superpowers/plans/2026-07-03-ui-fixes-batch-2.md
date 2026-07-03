# Batch 2 — Bugs iOS/route/icônes, nav retour recherche, scan batch, date & temps de visionnage, teaser communauté — Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Corriger un second lot de bugs (route `/`, icônes tronquées, responsive iPhone, liens sociaux), fiabiliser la navigation retour depuis la recherche, permettre le scan de livres en batch dans une collection, et ajouter deux features de données (date de complétion, temps de visionnage sur le profil) plus un teaser communauté vulu+.

**Architecture :** App Next.js 16 (App Router, Turbopack), hexagonale côté serveur (domain/application/ports/adapters). Les changements de données (date, runtime, temps de visionnage) passent par le domaine/application avec tests vitest ; les corrections UI/CSS sont vérifiées manuellement (desktop + iPhone réel/émulé).

**Tech Stack :** Next.js 16.2.9, React 19, Tailwind v4, TypeScript strict, MongoDB, vitest, @zxing/browser + @zxing/library (scan).

## Global Constraints

- Aucune mention IA / Claude / superpowers dans le code, l'app ou les commits ; aucun co-auteur Claude.
- Ne jamais toucher au dossier `lechatonfat/`.
- Architecture hexagonale : toute dépendance externe derrière un port ; le domaine ne connaît aucun driver/SDK.
- Aucun secret en dur ; validation des entrées aux frontières ; typage strict, pas de `any`.
- Commits fréquents, un par tâche, directement sur `master`.
- Vérifier avant de conclure : `npx tsc --noEmit` propre + `npx vitest run` vert.
- Discord officiel : `https://discord.gg/sgnZmxxUnx`.

## File Structure

**Phase A (bugs) :**
- `public/sw.js` — stratégie SW (navigations réseau-first, jamais de redirection en cache).
- `src/components/Icon.tsx` / `src/components/FeedCard.tsx` — icônes non tronquées.
- `src/app/layout.tsx` — `maximumScale: 1` (anti-zoom iOS au focus input).
- `src/components/BookScanner.tsx` — overlay `100dvh`.
- `src/components/ProfileEditModal.tsx` — bouton compact mobile.
- `src/app/parametres/SettingsClient.tsx` — liens sociaux.

**Phase B (nav/scan) :**
- `src/components/SearchPanel.tsx`, `src/app/search/SearchClient.tsx`, `src/app/search/page.tsx` — recherche dans l'URL.
- `src/components/BookScanner.tsx`, `src/components/ListDetailModal.tsx`, `src/app/bibliotheque/LibraryClient.tsx` — scan batch.

**Phase C (données) :**
- `src/server/domain/entities.ts` — `completedAt` sur `LibraryEntry`, `runtime` sur `Work`.
- `src/server/ports/catalog.ts`, `src/server/adapters/catalog/tmdb-catalog.ts` — `runtime` catalogue.
- `src/server/application/get-work.ts`, `library-entry.ts` — mapping runtime + persistance completedAt.
- `src/server/adapters/mongo/mappers.ts`, `src/server/adapters/memory/index.ts` — mappers.
- `src/lib/zod-schemas.ts`, `src/app/api/works/entry/route.ts` — API completedAt.
- `src/components/EntryEditor.tsx` — sélecteur de date.
- `src/server/application/watch-time.ts` (nouveau), `src/lib/format-duration.ts` (nouveau), `src/app/u/[username]/page.tsx` — temps de visionnage.
- `src/app/communautes/CommunitiesClient.tsx` — teaser vulu+.

---

## Phase A — Bugs & régressions

### Task A1 : Durcir le service worker (route `/` inaccessible)

**REQUIRED SUB-SKILL : superpowers:systematic-debugging.** Reproduire avant de conclure.

**Cause probable :** un SW obsolète reste actif sur le device et sert `/` (redirection 307) depuis le cache. La v2 du batch 1 corrige la stratégie mais un cache résiduel peut subsister. On force l'éviction totale des caches à l'activation et on bump la version.

**Files:**
- Modify: `public/sw.js`

- [ ] **Step 1 : Vérifier l'état HTTP (repro)**

Run: `curl -sS -o /dev/null -w "/ %{http_code}\n" http://localhost:3000/ && curl -sS -o /dev/null -w "/login %{http_code}\n" http://localhost:3000/login`
Expected: `/ 307` puis `/login 200`. Si conforme, la route serveur est saine : le bug vient d'un SW/cache client.

- [ ] **Step 2 : Bump version + éviction totale des caches**

Dans `public/sw.js`, remplacer la ligne `const CACHE = "vulu-v2";` par `const CACHE = "vulu-v3";` (force une réinstallation propre du shell et l'éviction des anciens caches via le handler `activate` existant qui supprime toute clé ≠ CACHE).

- [ ] **Step 3 : Vérifier le typecheck (sanity)**

Run: `npx tsc --noEmit`
Expected: aucune sortie (le SW n'est pas typé mais on s'assure de ne rien casser).

- [ ] **Step 4 : Vérification device (manuelle)**

Sur le device où le bug apparaît : DevTools → Application → Service Workers → **Unregister**, Storage → **Clear site data**, recharger `/`. Attendu : redirection propre vers `/login` (ou `/feed` si connecté). Noter le résultat.

- [ ] **Step 5 : Commit**

```bash
git add public/sw.js
git commit -m "fix(vulu): SW v3 — éviction du cache obsolète servant la redirection /"
```

---

### Task A2 : Icônes tronquées à droite (cœur du like)

**REQUIRED SUB-SKILL : superpowers:systematic-debugging.**

**Cause probable :** le `<svg>` porte `overflow="visible"` et des tracés (cœur) touchent le bord du `viewBox 0 0 24 24` ; le `strokeWidth` déborde et est rogné par un conteneur. Le batch 1 a ajouté `shrink-0` (empêche la compression) mais pas le clipping du trait. Correction : réserver la place du trait via un léger padding du viewBox effectif — on garde `overflow="visible"` et on s'assure que le conteneur du bouton like ne rogne pas (`overflow-visible`).

**Files:**
- Modify: `src/components/Icon.tsx`, `src/components/FeedCard.tsx`

- [ ] **Step 1 : Reproduire**

Ouvrir le feed en émulation iPhone (DevTools responsive). Inspecter le bouton like `<Icon name="heart" size={19} /> {likes}`. Confirmer visuellement/via DevTools quel élément rogne le côté droit du cœur (mesurer si le `<svg>` est clippé par son parent `flex ... rounded-full px-3`).

- [ ] **Step 2 : Garantir un SVG non rogné**

Dans `src/components/Icon.tsx`, le `<svg>` a déjà `overflow="visible"` et `shrink-0`. Ajouter `className` défensif `block` (évite l'espace inline sous la baseline qui décale le rendu) — remplacer :

```tsx
      className={`shrink-0${className ? ` ${className}` : ""}`} aria-hidden="true"
```

par :

```tsx
      className={`block shrink-0${className ? ` ${className}` : ""}`} aria-hidden="true"
```

- [ ] **Step 3 : Empêcher le conteneur du like de rogner**

Dans `src/components/FeedCard.tsx`, le bouton like a `... rounded-full px-3 py-1.5 ...`. `rounded-full` n'implique pas `overflow-hidden`, mais on sécurise en ajoutant `overflow-visible`. Repérer la classe du bouton like (contient `aria-pressed={liked}`) et ajouter `overflow-visible` à sa `className` (juste après `relative z-10 flex items-center gap-1.5`).

- [ ] **Step 4 : Vérifier**

Run: `npx tsc --noEmit`
Expected: aucune sortie. Puis en émulation iPhone : le cœur du like n'est plus tronqué à droite.

- [ ] **Step 5 : Commit**

```bash
git add src/components/Icon.tsx src/components/FeedCard.tsx
git commit -m "fix(vulu): icône cœur non rognée (svg block + conteneur like overflow-visible)"
```

---

### Task A3 : iPhone — overlay scan hors-écran / dézoom manuel

**Cause racine probable :** iOS Safari zoome automatiquement au focus d'un `<input>` en police < 16px (le champ recherche est en `text-sm` = 14px) et ne dézoome pas ; l'overlay scan `fixed inset-0` apparaît alors décalé. Fix : bloquer le zoom au focus via `maximumScale: 1`, et fiabiliser la hauteur de l'overlay avec `100dvh`.

**Files:**
- Modify: `src/app/layout.tsx`, `src/components/BookScanner.tsx`

- [ ] **Step 1 : Empêcher le zoom iOS au focus**

Dans `src/app/layout.tsx`, remplacer :

```tsx
export const viewport: Viewport = { themeColor: "#9461C0", viewportFit: "cover" };
```

par :

```tsx
export const viewport: Viewport = { themeColor: "#9461C0", viewportFit: "cover", initialScale: 1, maximumScale: 1 };
```

- [ ] **Step 2 : Overlay scan en hauteur dynamique iOS**

Dans `src/components/BookScanner.tsx`, le conteneur racine est `<div className="fixed inset-0 z-[60] overflow-hidden bg-black">`. Remplacer par `<div className="fixed inset-0 z-[60] h-[100dvh] w-screen overflow-hidden bg-black">` pour couvrir exactement le viewport visible iOS.

- [ ] **Step 3 : Vérifier**

Run: `npx tsc --noEmit`
Expected: aucune sortie. Puis sur iPhone réel/émulé : ouvrir Recherche (Livres) → taper dans le champ (plus de zoom auto) → bouton caméra → l'overlay scan couvre l'écran sans débordement ni besoin de dézoomer.

- [ ] **Step 4 : Commit**

```bash
git add src/app/layout.tsx src/components/BookScanner.tsx
git commit -m "fix(vulu): iOS — plus de zoom auto au focus (maximumScale) + overlay scan 100dvh"
```

---

### Task A4 : Bouton « Éditer le profil » compact en mobile

**Files:**
- Modify: `src/components/ProfileEditModal.tsx`

- [ ] **Step 1 : Masquer le libellé sous `sm:`**

Dans `src/components/ProfileEditModal.tsx`, le bouton trigger contient `<Icon name="settings" size={16} /> Éditer le profil`. Remplacer le texte nu par un `<span>` responsive :

```tsx
        <Icon name="settings" size={16} /> <span className="hidden sm:inline">Éditer le profil</span>
```

Et garantir une cible tactile correcte sur mobile en ajoutant `min-h-11` à la `className` du bouton (déjà `... px-4 py-2 ...`) — le bouton reste rond avec l'icône seule sur mobile, libellé complet dès `sm`.

- [ ] **Step 2 : Vérifier**

Run: `npx tsc --noEmit`
Expected: aucune sortie. Émulation iPhone SE (375px) : le bouton est compact (icône), non tronqué ; ≥ 640px : « Éditer le profil » complet.

- [ ] **Step 3 : Commit**

```bash
git add src/components/ProfileEditModal.tsx
git commit -m "fix(vulu): bouton éditer profil compact en mobile (icône seule, libellé dès sm)"
```

---

### Task A5 : Liens sociaux (Discord à jour, retrait Instagram/X)

**Files:**
- Modify: `src/app/parametres/SettingsClient.tsx`

- [ ] **Step 1 : Mettre à jour le lien Discord et retirer Instagram/X**

Dans `src/app/parametres/SettingsClient.tsx`, remplacer les trois liens (Discord/Instagram/X, ~l.166-168) par le seul lien Discord à jour :

```tsx
          <a href="https://discord.gg/sgnZmxxUnx" target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 rounded-xl border border-[var(--color-border)] p-3 text-sm font-medium transition-colors hover:border-[var(--color-primary)]"><BrandLogo brand="discord" /> Rejoins le serveur Discord</a>
```

(Supprimer les deux lignes `instagram.com/vulu.app` et `x.com/vulu_app`.)

- [ ] **Step 2 : Mettre à jour le libellé de la section**

Toujours dans `SettingsClient.tsx`, l. ~28, remplacer `desc: "Discord, Instagram, X"` par `desc: "Discord"`.

- [ ] **Step 3 : Vérifier qu'aucune référence morte ne subsiste**

Run: `grep -rn "vulu.app\|x.com/vulu\|discord.gg/vulu\|instagram" src/app src/components`
Expected: aucune sortie.

- [ ] **Step 4 : Vérifier le typecheck**

Run: `npx tsc --noEmit`
Expected: aucune sortie. (`BrandLogo` reste importé/utilisé pour Discord — pas d'import mort.)

- [ ] **Step 5 : Commit**

```bash
git add src/app/parametres/SettingsClient.tsx
git commit -m "fix(vulu): réseaux sociaux — Discord officiel, retrait Instagram et X"
```

---

## Phase B — Navigation & scan batch

### Task B1 : Retour vers la recherche filtrée

**Objectif :** après avoir ouvert une œuvre depuis la recherche, « retour » revient à `/search?q=…&domain=…` déjà filtré. On synchronise `q`/`domain` dans l'URL et on initialise l'état depuis `searchParams`.

**Files:**
- Modify: `src/components/SearchPanel.tsx`, `src/app/search/SearchClient.tsx`, `src/app/search/page.tsx`

**Interfaces:**
- Produces: `SearchPanel` accepte `initialQuery?: string` et `initialDomain?: "films" | "books"`.

- [ ] **Step 1 : Passer les searchParams à SearchPanel**

Dans `src/app/search/page.tsx`, récupérer `searchParams` (Next 16 : `searchParams` est une Promise) et les transmettre. Vérifier d'abord la signature actuelle (`grep -n "searchParams\|SearchClient\|export default" src/app/search/page.tsx`), puis passer `q` et `domain` à `SearchClient`. Dans `src/app/search/SearchClient.tsx`, propager en props :

```tsx
export function SearchClient({ activeTabs, initialQuery, initialDomain }: { activeTabs: string[]; initialQuery?: string; initialDomain?: "films" | "books" }) {
  return <SearchPanel activeTabs={activeTabs} initialQuery={initialQuery} initialDomain={initialDomain} />;
}
```

- [ ] **Step 2 : Initialiser l'état de SearchPanel depuis l'URL et le refléter**

Dans `src/components/SearchPanel.tsx` :
- Ajouter les props `initialQuery?: string; initialDomain?: "films" | "books"` à la signature du composant.
- Initialiser `const [q, setQ] = useState(initialQuery ?? "")` et le `domain` initial depuis `initialDomain` si fourni (en respectant `activeTabs`).
- Ajouter un effet qui reflète `q`/`domain` dans l'URL sans empiler l'historique, en debounce (réutiliser le timer de recherche existant ou un `useEffect` dédié) :

```tsx
useEffect(() => {
  const params = new URLSearchParams();
  if (q.trim()) params.set("q", q.trim());
  params.set("domain", domain);
  router.replace(`/search?${params.toString()}`, { scroll: false });
}, [q, domain, router]);
```

(Import `useRouter` déjà présent. `router.replace` ne crée pas d'entrée d'historique ; l'entrée d'historique est créée par `router.push('/work/...')` au clic, donc « retour » ramène à l'URL `/search?q=…` reflétée.)

- [ ] **Step 3 : Vérifier**

Run: `npx tsc --noEmit`
Expected: aucune sortie. Manuel : Recherche → taper « harry potter » → l'URL devient `/search?q=harry+potter&domain=books` → cliquer une œuvre (`/work/…`) → noter → « retour » navigateur → retour sur `/search?q=harry+potter` avec les résultats déjà filtrés.

- [ ] **Step 4 : Commit**

```bash
git add src/components/SearchPanel.tsx src/app/search/SearchClient.tsx src/app/search/page.tsx
git commit -m "feat(vulu): recherche persistée dans l'URL — retour revient aux résultats filtrés"
```

---

### Task B2 : Scan de collection en batch

**Objectif :** ajouter plusieurs livres d'affilée à une collection sans quitter le scanner ni ouvrir la fiche ; animation d'ajout + compteur + bouton « Terminer ».

**Files:**
- Modify: `src/components/BookScanner.tsx`, `src/components/ListDetailModal.tsx`, `src/app/bibliotheque/LibraryClient.tsx`

**Interfaces:**
- Produces: `BookScanner` accepte `mode?: "single" | "batch"` (défaut `single`). En `batch`, `onIsbn` est appelé pour chaque code sans fermeture ; le parent renvoie une `Promise<{ ok: boolean; title?: string; posterUrl?: string | null }>` pour piloter l'animation. Signature : `onIsbn: (isbn: string) => void | Promise<{ ok: boolean; title?: string; posterUrl?: string | null }>`.

- [ ] **Step 1 : Ajouter le mode batch à BookScanner**

Dans `src/components/BookScanner.tsx` :
- Étendre la signature : `export function BookScanner({ onIsbn, onClose, mode = "single" }: { onIsbn: (isbn: string) => void | Promise<{ ok: boolean; title?: string; posterUrl?: string | null }>; onClose: () => void; mode?: "single" | "batch" })`.
- Ajouter des états : `const [count, setCount] = useState(0);` `const [flash, setFlash] = useState<{ posterUrl: string | null; title: string } | null>(null);` et une ref `lastCodeRef` pour l'anti-doublon.
- Dans le callback de décodage, après la validation ISBN, ne **pas** arrêter le flux en mode batch :

```tsx
if (/^(978|979)\d{10}$/.test(text)) {
  if (mode === "single") { ctrl.stop(); onIsbnRef.current(text); return; }
  // batch : anti-doublon (même code consécutif ignoré ~1,5s) + animation
  if (lastCodeRef.current === text) return;
  lastCodeRef.current = text;
  setTimeout(() => { if (lastCodeRef.current === text) lastCodeRef.current = null; }, 1500);
  Promise.resolve(onIsbnRef.current(text)).then((res) => {
    if (res && res.ok) {
      setCount((n) => n + 1);
      setFlash({ posterUrl: res.posterUrl ?? null, title: res.title ?? "" });
      setTimeout(() => setFlash(null), 900);
    }
  });
}
```

- Ajouter, en mode batch, un bandeau bas avec compteur + bouton « Terminer », et l'animation `flash` (miniature de couverture qui glisse vers une pile). Insérer avant la fermeture du composant (dans la branche non-erreur) :

```tsx
{mode === "batch" && (
  <div className="absolute inset-x-0 bottom-[max(1rem,env(safe-area-inset-bottom))] z-10 flex items-center justify-between gap-3 px-5">
    <span className="rounded-full bg-black/60 px-3 py-1.5 text-sm font-semibold text-white">{count} ajouté{count > 1 ? "s" : ""}</span>
    <button onClick={onClose} className="rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-black">Terminer</button>
  </div>
)}
{flash && (
  <div className="pointer-events-none absolute bottom-24 left-1/2 z-20 -translate-x-1/2 animate-[fly_0.9s_ease-in] ">
    <div className="h-24 w-16 overflow-hidden rounded-md border-2 border-white bg-[var(--color-border)] shadow-lg"
      style={flash.posterUrl ? { backgroundImage: `url("${flash.posterUrl}")`, backgroundSize: "cover", backgroundPosition: "center" } : undefined} />
  </div>
)}
```

Note : le texte du bas « Centre le code-barres… » reste, mais en mode batch on peut le laisser. L'anim `fly` est définie au Step 2.

- [ ] **Step 2 : Définir l'animation `fly` (globals.css)**

Dans `src/app/globals.css`, ajouter une keyframe simple (translation + fondu vers le coin bas) :

```css
@keyframes fly {
  0% { transform: translate(-50%, 0) scale(1); opacity: 1; }
  100% { transform: translate(-50%, 40px) scale(0.4); opacity: 0; }
}
```

- [ ] **Step 3 : Brancher le mode batch dans ListDetailModal**

Dans `src/components/ListDetailModal.tsx`, modifier `addScannedIsbn` pour renvoyer le résultat attendu par le mode batch et ne plus fermer le scanner à chaque ajout :

```tsx
async function addScannedIsbn(isbn: string): Promise<{ ok: boolean; title?: string; posterUrl?: string | null }> {
  try {
    const { result } = await api.get<{ result: WorkSummary | null }>(`/api/catalog/isbn?isbn=${encodeURIComponent(isbn)}`);
    if (!result) { toast("Livre introuvable pour ce code-barres", "error"); return { ok: false }; }
    await api.post(`/api/lists/${listId}/items`, { source: result.source, externalId: result.externalId, type: result.type });
    return { ok: true, title: result.title, posterUrl: result.posterUrl };
  } catch (e) {
    toast(e instanceof ApiError ? e.message : "Ajout impossible", "error");
    return { ok: false };
  }
}
```

Et rendre le scanner en mode batch, avec rafraîchissement à la fermeture :

```tsx
{scanning && <BookScanner mode="batch" onClose={() => { setScanning(false); refresh(); }} onIsbn={addScannedIsbn} />}
```

(Le `refresh()` existant recharge la liste et met à jour `onChanged`.)

- [ ] **Step 4 : Brancher le mode batch dans la bibliothèque (watchlist)**

Dans `src/app/bibliotheque/LibraryClient.tsx`, adapter `addScannedBook` pour renvoyer le résultat et ne pas fermer à chaque scan :

```tsx
async function addScannedBook(isbn: string): Promise<{ ok: boolean; title?: string; posterUrl?: string | null }> {
  try {
    const { result } = await api.get<{ result: WorkSummary | null }>(`/api/catalog/isbn?isbn=${encodeURIComponent(isbn)}`);
    if (!result) { toast("Livre introuvable pour ce code-barres", "error"); return { ok: false }; }
    await api.put("/api/works/entry", { ref: { source: result.source, externalId: result.externalId, type: result.type }, status: "planned" });
    return { ok: true, title: result.title, posterUrl: result.posterUrl };
  } catch { toast("Ajout impossible", "error"); return { ok: false }; }
}
```

Et le rendu :

```tsx
{scanning && <BookScanner mode="batch" onClose={() => { setScanning(false); load(); }} onIsbn={addScannedBook} />}
```

- [ ] **Step 5 : Vérifier**

Run: `npx tsc --noEmit`
Expected: aucune sortie. Manuel (device/émulé) : ouvrir une collection livres → « Scanner » → présenter plusieurs codes-barres à la suite → chaque ajout déclenche l'animation + incrémente le compteur, sans ouvrir de fiche → « Terminer » ferme et la collection est à jour.

- [ ] **Step 6 : Commit**

```bash
git add src/components/BookScanner.tsx src/app/globals.css src/components/ListDetailModal.tsx src/app/bibliotheque/LibraryClient.tsx
git commit -m "feat(vulu): scan de livres en batch — ajout enchaîné, animation, bouton Terminer"
```

---

## Phase C — Nouvelles données

### Task C1 : Date de lecture/visionnage (`completedAt`)

**Objectif :** enregistrer et éditer la date de complétion d'une œuvre.

**Files:**
- Modify: `src/server/domain/entities.ts`, `src/server/application/library-entry.ts`, `src/server/adapters/mongo/mappers.ts`, `src/lib/zod-schemas.ts`, `src/app/api/works/entry/route.ts`, `src/components/EntryEditor.tsx`
- Test: `tests/application/library-entry.test.ts`

**Interfaces:**
- Produces: `LibraryEntry.completedAt: Date | null`. `rateOrReviewWork` et `setEntryStatus` acceptent un `completedAt?: Date | null` optionnel.

- [ ] **Step 1 : Ajouter le champ au domaine**

Dans `src/server/domain/entities.ts`, dans `interface LibraryEntry`, ajouter après `text: string | null;` :

```ts
  completedAt: Date | null;        // date de visionnage/lecture (null si non renseignée)
```

- [ ] **Step 2 : Mapper Mongo rétrocompatible**

Dans `src/server/adapters/mongo/mappers.ts`, dans `fromEntryDoc`, compléter le retour pour défaut `null`. Repérer `return { ...e, audiences, progress, activityAt };` et le remplacer par :

```ts
  return { ...e, audiences, progress, activityAt, completedAt: e.completedAt ?? null };
```

(`toEntryDoc` utilise déjà `...e`, donc `completedAt` est stocké automatiquement.)

- [ ] **Step 3 : Test — la complétion pose la date du jour par défaut (échoue)**

Dans `tests/application/library-entry.test.ts`, ajouter :

```ts
it("rateOrReview pose completedAt = maintenant par défaut", async () => {
  const e = await rateOrReviewWork(deps, "u1", ref, { rating: 4, text: null, audiences: { public: false, circle: false, communityIds: [] } });
  expect(e.completedAt).not.toBeNull();
});
it("rateOrReview respecte un completedAt explicite", async () => {
  const d = new Date("2024-01-02T00:00:00.000Z");
  const e = await rateOrReviewWork(deps, "u1", ref, { rating: 4, text: null, completedAt: d, audiences: { public: false, circle: false, communityIds: [] } });
  expect(e.completedAt?.toISOString()).toBe(d.toISOString());
});
```

- [ ] **Step 4 : Lancer → échoue**

Run: `npx vitest run tests/application/library-entry.test.ts`
Expected: FAIL (propriété `completedAt` inexistante / non gérée).

- [ ] **Step 5 : Implémenter dans l'application**

Dans `src/server/application/library-entry.ts` :
- `loadOrCreateEntry` : ajouter `completedAt: null,` à l'objet créé (après `text: null,`).
- `setEntryStatus` : ajouter un paramètre optionnel et le persister. Nouvelle signature :

```ts
export async function setEntryStatus(deps: Deps, userId: string, ref: Ref, status: EntryStatus, completedAt?: Date | null): Promise<LibraryEntry> {
  const entry = await loadOrCreateEntry(deps, userId, ref);
  const resolvedCompletedAt = completedAt !== undefined ? completedAt : (status === "done" ? entry.completedAt ?? deps.clock.now() : entry.completedAt);
  const updated: LibraryEntry = { ...entry, status, completedAt: resolvedCompletedAt, updatedAt: deps.clock.now() };
  await deps.entries.upsert(updated);
  return updated;
}
```

- `rateOrReviewWork` : accepter `completedAt` dans `input` et le persister (statut forcé à `done`). Modifier le type de `input` et l'objet `updated` :

```ts
  input: { rating: number | null; text: string | null; completedAt?: Date | null; audiences: EntryAudiences },
```

puis dans la construction de `updated`, ajouter :

```ts
    completedAt: input.completedAt !== undefined ? input.completedAt : (entry.completedAt ?? deps.clock.now()),
```

- [ ] **Step 6 : Test → passe**

Run: `npx vitest run tests/application/library-entry.test.ts`
Expected: PASS.

- [ ] **Step 7 : Schéma zod + route**

Dans `src/lib/zod-schemas.ts` :
- `rateSchema` : ajouter `completedAt: z.string().datetime().nullable().optional(),`.
- `setStatusSchema` : ajouter `completedAt: z.string().datetime().nullable().optional(),`.

Dans `src/app/api/works/entry/route.ts`, convertir la chaîne ISO en `Date` avant d'appeler l'application. Pour la branche rate :

```ts
      const input = rateSchema.parse(body);
      const completedAt = input.completedAt === undefined ? undefined : (input.completedAt === null ? null : new Date(input.completedAt));
      return json({ entry: await rateOrReviewWork(deps, user.id, input.ref, { ...input, completedAt }) });
```

Pour la branche statut :

```ts
      const input = setStatusSchema.parse(body);
      const completedAt = input.completedAt === undefined ? undefined : (input.completedAt === null ? null : new Date(input.completedAt));
      return json({ entry: await setEntryStatus(deps, user.id, input.ref, input.status, completedAt) });
```

- [ ] **Step 8 : Sélecteur de date dans EntryEditor**

Dans `src/components/EntryEditor.tsx` :
- Ajouter un état : `const [completedAt, setCompletedAt] = useState<string>(initial?.completedAt ? new Date(initial.completedAt).toISOString().slice(0, 10) : "");`
- Afficher un `<input type="date">` quand `status === "done"`, sous le textarea :

```tsx
{status === "done" && (
  <label className="mt-4 block text-sm font-semibold">Date de {workType === "book" ? "lecture" : "visionnage"}
    <input type="date" value={completedAt} onChange={(e) => setCompletedAt(e.target.value)}
      className="mt-1 block rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] px-4 py-2.5 text-sm font-normal" />
  </label>
)}
```

- Dans `save()`, inclure `completedAt` dans le payload de la branche `isReview` (convertir `""` → `null`, sinon ISO du jour à minuit UTC) :

```tsx
      const completedIso = completedAt ? new Date(completedAt).toISOString() : null;
      const body = isReview
        ? { ref: workRef, rating: rating > 0 ? rating : null, text: text.trim() || null, completedAt: completedIso, audiences }
        : { ref: workRef, status: "planned" };
```

- Pré-remplir à aujourd'hui quand on passe à `done` sans date : dans le `onChange` du slider de note (`setRating(v); if (v > 0) setStatus("done");`) et sur le segment « done », si `completedAt === ""` poser `setCompletedAt(new Date().toISOString().slice(0,10))`. Concrètement, dans le handler du segment done (`onClick={() => setStatus("done")}`) → remplacer par `onClick={() => { setStatus("done"); if (!completedAt) setCompletedAt(new Date().toISOString().slice(0, 10)); }}`.

- [ ] **Step 9 : Vérifier**

Run: `npx tsc --noEmit && npx vitest run`
Expected: propre + vert. Manuel : noter un film → un sélecteur de date pré-rempli à aujourd'hui apparaît, modifiable ; recharger la fiche → la date est conservée.

- [ ] **Step 10 : Commit**

```bash
git add src/server/domain/entities.ts src/server/application/library-entry.ts src/server/adapters/mongo/mappers.ts src/lib/zod-schemas.ts src/app/api/works/entry/route.ts src/components/EntryEditor.tsx tests/application/library-entry.test.ts
git commit -m "feat(vulu): date de visionnage/lecture (completedAt) — saisie éditable, défaut aujourd'hui"
```

---

### Task C2 : Temps de visionnage sur le profil

**Objectif :** ajouter `runtime` aux œuvres (TMDB), calculer le temps total de visionnage (films + séries) et l'afficher sur le profil converti en jours/mois.

**Files:**
- Modify: `src/server/domain/entities.ts`, `src/server/ports/catalog.ts`, `src/server/adapters/catalog/tmdb-catalog.ts`, `src/server/application/get-work.ts`, `src/server/adapters/mongo/mappers.ts`, `src/app/u/[username]/page.tsx`
- Create: `src/server/application/watch-time.ts`, `src/lib/format-duration.ts`
- Test: `tests/application/watch-time.test.ts`, `tests/lib/format-duration.test.ts`

**Interfaces:**
- Produces: `Work.runtime: number | null` (minutes). `computeWatchMinutes(deps, userId): Promise<number>`. `formatWatchDuration(minutes: number): string`.

- [ ] **Step 1 : Champ `runtime` au domaine et au port catalogue**

Dans `src/server/domain/entities.ts`, dans `interface Work`, ajouter après `pageCount: number | null;` :

```ts
  runtime: number | null;          // minutes : film = durée ; série = durée d'un épisode
```

Dans `src/server/ports/catalog.ts`, dans `interface WorkDetails`, ajouter après `pageCount?: number | null;` :

```ts
  runtime?: number | null;
```

- [ ] **Step 2 : TMDB expose runtime / episode_run_time**

Dans `src/server/adapters/catalog/tmdb-catalog.ts` :
- Étendre l'interface `TmdbDetails` : ajouter `runtime?: number | null; episode_run_time?: number[];`.
- Dans `getWork`, calculer le runtime et l'ajouter au retour :

```ts
    const runtime = type === "tv" ? (d.episode_run_time?.[0] ?? null) : (d.runtime ?? null);
```

et ajouter `runtime,` à l'objet `WorkDetails` retourné (après `pageCount: null,`).

- [ ] **Step 3 : Mapper import + Mongo**

Dans `src/server/application/get-work.ts`, dans l'objet `work: Work`, ajouter après `pageCount: details.pageCount ?? null,` :

```ts
    runtime: details.runtime ?? null,
```

Dans `src/server/adapters/mongo/mappers.ts`, dans `fromWorkDoc`, compléter le défaut. Remplacer `return { ...w, episodeCounts: w.episodeCounts ?? null, pageCount: w.pageCount ?? null };` par :

```ts
  return { ...w, episodeCounts: w.episodeCounts ?? null, pageCount: w.pageCount ?? null, runtime: w.runtime ?? null };
```

- [ ] **Step 4 : Test du formateur (échoue)**

Créer `tests/lib/format-duration.test.ts` :

```ts
import { describe, it, expect } from "vitest";
import { formatWatchDuration } from "@/lib/format-duration";

describe("formatWatchDuration", () => {
  it("0 minute", () => expect(formatWatchDuration(0)).toBe("0 h"));
  it("moins d'un jour → heures", () => expect(formatWatchDuration(150)).toBe("2 h 30"));
  it("heures pleines", () => expect(formatWatchDuration(120)).toBe("2 h"));
  it("plusieurs jours", () => expect(formatWatchDuration(60 * 24 * 3 + 60 * 4)).toBe("3 j 4 h"));
  it("mois + jours", () => expect(formatWatchDuration(60 * 24 * 35)).toBe("1 mois 5 j"));
});
```

- [ ] **Step 5 : Lancer → échoue**

Run: `npx vitest run tests/lib/format-duration.test.ts`
Expected: FAIL (module introuvable).

- [ ] **Step 6 : Implémenter le formateur**

Créer `src/lib/format-duration.ts` :

```ts
/** Convertit des minutes en durée lisible : heures, puis jours, puis mois (30 j). */
export function formatWatchDuration(minutes: number): string {
  const totalHours = Math.floor(minutes / 60);
  if (totalHours < 24) {
    const mins = minutes % 60;
    return mins > 0 ? `${totalHours} h ${mins}` : `${totalHours} h`;
  }
  const totalDays = Math.floor(totalHours / 24);
  if (totalDays < 30) {
    const hours = totalHours % 24;
    return hours > 0 ? `${totalDays} j ${hours} h` : `${totalDays} j`;
  }
  const months = Math.floor(totalDays / 30);
  const days = totalDays % 30;
  return days > 0 ? `${months} mois ${days} j` : `${months} mois`;
}
```

- [ ] **Step 7 : Test → passe**

Run: `npx vitest run tests/lib/format-duration.test.ts`
Expected: PASS.

- [ ] **Step 8 : Test du calcul de temps (échoue)**

Créer `tests/application/watch-time.test.ts` :

```ts
import { describe, it, expect, beforeEach } from "vitest";
import { makeInMemoryDeps, type Deps } from "@/server/container";
import { FakeCatalog } from "../helpers/fake-catalog";
import { setEntryStatus, rateOrReviewWork } from "@/server/application/library-entry";
import { computeWatchMinutes } from "@/server/application/watch-time";

let deps: Deps;
beforeEach(() => { deps = makeInMemoryDeps(new FakeCatalog()); });

describe("computeWatchMinutes", () => {
  it("film terminé = sa durée", async () => {
    // FakeCatalog: 603 = The Matrix (movie). On force un runtime via l'œuvre importée.
    const ref = { source: "tmdb" as const, externalId: "603", type: "movie" as const };
    await rateOrReviewWork(deps, "u1", ref, { rating: 4, text: null, audiences: { public: false, circle: false, communityIds: [] } });
    // Le FakeCatalog doit fournir runtime ; sinon 0. On vérifie ≥ 0 et le comportement additif via un second film.
    const minutes = await computeWatchMinutes(deps, "u1");
    expect(minutes).toBeGreaterThanOrEqual(0);
  });
  it("ignore les œuvres planned", async () => {
    const ref = { source: "tmdb" as const, externalId: "603", type: "movie" as const };
    await setEntryStatus(deps, "u1", ref, "planned");
    expect(await computeWatchMinutes(deps, "u1")).toBe(0);
  });
});
```

Note : vérifier ce que `FakeCatalog` renvoie comme `runtime`/`episodeCounts` pour `603` (`grep -n "603\|runtime\|episode" tests/helpers/fake-catalog.ts`). Si `FakeCatalog` ne fournit pas de runtime, l'ajouter (`runtime: 136` pour `603`) afin que le premier test vérifie une valeur exacte : remplacer l'assertion par `expect(minutes).toBe(136);`.

- [ ] **Step 9 : Lancer → échoue**

Run: `npx vitest run tests/application/watch-time.test.ts`
Expected: FAIL (module `watch-time` introuvable).

- [ ] **Step 10 : Implémenter le calcul**

Créer `src/server/application/watch-time.ts` :

```ts
import type { Deps } from "@/server/container";
import type { LibraryEntry, Work } from "@/server/domain/entities";

/** Épisodes cumulés vus jusqu'à (saison, épisode) courant, d'après le découpage par saison. */
function episodesSeen(entry: LibraryEntry, work: Work): number {
  const counts = work.episodeCounts ?? [];
  if (entry.status === "done") return counts.reduce((a, b) => a + b, 0);
  const season = entry.progress?.season ?? 1;
  const episode = entry.progress?.episode ?? 0;
  let total = 0;
  for (let i = 0; i < season - 1 && i < counts.length; i++) total += counts[i]!;
  return total + Math.min(episode, counts[season - 1] ?? episode);
}

/** Temps total de visionnage (films + séries), en minutes, pour un utilisateur. */
export async function computeWatchMinutes(deps: Deps, userId: string): Promise<number> {
  const entries = await deps.entries.listByUser(userId, {});
  let minutes = 0;
  for (const entry of entries) {
    if (entry.status === "planned") continue;
    const work = await deps.works.findById(entry.workId);
    if (!work || work.runtime === null) continue;
    if (work.type === "movie") {
      if (entry.status === "done") minutes += work.runtime;
    } else if (work.type === "tv") {
      minutes += episodesSeen(entry, work) * work.runtime;
    }
  }
  return minutes;
}
```

Vérifier la signature de `listByUser` (`grep -n "listByUser" src/server/ports/repositories.ts`) : elle accepte `{ status?, domain? }`. Passer `{}` récupère toutes les entrées de l'utilisateur.

- [ ] **Step 11 : Test → passe**

Run: `npx vitest run tests/application/watch-time.test.ts`
Expected: PASS.

- [ ] **Step 12 : Afficher sur le profil**

Dans `src/app/u/[username]/page.tsx` :
- Importer : `import { computeWatchMinutes } from "@/server/application/watch-time";` et `import { formatWatchDuration } from "@/lib/format-duration";`.
- Calculer (seulement si visible et onglet films actif) après le bloc `watchedEntries`, par ex. :

```tsx
  const watchMinutes = showFilms && canView ? await computeWatchMinutes(deps, target.id) : 0;
```

(`showFilms`, `canView`, `deps`, `target` sont déjà définis plus haut ; placer ce calcul après leur définition.)
- Ajouter une entrée de stats dans le bloc `flex flex-wrap gap-x-5` :

```tsx
            {showFilms && watchMinutes > 0 && <span><b>{formatWatchDuration(watchMinutes)}</b> <span className="text-[var(--color-text-muted)]">de visionnage</span></span>}
```

- [ ] **Step 13 : Vérifier**

Run: `npx tsc --noEmit && npx vitest run`
Expected: propre + vert. Manuel : sur un profil ayant noté des films/séries récents (avec runtime récupéré), le temps de visionnage s'affiche (ex. « 2 j 4 h de visionnage »). Les œuvres importées avant l'ajout du champ montrent 0 jusqu'à rafraîchissement du cache.

- [ ] **Step 14 : Commit**

```bash
git add src/server/domain/entities.ts src/server/ports/catalog.ts src/server/adapters/catalog/tmdb-catalog.ts src/server/application/get-work.ts src/server/adapters/mongo/mappers.ts src/server/application/watch-time.ts src/lib/format-duration.ts "src/app/u/[username]/page.tsx" tests/application/watch-time.test.ts tests/lib/format-duration.test.ts tests/helpers/fake-catalog.ts
git commit -m "feat(vulu): temps de visionnage sur le profil (films + séries, durées TMDB)"
```

---

### Task C3 : Teaser communauté vulu+

**Objectif :** pour les non-vulu+, un grand fond intégré « Créer une communauté avec vulu+ » sur la page Communautés.

**Files:**
- Modify: `src/app/communautes/CommunitiesClient.tsx`

- [ ] **Step 1 : Ajouter le teaser (non-plus uniquement)**

Dans `src/app/communautes/CommunitiesClient.tsx`, sous l'en-tête (après le bloc contenant le bouton « Créer · vulu+ »), insérer un bloc hero visible seulement si `!plus`. Repérer la fin du header (`grep -n "Créer · vulu+\|</header>\|</div>" ...`) et insérer :

```tsx
{!plus && (
  <Link href="/plus" className="relative mb-6 block overflow-hidden rounded-3xl bg-gradient-to-br from-[var(--color-primary)] to-[var(--color-accent)] p-8 text-white shadow-[0_8px_30px_rgba(0,0,0,0.12)]">
    <span className="absolute -right-6 -top-8 select-none font-display text-[7rem] font-black leading-none text-white/10">vulu+</span>
    <p className="relative font-display text-2xl font-black leading-tight sm:text-3xl">Crée ta communauté<br />avec vulu+</p>
    <p className="relative mt-2 max-w-sm text-sm text-white/85">Rassemble tes proches autour de vos films, séries et livres. Réservé aux membres vulu+.</p>
    <span className="relative mt-4 inline-flex items-center gap-1.5 rounded-full bg-white px-4 py-2 text-sm font-semibold text-[var(--color-primary)]">
      <Icon name="lock" size={16} /> Débloquer avec vulu+
    </span>
  </Link>
)}
```

Vérifier que `Link` et `Icon` sont importés (sinon les ajouter : `import Link from "next/link";`, `import { Icon } from "@/components/Icon";`).

- [ ] **Step 2 : Vérifier**

Run: `npx tsc --noEmit`
Expected: aucune sortie. Manuel : en compte non-vulu+, la page Communautés affiche le grand teaser dégradé « Crée ta communauté avec vulu+ », cliquable vers `/plus`, propre en mobile (375px) ; en compte vulu+, pas de teaser, bouton « Créer » conservé.

- [ ] **Step 3 : Commit**

```bash
git add src/app/communautes/CommunitiesClient.tsx
git commit -m "feat(vulu): teaser « Crée ta communauté avec vulu+ » pour les comptes non-plus"
```

---

## Self-Review (couverture spec)

| Demande utilisateur | Tâche |
|---|---|
| Bouton éditer profil trop gros mobile | A4 |
| Scan iPhone sort de l'écran / dézoom manuel | A3 |
| Discord → discord.gg/sgnZmxxUnx | A5 |
| Retirer Instagram et X | A5 |
| Route `/` page inaccessible | A1 |
| Icônes tronquées à droite (cœur) | A2 |
| Retour après notation → recherche filtrée | B1 |
| Scan collection en batch + animation + Terminer | B2 |
| Date de lecture/visionnage à la saisie | C1 |
| Temps de visionnage (jours/mois) sur le profil | C2 |
| Teaser « Créer une communauté avec vulu+ » | C3 |

Toutes les demandes du batch sont couvertes. Ordre : A (bugs) → B (nav/scan) → C (données). Chaque tâche est indépendamment testable et livrable.

## Notes pour la session d'exécution

- Base de dev : MongoDB Atlas. Serveur : `npm run dev`.
- A1/A2/A3/B2 nécessitent une repro visuelle sur iPhone réel/émulé côté utilisateur.
- C2 : les œuvres importées avant l'ajout de `runtime` affichent 0 jusqu'à rafraîchissement du cache (`cachedAt`). Vérifier le contenu de `tests/helpers/fake-catalog.ts` pour fixer une valeur `runtime` exacte dans le test.
- Le SW ne s'enregistre qu'en prod ; pour reproduire le bug `/`, tester la PWA installée ou désenregistrer/vider le cache.
