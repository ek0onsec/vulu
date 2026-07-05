# Bibliothèque : section « En cours » — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ajouter une section « En cours » en haut de la Bibliothèque, réutilisant le composant `InProgressShelf`, pour accéder et mettre à jour rapidement les séries et livres en cours.

**Architecture:** `getLibrary` charge en plus les entrées `in_progress` et les expose via un nouveau champ `Library.inProgress` (forme attendue par `InProgressShelf`, + `peopleIds`). `LibraryClient` rend `InProgressShelf` en tête, filtré par type et personne comme les sections existantes.

**Tech Stack:** Next.js (version custom — lire `node_modules/next/dist/docs/` avant tout code), React, TypeScript strict (`noUncheckedIndexedAccess` actif), Vitest, ports & adapters.

## Global Constraints

- **Typage strict sans `any`** ; accès indexés sécurisés (`noUncheckedIndexedAccess`).
- **Réutilisation** : `InProgressShelf` n'est pas réécrit ; seul son type `Item` gagne `peopleIds`.
- **Rétro-compat** : la route `/api/library` sérialise l'objet `Library` entier → aucun changement route.
- Copie FR existante conservée (le titre « En cours » vient déjà de `InProgressShelf`).
- Tests : `npm test` (vitest run) ; typecheck `npx tsc --noEmit` ; build `npm run build`.

---

### Task 1: Données — `Library.inProgress` + `getLibrary` (avec optimisation single-fetch)

Cette tâche ajoute `inProgress` **et** corrige la lenteur : `getLibrary` charge
aujourd'hui les œuvres deux fois (dont une boucle séquentielle re-`findById`). On
réécrit le corps pour charger chaque œuvre **une seule fois, en parallèle**, dans
une `Map`, puis construire toutes les listes depuis cette map. Les tests existants
(watchlist/seen/people/peopleIds) protègent contre toute régression de contrat.

**Files:**
- Modify: `src/server/application/library.ts` (imports ~ligne 1-2 ; interfaces ~ligne 5-7 ; `getLibrary` ~ligne 9-43)
- Test: `tests/application/library.test.ts` (imports ~ligne 5 ; nouveau cas dans `describe("getLibrary")`)

**Interfaces:**
- Produces:
  - `interface LibraryInProgress { entryId: string; workId: string; source: WorkSource; externalId: string; title: string; posterUrl: string | null; type: WorkType; episodeCounts: number[] | null; pageCount: number | null; progress: EntryProgress | null; peopleIds: number[] }`
  - `Library.inProgress: LibraryInProgress[]`

- [ ] **Step 1: Écrire le test qui échoue**

Dans `tests/application/library.test.ts`, modifier la ligne d'import de `library-entry` pour ajouter `updateProgress` :

```ts
import { setEntryStatus, rateOrReviewWork, updateProgress } from "@/server/application/library-entry";
```

Puis ajouter ce cas à la fin du `describe("getLibrary", ...)` :

```ts
  it("expose les entrées en cours dans inProgress, hors watchlist et seen", async () => {
    await updateProgress(deps, me, book, { page: 50 });
    const lib = await getLibrary(deps, me);
    expect(lib.inProgress).toHaveLength(1);
    const ip = lib.inProgress[0]!;
    expect(ip.type).toBe("book");
    expect(ip.source).toBe("googlebooks");
    expect(ip.externalId).toBe("book-1");
    expect(ip.progress?.page).toBe(50);
    expect(ip.peopleIds).toContain(99); // William Gibson (auteur)
    expect(lib.watchlist).toHaveLength(0);
    expect(lib.seen).toHaveLength(0);
  });
```

- [ ] **Step 2: Lancer le test, vérifier l'échec**

Run: `npm test -- library`
Expected: FAIL — `lib.inProgress` est `undefined` (propriété inexistante).

- [ ] **Step 3: Étendre les imports et les types**

Dans `src/server/application/library.ts`, la ligne d'import des entités importe déjà `LibraryEntry, PersonRole, WorkType`. Ajouter `EntryProgress`, `Work` et `WorkSource` :

```ts
import type { EntryProgress, LibraryEntry, PersonRole, Work, WorkSource, WorkType } from "@/server/domain/entities";
```

Ajouter l'interface `LibraryInProgress` juste après la définition de `LibraryPlaylist` :

```ts
export interface LibraryInProgress { entryId: string; workId: string; source: WorkSource; externalId: string; title: string; posterUrl: string | null; type: WorkType; episodeCounts: number[] | null; pageCount: number | null; progress: EntryProgress | null; peopleIds: number[] }
```

Étendre l'interface `Library` avec le champ `inProgress` :

```ts
export interface Library { playlists: LibraryPlaylist[]; watchlist: LibraryPoster[]; seen: LibraryPoster[]; inProgress: LibraryInProgress[]; people: { id: number; name: string; role: PersonRole }[] }
```

- [ ] **Step 4: Réécrire le corps de `getLibrary` (single-fetch + inProgress)**

Remplacer tout le corps de `getLibrary` **après** la garde utilisateur
(`if (!user) throw …`) — c.-à-d. de la déclaration `async function posters` jusqu'au
`return` inclus (≈ lignes 13-42) — par :

```ts
  const [plannedEntries, doneEntries, inProgressEntries, lists] = await Promise.all([
    deps.entries.listByUser(userId, { status: "planned" }),
    deps.entries.listByUser(userId, { status: "done" }),
    deps.entries.listByUser(userId, { status: "in_progress" }),
    deps.lists.listByUser(userId),
  ]);

  // Chaque œuvre des entrées est chargée une seule fois, en parallèle.
  const entryWorkIds = [...new Set([...plannedEntries, ...doneEntries, ...inProgressEntries].map((e) => e.workId))];
  const worksById = new Map<string, Work>();
  await Promise.all(entryWorkIds.map(async (id) => {
    const w = await deps.works.findById(id);
    if (w) worksById.set(id, w);
  }));

  const toPoster = (e: LibraryEntry): LibraryPoster | null => {
    const w = worksById.get(e.workId);
    return w ? { id: e.id, workId: w.id, title: w.title, posterUrl: w.posterUrl, type: w.type, rating: e.rating, peopleIds: w.people.map((p) => p.tmdbId) } : null;
  };
  const watchlist = plannedEntries.map(toPoster).filter((x): x is LibraryPoster => x !== null);
  const seen = doneEntries.map(toPoster).filter((x): x is LibraryPoster => x !== null);

  const inProgress: LibraryInProgress[] = inProgressEntries.map((e) => {
    const w = worksById.get(e.workId);
    return w ? {
      entryId: e.id, workId: w.id, source: w.source, externalId: w.externalId,
      title: w.title, posterUrl: w.posterUrl, type: w.type,
      episodeCounts: w.episodeCounts, pageCount: w.pageCount,
      progress: e.progress, peopleIds: w.people.map((p) => p.tmdbId),
    } : null;
  }).filter((x): x is LibraryInProgress => x !== null);

  const playlists: LibraryPlaylist[] = await Promise.all(
    lists.map(async (l) => {
      const coverWorks = await Promise.all(l.workIds.slice(0, 4).map((id) => deps.works.findById(id)));
      const covers = coverWorks.map((w) => w?.posterUrl).filter((u): u is string => Boolean(u));
      return { id: l.id, name: l.name, kind: l.kind, description: l.description, bannerUrl: l.bannerUrl, visibility: l.visibility, count: l.workIds.length, covers };
    }),
  );

  // Personnes : depuis la map déjà chargée (planned + seen), sans boucle séquentielle ni re-fetch.
  const ownedWorkIds = new Set([...watchlist, ...seen].map((p) => p.workId));
  const peopleMap = new Map<number, { id: number; name: string; role: PersonRole }>();
  for (const id of ownedWorkIds) {
    const w = worksById.get(id);
    for (const p of w?.people ?? []) if (!peopleMap.has(p.tmdbId)) peopleMap.set(p.tmdbId, { id: p.tmdbId, name: p.name, role: p.role });
  }
  const people = [...peopleMap.values()].sort((a, b) => a.name.localeCompare(b.name));

  return { playlists, watchlist, seen, inProgress, people };
```

Note : la fonction interne `posters` disparaît (remplacée par `toPoster` synchrone).
Vérifier qu'aucun autre appel à `posters` ne subsiste dans le fichier.

- [ ] **Step 5: Lancer le test, vérifier le succès**

Run: `npm test -- library`
Expected: PASS (nouveau cas `inProgress` + cas existants watchlist/seen/people/peopleIds — ces derniers valident la non-régression du refactor).

- [ ] **Step 6: Typecheck**

Run: `npx tsc --noEmit`
Expected: la seule erreur attendue provient de `LibraryClient.tsx` (fallback sans `inProgress`, corrigé en Task 2). Vérifier qu'aucune erreur ne provient de `library.ts`.

- [ ] **Step 7: Commit**

```bash
git add src/server/application/library.ts tests/application/library.test.ts
git commit -m "feat(vulu): getLibrary expose les entrées en cours + chargement des œuvres en une passe parallèle"
```

---

### Task 2: UI — section « En cours » dans la Bibliothèque

**Files:**
- Modify: `src/components/InProgressShelf.tsx` (interface `Item`, ~ligne 9-12)
- Modify: `src/app/u/[username]/page.tsx` (mapping in-progress, ~ligne 52-57)
- Modify: `src/app/bibliotheque/LibraryClient.tsx` (import ; fallback `load` ~ligne 53 ; calcul filtré ~ligne 83-84 ; rendu avant « Mes collections » ~ligne 119)

**Interfaces:**
- Consumes: `Library.inProgress: LibraryInProgress[]` (Task 1) ; `InProgressShelf` (existant).

- [ ] **Step 1: Ajouter `peopleIds` au type `Item` de `InProgressShelf`**

Dans `src/components/InProgressShelf.tsx`, l'interface `Item` :

```ts
interface Item {
  entryId: string; workId: string; source: WorkSource; externalId: string; title: string; posterUrl: string | null;
  type: WorkType; episodeCounts: number[] | null; pageCount: number | null; progress: EntryProgress | null; peopleIds: number[];
}
```

- [ ] **Step 2: Fournir `peopleIds` depuis la page profil**

Dans `src/app/u/[username]/page.tsx`, le mapping qui construit `inProgress` (≈ lignes 53-56) retourne un objet ; ajouter `peopleIds`. Remplacer :

```ts
        return w ? { entryId: e.id, workId: w.id, source: w.source, externalId: w.externalId, title: w.title, posterUrl: w.posterUrl,
          type: w.type, episodeCounts: w.episodeCounts, pageCount: w.pageCount, progress: e.progress } : null;
```
par :
```ts
        return w ? { entryId: e.id, workId: w.id, source: w.source, externalId: w.externalId, title: w.title, posterUrl: w.posterUrl,
          type: w.type, episodeCounts: w.episodeCounts, pageCount: w.pageCount, progress: e.progress, peopleIds: w.people.map((p) => p.tmdbId) } : null;
```

- [ ] **Step 3: Importer `InProgressShelf` et corriger le fallback dans `LibraryClient`**

Dans `src/app/bibliotheque/LibraryClient.tsx`, ajouter l'import après les autres imports de composants (près de la ligne `import { BookScanner }`) :

```ts
import { InProgressShelf } from "@/components/InProgressShelf";
```

Corriger le fallback d'erreur de `load` pour inclure `inProgress: []`. Remplacer :

```ts
    api.get<Library>("/api/library").then(setData).catch(() => setData({ playlists: [], watchlist: [], seen: [], people: [] }));
```
par :
```ts
    api.get<Library>("/api/library").then(setData).catch(() => setData({ playlists: [], watchlist: [], seen: [], inProgress: [], people: [] }));
```

- [ ] **Step 4: Calculer la liste filtrée**

Dans `LibraryClient`, à côté du calcul de `watchlist`/`seen` (après la ligne `const seen = data.seen.filter(...)`), ajouter :

```ts
  const inProgress = data.inProgress.filter((x) => match(x.type) && matchPerson(x.peopleIds));
```

- [ ] **Step 5: Rendre la section avant « Mes collections »**

Dans le JSX, juste avant la section `<section className="mb-8">` contenant `<h2>Mes collections</h2>` (≈ ligne 119), insérer :

```tsx
      {inProgress.length > 0 && <InProgressShelf items={inProgress} />}
```

(`InProgressShelf` fournit déjà son `<section className="mb-6">` et son titre « En cours ».)

- [ ] **Step 6: Typecheck**

Run: `npx tsc --noEmit`
Expected: aucune erreur.

- [ ] **Step 7: Build de production (compilation React/Next)**

Run: `npm run build`
Expected: build réussi (« Compiled successfully » puis liste des routes).

- [ ] **Step 8: Vérification manuelle**

Run: `npm run dev`, ouvrir la Bibliothèque avec au moins une série et un livre en cours.
Expected : une section « En cours » en haut (avant « Mes collections ») ; `+1 page` / `+10` sur le livre, `+1 épisode` sur la série mettent à jour la progression sur place ; filtrer sur « Séries » ne laisse que les séries ; sélectionner une personne filtre aussi la section ; la section disparaît si aucun item ne correspond.

- [ ] **Step 9: Commit**

```bash
git add src/components/InProgressShelf.tsx src/app/u/[username]/page.tsx src/app/bibliotheque/LibraryClient.tsx
git commit -m "feat(vulu): section « En cours » en haut de la Bibliothèque (mise à jour rapide)"
```

---

## Self-Review

**Spec coverage :**
- `Library.inProgress` + `getLibrary` charge `in_progress` → Task 1 ✓
- Type `LibraryInProgress` avec `peopleIds` → Task 1 Step 3 ✓
- `InProgressShelf.Item` gagne `peopleIds` → Task 2 Step 1 ✓
- Page profil fournit `peopleIds` → Task 2 Step 2 ✓
- Rendu en haut, avant « Mes collections », filtré type + personne, masqué si vide → Task 2 Steps 4-5 ✓
- Fallback `load` inclut `inProgress: []` → Task 2 Step 3 ✓
- Test `getLibrary` (inProgress présent, hors watchlist/seen, peopleIds) → Task 1 Step 1 ✓
- Optimisation single-fetch (map d'œuvres, suppression boucle séquentielle + double fetch, `people` depuis la map) → Task 1 Step 4 ✓ ; non-régression via tests existants → Task 1 Step 5 ✓

**Placeholder scan :** aucun TBD/TODO ; code complet à chaque étape.

**Type consistency :** `LibraryInProgress` (Task 1) ⇔ objet mappé dans `getLibrary` (mêmes clés) ⇔ `InProgressShelf.Item` étendu de `peopleIds` (Task 2) ⇔ objet du profil (Task 2 Step 2). `data.inProgress` filtré via `match`/`matchPerson` déjà définis dans `LibraryClient`. Cohérent.
