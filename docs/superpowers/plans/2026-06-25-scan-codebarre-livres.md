# Scan de code-barres pour ajouter des livres — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Scanner le code-barres (EAN-13/ISBN) d'un livre avec la caméra pour ouvrir sa fiche et l'ajouter à une liste, depuis la recherche.

**Architecture:** Hexagonal. Nouveau `CatalogProvider.findByIsbn` (adaptateur Google Books) → application `findBookByIsbn` (validation ISBN) → route `GET /api/catalog/isbn`. Côté client, un `BookScanner` (ZXing, import dynamique) lit l'EAN-13 ; la résolution réutilise le flux existant `import → /work/{id}`.

**Tech Stack:** TypeScript strict, Next.js 16 (client + route handlers), Vitest, Google Books, `@zxing/browser` (scanner, lazy).

## Global Constraints

- Réservé aux **livres** : le bouton scan n'apparaît que quand le domaine actif de la recherche est Livres.
- Le scan **résout un ISBN → fiche `/work/{id}`** (réutilise `open()`/`/api/works/import`) ; aucune nouvelle UI d'ajout à une liste.
- ISBN normalisé (retirer non-chiffres, garder `X` final), longueur valide **10 ou 13** ; sinon `null` **sans appel réseau**.
- Scan restreint au format **EAN-13**, accepté seulement si 13 chiffres préfixe `978`/`979`.
- Icône : `<Icon name="camera" />` (glyphe SVG existant dans `Icon.tsx`) — **jamais d'emoji**.
- Dépendance `@zxing/browser` chargée en **import dynamique** (hors bundle principal).
- Toute dépendance externe derrière un port ; aucune logique métier dans les adaptateurs/handlers (CLAUDE.md).

---

### Task 1: Port `findByIsbn` + adaptateurs (Google Books, composite, fake)

**Files:**
- Modify: `src/server/ports/catalog.ts` (interface `CatalogProvider`)
- Modify: `src/server/adapters/catalog/google-books-catalog.ts`
- Modify: `src/server/adapters/catalog/composite-catalog.ts`
- Modify: `tests/helpers/fake-catalog.ts`
- Test: `tests/adapters/google-books-catalog.test.ts`

**Interfaces:**
- Consumes: `WorkSummary` (`{ source, externalId, type, title, year, posterUrl }`), méthodes privées `get`/`toSummary` de `GoogleBooksCatalog`.
- Produces: `CatalogProvider.findByIsbn(isbn: string): Promise<WorkSummary | null>` implémenté par les 3 adaptateurs. `FakeCatalog.findByIsbn` renvoie le livre `book-1` pour l'ISBN `9780441569595`, `null` sinon.

> Note : `CatalogProvider` est implémenté par `GoogleBooksCatalog` (via composite), `CompositeCatalog` ET `FakeCatalog`. Ajouter la méthode aux **trois** dans cette task pour garder `tsc` vert.

- [ ] **Step 1: Write the failing adapter test**

Ajouter dans `tests/adapters/google-books-catalog.test.ts`, à la fin du `describe("GoogleBooksCatalog", …)` :

```ts
  it("findByIsbn renvoie le premier volume", async () => {
    const c = new GoogleBooksCatalog(cfg, fakeFetch({
      "/volumes": { items: [{ id: "xyz", volumeInfo: { title: "Dune", publishedDate: "1965" } }] },
    }));
    const r = await c.findByIsbn("9780441569595");
    expect(r).toMatchObject({ source: "googlebooks", type: "book", title: "Dune", externalId: "xyz" });
  });
  it("findByIsbn renvoie null si aucun volume", async () => {
    const c = new GoogleBooksCatalog(cfg, fakeFetch({ "/volumes": {} }));
    expect(await c.findByIsbn("0000000000000")).toBeNull();
  });
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run tests/adapters/google-books-catalog.test.ts`
Expected: FAIL — `findByIsbn` n'existe pas sur `GoogleBooksCatalog`.

- [ ] **Step 3: Add the port method**

Dans `src/server/ports/catalog.ts`, ajouter à l'interface `CatalogProvider` (après `getWork`) :

```ts
  findByIsbn(isbn: string): Promise<WorkSummary | null>;
```

- [ ] **Step 4: Implement in GoogleBooksCatalog**

Dans `src/server/adapters/catalog/google-books-catalog.ts`, classe `GoogleBooksCatalog`, ajouter (à côté de `searchWorks`) :

```ts
  async findByIsbn(isbn: string): Promise<WorkSummary | null> {
    const data = await this.get<{ items?: Volume[] }>("/volumes", { q: `isbn:${isbn}`, maxResults: "1" });
    const v = data.items?.[0];
    return v ? this.toSummary(v) : null;
  }
```

- [ ] **Step 5: Delegate in CompositeCatalog**

Dans `src/server/adapters/catalog/composite-catalog.ts`, classe `CompositeCatalog`, ajouter (après `getWork`) :

```ts
  findByIsbn(isbn: string): Promise<WorkSummary | null> {
    return this.books.findByIsbn(isbn);
  }
```

- [ ] **Step 6: Implement in FakeCatalog**

Dans `tests/helpers/fake-catalog.ts`, classe `FakeCatalog`, ajouter (après `getWork`) :

```ts
  async findByIsbn(isbn: string): Promise<WorkSummary | null> {
    if (isbn !== "9780441569595") return null;
    const w = this.works["book-1"]!;
    return { source: w.source, externalId: w.externalId, type: w.type, title: w.title, year: w.year, posterUrl: w.posterUrl };
  }
```

- [ ] **Step 7: Run tests + typecheck**

Run: `npx vitest run tests/adapters/google-books-catalog.test.ts && npx tsc --noEmit`
Expected: tests PASS ; aucune erreur de type (les 3 implémenteurs satisfont l'interface).

- [ ] **Step 8: Commit**

```bash
git add src/server/ports/catalog.ts src/server/adapters/catalog/google-books-catalog.ts src/server/adapters/catalog/composite-catalog.ts tests/helpers/fake-catalog.ts tests/adapters/google-books-catalog.test.ts
git commit -m "feat(vulu): catalogue findByIsbn (Google Books)"
```

---

### Task 2: Application `findBookByIsbn` + route + zod

**Files:**
- Create: `src/server/application/find-book-by-isbn.ts`
- Create: `src/app/api/catalog/isbn/route.ts`
- Modify: `src/lib/zod-schemas.ts`
- Test: `tests/application/find-book-by-isbn.test.ts`

**Interfaces:**
- Consumes: `deps.catalog.findByIsbn` (Task 1), `Deps` (`@/server/container`), `WorkSummary`.
- Produces: `findBookByIsbn(deps: Deps, rawIsbn: string): Promise<WorkSummary | null>` ; route `GET /api/catalog/isbn?isbn=…` → `{ result: WorkSummary | null }` ; `isbnSchema`.

- [ ] **Step 1: Write the failing application test**

Créer `tests/application/find-book-by-isbn.test.ts` :

```ts
import { describe, it, expect, beforeEach, vi } from "vitest";
import { makeInMemoryDeps, type Deps } from "@/server/container";
import { FakeCatalog } from "../helpers/fake-catalog";
import { findBookByIsbn } from "@/server/application/find-book-by-isbn";

let deps: Deps;
beforeEach(() => { deps = makeInMemoryDeps(new FakeCatalog()); });

describe("findBookByIsbn", () => {
  it("ISBN valide (avec tirets) → summary, tirets normalisés", async () => {
    const r = await findBookByIsbn(deps, "978-0-441-56959-5");
    expect(r).toMatchObject({ source: "googlebooks", type: "book", externalId: "book-1" });
  });
  it("chaîne non-ISBN → null sans appeler le catalogue", async () => {
    const spy = vi.spyOn(deps.catalog, "findByIsbn");
    expect(await findBookByIsbn(deps, "abc")).toBeNull();
    expect(spy).not.toHaveBeenCalled();
  });
  it("ISBN inconnu → null", async () => {
    expect(await findBookByIsbn(deps, "9781234567897")).toBeNull();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run tests/application/find-book-by-isbn.test.ts`
Expected: FAIL — module `find-book-by-isbn` introuvable.

- [ ] **Step 3: Implement the application function**

Créer `src/server/application/find-book-by-isbn.ts` :

```ts
import type { Deps } from "@/server/container";
import type { WorkSummary } from "@/server/ports/catalog";

/**
 * Résout un code-barres/ISBN de livre en WorkSummary via le catalogue.
 * Normalise (retire tout sauf chiffres et X final), valide la longueur (10 ou 13)
 * et n'interroge le catalogue que pour un ISBN plausible.
 */
export async function findBookByIsbn(deps: Deps, rawIsbn: string): Promise<WorkSummary | null> {
  const isbn = rawIsbn.replace(/[^0-9Xx]/g, "").toUpperCase();
  if (isbn.length !== 10 && isbn.length !== 13) return null;
  return deps.catalog.findByIsbn(isbn);
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run tests/application/find-book-by-isbn.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Add the zod schema**

Dans `src/lib/zod-schemas.ts`, ajouter (près des autres schémas) :

```ts
export const isbnSchema = z.object({ isbn: z.string().min(10).max(20) });
```

- [ ] **Step 6: Test the schema**

Ajouter dans `tests/lib/zod-schemas.test.ts` (importer `isbnSchema` depuis `@/lib/zod-schemas` si l'import groupé ne l'inclut pas déjà) :

```ts
import { isbnSchema } from "@/lib/zod-schemas";

describe("isbnSchema", () => {
  it("accepte une chaîne 10–20, rejette trop court", () => {
    expect(isbnSchema.parse({ isbn: "9780441569595" }).isbn).toBe("9780441569595");
    expect(() => isbnSchema.parse({ isbn: "123" })).toThrow();
  });
});
```

Run: `npx vitest run tests/lib/zod-schemas.test.ts`
Expected: PASS.

- [ ] **Step 7: Create the route**

Créer `src/app/api/catalog/isbn/route.ts` :

```ts
import { getDeps } from "@/server/container";
import { findBookByIsbn } from "@/server/application/find-book-by-isbn";
import { isbnSchema } from "@/lib/zod-schemas";
import { requireUser, json } from "@/server/http/session";
import { toErrorResponse } from "@/server/http/errors";

export async function GET(req: Request) {
  try {
    await requireUser();
    const { isbn } = isbnSchema.parse({ isbn: new URL(req.url).searchParams.get("isbn") ?? "" });
    const result = await findBookByIsbn(await getDeps(), isbn);
    return json({ result });
  } catch (e) { return toErrorResponse(e); }
}
```

- [ ] **Step 8: Typecheck + commit**

Run: `npx tsc --noEmit`
Expected: aucune erreur.

```bash
git add src/server/application/find-book-by-isbn.ts src/app/api/catalog/isbn/route.ts src/lib/zod-schemas.ts tests/application/find-book-by-isbn.test.ts tests/lib/zod-schemas.test.ts
git commit -m "feat(vulu): résolution ISBN — application + route /api/catalog/isbn"
```

---

### Task 3: Composant `BookScanner` (ZXing, lazy)

**Files:**
- Modify: `package.json` (dépendance `@zxing/browser`)
- Create: `src/components/BookScanner.tsx`

**Interfaces:**
- Consumes: `Icon` (`@/components/Icon`, glyphes `camera`/`back`), `@zxing/browser` + `@zxing/library` (import dynamique).
- Produces: `BookScanner({ onIsbn: (isbn: string) => void; onClose: () => void })` — overlay caméra qui appelle `onIsbn` au premier EAN-13 valide.

- [ ] **Step 1: Install the dependency**

Run: `npm install @zxing/browser`
Expected: ajoute `@zxing/browser` (et `@zxing/library` transitif) à `package.json` / lockfile.

- [ ] **Step 2: Create the component**

Créer `src/components/BookScanner.tsx` :

```tsx
"use client";
import { useEffect, useRef, useState } from "react";
import { Icon } from "./Icon";

/** Overlay caméra : lit un EAN-13 (ISBN) et appelle onIsbn. ZXing chargé en lazy. */
export function BookScanner({ onIsbn, onClose }: { onIsbn: (isbn: string) => void; onClose: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const onIsbnRef = useRef(onIsbn);
  onIsbnRef.current = onIsbn;
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let controls: { stop: () => void } | null = null;
    let cancelled = false;
    (async () => {
      try {
        const [{ BrowserMultiFormatReader }, { DecodeHintType, BarcodeFormat }] = await Promise.all([
          import("@zxing/browser"),
          import("@zxing/library"),
        ]);
        const hints = new Map();
        hints.set(DecodeHintType.POSSIBLE_FORMATS, [BarcodeFormat.EAN_13]);
        const reader = new BrowserMultiFormatReader(hints);
        if (cancelled || !videoRef.current) return;
        controls = await reader.decodeFromVideoDevice(undefined, videoRef.current, (result, _err, ctrl) => {
          if (!result) return;
          const text = result.getText();
          if (/^(978|979)\d{10}$/.test(text)) {
            ctrl.stop();
            onIsbnRef.current(text);
          }
        });
      } catch (e) {
        const name = (e as { name?: string })?.name;
        setError(
          name === "NotAllowedError" ? "Accès à la caméra refusé."
            : name === "NotFoundError" ? "Aucune caméra détectée."
              : "Impossible d'ouvrir la caméra.",
        );
      }
    })();
    return () => { cancelled = true; controls?.stop(); };
  }, []);

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-black">
      <div className="flex items-center justify-between px-3 py-2 text-white">
        <span className="font-semibold">Scanner un livre</span>
        <button onClick={onClose} aria-label="Fermer" className="rounded-full p-2 hover:bg-white/10"><Icon name="back" size={22} /></button>
      </div>
      <div className="relative flex-1">
        <video ref={videoRef} className="h-full w-full object-cover" muted playsInline />
        {!error && <div className="pointer-events-none absolute left-1/2 top-1/2 h-28 w-64 -translate-x-1/2 -translate-y-1/2 rounded-xl border-2 border-white/80" />}
        {error && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center text-white">
            <p>{error}</p>
            <button onClick={onClose} className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-black">Utiliser la recherche</button>
          </div>
        )}
      </div>
      {!error && <p className="px-4 py-3 text-center text-sm text-white/70">Vise le code-barres au dos du livre.</p>}
    </div>
  );
}
```

- [ ] **Step 3: Typecheck + commit**

Run: `npx tsc --noEmit`
Expected: aucune erreur (les types `@zxing/browser` sont fournis par le paquet).

```bash
git add package.json package-lock.json src/components/BookScanner.tsx
git commit -m "feat(vulu): composant BookScanner (caméra, EAN-13, ZXing lazy)"
```

---

### Task 4: Intégration dans `SearchPanel`

**Files:**
- Modify: `src/components/SearchPanel.tsx`

**Interfaces:**
- Consumes: `BookScanner` (Task 3), `findBookByIsbn` via `GET /api/catalog/isbn` (Task 2), `open(r: WorkSummary)` (existant), `Icon`, `toast`.
- Produces: rien (UI).

- [ ] **Step 1: Add imports + scanning state**

Dans `src/components/SearchPanel.tsx`, ajouter aux imports :

```ts
import { Icon } from "@/components/Icon";
import { toast } from "@/lib/toast";
import { BookScanner } from "@/components/BookScanner";
```

Et, à côté des autres `useState` (après `const [opening, setOpening] = useState<string | null>(null);`) :

```ts
  const [scanning, setScanning] = useState(false);
```

- [ ] **Step 2: Add the ISBN handler**

Toujours dans `SearchPanel.tsx`, juste après la fonction `open` :

```ts
  async function handleIsbn(isbn: string) {
    try {
      const { result } = await api.get<{ result: WorkSummary | null }>(`/api/catalog/isbn?isbn=${encodeURIComponent(isbn)}`);
      if (result) { setScanning(false); await open(result); }
      else toast("Aucun livre trouvé pour ce code-barres", "error");
    } catch {
      toast("Recherche indisponible, réessaie", "error");
    }
  }
```

- [ ] **Step 3: Add the camera button next to the input + mount the scanner**

Remplacer le bloc `<input … />` actuel :

```tsx
      <input autoFocus={autoFocus} value={q} onChange={(e) => setQ(e.target.value)}
        placeholder={domain === "books" ? "Un livre, un auteur, @pseudo…" : "Un film, une série, @pseudo…"}
        className="mb-5 w-full rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] px-5 py-3 text-sm" />
```

par (champ + bouton caméra quand domaine = livres, et montage conditionnel du scanner) :

```tsx
      <div className="mb-5 flex items-center gap-2">
        <input autoFocus={autoFocus} value={q} onChange={(e) => setQ(e.target.value)}
          placeholder={domain === "books" ? "Un livre, un auteur, @pseudo…" : "Un film, une série, @pseudo…"}
          className="w-full rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] px-5 py-3 text-sm" />
        {domain === "books" && (
          <button type="button" onClick={() => setScanning(true)} aria-label="Scanner un code-barres"
            className="shrink-0 rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] p-3 text-[var(--color-text-muted)] transition-colors hover:text-[var(--color-text)]">
            <Icon name="camera" size={20} />
          </button>
        )}
      </div>
      {scanning && <BookScanner onClose={() => setScanning(false)} onIsbn={handleIsbn} />}
```

- [ ] **Step 4: Typecheck + build + manual smoke**

Run: `npx tsc --noEmit && npm run build`
Expected: typecheck OK, build OK.

Smoke manuel (mobile, HTTPS ou localhost) : recherche en domaine **Livres** → bouton caméra visible (pas en Films/Séries) ; tap → caméra ; viser un code-barres de livre → ouverture de la fiche ; refuser la permission → message + « Utiliser la recherche » ; code inconnu → toast.

- [ ] **Step 5: Commit**

```bash
git add src/components/SearchPanel.tsx
git commit -m "feat(vulu): bouton scan code-barres dans la recherche livres"
```

---

## Self-review

- **Couverture spec :** port `findByIsbn` + Google Books + composite → Task 1 ✓ ; `findBookByIsbn` (normalisation/validation) → Task 2 ✓ ; route `GET /api/catalog/isbn` + `isbnSchema` → Task 2 ✓ ; `BookScanner` ZXing lazy + erreurs caméra → Task 3 ✓ ; intégration `SearchPanel` (bouton livres, `handleIsbn`, réutilise `open`) → Task 4 ✓ ; `FakeCatalog.findByIsbn` → Task 1 ✓ ; tests application/adaptateur → Tasks 1-2 ✓ ; icône SVG `camera` (pas d'emoji) → Task 4 ✓.
- **tsc vert entre tasks :** l'ajout de `findByIsbn` à `CatalogProvider` (Task 1) est accompagné des 3 implémenteurs (Google Books, composite, fake) dans la même task.
- **Placeholders :** aucun — chaque étape montre le code complet. Le test `isbnSchema` de la spec est inclus (Task 2, step 6).
- **Cohérence des types :** `findByIsbn(isbn: string): Promise<WorkSummary | null>` identique port (Task 1 step 3), Google Books (step 4), composite (step 5), fake (step 6) ; `findBookByIsbn(deps, rawIsbn)` → `WorkSummary | null` cohérent application↔route↔`handleIsbn` ; `BookScanner` props `{ onIsbn, onClose }` cohérent Task 3↔Task 4 ; réponse route `{ result }` cohérente route↔client.
- **Ordre d'exécution :** Task 1 (port/adaptateurs) → Task 2 (app/route) → Task 3 (scanner) → Task 4 (intégration). Respecté.
