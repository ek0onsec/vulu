# Inscription — vérif disponibilité pseudo/email + retour étape 1 — Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Vérifier la disponibilité du pseudo et de l'email avant l'étape 2 de l'inscription, et permettre de revenir à l'étape 1 sans perdre la saisie.

**Architecture :** Un cas d'usage `checkSignupAvailability` (lecture `findByUsername`/`findByEmail`), une route publique `GET /api/auth/check-account`, puis le câblage UI : l'étape 1 valide et interroge l'endpoint avant de naviguer (et se préremplit depuis `sessionStorage`), l'étape 2 gagne un bouton « ← Retour ».

**Tech Stack :** Next.js 16 (App Router, route handlers), TypeScript strict (`noUncheckedIndexedAccess`), Vitest, MongoDB + mongodb-memory-server, zod v4, React 19, Tailwind v4.

## Global Constraints

- Toutes les commandes sont préfixées `cd /home/chamberlain/Desktop/Claude/vulu`.
- `tsc` : `node_modules/.bin/tsc --noEmit` doit rester vert.
- Tests : `npx vitest run` ; suite verte à 186 tests avant ce lot, doit le rester (+ nouveaux).
- Aucune mention d'IA / Claude dans le code, l'app ou les commits ; pas de co-auteur Claude.
- Ne pas toucher `lechatonfat/`. Stager uniquement des fichiers `vulu/`.
- Hexagonal : le domaine ne connaît pas Mongo ; lecture via le port `UserRepository`.
- Normalisation pseudo/email : `trim().toLowerCase()` (cohérent avec `registerUser`).
- La vérif d'unicité finale dans `registerUser` reste inchangée (garde-fou anti-race).

## File Structure

- `src/server/application/signup-availability.ts` — **nouveau** : `checkSignupAvailability` + type `SignupAvailability`.
- `src/lib/zod-schemas.ts` — `checkAccountSchema`.
- `src/app/api/auth/check-account/route.ts` — **nouveau** : `GET` handler public.
- `src/app/(auth)/register/page.tsx` — préremplissage + `next` async (validation + appel endpoint).
- `src/app/onboarding/page.tsx` — bouton « ← Retour ».
- Tests : `tests/application/signup-availability.test.ts` (**nouveau**), `tests/lib/zod-schemas.test.ts`.

---

## Task 1 : Cas d'usage `checkSignupAvailability` + schéma zod

**Files:**
- Create: `src/server/application/signup-availability.ts`
- Modify: `src/lib/zod-schemas.ts` (ajouter `checkAccountSchema`)
- Test: `tests/application/signup-availability.test.ts` (créer), `tests/lib/zod-schemas.test.ts`

**Interfaces:**
- Consumes : `deps.users.findByUsername(username): Promise<User | null>`, `deps.users.findByEmail(email): Promise<User | null>`.
- Produces :
  - `interface SignupAvailability { usernameAvailable: boolean; emailAvailable: boolean }`
  - `checkSignupAvailability(deps: Deps, input: { username: string; email: string }): Promise<SignupAvailability>`
  - `checkAccountSchema` (zod) : `{ u: string(3–20, [a-z0-9_]); e: email }`.

- [ ] **Step 1 : Test applicatif**

Créer `tests/application/signup-availability.test.ts` :

```ts
import { describe, it, expect, beforeEach } from "vitest";
import { makeInMemoryDeps, type Deps } from "@/server/container";
import { FakeCatalog } from "../helpers/fake-catalog";
import { registerUser } from "@/server/application/register-user";
import { checkSignupAvailability } from "@/server/application/signup-availability";

const tastes = { filmGenreIds: [1, 2, 3], people: [] };
let deps: Deps;
beforeEach(async () => {
  deps = makeInMemoryDeps(new FakeCatalog());
  await registerUser(deps, { email: "taken@x.io", username: "taken", displayName: "Pris", password: "password1", activeTabs: ["films"], tastes });
});

describe("checkSignupAvailability", () => {
  it("pseudo et email libres → tout disponible", async () => {
    expect(await checkSignupAvailability(deps, { username: "libre", email: "libre@x.io" }))
      .toEqual({ usernameAvailable: true, emailAvailable: true });
  });
  it("pseudo pris (insensible à la casse) → usernameAvailable false", async () => {
    const r = await checkSignupAvailability(deps, { username: "TAKEN", email: "libre@x.io" });
    expect(r.usernameAvailable).toBe(false);
    expect(r.emailAvailable).toBe(true);
  });
  it("email pris (insensible à la casse) → emailAvailable false", async () => {
    const r = await checkSignupAvailability(deps, { username: "libre", email: "Taken@X.io" });
    expect(r.emailAvailable).toBe(false);
    expect(r.usernameAvailable).toBe(true);
  });
});
```

- [ ] **Step 2 : Lancer, vérifier l'échec**

Run: `cd /home/chamberlain/Desktop/Claude/vulu && npx vitest run tests/application/signup-availability.test.ts`
Expected: ÉCHEC — module `signup-availability` introuvable.

- [ ] **Step 3 : Implémenter `checkSignupAvailability`**

Créer `src/server/application/signup-availability.ts` :

```ts
import type { Deps } from "@/server/container";

export interface SignupAvailability {
  usernameAvailable: boolean;
  emailAvailable: boolean;
}

/** Vérifie qu'un pseudo et un email ne sont pas déjà pris (normalisés en minuscules). */
export async function checkSignupAvailability(
  deps: Deps, input: { username: string; email: string },
): Promise<SignupAvailability> {
  const username = input.username.trim().toLowerCase();
  const email = input.email.trim().toLowerCase();
  const [byUsername, byEmail] = await Promise.all([
    deps.users.findByUsername(username),
    deps.users.findByEmail(email),
  ]);
  return { usernameAvailable: byUsername === null, emailAvailable: byEmail === null };
}
```

- [ ] **Step 4 : Schéma zod**

Dans `src/lib/zod-schemas.ts`, ajouter après `userSearchSchema` :

```ts
export const checkAccountSchema = z.object({
  u: z.string().min(3).max(20).regex(/^[a-z0-9_]+$/i),
  e: z.email(),
});
```

- [ ] **Step 5 : Test schéma**

Dans `tests/lib/zod-schemas.test.ts`, ajouter `checkAccountSchema` à l'import existant
`import { rateSchema, userSearchSchema } from "@/lib/zod-schemas";` (→ ajouter `, checkAccountSchema`),
puis ajouter à la fin du fichier :

```ts
describe("checkAccountSchema", () => {
  it("accepte un pseudo et un email valides", () => {
    expect(checkAccountSchema.parse({ u: "tom_92", e: "a@x.io" })).toEqual({ u: "tom_92", e: "a@x.io" });
  });
  it("rejette un pseudo trop court ou un email invalide", () => {
    expect(() => checkAccountSchema.parse({ u: "ab", e: "a@x.io" })).toThrow();
    expect(() => checkAccountSchema.parse({ u: "tom_92", e: "pas-un-email" })).toThrow();
  });
});
```

- [ ] **Step 6 : Lancer les tests + tsc**

Run: `cd /home/chamberlain/Desktop/Claude/vulu && npx vitest run tests/application/signup-availability.test.ts tests/lib/zod-schemas.test.ts && node_modules/.bin/tsc --noEmit`
Expected: PASS, 0 erreur tsc.

- [ ] **Step 7 : Commit**

```bash
cd /home/chamberlain/Desktop/Claude/vulu && git add -- src/server/application/signup-availability.ts src/lib/zod-schemas.ts tests/application/signup-availability.test.ts tests/lib/zod-schemas.test.ts && git commit -q -m "feat(vulu): checkSignupAvailability + checkAccountSchema"
```

---

## Task 2 : Route API `GET /api/auth/check-account`

**Files:**
- Create: `src/app/api/auth/check-account/route.ts`

**Interfaces:**
- Consumes : `checkSignupAvailability(deps, { username, email })` (Task 1), `checkAccountSchema` (Task 1), `getDeps` (`@/server/container`), `json` (`@/server/http/session`), `toErrorResponse` (`@/server/http/errors`).
- Produces : `GET /api/auth/check-account?u=…&e=…` → `{ usernameAvailable: boolean, emailAvailable: boolean }`. Public (pas d'auth). Format invalide → erreur 400.

- [ ] **Step 1 : Implémenter le handler**

Créer `src/app/api/auth/check-account/route.ts` :

```ts
import { getDeps } from "@/server/container";
import { checkSignupAvailability } from "@/server/application/signup-availability";
import { checkAccountSchema } from "@/lib/zod-schemas";
import { json } from "@/server/http/session";
import { toErrorResponse } from "@/server/http/errors";

export async function GET(req: Request) {
  try {
    const sp = new URL(req.url).searchParams;
    const { u, e } = checkAccountSchema.parse({ u: sp.get("u") ?? "", e: sp.get("e") ?? "" });
    return json({ ...(await checkSignupAvailability(await getDeps(), { username: u, email: e })) });
  } catch (err) { return toErrorResponse(err); }
}
```

- [ ] **Step 2 : Vérifier tsc**

Run: `cd /home/chamberlain/Desktop/Claude/vulu && node_modules/.bin/tsc --noEmit`
Expected: 0 erreur.

- [ ] **Step 3 : Vérifier le routage (endpoint répond, sans auth)**

Run: `cd /home/chamberlain/Desktop/Claude/vulu && curl -s "http://localhost:3000/api/auth/check-account?u=demo&e=demo@vulu.app"`
Expected: `{"usernameAvailable":false,"emailAvailable":false}` (le compte démo « demo » existe en base de dev seedée). Avec un pseudo/email inédits : `{"usernameAvailable":true,"emailAvailable":true}`.

- [ ] **Step 4 : Commit**

```bash
cd /home/chamberlain/Desktop/Claude/vulu && git add -- src/app/api/auth/check-account/route.ts && git commit -q -m "feat(vulu): route GET /api/auth/check-account"
```

---

## Task 3 : Étape 1 — préremplissage + vérif avant navigation

**Files:**
- Modify: `src/app/(auth)/register/page.tsx`

**Interfaces:**
- Consumes : `GET /api/auth/check-account?u=…&e=…` → `{ usernameAvailable, emailAvailable }` (Task 2) ; `SIGNUP_KEY`, `SignupDraft` (`@/lib/signup`) ; `api` (`@/lib/api-client`).
- Produces : (UI seulement).

- [ ] **Step 1 : Imports + préremplissage depuis sessionStorage**

Dans `src/app/(auth)/register/page.tsx`, ajouter à `useState` l'import `useEffect` (ligne 2 → `import { useEffect, useState } from "react";`) et l'API client. En tête de fichier, après l'import `SIGNUP_KEY` :

```ts
import { api } from "@/lib/api-client";
```

Ajouter un état `busy` à côté de `error` :

```ts
  const [busy, setBusy] = useState(false);
```

Et, après la déclaration de `draft`/`error`/`busy`, préremplir depuis `sessionStorage` :

```ts
  useEffect(() => {
    const raw = sessionStorage.getItem(SIGNUP_KEY);
    if (raw) setDraft(JSON.parse(raw) as SignupDraft);
  }, []);
```

- [ ] **Step 2 : `next` asynchrone (validation format + appel endpoint)**

Remplacer la fonction `next` existante par :

```ts
  async function next(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const username = draft.username.trim().toLowerCase();
    const email = draft.email.trim().toLowerCase();
    if (!draft.displayName.trim()) { setError("Renseigne un nom affiché"); return; }
    if (!/^[a-z0-9_]{3,20}$/.test(username)) { setError("Pseudo invalide (3–20 caractères : lettres, chiffres, _)"); return; }
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { setError("Email invalide"); return; }
    if (draft.password.length < 8) { setError("Mot de passe : 8 caractères minimum"); return; }
    setBusy(true);
    try {
      const r = await api.get<{ usernameAvailable: boolean; emailAvailable: boolean }>(
        `/api/auth/check-account?u=${encodeURIComponent(username)}&e=${encodeURIComponent(email)}`,
      );
      if (!r.usernameAvailable) { setError("Ce nom d'utilisateur est déjà pris"); return; }
      if (!r.emailAvailable) { setError("Cet email est déjà utilisé"); return; }
      sessionStorage.setItem(SIGNUP_KEY, JSON.stringify(draft));
      router.push("/onboarding");
    } catch {
      setError("Vérification impossible, réessaie");
    } finally {
      setBusy(false);
    }
  }
```

- [ ] **Step 3 : Bouton « Continuer » avec état busy**

Remplacer le bouton de soumission (`<button className="rounded-full bg-[var(--color-primary)] py-3 text-sm font-semibold text-white">Continuer →</button>`) par :

```tsx
        <button disabled={busy} className="rounded-full bg-[var(--color-primary)] py-3 text-sm font-semibold text-white disabled:opacity-50">
          {busy ? "Vérification…" : "Continuer →"}
        </button>
```

- [ ] **Step 4 : Vérifier tsc + page**

Run: `cd /home/chamberlain/Desktop/Claude/vulu && node_modules/.bin/tsc --noEmit && curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/register`
Expected: 0 erreur tsc ; `200`.

- [ ] **Step 5 : Commit**

```bash
cd /home/chamberlain/Desktop/Claude/vulu && git add -- "src/app/(auth)/register/page.tsx" && git commit -q -m "feat(vulu): inscription étape 1 — vérif pseudo/email avant l'étape 2 + préremplissage"
```

---

## Task 4 : Étape 2 — bouton « ← Retour »

**Files:**
- Modify: `src/app/onboarding/page.tsx`

**Interfaces:**
- Consumes : `router` (déjà présent via `useRouter`).
- Produces : (UI seulement).

- [ ] **Step 1 : Ajouter le bouton Retour**

Dans `src/app/onboarding/page.tsx`, remplacer le bloc du bouton « Terminer » (lignes ~45-48) pour ajouter un bouton « ← Retour » juste avant, dans un conteneur flex :

```tsx
      {error && <p className="mt-4 text-sm text-red-500">{error}</p>}
      <div className="mt-6 flex items-center gap-3">
        <button type="button" onClick={() => router.push("/register")} disabled={busy}
          className="rounded-full border border-[var(--color-border)] px-5 py-3 text-sm font-semibold text-[var(--color-text-muted)] disabled:opacity-50">
          ← Retour
        </button>
        <button onClick={finish} disabled={busy || tastes.filmGenreIds.length < 3}
          className="flex-1 rounded-full bg-[var(--color-primary)] py-3 text-sm font-semibold text-white disabled:opacity-50">
          {busy ? "…" : "Terminer l’inscription"}
        </button>
      </div>
```

(Le `{error && …}` existant est déplacé au-dessus du conteneur flex ; veiller à ne pas le laisser en double — supprimer l'ancienne ligne `{error && …}` si elle précédait déjà le bouton.)

- [ ] **Step 2 : Vérifier tsc + page**

Run: `cd /home/chamberlain/Desktop/Claude/vulu && node_modules/.bin/tsc --noEmit && curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/onboarding`
Expected: 0 erreur tsc ; `200` (ou `307` si la route redirige hors session — confirme l'absence d'erreur de compilation).

- [ ] **Step 3 : Suite complète + commit**

Run: `cd /home/chamberlain/Desktop/Claude/vulu && npx vitest run`
Expected: suite verte.

```bash
cd /home/chamberlain/Desktop/Claude/vulu && git add -- src/app/onboarding/page.tsx && git commit -q -m "feat(vulu): inscription étape 2 — bouton retour vers l'étape 1"
```

---

## Self-Review

**Spec coverage :**
- §1 `checkSignupAvailability` (normalise, findByUsername/findByEmail) ⇒ Task 1 Step 3. ✓
- §2 API `GET /api/auth/check-account` + `checkAccountSchema` (public, 400 si invalide) ⇒ Task 1 Step 4 + Task 2 Step 1. ✓
- §3 Étape 1 (préremplissage, `next` async, validation format, messages distincts, busy) ⇒ Task 3 Steps 1-3. ✓
- §4 Étape 2 (bouton « ← Retour » → `/register`) ⇒ Task 4 Step 1. ✓
- §5 Tests (checkSignupAvailability libre/pris casse, checkAccountSchema) ⇒ Task 1 Steps 1, 5. ✓
- Hors périmètre (pas de live-check, pas de suggestion, registerUser inchangé) ⇒ respecté. ✓

**Placeholder scan :** aucun TODO/TBD ; chaque step de code montre le code complet.

**Type consistency :** `SignupAvailability { usernameAvailable, emailAvailable }` défini en Task 1, renvoyé identique par l'API (Task 2) et consommé en Task 3 (`r.usernameAvailable`/`r.emailAvailable`). `checkAccountSchema` champs `{ u, e }` cohérents entre schéma (1.4), route (2.1) et appel client (`?u=…&e=…`, 3.2). `checkSignupAvailability(deps, { username, email })` : la route mappe `u → username`, `e → email` (2.1). `SIGNUP_KEY`/`SignupDraft` réutilisés tels quels.

## Execution Handoff

**Plan complet, sauvegardé dans `docs/superpowers/plans/2026-06-23-inscription-verif-disponibilite.md`. Deux options d'exécution :**

**1. Subagent-Driven (recommandé)** — un sous-agent par tâche, revue entre chaque.

**2. Inline Execution** — exécution dans cette session via executing-plans, par lots avec points de contrôle.

**Quelle approche ?**
