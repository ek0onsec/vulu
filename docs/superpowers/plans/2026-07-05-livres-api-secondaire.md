# Livres : API secondaire (Open Library) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Combler les couvertures de livres manquantes et les ISBN non reconnus par Google Books via un repli ciblé sur Open Library.

**Architecture:** Nouvel adaptateur `OpenLibraryBooks` (secondaire). `GoogleBooksCatalog` reçoit ce secondaire et l'utilise pour la couverture de repli (dans `getWork`, donc mise en cache) et l'ISBN de repli (dans `findByIsbn`, en repassant par une recherche titre Google pour garder `source="googlebooks"`). Tout appel Open Library est résilient.

**Tech Stack:** Next.js (version custom — lire `node_modules/next/dist/docs/`), TypeScript strict, Vitest, Zod (env).

## Global Constraints

- **Typage strict sans `any`** ; accès indexés sécurisés.
- **Repli ciblé** : Open Library uniquement pour couverture manquante + ISBN introuvable. Pas de nouveau `WorkSource`.
- **Résilience** : tout appel Open Library en `try/catch` → comportement actuel si échec.
- Config externalisée : `OPENLIBRARY_BASE_URL` (défaut `https://openlibrary.org`, sans clé).
- Tests : `npm test` ; typecheck `npx tsc --noEmit` ; build `npm run build`.

---

### Task 1: Adaptateur `OpenLibraryBooks`

**Files:**
- Create: `src/server/adapters/catalog/open-library.ts`
- Test: `tests/adapters/open-library.test.ts`

**Interfaces:**
- Produces:
  - `interface OpenLibraryBook { title: string; authors: string[]; coverUrl: string | null }`
  - `class OpenLibraryBooks { constructor(cfg: { baseUrl: string }, fetchImpl?: typeof fetch); lookupIsbn(isbn: string): Promise<OpenLibraryBook | null>; coverByIsbn(isbn: string): Promise<string | null> }`

- [ ] **Step 1: Test (rouge)**

Créer `tests/adapters/open-library.test.ts` :

```ts
import { describe, it, expect } from "vitest";
import { OpenLibraryBooks } from "@/server/adapters/catalog/open-library";

function fakeFetch(ok: boolean, body: unknown): typeof fetch {
  return (async () => ({ ok, json: async () => body }) as Response) as typeof fetch;
}

const cfg = { baseUrl: "https://openlibrary.org" };

describe("OpenLibraryBooks", () => {
  it("lookupIsbn parse titre, auteurs et couverture", async () => {
    const ol = new OpenLibraryBooks(cfg, fakeFetch(true, {
      "ISBN:9782207116210": { title: "La Route", authors: [{ name: "Cormac McCarthy" }], cover: { large: "https://covers/l.jpg", medium: "https://covers/m.jpg" } },
    }));
    const b = await ol.lookupIsbn("9782207116210");
    expect(b).toEqual({ title: "La Route", authors: ["Cormac McCarthy"], coverUrl: "https://covers/l.jpg" });
    expect(await ol.coverByIsbn("9782207116210")).toBe("https://covers/l.jpg");
  });
  it("renvoie null si l'ISBN est absent de la réponse", async () => {
    const ol = new OpenLibraryBooks(cfg, fakeFetch(true, {}));
    expect(await ol.lookupIsbn("0000000000000")).toBeNull();
  });
  it("renvoie null sur erreur HTTP", async () => {
    const ol = new OpenLibraryBooks(cfg, fakeFetch(false, {}));
    expect(await ol.lookupIsbn("123")).toBeNull();
  });
  it("couverture nulle si absente", async () => {
    const ol = new OpenLibraryBooks(cfg, fakeFetch(true, { "ISBN:1": { title: "X", authors: [], cover: {} } }));
    expect((await ol.lookupIsbn("1"))?.coverUrl).toBeNull();
  });
});
```

- [ ] **Step 2: Lancer, vérifier l'échec**

Run: `npm test -- open-library`
Expected: FAIL — module inexistant.

- [ ] **Step 3: Implémenter**

Créer `src/server/adapters/catalog/open-library.ts` :

```ts
export interface OpenLibraryConfig { baseUrl: string }
export interface OpenLibraryBook { title: string; authors: string[]; coverUrl: string | null }

interface OlVolume {
  title?: string;
  authors?: { name?: string }[];
  cover?: { large?: string; medium?: string; small?: string };
}

export class OpenLibraryBooks {
  constructor(private cfg: OpenLibraryConfig, private fetchImpl: typeof fetch = fetch) {}

  async lookupIsbn(isbn: string): Promise<OpenLibraryBook | null> {
    try {
      const url = new URL(`${this.cfg.baseUrl}/api/books`);
      url.searchParams.set("bibkeys", `ISBN:${isbn}`);
      url.searchParams.set("format", "json");
      url.searchParams.set("jscmd", "data");
      const res = await this.fetchImpl(url.toString());
      if (!res.ok) return null;
      const data = (await res.json()) as Record<string, OlVolume>;
      const v = data[`ISBN:${isbn}`];
      if (!v || !v.title) return null;
      const cover = v.cover ?? {};
      return {
        title: v.title,
        authors: (v.authors ?? []).map((a) => a.name).filter((n): n is string => Boolean(n)),
        coverUrl: cover.large ?? cover.medium ?? cover.small ?? null,
      };
    } catch { return null; }
  }

  async coverByIsbn(isbn: string): Promise<string | null> {
    const book = await this.lookupIsbn(isbn);
    return book?.coverUrl ?? null;
  }
}
```

- [ ] **Step 4: Lancer, vérifier le succès**

Run: `npm test -- open-library`
Expected: PASS (4 cas).

- [ ] **Step 5: Commit**

```bash
git add src/server/adapters/catalog/open-library.ts tests/adapters/open-library.test.ts
git commit -m "feat(vulu): adaptateur OpenLibraryBooks (lookupIsbn + coverByIsbn, résilient)"
```

---

### Task 2: `GoogleBooksCatalog` — repli couverture + ISBN

**Files:**
- Modify: `src/server/adapters/catalog/google-books-catalog.ts`
- Test: `tests/adapters/google-books-catalog.test.ts`

**Interfaces:**
- Consumes: `OpenLibraryBooks` (Task 1) via une interface structurelle `SecondaryBooks`.
- Produces: `GoogleBooksCatalog` constructeur à 3e argument optionnel `secondary?: SecondaryBooks`.

- [ ] **Step 1: Tests (rouge)**

Ajouter à `tests/adapters/google-books-catalog.test.ts`, dans le `describe("GoogleBooksCatalog", …)` :

```ts
  const fakeSecondary = (over: Partial<{ title: string; authors: string[]; coverUrl: string | null }> = {}) => ({
    lookupIsbn: async () => ({ title: "La Route", authors: ["Cormac McCarthy"], coverUrl: "https://ol/cover.jpg", ...over }),
    coverByIsbn: async () => over.coverUrl ?? "https://ol/cover.jpg",
  });

  it("getWork : couverture de repli Open Library quand Google n'en a pas", async () => {
    const c = new GoogleBooksCatalog(cfg, fakeFetch({
      "/volumes/BK1": { id: "BK1", volumeInfo: { title: "La Route", industryIdentifiers: [{ type: "ISBN_13", identifier: "9782207116210" }] } },
    }), fakeSecondary());
    const w = await c.getWork("BK1");
    expect(w?.posterUrl).toBe("https://ol/cover.jpg");
  });

  it("findByIsbn : repli Open Library → recherche titre Google", async () => {
    const c = new GoogleBooksCatalog(cfg, fakeFetch({
      "q=isbn:9782207116210": { items: [] }, // Google ne trouve pas par ISBN
      "q=La+Route": { items: [{ id: "BK1", volumeInfo: { title: "La Route" } }] }, // mais trouve par titre
    }), fakeSecondary());
    const r = await c.findByIsbn("9782207116210");
    expect(r?.externalId).toBe("BK1");
    expect(r?.posterUrl).toBe("https://ol/cover.jpg"); // couverture complétée depuis Open Library
  });

  it("sans secondary : comportement inchangé (couverture nulle, ISBN nul)", async () => {
    const c = new GoogleBooksCatalog(cfg, fakeFetch({ "q=isbn:0": { items: [] } }));
    expect(await c.findByIsbn("0")).toBeNull();
  });
```

Note : `fakeFetch` matche par `u.includes(key)` ; les clés `q=isbn:…`, `q=La+Route`, `/volumes/BK1` distinguent bien les routes (`URLSearchParams` encode l'espace en `+` et `:` reste littéral).

- [ ] **Step 2: Lancer, vérifier l'échec**

Run: `npm test -- google-books-catalog`
Expected: FAIL — 3e argument non géré / repli absent.

- [ ] **Step 3: Type de dépendance + ISBN helper**

Dans `src/server/adapters/catalog/google-books-catalog.ts` :
- ajouter au `volumeInfo` de l'interface `Volume` : `industryIdentifiers?: { type: string; identifier: string }[];`
- ajouter, avant la classe :

```ts
interface SecondaryBooks {
  lookupIsbn(isbn: string): Promise<{ title: string; authors: string[]; coverUrl: string | null } | null>;
  coverByIsbn(isbn: string): Promise<string | null>;
}

function isbnOf(info: Volume["volumeInfo"]): string | null {
  const ids = info?.industryIdentifiers ?? [];
  return ids.find((i) => i.type === "ISBN_13")?.identifier
    ?? ids.find((i) => i.type === "ISBN_10")?.identifier
    ?? null;
}
```

- [ ] **Step 4: Constructeur + repli couverture dans `getWork`**

Modifier le constructeur :

```ts
  constructor(private cfg: GoogleBooksConfig, private fetchImpl: typeof fetch = fetch, private secondary?: SecondaryBooks) {}
```

Dans `getWork`, remplacer le `return { … }` final par la construction d'un objet
puis un repli couverture avant de le renvoyer :

```ts
    const details: WorkDetails = {
      source: "googlebooks",
      externalId: v.id,
      type: "book",
      title: info.title ?? "Sans titre",
      year: yearOf(info.publishedDate),
      posterUrl: cover(info),
      backdropUrl: null,
      overview: info.description ?? null,
      genres: info.categories ?? [],
      people: (info.authors ?? []).map((name) => ({ tmdbId: authorId(name), name, role: "author" as const })),
      externalRating: null,
      watchProviders: [],
      episodeCounts: null,
      pageCount: typeof info.pageCount === "number" && info.pageCount > 0 ? info.pageCount : null,
    };
    if (details.posterUrl === null && this.secondary) {
      const isbn = isbnOf(info);
      if (isbn) {
        try { const url = await this.secondary.coverByIsbn(isbn); if (url) details.posterUrl = url; } catch { /* repli silencieux */ }
      }
    }
    return details;
```

- [ ] **Step 5: Repli ISBN dans `findByIsbn`**

Remplacer `findByIsbn` :

```ts
  async findByIsbn(isbn: string): Promise<WorkSummary | null> {
    const data = await this.get<{ items?: Volume[] }>("/volumes", { q: `isbn:${isbn}`, maxResults: "1" });
    const v = data.items?.[0];
    if (v) return this.toSummary(v);
    if (!this.secondary) return null;
    let ol: { title: string; authors: string[]; coverUrl: string | null } | null = null;
    try { ol = await this.secondary.lookupIsbn(isbn); } catch { ol = null; }
    if (!ol) return null;
    const byTitle = await this.searchWorks(ol.title);
    const match = byTitle[0];
    if (!match) return null;
    return match.posterUrl ? match : { ...match, posterUrl: ol.coverUrl };
  }
```

- [ ] **Step 6: Lancer, vérifier le succès + suite**

Run: `npm test -- google-books-catalog`
Expected: PASS.
Run: `npm test` → PASS ; `npx tsc --noEmit` → aucune erreur.

- [ ] **Step 7: Commit**

```bash
git add src/server/adapters/catalog/google-books-catalog.ts tests/adapters/google-books-catalog.test.ts
git commit -m "feat(vulu): GoogleBooksCatalog — repli couverture + ISBN via Open Library"
```

---

### Task 3: Config & câblage

**Files:**
- Modify: `src/lib/env.ts`
- Modify: `src/server/container.ts`

**Interfaces:**
- Consumes: `OpenLibraryBooks` (Task 1), `GoogleBooksCatalog` 3e arg (Task 2).

- [ ] **Step 1: Variable d'environnement**

Dans `src/lib/env.ts`, ajouter après `GOOGLE_BOOKS_API_KEY` :

```ts
  OPENLIBRARY_BASE_URL: z.url().default("https://openlibrary.org"),
```

- [ ] **Step 2: Câblage container**

Dans `src/server/container.ts` :
- ajouter l'import : `import { OpenLibraryBooks } from "@/server/adapters/catalog/open-library";`
- remplacer l'instanciation Google Books dans `getDeps` :

```ts
      new GoogleBooksCatalog(
        { baseUrl: env.GOOGLE_BOOKS_BASE_URL, apiKey: env.GOOGLE_BOOKS_API_KEY },
        fetch,
        new OpenLibraryBooks({ baseUrl: env.OPENLIBRARY_BASE_URL }),
      ),
```

- [ ] **Step 3: Typecheck + build**

Run: `npx tsc --noEmit` → aucune erreur.
Run: `npm run build` → build réussi.

- [ ] **Step 4: Commit**

```bash
git add src/lib/env.ts src/server/container.ts
git commit -m "chore(vulu): câblage Open Library comme secondaire des livres"
```

---

## Self-Review

**Spec coverage :**
- `OpenLibraryBooks` (`lookupIsbn`/`coverByIsbn`, résilient) → Task 1 ✓
- Repli couverture dans `getWork` (mis en cache) → Task 2 Step 4 ✓
- Repli ISBN dans `findByIsbn` (Open Library → titre → recherche Google) → Task 2 Step 5 ✓
- `industryIdentifiers` + `isbnOf` → Task 2 Step 3 ✓
- Non-régression sans secondary → Task 2 Step 1 ✓
- Env `OPENLIBRARY_BASE_URL` + câblage → Task 3 ✓
- Tests parsing / cover / ISBN → Tasks 1-2 ✓

**Placeholder scan :** aucun TBD/TODO ; code complet.

**Type consistency :** `OpenLibraryBook`/`OpenLibraryBooks` (Task 1) ⇔ `SecondaryBooks` structurel (Task 2) ⇔ câblage `new OpenLibraryBooks(...)` (Task 3). `GoogleBooksCatalog(cfg, fetch, secondary?)` cohérent entre Task 2 et Task 3. `isbnOf(info)`/`industryIdentifiers` internes à Task 2.
