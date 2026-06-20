# Exploration par personne — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Explorer une personne (acteur/réalisateur/auteur) via une page dédiée (mes œuvres + découverte catalogue) et un filtre par personne dans la bibliothèque, avec des noms cliquables sur la fiche œuvre et dans les favoris.

**Architecture:** Hexagonale existante. Le matching « œuvres de la personne dans ma biblio » scanne les entrées de l'utilisateur (volumes faibles, pas de requête repo dédiée). La découverte délègue au catalogue : TMDB `combined_credits` pour les films/séries, recherche `inauthor:` pour les livres.

**Tech Stack:** Next.js 16 (App Router, async params/searchParams), React 19, Tailwind v4, MongoDB, Vitest, zod v4.

## Global Constraints

- TypeScript strict, **aucun `any`** (CLAUDE.md).
- Découplage hexagonal : domaine → ports → adaptateurs ; pas d'accès driver hors adaptateur.
- TDD : test rouge → implémentation minimale → vert → commit.
- **Aucune attribution IA** dans le code/app/commits ; pas de co-auteur Claude.
- Ne PAS toucher à `lechatonfat/` ni aux clés réelles de `vulu/.env.local`.
- Typecheck : `node_modules/.bin/tsc --noEmit` (jamais `npx tsc`). Tests : `npx vitest run`.
- **Toujours préfixer les commandes par `cd /home/chamberlain/Desktop/Claude/vulu`** (le cwd du shell peut dériver).
- Commits en français, préfixe `feat(vulu):` / `test(vulu):`.
- Chemins relatifs à `/home/chamberlain/Desktop/Claude/vulu`.

---

### Task 1: Helpers de lien personne

**Files:**
- Create: `src/lib/person.ts`
- Test: `tests/lib/person.test.ts`

**Interfaces:**
- Produces:
  - `interface PersonRef { source: "tmdb" | "book"; externalId: number }`
  - `parsePersonId(id: string): PersonRef | null`
  - `personHref(p: { tmdbId: number; name: string }, source: "tmdb" | "book"): string`

- [ ] **Step 1: Écrire le test qui échoue**

Create `tests/lib/person.test.ts` :

```ts
import { describe, it, expect } from "vitest";
import { parsePersonId, personHref } from "@/lib/person";

describe("personHref / parsePersonId", () => {
  it("construit un lien tmdb avec le nom encodé", () => {
    expect(personHref({ tmdbId: 6384, name: "Keanu Reeves" }, "tmdb"))
      .toBe("/personne/tmdb-6384?name=Keanu%20Reeves");
  });
  it("construit un lien book", () => {
    expect(personHref({ tmdbId: 99, name: "William Gibson" }, "book"))
      .toBe("/personne/book-99?name=William%20Gibson");
  });
  it("décode un id de route valide", () => {
    expect(parsePersonId("tmdb-6384")).toEqual({ source: "tmdb", externalId: 6384 });
    expect(parsePersonId("book-99")).toEqual({ source: "book", externalId: 99 });
  });
  it("renvoie null si l'id est invalide", () => {
    expect(parsePersonId("foo-1")).toBeNull();
    expect(parsePersonId("tmdb-")).toBeNull();
    expect(parsePersonId("tmdb-abc")).toBeNull();
  });
});
```

- [ ] **Step 2: Lancer le test, vérifier l'échec**

Run: `cd /home/chamberlain/Desktop/Claude/vulu && npx vitest run tests/lib/person.test.ts`
Expected: FAIL — module `@/lib/person` introuvable.

- [ ] **Step 3: Implémenter**

Create `src/lib/person.ts` :

```ts
export interface PersonRef { source: "tmdb" | "book"; externalId: number }

export function parsePersonId(id: string): PersonRef | null {
  const m = /^(tmdb|book)-(\d+)$/.exec(id);
  if (!m) return null;
  return { source: m[1] as "tmdb" | "book", externalId: Number(m[2]) };
}

export function personHref(p: { tmdbId: number; name: string }, source: "tmdb" | "book"): string {
  return `/personne/${source}-${p.tmdbId}?name=${encodeURIComponent(p.name)}`;
}
```

- [ ] **Step 4: Lancer le test, vérifier le succès**

Run: `cd /home/chamberlain/Desktop/Claude/vulu && npx vitest run tests/lib/person.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
cd /home/chamberlain/Desktop/Claude/vulu
git add src/lib/person.ts tests/lib/person.test.ts
git commit -m "feat(vulu): helpers de lien personne (personHref/parsePersonId)"
```

---

### Task 2: Catalogue — crédits d'une personne

**Files:**
- Modify: `src/server/ports/catalog.ts`
- Modify: `src/server/adapters/catalog/tmdb-catalog.ts`
- Modify: `src/server/adapters/catalog/google-books-catalog.ts`
- Modify: `src/server/adapters/catalog/composite-catalog.ts`
- Modify: `tests/helpers/fake-catalog.ts`
- Test: `tests/adapters/tmdb-catalog.test.ts`

**Interfaces:**
- Produces:
  - `CatalogProvider.getPersonCredits(personId: string): Promise<WorkSummary[]>`
  - `FakeCatalog.getPersonCredits` renvoie The Matrix (`603`) + Breaking Bad (`1396`) pour le personId `"6384"`, sinon `[]`.

- [ ] **Step 1: Écrire le test qui échoue**

Append to `tests/adapters/tmdb-catalog.test.ts` (suivre le style existant : `fakeFetch` mappe un chemin → réponse JSON). Ajouter un test :

```ts
it("getPersonCredits mappe cast+crew, filtre movie/tv, déduplique", async () => {
  const cat = new TmdbCatalog({ apiKey: "k", baseUrl: "https://api", imageBase: "https://img" }, fakeFetch({
    "/person/6384/combined_credits": {
      cast: [
        { media_type: "movie", id: 603, title: "The Matrix", release_date: "1999-03-30", poster_path: "/m.jpg" },
        { media_type: "person", id: 1 },
      ],
      crew: [
        { media_type: "tv", id: 1396, name: "Breaking Bad", first_air_date: "2008-01-20", poster_path: "/b.jpg" },
        { media_type: "movie", id: 603, title: "The Matrix", release_date: "1999-03-30", poster_path: "/m.jpg" },
      ],
    },
  }));
  const out = await cat.getPersonCredits("6384");
  expect(out.map((w) => w.externalId).sort()).toEqual(["1396", "603"]);
  expect(out.find((w) => w.externalId === "603")?.type).toBe("movie");
});
```

Note : adapter les arguments du constructeur `TmdbCatalog` et la forme de `fakeFetch` à ce que le fichier de test utilise déjà (lire le haut du fichier avant d'écrire).

- [ ] **Step 2: Lancer le test, vérifier l'échec**

Run: `cd /home/chamberlain/Desktop/Claude/vulu && npx vitest run tests/adapters/tmdb-catalog.test.ts`
Expected: FAIL — `getPersonCredits` n'existe pas sur `TmdbCatalog`.

- [ ] **Step 3: Étendre le port**

Dans `src/server/ports/catalog.ts`, ajouter à l'interface `CatalogProvider` :

```ts
  getPersonCredits(personId: string): Promise<WorkSummary[]>;
```

- [ ] **Step 4: Implémenter dans TmdbCatalog**

Dans `src/server/adapters/catalog/tmdb-catalog.ts`, ajouter une méthode (après `searchWorks`). Réutilise `this.get`, `this.img` et la fonction module `yearOf` déjà présents :

```ts
  async getPersonCredits(personId: string): Promise<WorkSummary[]> {
    const d = await this.get<{ cast?: TmdbSearchItem[]; crew?: TmdbSearchItem[] }>(`/person/${personId}/combined_credits`, {});
    const seen = new Set<number>();
    const out: WorkSummary[] = [];
    for (const r of [...(d?.cast ?? []), ...(d?.crew ?? [])]) {
      if (r.media_type !== "movie" && r.media_type !== "tv") continue;
      if (seen.has(r.id)) continue;
      seen.add(r.id);
      out.push({
        source: "tmdb",
        externalId: String(r.id),
        type: (r.media_type === "tv" ? "tv" : "movie") as WorkType,
        title: r.title ?? r.name ?? "Sans titre",
        year: yearOf(r.release_date ?? r.first_air_date),
        posterUrl: this.img(r.poster_path, "w500"),
      });
    }
    return out;
  }
```

Si `TmdbSearchItem` ne contient pas `release_date`/`first_air_date`/`poster_path`/`name`, les ajouter à son interface (déjà probable car réutilisée par `searchWorks`). Vérifier avant d'éditer.

- [ ] **Step 5: Implémenter dans GoogleBooksCatalog (no-op)**

Dans `src/server/adapters/catalog/google-books-catalog.ts`, ajouter :

```ts
  async getPersonCredits(): Promise<WorkSummary[]> { return []; }
```

(importer `WorkSummary` si nécessaire — il l'est déjà via les autres méthodes.)

- [ ] **Step 6: Déléguer dans CompositeCatalog**

Dans `src/server/adapters/catalog/composite-catalog.ts`, ajouter à la classe :

```ts
  getPersonCredits(personId: string): Promise<WorkSummary[]> {
    return this.films.getPersonCredits(personId);
  }
```

- [ ] **Step 7: Étendre FakeCatalog**

Dans `tests/helpers/fake-catalog.ts`, ajouter la méthode :

```ts
  async getPersonCredits(personId: string): Promise<WorkSummary[]> {
    if (personId !== "6384") return [];
    return [this.works["603"], this.works["1396"]].map((w) => ({
      source: w.source, externalId: w.externalId, type: w.type, title: w.title, year: w.year, posterUrl: w.posterUrl,
    }));
  }
```

- [ ] **Step 8: Lancer les tests + typecheck**

Run: `cd /home/chamberlain/Desktop/Claude/vulu && npx vitest run tests/adapters/tmdb-catalog.test.ts && node_modules/.bin/tsc --noEmit`
Expected: PASS, tsc 0.

- [ ] **Step 9: Commit**

```bash
cd /home/chamberlain/Desktop/Claude/vulu
git add src/server/ports/catalog.ts src/server/adapters/catalog/ tests/helpers/fake-catalog.ts tests/adapters/tmdb-catalog.test.ts
git commit -m "feat(vulu): catalogue — getPersonCredits (TMDB combined_credits)"
```

---

### Task 3: Application — getPersonProfile

**Files:**
- Create: `src/server/application/person.ts`
- Test: `tests/application/person.test.ts`

**Interfaces:**
- Consumes: `getPersonCredits` (Task 2), `deps.entries.listByUser(userId, {})`, `deps.catalog.searchWorks`.
- Produces:
  - `interface PersonWork { workId: string; source: WorkSource; externalId: string; title: string; posterUrl: string | null; type: WorkType; status: EntryStatus; rating: number | null }`
  - `interface DiscoveryWork { source: WorkSource; externalId: string; title: string; posterUrl: string | null; type: WorkType }`
  - `interface PersonProfile { name: string; library: PersonWork[]; discovery: DiscoveryWork[] }`
  - `getPersonProfile(deps: Deps, userId: string, input: { source: "tmdb" | "book"; externalId: number; name: string }): Promise<PersonProfile>`

- [ ] **Step 1: Écrire le test qui échoue**

Create `tests/application/person.test.ts` :

```ts
import { describe, it, expect, beforeEach } from "vitest";
import { makeInMemoryDeps, type Deps } from "@/server/container";
import { FakeCatalog } from "../helpers/fake-catalog";
import { rateOrReviewWork } from "@/server/application/library-entry";
import { getPersonProfile } from "@/server/application/person";

let deps: Deps;
beforeEach(() => { deps = makeInMemoryDeps(new FakeCatalog()); });

describe("getPersonProfile", () => {
  it("liste les œuvres de la personne dans ma bibliothèque", async () => {
    // The Matrix (603) a Keanu Reeves (6384) dans FakeCatalog.
    await rateOrReviewWork(deps, "u1", { source: "tmdb", externalId: "603", type: "movie" }, { rating: 5, text: null, visibility: "public" });
    const p = await getPersonProfile(deps, "u1", { source: "tmdb", externalId: 6384, name: "Keanu Reeves" });
    expect(p.library.map((w) => w.externalId)).toEqual(["603"]);
    expect(p.library[0]?.status).toBe("done");
  });
  it("exclut de la découverte les œuvres déjà possédées", async () => {
    await rateOrReviewWork(deps, "u1", { source: "tmdb", externalId: "603", type: "movie" }, { rating: 5, text: null, visibility: "public" });
    const p = await getPersonProfile(deps, "u1", { source: "tmdb", externalId: 6384, name: "Keanu Reeves" });
    // getPersonCredits(6384) = [603, 1396] ; 603 est possédé → découverte = [1396]
    expect(p.discovery.map((w) => w.externalId)).toEqual(["1396"]);
  });
  it("branche livres : recherche par auteur", async () => {
    const p = await getPersonProfile(deps, "u1", { source: "book", externalId: 99, name: "William Gibson" });
    expect(Array.isArray(p.discovery)).toBe(true); // searchWorks("inauthor:William Gibson","books")
    expect(p.name).toBe("William Gibson");
  });
});
```

- [ ] **Step 2: Lancer le test, vérifier l'échec**

Run: `cd /home/chamberlain/Desktop/Claude/vulu && npx vitest run tests/application/person.test.ts`
Expected: FAIL — `getPersonProfile` introuvable.

- [ ] **Step 3: Implémenter**

Create `src/server/application/person.ts` :

```ts
import type { Deps } from "@/server/container";
import type { EntryStatus, WorkSource, WorkType } from "@/server/domain/entities";

export interface PersonWork {
  workId: string; source: WorkSource; externalId: string; title: string; posterUrl: string | null;
  type: WorkType; status: EntryStatus; rating: number | null;
}
export interface DiscoveryWork {
  source: WorkSource; externalId: string; title: string; posterUrl: string | null; type: WorkType;
}
export interface PersonProfile { name: string; library: PersonWork[]; discovery: DiscoveryWork[] }

export async function getPersonProfile(
  deps: Deps, userId: string, input: { source: "tmdb" | "book"; externalId: number; name: string },
): Promise<PersonProfile> {
  const entries = await deps.entries.listByUser(userId, {});
  const resolved = await Promise.all(entries.map(async (e) => ({ e, w: await deps.works.findById(e.workId) })));
  const library: PersonWork[] = resolved
    .filter(({ w }) => w !== null && w.people.some((p) => p.tmdbId === input.externalId))
    .map(({ e, w }) => ({
      workId: w!.id, source: w!.source, externalId: w!.externalId, title: w!.title,
      posterUrl: w!.posterUrl, type: w!.type, status: e.status, rating: e.rating,
    }));

  const owned = new Set(library.map((x) => x.externalId));
  const credits = input.source === "tmdb"
    ? await deps.catalog.getPersonCredits(String(input.externalId))
    : await deps.catalog.searchWorks(`inauthor:${input.name}`, "books");
  const discovery: DiscoveryWork[] = credits
    .filter((c) => !owned.has(c.externalId))
    .slice(0, 20)
    .map((c) => ({ source: c.source, externalId: c.externalId, title: c.title, posterUrl: c.posterUrl, type: c.type }));

  return { name: input.name, library, discovery };
}
```

- [ ] **Step 4: Lancer le test, vérifier le succès**

Run: `cd /home/chamberlain/Desktop/Claude/vulu && npx vitest run tests/application/person.test.ts && node_modules/.bin/tsc --noEmit`
Expected: PASS, tsc 0.

- [ ] **Step 5: Commit**

```bash
cd /home/chamberlain/Desktop/Claude/vulu
git add src/server/application/person.ts tests/application/person.test.ts
git commit -m "feat(vulu): getPersonProfile — bibliothèque + découverte par personne"
```

---

### Task 4: Page personne `/personne/[id]`

**Files:**
- Create: `src/app/personne/[id]/page.tsx`
- Create: `src/app/personne/[id]/PersonClient.tsx`

**Interfaces:**
- Consumes: `parsePersonId` (Task 1), `getPersonProfile` (Task 3), `POST /api/works/import` (existant).

- [ ] **Step 1: Créer la page serveur**

Create `src/app/personne/[id]/page.tsx` :

```tsx
import { redirect, notFound } from "next/navigation";
import { currentUser } from "@/server/http/session";
import { getDeps } from "@/server/container";
import { getPersonProfile } from "@/server/application/person";
import { parsePersonId } from "@/lib/person";
import { AppShell } from "@/components/AppShell";
import { BackButton } from "@/components/BackButton";
import { PersonClient } from "./PersonClient";

export default async function PersonPage(
  { params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ name?: string }> },
) {
  const user = await currentUser();
  if (!user) redirect("/login");
  const { id } = await params;
  const sp = await searchParams;
  const ref = parsePersonId(id);
  if (!ref || !sp.name) notFound();
  const profile = await getPersonProfile(await getDeps(), user.id, { ...ref, name: sp.name });
  return <AppShell><BackButton fallback="/recherche" /><PersonClient profile={profile} /></AppShell>;
}
```

- [ ] **Step 2: Créer le client**

Create `src/app/personne/[id]/PersonClient.tsx` (le bloc « découverte » importe via le flux existant comme `SearchClient.open`, puis navigue) :

```tsx
"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api-client";
import { toast } from "@/lib/toast";
import type { PersonProfile, PersonWork, DiscoveryWork } from "@/server/application/person";

function PosterLink({ href, title, posterUrl, badge }: { href: string; title: string; posterUrl: string | null; badge?: string }) {
  return (
    <Link href={href} className="w-28 shrink-0">
      <div className="aspect-[2/3] overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-2)]"
        style={posterUrl ? { backgroundImage: `url(${posterUrl})`, backgroundSize: "cover", backgroundPosition: "center" } : undefined} />
      <p className="mt-1.5 line-clamp-2 text-sm font-semibold">{title}</p>
      {badge && <p className="text-xs text-[var(--color-text-muted)]">{badge}</p>}
    </Link>
  );
}

export function PersonClient({ profile }: { profile: PersonProfile }) {
  const router = useRouter();
  const [opening, setOpening] = useState<string | null>(null);

  async function open(d: DiscoveryWork) {
    setOpening(d.externalId);
    try {
      const { work } = await api.post<{ work: { id: string } }>("/api/works/import", { source: d.source, externalId: d.externalId, type: d.type });
      router.push(`/work/${work.id}`);
    } catch { toast("Import impossible", "error"); setOpening(null); }
  }

  const statusLabel = (w: PersonWork) => w.status === "done" ? (w.rating ? `${w.rating.toFixed(1).replace(".", ",")}/5` : "Vu") : w.status === "in_progress" ? "En cours" : "À voir";

  return (
    <>
      <h1 className="mb-1 font-display text-2xl font-bold">{profile.name}</h1>

      <h2 className="mb-3 mt-5 font-display text-lg font-bold">Dans ta bibliothèque</h2>
      {profile.library.length === 0
        ? <p className="text-sm text-[var(--color-text-muted)]">Aucune œuvre de cette personne dans ta bibliothèque.</p>
        : <div className="flex gap-3 overflow-x-auto pb-1">
            {profile.library.map((w) => <PosterLink key={w.workId} href={`/work/${w.workId}`} title={w.title} posterUrl={w.posterUrl} badge={statusLabel(w)} />)}
          </div>}

      {profile.discovery.length > 0 && (
        <>
          <h2 className="mb-3 mt-6 font-display text-lg font-bold">À découvrir</h2>
          <div className="flex gap-3 overflow-x-auto pb-1">
            {profile.discovery.map((d) => (
              <button key={`${d.source}-${d.externalId}`} onClick={() => open(d)} disabled={opening === d.externalId} className="w-28 shrink-0 text-left disabled:opacity-50">
                <div className="aspect-[2/3] overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-2)]"
                  style={d.posterUrl ? { backgroundImage: `url(${d.posterUrl})`, backgroundSize: "cover", backgroundPosition: "center" } : undefined} />
                <p className="mt-1.5 line-clamp-2 text-sm font-semibold">{d.title}</p>
              </button>
            ))}
          </div>
        </>
      )}
    </>
  );
}
```

- [ ] **Step 3: Typecheck**

Run: `cd /home/chamberlain/Desktop/Claude/vulu && node_modules/.bin/tsc --noEmit`
Expected: tsc 0. (Vérifier que `currentUser` et `BackButton` s'importent comme dans `src/app/communaute/[id]/page.tsx`.)

- [ ] **Step 4: Commit**

```bash
cd /home/chamberlain/Desktop/Claude/vulu
git add "src/app/personne/[id]/"
git commit -m "feat(vulu): page personne — bibliothèque + découverte"
```

---

### Task 5: Bibliothèque — peopleIds + personnes distinctes

**Files:**
- Modify: `src/server/application/library.ts`
- Test: `tests/application/library.test.ts`

**Interfaces:**
- Produces:
  - `LibraryPoster.peopleIds: number[]`
  - `Library.people: { id: number; name: string; role: PersonRole }[]` (distinct, trié par nom)

- [ ] **Step 1: Écrire le test qui échoue**

Append to `tests/application/library.test.ts` (lire l'en-tête du fichier pour réutiliser son `beforeEach`/helpers ; il utilise `makeInMemoryDeps(new FakeCatalog())` et `rateOrReviewWork`/`setEntryStatus`). Ajouter :

```ts
import { getLibrary } from "@/server/application/library";

it("expose peopleIds par poster et la liste distincte des personnes", async () => {
  await rateOrReviewWork(deps, "u1", { source: "tmdb", externalId: "603", type: "movie" }, { rating: 5, text: null, visibility: "public" });
  const lib = await getLibrary(deps, "u1");
  const matrix = lib.seen.find((p) => p.title === "The Matrix");
  expect(matrix?.peopleIds).toContain(6384);
  expect(lib.people.some((x) => x.id === 6384 && x.name === "Keanu Reeves")).toBe(true);
});
```

Adapter le nom de la variable `deps` / l'import de `rateOrReviewWork` à ce que le fichier utilise déjà.

- [ ] **Step 2: Lancer le test, vérifier l'échec**

Run: `cd /home/chamberlain/Desktop/Claude/vulu && npx vitest run tests/application/library.test.ts`
Expected: FAIL — `peopleIds`/`people` absents.

- [ ] **Step 3: Implémenter**

Dans `src/server/application/library.ts` :
- Ajouter l'import de type : `import type { LibraryEntry, PersonRole, WorkType } from "@/server/domain/entities";` (ajouter `PersonRole`).
- Étendre `LibraryPoster` : ajouter `peopleIds: number[];`.
- Étendre `Library` : ajouter `people: { id: number; name: string; role: PersonRole }[];`.
- Dans `posters()`, inclure les ids :

```ts
      .map(({ e, w }) => ({ id: e.id, workId: w!.id, title: w!.title, posterUrl: w!.posterUrl, type: w!.type, rating: e.rating, peopleIds: w!.people.map((p) => p.tmdbId) }));
```

- Construire la liste distincte (à partir des œuvres de `watchlist` + `seen`). Remplacer la résolution actuelle pour récupérer aussi les `people`. Le plus simple : après avoir calculé `watchlist` et `seen`, recharger les personnes via un passage sur les œuvres possédées. Ajouter, avant le `return` :

```ts
  const ownedWorkIds = new Set([...watchlist, ...seen].map((p) => p.workId));
  const peopleMap = new Map<number, { id: number; name: string; role: PersonRole }>();
  for (const id of ownedWorkIds) {
    const w = await deps.works.findById(id);
    for (const p of w?.people ?? []) if (!peopleMap.has(p.tmdbId)) peopleMap.set(p.tmdbId, { id: p.tmdbId, name: p.name, role: p.role });
  }
  const people = [...peopleMap.values()].sort((a, b) => a.name.localeCompare(b.name));
```

- Mettre `people` dans l'objet retourné : `return { playlists, watchlist, seen, people };`.

- [ ] **Step 4: Lancer le test + typecheck**

Run: `cd /home/chamberlain/Desktop/Claude/vulu && npx vitest run tests/application/library.test.ts && node_modules/.bin/tsc --noEmit`
Expected: PASS, tsc 0.

- [ ] **Step 5: Commit**

```bash
cd /home/chamberlain/Desktop/Claude/vulu
git add src/server/application/library.ts tests/application/library.test.ts
git commit -m "feat(vulu): bibliothèque — peopleIds par œuvre + personnes distinctes"
```

---

### Task 6: Bibliothèque — filtre par personne (UI)

**Files:**
- Modify: `src/app/bibliotheque/LibraryClient.tsx`

**Interfaces:**
- Consumes: `Library.people`, `LibraryPoster.peopleIds` (Task 5), `personHref` (Task 1).

- [ ] **Step 1: Lire le composant**

Lire `src/app/bibliotheque/LibraryClient.tsx` pour repérer : le type local de `data` (doit inclure `people` + `peopleIds` désormais — les types viennent de `getLibrary` via l'API), l'état `filter` (type) et l'application `match`/`watchlist`/`seen`.

- [ ] **Step 2: Ajouter l'état + le filtrage personne**

Dans `LibraryClient.tsx` :
- Ajouter un état : `const [person, setPerson] = useState<number | null>(null);`
- Étendre le filtrage : une œuvre passe si elle respecte le filtre type **et** (`person === null || x.peopleIds.includes(person)`). Modifier les lignes `watchlist`/`seen` :

```tsx
  const matchPerson = (ids: number[]) => person === null || ids.includes(person);
  const watchlist = data.watchlist.filter((x) => match(x.type) && matchPerson(x.peopleIds));
  const seen = data.seen.filter((x) => match(x.type) && matchPerson(x.peopleIds));
```

- Ajouter un sélecteur sous/à côté du filtre type (`data.people` peut être long → `<select>` simple) :

```tsx
  {data.people.length > 0 && (
    <select value={person ?? ""} onChange={(e) => setPerson(e.target.value ? Number(e.target.value) : null)}
      className="rounded-full border border-[var(--color-border)] bg-[var(--color-bg)] px-4 py-1.5 text-sm">
      <option value="">Toutes les personnes</option>
      {data.people.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
    </select>
  )}
```

- Sous le sélecteur, quand une personne est choisie, un lien vers sa page (déduire la source du rôle de la personne dans `data.people`) :

```tsx
  {person !== null && (() => {
    const p = data.people.find((x) => x.id === person);
    return p ? <Link href={personHref({ tmdbId: p.id, name: p.name }, p.role === "author" ? "book" : "tmdb")} className="text-sm font-semibold text-[var(--color-primary)]">Voir la page de {p.name}</Link> : null;
  })()}
```

- Importer en tête : `import Link from "next/link";` et `import { personHref } from "@/lib/person";` (si absents).

- [ ] **Step 3: Typecheck**

Run: `cd /home/chamberlain/Desktop/Claude/vulu && node_modules/.bin/tsc --noEmit`
Expected: tsc 0. Si le type local de `data` est déclaré en dur dans le fichier, y ajouter `people` et `peopleIds`.

- [ ] **Step 4: Commit**

```bash
cd /home/chamberlain/Desktop/Claude/vulu
git add src/app/bibliotheque/LibraryClient.tsx
git commit -m "feat(vulu): bibliothèque — filtre par personne + lien vers la page personne"
```

---

### Task 7: Noms cliquables (fiche œuvre + favoris)

**Files:**
- Modify: `src/app/work/[id]/page.tsx`
- Modify: `src/components/TasteSelector.tsx`

**Interfaces:**
- Consumes: `personHref` (Task 1).

- [ ] **Step 1: Fiche œuvre — section personnes cliquables**

Dans `src/app/work/[id]/page.tsx` :
- Importer : `import Link from "next/link";` et `import { personHref } from "@/lib/person";` (en tête).
- Après le bloc « Où regarder » (fin du `{work.watchProviders.length > 0 && (...)}`), ajouter une section listant `work.people` en liens. `source` = `work.type === "book" ? "book" : "tmdb"`. Insérer :

```tsx
        {work.people.length > 0 && (
          <div className="px-5 pb-5">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">Équipe & casting</p>
            <div className="flex flex-wrap gap-2">
              {work.people.map((p) => (
                <Link key={`${p.role}-${p.tmdbId}`} href={personHref({ tmdbId: p.tmdbId, name: p.name }, work.type === "book" ? "book" : "tmdb")}
                  className="rounded-full border border-[var(--color-border)] px-3 py-1 text-xs font-medium hover:border-[var(--color-primary)] hover:text-[var(--color-primary)]">
                  {p.name}
                </Link>
              ))}
            </div>
          </div>
        )}
```

(Vérifier que `work.people` est disponible dans ce composant — `deps.works.findById` renvoie le `Work` complet, donc oui.)

- [ ] **Step 2: Favoris cliquables (TasteSelector)**

Dans `src/components/TasteSelector.tsx`, au rendu des personnes favorites (`value.people.map(...)`, vers la ligne 88), ajouter un petit lien « ↗ » à côté de la croix de suppression, ouvrant la page personne dans un nouvel onglet (ne pas transformer le bouton de suppression en lien). Remplacer le contenu du chip :

```tsx
                  {p.name}
                  <a href={personHref({ tmdbId: p.tmdbId, name: p.name }, p.role === "author" ? "book" : "tmdb")} target="_blank" rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()} className="text-xs underline">↗</a>
                  <span className="text-xs">✕</span>
```

- Importer en tête de `TasteSelector.tsx` : `import { personHref } from "@/lib/person";`.

- [ ] **Step 3: Typecheck**

Run: `cd /home/chamberlain/Desktop/Claude/vulu && node_modules/.bin/tsc --noEmit`
Expected: tsc 0.

- [ ] **Step 4: Commit**

```bash
cd /home/chamberlain/Desktop/Claude/vulu
git add "src/app/work/[id]/page.tsx" src/components/TasteSelector.tsx
git commit -m "feat(vulu): noms de personnes cliquables (fiche œuvre + favoris)"
```

---

### Task 8: Vérification end-to-end + roadmap

**Files:**
- Modify: `docs/superpowers/ROADMAP.md`

- [ ] **Step 1: Suite complète + typecheck**

Run: `cd /home/chamberlain/Desktop/Claude/vulu && node_modules/.bin/tsc --noEmit && npx vitest run`
Expected: tsc 0, tous les tests verts.

- [ ] **Step 2: Vérification live**

S'assurer que le serveur dev tourne (`curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/api/me` → 401/200 ; sinon `MONGODB_URI="mongodb://127.0.0.1:43793/" npm run dev` en arrière-plan). Avec un cookie de session démo (login `demo@vulu.app` / `password1`) :
- Ouvrir une fiche film (ex. `/work/w-matrix`) → vérifier la présence de la section « Équipe & casting » avec des liens.
- Suivre un lien → `/personne/tmdb-<id>?name=...` rend « Dans ta bibliothèque » + « À découvrir » (200).
- `GET /api/library` (ou la page `/bibliotheque`) → le `select` « Toutes les personnes » apparaît ; choisir une personne filtre la grille.

- [ ] **Step 3: ROADMAP + commit**

Marquer dans `docs/superpowers/ROADMAP.md` le point « SP3 — Filtres par personne » comme livré (page personne + filtre biblio + découverte catalogue + noms cliquables fiche/favoris). Puis :

```bash
cd /home/chamberlain/Desktop/Claude/vulu
git add docs/superpowers/ROADMAP.md
git commit -m "docs(vulu): roadmap — exploration par personne livrée"
```

---

## Notes de cohérence (raffinements du spec)

- **Découverte livres** : faute d'auteurs dans `WorkSummary` et de `authorId` exporté, la
  découverte livre utilise `searchWorks("inauthor:<nom>", "books")` (filtre par requête,
  pas par hash). Suffisant et plus simple.
- **`personHref` sans rôle** : le rôle n'est qu'un libellé d'affichage ; il n'est pas encodé
  dans l'URL. La page personne affiche le nom (et les œuvres), pas un rôle global.
- **Fiche œuvre** : aujourd'hui le casting n'était pas rendu (seuls les réalisateurs en
  sous-titre) ; la Task 7 ajoute une vraie section « Équipe & casting » cliquable.
- **Feed** : aucun nom rendu → hors périmètre (conforme au spec).
