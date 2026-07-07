# Squelettes de chargement fidèles — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remplacer les squelettes de chargement génériques par des squelettes rendus dans un shell (nav) et fidèles à la structure réelle de chaque page.

**Architecture:** Un composant statique `AppShellSkeleton` reproduit le gabarit de l'`AppShell` ; chaque `loading.tsx` rend son squelette de contenu à l'intérieur, avec des formes qui épousent la vraie page.

**Tech Stack:** Next.js (version custom — lire `node_modules/next/dist/docs/`), React, Tailwind, tokens CSS (`--color-border`, `--color-surface`).

## Global Constraints

- **Purement présentationnel** : aucune donnée, aucune requête, aucun `use client`, aucun état.
- Fidélité **structurelle** (bonnes zones/formes), pas pixel-perfect.
- Tokens/rayons cohérents avec les vrais composants (`rounded-2xl` cartes, `rounded-xl` posters, `rounded-full` pastilles ; `animate-pulse bg-[var(--color-border)]`).
- Validation : `npx tsc --noEmit` + `npm run build` (pas de tests unitaires pour ces vues).

---

### Task 1: Composant `AppShellSkeleton`

**Files:**
- Create: `src/components/AppShellSkeleton.tsx`

**Interfaces:**
- Produces: `export function AppShellSkeleton({ children }: { children: React.ReactNode })`, et `export function Skel({ className }: { className?: string })`.

- [ ] **Step 1: Créer le composant**

```tsx
import type { ReactNode } from "react";

export function Skel({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse bg-[var(--color-border)] ${className}`} />;
}

export function AppShellSkeleton({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto grid min-h-screen max-w-[1320px] grid-cols-1 md:grid-cols-[240px_1fr] lg:grid-cols-[240px_minmax(0,1fr)_340px]">
      {/* Sidebar gauche */}
      <aside className="sticky top-0 hidden h-screen flex-col gap-2 border-r border-[var(--color-border)] px-3 py-4 md:flex">
        <Skel className="mb-3 h-7 w-24 rounded-md" />
        {Array.from({ length: 6 }).map((_, i) => <Skel key={i} className="h-9 rounded-full" />)}
        <div className="mt-auto">
          <Skel className="h-14 rounded-2xl" />
        </div>
      </aside>

      {/* Colonne principale */}
      <main className="w-full border-x border-[var(--color-border)] px-3 pb-24 pt-4 md:px-5 md:pb-8">
        <div className="mb-3 flex items-center justify-between md:hidden">
          <Skel className="h-6 w-20 rounded-md" />
          <Skel className="h-8 w-8 rounded-full" />
        </div>
        {children}
      </main>

      {/* Rail droit */}
      <aside className="sticky top-0 hidden h-screen flex-col gap-3 px-4 py-5 lg:flex">
        {Array.from({ length: 3 }).map((_, i) => <Skel key={i} className="h-24 rounded-2xl" />)}
      </aside>

      {/* Nav mobile basse */}
      <nav className="fixed inset-x-0 bottom-0 z-10 flex justify-around border-t border-[var(--color-border)] bg-[var(--color-surface)] py-3 md:hidden">
        {Array.from({ length: 4 }).map((_, i) => <Skel key={i} className="h-6 w-6 rounded-full" />)}
      </nav>
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: aucune erreur.

- [ ] **Step 3: Commit**

```bash
git add src/components/AppShellSkeleton.tsx
git commit -m "feat(vulu): AppShellSkeleton (gabarit de chargement avec nav en placeholder)"
```

---

### Task 2: Réécrire les 6 `loading.tsx`

**Files:**
- Modify: `src/app/feed/loading.tsx`
- Modify: `src/app/bibliotheque/loading.tsx`
- Modify: `src/app/u/[username]/loading.tsx`
- Modify: `src/app/work/[id]/loading.tsx`
- Modify: `src/app/communautes/loading.tsx`
- Modify: `src/app/search/loading.tsx`

**Interfaces:**
- Consumes: `AppShellSkeleton`, `Skel` (Task 1).

- [ ] **Step 1: `feed/loading.tsx`**

```tsx
import { AppShellSkeleton, Skel } from "@/components/AppShellSkeleton";

export default function Loading() {
  return (
    <AppShellSkeleton>
      <div className="mb-3 flex gap-1.5 rounded-2xl border border-[var(--color-border)] p-1.5">
        {Array.from({ length: 3 }).map((_, i) => <Skel key={i} className="h-10 flex-1 rounded-xl" />)}
      </div>
      <Skel className="mb-4 h-11 w-full rounded-2xl" />
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="rounded-2xl border border-[var(--color-border)] p-4">
            <div className="flex gap-3">
              <Skel className="h-10 w-10 shrink-0 rounded-full" />
              <div className="flex-1 space-y-2">
                <Skel className="h-3 w-32 rounded" />
                <Skel className="h-3 w-24 rounded" />
                <Skel className="mt-2 h-24 w-full rounded-xl" />
                <div className="flex gap-2 pt-1">
                  <Skel className="h-7 w-16 rounded-full" />
                  <Skel className="h-7 w-16 rounded-full" />
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </AppShellSkeleton>
  );
}
```

- [ ] **Step 2: `bibliotheque/loading.tsx`**

```tsx
import { AppShellSkeleton, Skel } from "@/components/AppShellSkeleton";

export default function Loading() {
  return (
    <AppShellSkeleton>
      <div className="mb-5 flex items-center justify-between">
        <Skel className="h-8 w-40 rounded-md" />
        <Skel className="h-9 w-28 rounded-full" />
      </div>
      <div className="mb-4 flex gap-2">
        {Array.from({ length: 4 }).map((_, i) => <Skel key={i} className="h-8 w-16 rounded-full" />)}
      </div>
      <Skel className="mb-2 h-5 w-24 rounded" />
      <div className="mb-6 flex gap-3 overflow-hidden">
        {Array.from({ length: 4 }).map((_, i) => <Skel key={i} className="aspect-[2/3] w-32 shrink-0 rounded-xl" />)}
      </div>
      <Skel className="mb-3 h-5 w-40 rounded" />
      <div className="mb-8 grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => <Skel key={i} className="aspect-[4/3] rounded-2xl" />)}
      </div>
      <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5">
        {Array.from({ length: 10 }).map((_, i) => <Skel key={i} className="aspect-[2/3] rounded-xl" />)}
      </div>
    </AppShellSkeleton>
  );
}
```

- [ ] **Step 3: `u/[username]/loading.tsx`**

```tsx
import { AppShellSkeleton, Skel } from "@/components/AppShellSkeleton";

export default function Loading() {
  return (
    <AppShellSkeleton>
      <div className="overflow-hidden rounded-2xl border border-[var(--color-border)]">
        <Skel className="h-28 w-full" />
        <div className="px-5 pb-5">
          <div className="flex items-end gap-3">
            <Skel className="-mt-10 h-20 w-20 rounded-full ring-4 ring-[var(--color-surface)]" />
            <div className="flex-1 space-y-2 pb-1">
              <Skel className="h-5 w-40 rounded" />
              <Skel className="h-3 w-24 rounded" />
            </div>
          </div>
          <Skel className="mt-3 h-4 w-56 rounded" />
        </div>
      </div>
      <div className="mt-4 flex gap-2">
        {Array.from({ length: 3 }).map((_, i) => <Skel key={i} className="h-9 w-24 rounded-full" />)}
      </div>
      <div className="mt-4 grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5">
        {Array.from({ length: 9 }).map((_, i) => <Skel key={i} className="aspect-[2/3] rounded-xl" />)}
      </div>
    </AppShellSkeleton>
  );
}
```

- [ ] **Step 4: `work/[id]/loading.tsx`**

```tsx
import { AppShellSkeleton, Skel } from "@/components/AppShellSkeleton";

export default function Loading() {
  return (
    <AppShellSkeleton>
      <div className="overflow-hidden rounded-2xl border border-[var(--color-border)]">
        <Skel className="h-32 w-full" />
        <div className="flex gap-4 px-5 pb-5">
          <Skel className="-mt-12 h-36 w-24 shrink-0 rounded-xl border-2 border-[var(--color-surface)]" />
          <div className="space-y-2 pt-3">
            <Skel className="h-6 w-48 rounded" />
            <Skel className="h-3 w-32 rounded" />
            <div className="flex gap-1.5 pt-1">
              {Array.from({ length: 3 }).map((_, i) => <Skel key={i} className="h-5 w-16 rounded-full" />)}
            </div>
          </div>
        </div>
        <div className="space-y-2 px-5 pb-5">
          {Array.from({ length: 3 }).map((_, i) => <Skel key={i} className="h-3 w-full rounded" />)}
        </div>
      </div>
      <div className="mt-4 flex gap-1 rounded-full border border-[var(--color-border)] p-1">
        {Array.from({ length: 2 }).map((_, i) => <Skel key={i} className="h-9 flex-1 rounded-full" />)}
      </div>
      <Skel className="mt-4 h-40 w-full rounded-2xl" />
    </AppShellSkeleton>
  );
}
```

- [ ] **Step 5: `communautes/loading.tsx`**

```tsx
import { AppShellSkeleton, Skel } from "@/components/AppShellSkeleton";

export default function Loading() {
  return (
    <AppShellSkeleton>
      <div className="mb-5 flex items-center justify-between">
        <Skel className="h-8 w-40 rounded-md" />
        <Skel className="h-9 w-28 rounded-full" />
      </div>
      <div className="flex flex-col gap-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="overflow-hidden rounded-2xl border border-[var(--color-border)]">
            <Skel className="h-16 w-full" />
            <div className="space-y-2 p-4">
              <Skel className="h-5 w-40 rounded" />
              <Skel className="h-3 w-20 rounded" />
            </div>
          </div>
        ))}
      </div>
    </AppShellSkeleton>
  );
}
```

- [ ] **Step 6: `search/loading.tsx`**

```tsx
import { AppShellSkeleton, Skel } from "@/components/AppShellSkeleton";

export default function Loading() {
  return (
    <AppShellSkeleton>
      <Skel className="mb-4 h-11 w-full rounded-full" />
      <div className="space-y-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3">
            <Skel className="h-16 w-11 shrink-0 rounded-lg" />
            <div className="flex-1 space-y-2">
              <Skel className="h-3 w-40 rounded" />
              <Skel className="h-3 w-24 rounded" />
            </div>
          </div>
        ))}
      </div>
    </AppShellSkeleton>
  );
}
```

- [ ] **Step 7: Typecheck + build**

Run: `npx tsc --noEmit`
Expected: aucune erreur.
Run: `npm run build`
Expected: build réussi.

- [ ] **Step 8: Vérification visuelle**

Run: `npm run dev`, naviguer entre les pages (feed → bibliothèque → profil → work → communautés → recherche). Chaque squelette doit montrer la nav (sidebar/mobile) + une silhouette proche de la page finale (pas de blocs génériques flottants). Un throttling réseau (DevTools) aide à voir le squelette.

- [ ] **Step 9: Commit**

```bash
git add "src/app/feed/loading.tsx" "src/app/bibliotheque/loading.tsx" "src/app/u/[username]/loading.tsx" "src/app/work/[id]/loading.tsx" "src/app/communautes/loading.tsx" "src/app/search/loading.tsx"
git commit -m "feat(vulu): squelettes de chargement fidèles au rendu de chaque page"
```

---

## Self-Review

**Spec coverage :**
- `AppShellSkeleton` (grille identique, nav placeholder, rail, nav mobile) → Task 1 ✓
- 6 `loading.tsx` dans le shell, formes par page (feed/biblio/profil/work/communautés/recherche) → Task 2 ✓
- Présentationnel, tokens cohérents, validation typecheck+build+visuel → contraintes + Task 2 Steps 7-8 ✓

**Placeholder scan :** aucun TBD/TODO ; code complet et final pour chaque fichier.

**Type consistency :** `AppShellSkeleton({ children })` et `Skel({ className })` (Task 1) consommés à l'identique par les 6 `loading.tsx` (Task 2). Chemins exacts (`u/[username]`, `work/[id]` entre guillemets pour les crochets).
