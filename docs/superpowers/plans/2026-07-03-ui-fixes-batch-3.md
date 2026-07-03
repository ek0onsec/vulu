# Batch 3 — Avis propre fiche œuvre, backfill runtime, stats profil cliquables, bouton Valider, réactivité — Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Afficher ton propre avis partagé sur la fiche œuvre, rendre visible le temps de visionnage en backfillant le `runtime` des œuvres existantes, rendre les stats du profil cliquables (onglets + modales d'abonnés), rendre le bouton de validation proéminent (« Valider »), et améliorer la réactivité perçue (squelettes, feedback tactile, préchargement).

**Architecture :** App Next.js 16 (App Router), hexagonale côté serveur. Logique (avis propre, backfill, listes d'abonnés) dans domain/application avec tests vitest ; UX vérifiée manuellement.

**Tech Stack :** Next.js 16.2.9, React 19, Tailwind v4, TypeScript strict, MongoDB, vitest.

## Global Constraints

- Aucune mention IA / Claude / superpowers dans le code, l'app ou les commits ; aucun co-auteur Claude.
- Ne jamais toucher au dossier `lechatonfat/`.
- Architecture hexagonale : toute dépendance externe derrière un port ; le domaine ne connaît aucun driver/SDK.
- Aucun secret en dur ; validation des entrées aux frontières ; typage strict, pas de `any`.
- Commits fréquents, un par tâche, directement sur `master`.
- Vérifier avant de conclure : `npx tsc --noEmit` propre + `npx vitest run` vert.

## File Structure

- `src/server/application/feed.ts` — `getMyWorkReview` (A1).
- `src/app/api/works/[id]/reviews/route.ts`, `src/components/WorkReviews.tsx` — avis propre + autres (A1).
- `src/server/application/get-work.ts` — `backfillRuntime` + refresh au cache hit (A2).
- `src/server/application/watch-time.ts` — backfill borné (A2).
- `src/components/ProfileTabs.tsx` — présélection onglet via hash (B1).
- `src/server/application/follow-lists.ts` (nouveau) — `listFollowers`/`listFollowing` (B2).
- `src/app/api/users/[username]/followers/route.ts`, `.../following/route.ts` (nouveaux) — endpoints (B2).
- `src/components/UserListModal.tsx`, `src/components/ProfileStats.tsx` (nouveaux) — UI stats (B2).
- `src/app/u/[username]/page.tsx` — câblage stats (B1/B2).
- `src/components/EntryEditor.tsx` — bouton « Valider » (C1).
- `src/app/*/loading.tsx` (nouveaux), `src/components/FeedCard.tsx`, `src/components/AppShell.tsx` — réactivité (C2).

---

## Phase A — Bugs

### Task A1 : Afficher ton avis partagé sur la fiche œuvre

**Files:**
- Modify: `src/server/application/feed.ts`, `src/app/api/works/[id]/reviews/route.ts`, `src/components/WorkReviews.tsx`
- Test: `tests/application/feed.test.ts`

**Interfaces:**
- Produces: `getMyWorkReview(deps: Deps, viewerId: string, workId: string): Promise<FeedItem | null>`.
- L'endpoint `GET /api/works/[id]/reviews` renvoie `{ mine: FeedItem | null; others: FeedItem[] }`.

- [ ] **Step 1 : Test de `getMyWorkReview` (échoue)**

Dans `tests/application/feed.test.ts`, ajouter à la fin (avant la dernière accolade fermante du fichier) un nouveau bloc. Réutilise les helpers du fichier (`rateOrReviewWork`, `deps`, `me`) :

```ts
describe("getMyWorkReview", () => {
  const ref = { source: "tmdb" as const, externalId: "603", type: "movie" as const };
  it("renvoie ton avis s'il est partagé (cercle)", async () => {
    await rateOrReviewWork(deps, me, ref, { rating: 4, text: "top", audiences: { public: false, circle: true, communityIds: [] } });
    const work = await deps.works.findByExternal("tmdb", "603");
    const mine = await getMyWorkReview(deps, me, work!.id);
    expect(mine?.author.id).toBe(me);
  });
  it("renvoie null si gardé pour moi (non partagé)", async () => {
    await rateOrReviewWork(deps, me, ref, { rating: 4, text: "privé", audiences: { public: false, circle: false, communityIds: [] } });
    const work = await deps.works.findByExternal("tmdb", "603");
    expect(await getMyWorkReview(deps, me, work!.id)).toBeNull();
  });
  it("renvoie null si aucune note ni texte", async () => {
    const work = await deps.works.findByExternal("tmdb", "603");
    expect(await getMyWorkReview(deps, me, work?.id ?? "x")).toBeNull();
  });
});
```

Ajouter `getMyWorkReview` à l'import existant depuis `@/server/application/feed` en haut du fichier.

- [ ] **Step 2 : Lancer → échoue**

Run: `npx vitest run tests/application/feed.test.ts`
Expected: FAIL (`getMyWorkReview` n'existe pas).

- [ ] **Step 3 : Implémenter `getMyWorkReview`**

Dans `src/server/application/feed.ts`, après `getWorkReviews`, ajouter :

```ts
/** Ton propre avis sur une œuvre, s'il est publishable ET partagé (sinon null). */
export async function getMyWorkReview(deps: Deps, viewerId: string, workId: string): Promise<FeedItem | null> {
  const entry = await deps.entries.findByUserAndWork(viewerId, workId);
  if (!entry) return null;
  const publishable = entry.status === "done" && (entry.rating !== null || entry.text !== null);
  const shared = entry.audiences.public || entry.audiences.circle || entry.audiences.communityIds.length > 0;
  if (!publishable || !shared) return null;
  const [item] = await enrichEntries(deps, viewerId, [entry]);
  return item ?? null;
}
```

Vérifier que `deps.entries.findByUserAndWork` existe (`grep -n "findByUserAndWork" src/server/ports/repositories.ts`) — utilisé par `library-entry.ts`.

- [ ] **Step 4 : Test → passe**

Run: `npx vitest run tests/application/feed.test.ts`
Expected: PASS.

- [ ] **Step 5 : Endpoint renvoie `{ mine, others }`**

Dans `src/app/api/works/[id]/reviews/route.ts`, remplacer le corps par :

```ts
import { getDeps } from "@/server/container";
import { getWorkReviews, getMyWorkReview } from "@/server/application/feed";
import { requireUser, json } from "@/server/http/session";
import { toErrorResponse } from "@/server/http/errors";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const deps = await getDeps();
    const [mine, others] = await Promise.all([getMyWorkReview(deps, user.id, id), getWorkReviews(deps, user.id, id)]);
    return json({ mine, others });
  } catch (e) { return toErrorResponse(e); }
}
```

- [ ] **Step 6 : `WorkReviews` affiche ton avis en tête**

Dans `src/components/WorkReviews.tsx`, remplacer le contenu par :

```tsx
"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/api-client";
import { FeedCard } from "./FeedCard";
import type { FeedItem } from "@/server/application/feed";

export function WorkReviews({ workId }: { workId: string }) {
  const [data, setData] = useState<{ mine: FeedItem | null; others: FeedItem[] } | null>(null);

  useEffect(() => {
    api.get<{ mine: FeedItem | null; others: FeedItem[] }>(`/api/works/${workId}/reviews`)
      .then(setData).catch(() => setData({ mine: null, others: [] }));
  }, [workId]);

  const empty = data !== null && data.mine === null && data.others.length === 0;

  return (
    <section className="mt-6">
      <h2 className="mb-3 font-display text-lg font-bold">Avis</h2>
      {data === null && (
        <div className="space-y-3">
          {[0, 1].map((i) => <div key={i} className="h-28 animate-pulse rounded-2xl bg-[var(--color-border)]" />)}
        </div>
      )}
      {empty && (
        <p className="rounded-2xl border border-dashed border-[var(--color-border)] p-6 text-center text-sm text-[var(--color-text-muted)]">
          Aucun avis pour l’instant. Sois le premier à partager le tien.
        </p>
      )}
      {data?.mine && (
        <div className="mb-3">
          <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-[var(--color-primary)]">Ton avis</p>
          <FeedCard item={data.mine} />
        </div>
      )}
      {data?.others.map((r) => <FeedCard key={r.entry.id} item={r} />)}
    </section>
  );
}
```

- [ ] **Step 7 : Vérifier**

Run: `npx tsc --noEmit && npx vitest run`
Expected: propre + vert. Manuel : noter/commenter un film en le partageant (Cercle) → la fiche affiche « Ton avis » avec ta carte ; en « Garder pour moi » → ton avis n'apparaît pas et « Aucun avis » s'affiche s'il n'y en a pas d'autres.

- [ ] **Step 8 : Commit**

```bash
git add src/server/application/feed.ts "src/app/api/works/[id]/reviews/route.ts" src/components/WorkReviews.tsx tests/application/feed.test.ts
git commit -m "fix(vulu): fiche œuvre — affiche ton avis partagé en tête (corrige « aucun avis »)"
```

---

### Task A2 : Backfill du `runtime` (temps de visionnage visible)

**Files:**
- Modify: `src/server/application/get-work.ts`, `src/server/application/watch-time.ts`
- Test: `tests/application/watch-time.test.ts`

**Interfaces:**
- Produces: `backfillRuntime(deps: Deps, work: Work): Promise<Work>` — re-récupère et persiste le `runtime` d'un film/série dont `runtime` est `null` ; renvoie l'œuvre (mise à jour ou inchangée). Consommée par `getOrImportWork` (cache hit) et `computeWatchMinutes` (borné).

- [ ] **Step 1 : Test — le calcul backfille un film au runtime manquant (échoue)**

Dans `tests/application/watch-time.test.ts`, ajouter :

```ts
it("backfille le runtime manquant d'un film déjà en base puis le compte", async () => {
  await rateOrReviewWork(deps, "u1", movie, { rating: 4, text: null, audiences: { public: false, circle: false, communityIds: [] } });
  const work = await deps.works.findByExternal("tmdb", "603");
  await deps.works.upsert({ ...work!, runtime: null }); // simule une œuvre importée avant le champ runtime
  expect(await computeWatchMinutes(deps, "u1")).toBe(136); // backfill depuis FakeCatalog (603 = 136 min)
});
```

- [ ] **Step 2 : Lancer → échoue**

Run: `npx vitest run tests/application/watch-time.test.ts`
Expected: FAIL (renvoie 0 : runtime null ignoré, pas encore de backfill).

- [ ] **Step 3 : Implémenter `backfillRuntime` et l'utiliser dans `getOrImportWork`**

Dans `src/server/application/get-work.ts`, ajouter la fonction et l'appeler au cache hit. Remplacer `if (cached) return cached;` par `if (cached) return backfillRuntime(deps, cached);` et ajouter :

```ts
/** Re-récupère le runtime d'un film/série dont il manque (import antérieur), et le persiste. */
export async function backfillRuntime(deps: Deps, work: Work): Promise<Work> {
  if (work.type === "book" || work.runtime !== null) return work;
  try {
    const details = await deps.catalog.getWork(work.externalId, work.type);
    if (!details || details.runtime === null || details.runtime === undefined) return work;
    const updated: Work = {
      ...work,
      runtime: details.runtime,
      episodeCounts: details.episodeCounts ?? work.episodeCounts,
      cachedAt: deps.clock.now(),
    };
    await deps.works.upsert(updated);
    return updated;
  } catch {
    return work;
  }
}
```

- [ ] **Step 4 : Backfill borné dans `computeWatchMinutes`**

Dans `src/server/application/watch-time.ts`, importer `backfillRuntime` et l'appliquer aux œuvres film/série sans runtime, dans une limite. Remplacer le corps de `computeWatchMinutes` par :

```ts
import type { Deps } from "@/server/container";
import type { LibraryEntry, Work } from "@/server/domain/entities";
import { backfillRuntime } from "./get-work";

const MAX_BACKFILL = 20;

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

/** Temps total de visionnage (films + séries), en minutes. Backfille le runtime manquant (borné). */
export async function computeWatchMinutes(deps: Deps, userId: string): Promise<number> {
  const entries = await deps.entries.listByUser(userId, {});
  let minutes = 0;
  let backfillBudget = MAX_BACKFILL;
  for (const entry of entries) {
    if (entry.status === "planned") continue;
    let work = await deps.works.findById(entry.workId);
    if (!work || work.type === "book") continue;
    if (work.runtime === null && backfillBudget > 0) {
      backfillBudget -= 1;
      work = await backfillRuntime(deps, work);
    }
    if (work.runtime === null) continue;
    if (work.type === "movie") {
      if (entry.status === "done") minutes += work.runtime;
    } else if (work.type === "tv") {
      minutes += episodesSeen(entry, work) * work.runtime;
    }
  }
  return minutes;
}
```

- [ ] **Step 5 : Test → passe (+ non-régression)**

Run: `npx vitest run tests/application/watch-time.test.ts`
Expected: PASS (5 tests, dont le nouveau backfill).

- [ ] **Step 6 : Vérifier**

Run: `npx tsc --noEmit && npx vitest run`
Expected: propre + vert. Manuel : sur ton profil, après avoir ouvert la page (backfill borné) ou visité quelques fiches films, le temps de visionnage apparaît et se complète.

- [ ] **Step 7 : Commit**

```bash
git add src/server/application/get-work.ts src/server/application/watch-time.ts tests/application/watch-time.test.ts
git commit -m "fix(vulu): backfill du runtime des œuvres existantes — temps de visionnage visible"
```

---

## Phase B — Stats profil cliquables

### Task B1 : « vus » / « lus » présélectionnent l'onglet

**Files:**
- Modify: `src/components/ProfileTabs.tsx`, `src/app/u/[username]/page.tsx`

- [ ] **Step 1 : ProfileTabs lit le hash au montage**

Dans `src/components/ProfileTabs.tsx`, après la ligne `const [active, setActive] = useState(tabs[0]!.id);`, ajouter un effet qui présélectionne l'onglet si le hash correspond à un id de tab existant. Ajouter `useEffect` à l'import React (`import { useState, useEffect } from "react";`) puis :

```tsx
  useEffect(() => {
    const id = window.location.hash.slice(1);
    if (id && tabs.some((t) => t.id === id)) setActive(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
```

(Le lint exhaustive-deps est neutralisé volontairement : présélection au montage uniquement.)

- [ ] **Step 2 : Ancrer ProfileTabs et rendre les compteurs cliquables**

Dans `src/app/u/[username]/page.tsx`, donner une ancre à la zone des onglets. Repérer `<ProfileTabs ...` (dans le bloc `canView ? <ProfileTabs .../>`) et l'envelopper d'un `<div id="profil-tabs">…</div>` (ou ajouter `id` au conteneur parent). Puis transformer les compteurs « vus »/« lus » en liens ancre :

```tsx
            {showFilms && <a href="#vus" className="active:scale-95"><b>{vusCount}</b> <span className="text-[var(--color-text-muted)]">vus</span></a>}
            {showBooks && <a href="#lus" className="active:scale-95"><b>{lusCount}</b> <span className="text-[var(--color-text-muted)]">lus</span></a>}
```

(Remplacer les `<span>` actuels de vusCount/lusCount par ces `<a>`. Le clic défile vers l'onglet — grâce à `scroll-behavior: smooth` déjà présent — et le hash déclenche la présélection du Step 1.)

- [ ] **Step 3 : Vérifier**

Run: `npx tsc --noEmit`
Expected: aucune sortie. Manuel : sur un profil, cliquer « vus » défile vers les onglets et sélectionne « Vus » ; « lus » sélectionne « Lu ».

- [ ] **Step 4 : Commit**

```bash
git add src/components/ProfileTabs.tsx "src/app/u/[username]/page.tsx"
git commit -m "feat(vulu): profil — les compteurs vus/lus ouvrent l'onglet correspondant"
```

---

### Task B2 : Modales abonnés / abonnements

**Files:**
- Create: `src/server/application/follow-lists.ts`, `src/app/api/users/[username]/followers/route.ts`, `src/app/api/users/[username]/following/route.ts`, `src/components/UserListModal.tsx`, `src/components/ProfileStats.tsx`
- Modify: `src/app/u/[username]/page.tsx`
- Test: `tests/application/follow-lists.test.ts`

**Interfaces:**
- Produces: `UserCard = { id: string; username: string; displayName: string; avatarUrl: string | null; plus: boolean; staff: boolean }`. `listFollowers(deps, userId): Promise<UserCard[]>`, `listFollowing(deps, userId): Promise<UserCard[]>`. Endpoints renvoient `{ users: UserCard[] }`.

- [ ] **Step 1 : Test des listes (échoue)**

Créer `tests/application/follow-lists.test.ts` :

```ts
import { describe, it, expect, beforeEach } from "vitest";
import { makeInMemoryDeps, type Deps } from "@/server/container";
import { FakeCatalog } from "../helpers/fake-catalog";
import { registerUser } from "@/server/application/register-user";
import { followUser } from "@/server/application/social";
import { listFollowers, listFollowing } from "@/server/application/follow-lists";

let deps: Deps; let a: string; let b: string;
const tastes = { filmGenreIds: [878], people: [] };
beforeEach(async () => {
  deps = makeInMemoryDeps(new FakeCatalog());
  a = (await registerUser(deps, { email: "a@x.io", username: "alice", displayName: "Alice", password: "password1", activeTabs: ["films"], tastes })).id;
  b = (await registerUser(deps, { email: "b@x.io", username: "bob", displayName: "Bob", password: "password1", activeTabs: ["films"], tastes })).id;
  await followUser(deps, a, b); // alice suit bob
});

describe("follow lists", () => {
  it("listFollowers(bob) contient alice", async () => {
    const followers = await listFollowers(deps, b);
    expect(followers.map((u) => u.username)).toContain("alice");
  });
  it("listFollowing(alice) contient bob", async () => {
    const following = await listFollowing(deps, a);
    expect(following.map((u) => u.username)).toContain("bob");
  });
  it("le DTO ne fuit pas de champ sensible (pas de passwordHash)", async () => {
    const [u] = await listFollowers(deps, b);
    expect(Object.keys(u!)).toEqual(expect.arrayContaining(["id", "username", "displayName", "avatarUrl", "plus", "staff"]));
    expect(u as Record<string, unknown>).not.toHaveProperty("passwordHash");
  });
});
```

- [ ] **Step 2 : Lancer → échoue**

Run: `npx vitest run tests/application/follow-lists.test.ts`
Expected: FAIL (module introuvable).

- [ ] **Step 3 : Implémenter les listes**

Créer `src/server/application/follow-lists.ts` :

```ts
import type { Deps } from "@/server/container";

export interface UserCard {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  plus: boolean;
  staff: boolean;
}

function toCard(u: { id: string; username: string; displayName: string; avatarUrl: string | null; plus: boolean; staff: boolean }): UserCard {
  return { id: u.id, username: u.username, displayName: u.displayName, avatarUrl: u.avatarUrl, plus: u.plus, staff: u.staff };
}

async function resolveCards(deps: Deps, ids: string[]): Promise<UserCard[]> {
  const users = await Promise.all(ids.map((id) => deps.users.findById(id)));
  return users.filter((u): u is NonNullable<typeof u> => u !== null).map(toCard);
}

export async function listFollowers(deps: Deps, userId: string): Promise<UserCard[]> {
  return resolveCards(deps, await deps.follows.followerIdsOf(userId));
}

export async function listFollowing(deps: Deps, userId: string): Promise<UserCard[]> {
  return resolveCards(deps, await deps.follows.followeeIdsOf(userId));
}
```

- [ ] **Step 4 : Test → passe**

Run: `npx vitest run tests/application/follow-lists.test.ts`
Expected: PASS.

- [ ] **Step 5 : Endpoints (visibilité respectée)**

Créer `src/app/api/users/[username]/followers/route.ts` :

```ts
import { getDeps } from "@/server/container";
import { currentUser, json } from "@/server/http/session";
import { toErrorResponse } from "@/server/http/errors";
import { NotFoundError, ForbiddenError } from "@/server/domain/errors";
import { canViewProfile } from "@/server/application/social";
import { listFollowers } from "@/server/application/follow-lists";

export async function GET(_req: Request, { params }: { params: Promise<{ username: string }> }) {
  try {
    const { username } = await params;
    const deps = await getDeps();
    const target = await deps.users.findByUsername(username.toLowerCase());
    if (!target) throw new NotFoundError("Profil introuvable");
    const viewer = await currentUser();
    if (!(await canViewProfile(deps, viewer?.id ?? "", target))) throw new ForbiddenError("Profil privé");
    return json({ users: await listFollowers(deps, target.id) });
  } catch (e) { return toErrorResponse(e); }
}
```

Créer `src/app/api/users/[username]/following/route.ts` — identique mais avec `listFollowing` :

```ts
import { getDeps } from "@/server/container";
import { currentUser, json } from "@/server/http/session";
import { toErrorResponse } from "@/server/http/errors";
import { NotFoundError, ForbiddenError } from "@/server/domain/errors";
import { canViewProfile } from "@/server/application/social";
import { listFollowing } from "@/server/application/follow-lists";

export async function GET(_req: Request, { params }: { params: Promise<{ username: string }> }) {
  try {
    const { username } = await params;
    const deps = await getDeps();
    const target = await deps.users.findByUsername(username.toLowerCase());
    if (!target) throw new NotFoundError("Profil introuvable");
    const viewer = await currentUser();
    if (!(await canViewProfile(deps, viewer?.id ?? "", target))) throw new ForbiddenError("Profil privé");
    return json({ users: await listFollowing(deps, target.id) });
  } catch (e) { return toErrorResponse(e); }
}
```

Vérifier la signature de `canViewProfile` (`grep -n "export async function canViewProfile" src/server/application/social.ts`) : `(deps, viewerId, target)`.

- [ ] **Step 6 : Composant `UserListModal`**

Créer `src/components/UserListModal.tsx` :

```tsx
"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Modal } from "./Modal";
import { Avatar } from "./Avatar";
import { CertifiedBadge } from "./CertifiedBadge";
import { StaffBadge } from "./StaffBadge";
import { api } from "@/lib/api-client";
import type { UserCard } from "@/server/application/follow-lists";

export function UserListModal({ title, endpoint, onClose }: { title: string; endpoint: string; onClose: () => void }) {
  const [users, setUsers] = useState<UserCard[] | null>(null);

  useEffect(() => {
    api.get<{ users: UserCard[] }>(endpoint).then((d) => setUsers(d.users)).catch(() => setUsers([]));
  }, [endpoint]);

  return (
    <Modal open onClose={onClose} title={title}>
      {users === null && <div className="space-y-2">{[0, 1, 2].map((i) => <div key={i} className="h-12 animate-pulse rounded-xl bg-[var(--color-border)]" />)}</div>}
      {users?.length === 0 && <p className="py-6 text-center text-sm text-[var(--color-text-muted)]">Personne pour l’instant.</p>}
      <div className="flex flex-col gap-1">
        {users?.map((u) => (
          <Link key={u.id} href={`/u/${u.username}`} onClick={onClose}
            className="flex items-center gap-3 rounded-xl p-2 transition-colors hover:bg-[var(--color-border)]">
            <Avatar name={u.displayName} src={u.avatarUrl} size={40} />
            <span className="min-w-0">
              <span className="flex items-center gap-1 font-semibold">{u.displayName}{u.staff && <StaffBadge />}{u.plus && <CertifiedBadge />}</span>
              <span className="block text-sm text-[var(--color-text-muted)]">@{u.username}</span>
            </span>
          </Link>
        ))}
      </div>
    </Modal>
  );
}
```

Vérifier les props de `Modal` (`grep -n "export function Modal" src/components/Modal.tsx`) : `{ open, onClose, title, children }`.

- [ ] **Step 7 : Wrapper client `ProfileStats`**

Créer `src/components/ProfileStats.tsx` (porte l'état d'ouverture des modales, car la page profil est un composant serveur) :

```tsx
"use client";
import { useState } from "react";
import { UserListModal } from "./UserListModal";

export function ProfileStats({ username, followers, following }: { username: string; followers: number; following: number }) {
  const [open, setOpen] = useState<null | "followers" | "following">(null);
  return (
    <>
      <button onClick={() => setOpen("followers")} className="active:scale-95"><b>{followers}</b> <span className="text-[var(--color-text-muted)]">abonnés</span></button>
      <button onClick={() => setOpen("following")} className="active:scale-95"><b>{following}</b> <span className="text-[var(--color-text-muted)]">abonnements</span></button>
      {open === "followers" && <UserListModal title="Abonnés" endpoint={`/api/users/${username}/followers`} onClose={() => setOpen(null)} />}
      {open === "following" && <UserListModal title="Abonnements" endpoint={`/api/users/${username}/following`} onClose={() => setOpen(null)} />}
    </>
  );
}
```

- [ ] **Step 8 : Câbler dans la page profil**

Dans `src/app/u/[username]/page.tsx`, importer `import { ProfileStats } from "@/components/ProfileStats";` et remplacer les deux `<span>` des compteurs abonnés/abonnements par :

```tsx
            <ProfileStats username={target.username} followers={followers} following={following} />
```

(Retirer les deux anciennes lignes `<span><b>{followers}</b>…` et `<span><b>{following}</b>…`.)

- [ ] **Step 9 : Vérifier**

Run: `npx tsc --noEmit && npx vitest run`
Expected: propre + vert. Manuel : cliquer « abonnés » / « abonnements » ouvre une modale listant les utilisateurs (avatar, pseudo, badges) ; clic sur un utilisateur → son profil ; compte privé non suivi → liste refusée (modale vide/erreur gérée).

- [ ] **Step 10 : Commit**

```bash
git add src/server/application/follow-lists.ts "src/app/api/users/[username]/followers/route.ts" "src/app/api/users/[username]/following/route.ts" src/components/UserListModal.tsx src/components/ProfileStats.tsx "src/app/u/[username]/page.tsx" tests/application/follow-lists.test.ts
git commit -m "feat(vulu): profil — modales abonnés/abonnements cliquables"
```

---

## Phase C — UX

### Task C1 : Bouton « Valider » proéminent

**Files:**
- Modify: `src/components/EntryEditor.tsx`

- [ ] **Step 1 : Renommer et styliser le bouton principal**

Dans `src/components/EntryEditor.tsx`, remplacer le bouton principal :

```tsx
      <button onClick={save} disabled={busy}
        className="mt-4 rounded-full bg-[var(--color-primary)] px-6 py-2 text-sm font-semibold text-white disabled:opacity-50">
        {busy ? "…" : "Enregistrer"}
      </button>
```

par :

```tsx
      <button onClick={save} disabled={busy}
        className="mt-5 w-full rounded-full bg-[var(--color-primary)] py-3 text-base font-bold text-white shadow-[0_4px_16px_color-mix(in_srgb,var(--color-primary)_45%,transparent)] transition-transform active:scale-[0.98] disabled:opacity-50">
        {busy ? "…" : "Valider"}
      </button>
```

- [ ] **Step 2 : Vérifier**

Run: `npx tsc --noEmit`
Expected: aucune sortie. Manuel : dans l'éditeur d'entrée, le bouton « Valider » est pleine largeur, coloré, avec ombre et effet d'appui.

- [ ] **Step 3 : Commit**

```bash
git add src/components/EntryEditor.tsx
git commit -m "feat(vulu): éditeur — bouton « Valider » proéminent (pleine largeur, accent, ombre)"
```

---

### Task C2 : Réactivité perçue (squelettes, feedback tactile, préchargement)

**Files:**
- Create: `src/app/feed/loading.tsx`, `src/app/u/[username]/loading.tsx`, `src/app/search/loading.tsx`, `src/app/work/[id]/loading.tsx`, `src/app/bibliotheque/loading.tsx`, `src/app/communautes/loading.tsx`
- Modify: `src/components/FeedCard.tsx`

- [ ] **Step 1 : Squelette réutilisable par route**

Créer les six fichiers `loading.tsx`. Chacun rend un squelette simple. Contenu identique pour tous (grille de blocs pulsés), par ex. `src/app/feed/loading.tsx` :

```tsx
export default function Loading() {
  return (
    <div className="space-y-3 p-1">
      {[0, 1, 2, 3].map((i) => <div key={i} className="h-40 animate-pulse rounded-2xl bg-[var(--color-border)]" />)}
    </div>
  );
}
```

Créer les cinq autres avec le même contenu (adapter le nombre de blocs si voulu : profil/œuvre 3 blocs, bibliothèque/communautés grille). Pour rester DRY sans sur-abstraire, un même corps par fichier est acceptable (Next exige un fichier par route).

- [ ] **Step 2 : Feedback tactile sur les cartes du feed**

Dans `src/components/FeedCard.tsx`, ajouter un retour d'appui discret sur l'article (sans casser l'overlay de lien). Repérer `<article className="relative mb-3 rounded-2xl border ...` et ajouter `transition-transform active:scale-[0.995]` à sa `className`.

- [ ] **Step 3 : Vérifier le préchargement**

Run: `grep -rn "prefetch={false}" src/components src/app`
Expected: aucune sortie (les `Link` utilisent le prefetch par défaut de Next). Si des occurrences existent sur la navigation principale, les retirer. (Aucune modification si le grep est vide.)

- [ ] **Step 4 : Vérifier**

Run: `npx tsc --noEmit`
Expected: aucune sortie. Manuel : naviguer entre feed/profil/recherche/œuvre → un squelette s'affiche instantanément ; appuyer sur une carte du feed → léger effet d'enfoncement.

- [ ] **Step 5 : Commit**

```bash
git add "src/app/feed/loading.tsx" "src/app/u/[username]/loading.tsx" "src/app/search/loading.tsx" "src/app/work/[id]/loading.tsx" "src/app/bibliotheque/loading.tsx" "src/app/communautes/loading.tsx" src/components/FeedCard.tsx
git commit -m "feat(vulu): réactivité — squelettes de chargement par route + feedback tactile cartes"
```

---

## Self-Review (couverture spec)

| Demande utilisateur | Tâche |
|---|---|
| Fiche œuvre : « aucun avis » alors que le mien existe | A1 |
| Temps de visionnage invisible sur mon profil | A2 |
| Clic vus/lus → onglet correspondant | B1 |
| Clic abonnés/abonnements → liste utilisateurs | B2 |
| Bouton « Enregistrer » → « Valider », plus visible | C1 |
| App plus réactive (squelettes, feedback, préchargement) | C2 |

Toutes les demandes du batch sont couvertes. Ordre : A (bugs) → B (stats) → C (UX). Chaque tâche est indépendamment testable et livrable.

## Notes pour la session d'exécution

- Base de dev : MongoDB Atlas. Serveur : `npm run dev`.
- A2 : le backfill appelle TMDB ; en test, `FakeCatalog` fournit `runtime` pour `603` (136) et `1396` (47). Le budget `MAX_BACKFILL` borne les appels par affichage de profil.
- B2 : `canViewProfile(deps, viewerId, target)` — un compte privé non suivi renvoie `403` (modale gère l'échec en liste vide).
- C2 : Next exige un `loading.tsx` par segment de route ; contenu volontairement simple.
