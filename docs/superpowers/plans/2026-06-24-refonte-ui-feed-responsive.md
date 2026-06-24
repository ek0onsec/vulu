# Refonte UI feed + navigation responsive — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Onglet « Suivis » (following only), feed en escalier façon Twitter, et navigation mobile moderne (side menu, bottom nav 4 entrées, recherche flottante en overlay).

**Architecture:** Backend — nouveau scope feed `following` (remplace `circle`) propagé port → adaptateurs → application → route. Frontend — refonte présentationnelle de `FeedCard` et `AppShell`, plus 3 composants mobiles (`SideMenu`, `SearchPanel` extrait, `SearchIsland`).

**Tech Stack:** TypeScript strict (`noUncheckedIndexedAccess`), Next.js 16 (server + client components), Tailwind v4, Vitest, MongoDB driver natif.

## Global Constraints

- Toute dépendance externe derrière un port ; le domaine ne connaît ni Mongo ni Next. (CLAUDE.md)
- Aucune attribution IA dans le code ni les commits ; pas de co-auteur.
- Desktop (`md+`) inchangé : sidebar gauche + rail droite. Les changements de nav ne touchent que `< md`.
- Onglet « Suivis » = following only : visible si `audiences.public || (audiences.circle && viewerCercle.has(author.id))`. Les posts communautaires-seuls ne remontent PAS dans « Suivis ».
- Libellés exacts : `« Pour toi »` (scope `foryou`), `« Suivis »` (scope `following`).
- DRY : la logique de recherche n'est PAS dupliquée — un seul `SearchPanel` sert `/search` et l'overlay.
- Icônes disponibles uniquement : home, search, lists, profile, sun, moon, heart(-filled), comment, star(-filled), plus, settings, camera, check, trending, user-plus, back, dots, logout, lock, bell, download, shield, community. (Pas de « x » → fermeture via `back`.)

---

### Task 1: Scope feed `following` (backend, TDD)

**Files:**
- Modify: `src/server/ports/repositories.ts:49-52` (opts de `feed`)
- Modify: `src/server/adapters/memory/index.ts:83-94` (`feed`)
- Modify: `src/server/adapters/mongo/repositories.ts:85-93` (`feed`)
- Modify: `src/server/application/feed.ts:40-57` (`buildFeed`)
- Modify: `src/app/api/feed/route.ts:10` (parsing du scope)
- Test: `tests/application/feed.test.ts`, `tests/adapters/memory.test.ts`, `tests/adapters/mongo-repositories.test.ts`

**Interfaces:**
- Consumes: `deps.follows.followeeIdsOf(userId): Promise<string[]>`, `getCircle(deps, userId): Promise<Set<string>>`.
- Produces: `LibraryEntryRepository.feed(opts)` avec `opts.scope: "foryou" | "following"` et `opts.followingUserIds: string[]` ; `buildFeed(deps, viewerId, { scope: "foryou" | "following"; cursor; limit })`.

- [ ] **Step 1: Write the failing application test**

Ajouter dans `tests/application/feed.test.ts`, à la fin du `describe("buildFeed", …)` (le setup existant fait déjà `followUser(deps, me, friend)`), ce bloc :

```ts
  it("scope 'following' : montre le public d'un suivi, masque un non-suivi", async () => {
    const ref = { source: "tmdb" as const, externalId: "603", type: "movie" as const };
    await rateOrReviewWork(deps, friend, ref, { rating: 4, text: "suivi public", audiences: { public: true, circle: true, communityIds: [] } });
    await rateOrReviewWork(deps, stranger, ref, { rating: 3, text: "non suivi", audiences: { public: true, circle: true, communityIds: [] } });
    const items = await buildFeed(deps, me, { scope: "following", cursor: null, limit: 10 });
    expect(items.map((i) => i.author.username)).toEqual(["friend"]);
  });

  it("scope 'following' : post 'cercle' d'un suivi non-mutuel masqué, mutuel visible", async () => {
    const ref = { source: "tmdb" as const, externalId: "603", type: "movie" as const };
    // friend ne suit pas me → non mutuel → son post cercle est masqué en 'following'
    await rateOrReviewWork(deps, friend, ref, { rating: 4, text: "cercle", audiences: { public: false, circle: true, communityIds: [] } });
    let items = await buildFeed(deps, me, { scope: "following", cursor: null, limit: 10 });
    expect(items).toHaveLength(0);
    // friend suit me en retour → mutuel → visible
    await followUser(deps, friend, me);
    items = await buildFeed(deps, me, { scope: "following", cursor: null, limit: 10 });
    expect(items.map((i) => i.author.username)).toEqual(["friend"]);
  });
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run tests/application/feed.test.ts`
Expected: FAIL — `buildFeed` n'accepte pas encore `scope: "following"` (erreur de type / comportement).

- [ ] **Step 3: Update the port opts**

Dans `src/server/ports/repositories.ts`, remplacer les lignes des opts de `feed` :

```ts
    scope: "foryou" | "following";
    circleUserIds: string[];
    followingUserIds: string[];
```

(garder le reste des opts — `viewerId`, `domains`, `cursor`, `limit` — inchangé)

- [ ] **Step 4: Update the memory adapter**

Dans `src/server/adapters/memory/index.ts`, remplacer la signature et le filtre de `feed` :

```ts
  async feed(opts: { scope: "foryou" | "following"; circleUserIds: string[]; followingUserIds: string[]; viewerId: string; domains: string[]; cursor: { activityAt: Date; id: string } | null; limit: number; }) {
    const circle = new Set(opts.circleUserIds);
    const following = new Set(opts.followingUserIds);
    return [...this.byId.values()]
      .filter((e) => isFeedVisible(e))
      .filter((e) => opts.domains.includes(e.domain))
      .filter((e) => opts.scope === "following"
        ? (following.has(e.userId) && (e.audiences.public || (e.audiences.circle && circle.has(e.userId))))
        : (e.audiences.public || e.audiences.communityIds.length > 0 || (e.audiences.circle && circle.has(e.userId))))
      .filter((e) => !opts.cursor || e.activityAt!.getTime() < opts.cursor.activityAt.getTime())
      .sort((a, b) => b.activityAt!.getTime() - a.activityAt!.getTime())
      .slice(0, opts.limit);
  }
```

- [ ] **Step 5: Update the Mongo adapter**

Dans `src/server/adapters/mongo/repositories.ts`, remplacer la signature et le bloc `visibility` de `feed` :

```ts
  async feed(opts: { scope: "foryou" | "following"; circleUserIds: string[]; followingUserIds: string[]; viewerId: string; domains: string[]; cursor: { activityAt: Date; id: string } | null; limit: number; }) {
    const visibility: Filter<M.WithIdEntry> = opts.scope === "following"
      ? { userId: { $in: opts.followingUserIds }, $or: [
          { "audiences.public": true },
          { "audiences.circle": true, userId: { $in: opts.circleUserIds } },
        ] }
      : { $or: [
          { "audiences.public": true },
          { "audiences.communityIds.0": { $exists: true } },
          { "audiences.circle": true, userId: { $in: opts.circleUserIds } },
        ] };
```

(le reste de la méthode — `and`, `activityAt`, tri, limit — reste inchangé)

- [ ] **Step 6: Update buildFeed**

Dans `src/server/application/feed.ts`, remplacer la signature et le corps utile de `buildFeed` :

```ts
export async function buildFeed(
  deps: Deps, viewerId: string, opts: { scope: "foryou" | "following"; cursor: { activityAt: Date; id: string } | null; limit: number },
): Promise<FeedItem[]> {
  const viewer = await deps.users.findById(viewerId);
  if (!viewer) throw new NotFoundError("Utilisateur introuvable");
  const [circle, following] = await Promise.all([
    getCircle(deps, viewerId),
    deps.follows.followeeIdsOf(viewerId),
  ]);

  const entries = await deps.entries.feed({
    scope: opts.scope,
    circleUserIds: [...circle],
    followingUserIds: following,
    viewerId,
    domains: viewer.activeTabs,
    cursor: opts.cursor,
    limit: opts.limit,
  });

  return enrichEntries(deps, viewerId, entries);
}
```

- [ ] **Step 7: Update the route**

Dans `src/app/api/feed/route.ts`, remplacer la ligne du scope :

```ts
    const scope = sp.get("scope") === "following" ? "following" : "foryou";
```

- [ ] **Step 8: Fix existing adapter test call sites**

Les appels directs à `.feed(...)` dans les tests d'adaptateurs passent maintenant `followingUserIds`. Remplacer dans `tests/adapters/memory.test.ts` (3 appels) et `tests/adapters/mongo-repositories.test.ts` (1 appel) chaque `{ scope: "foryou", circleUserIds: […], …` par l'ajout de `followingUserIds: []`. Exemple :

```ts
const res = await r.feed({ scope: "foryou", circleUserIds: ["friend"], followingUserIds: [], viewerId: "me", domains: ["films"], cursor: null, limit: 10 });
```

(les 3 autres : `circleUserIds: []` + `followingUserIds: []` ; conserver les `cursor`/`limit` existants de chaque appel)

- [ ] **Step 9: Add a memory adapter test for the following scope**

Ajouter dans `tests/adapters/memory.test.ts`, dans le `describe("InMemory repos", …)` après le test feed existant :

```ts
  it("feed scope 'following' filtre par followingUserIds + visibilité", async () => {
    const r = new InMemoryLibraryEntryRepository();
    const t0 = new Date(2024, 0, 1), t1 = new Date(2024, 0, 2), t2 = new Date(2024, 0, 3);
    await r.upsert(entry("pub_followed", { userId: "followed", audiences: { public: true, circle: true, communityIds: [] }, createdAt: t0, activityAt: t0 }));
    await r.upsert(entry("cir_mutual", { userId: "mutual", audiences: { public: false, circle: true, communityIds: [] }, createdAt: t1, activityAt: t1 }));
    await r.upsert(entry("pub_other", { userId: "stranger", audiences: { public: true, circle: true, communityIds: [] }, createdAt: t2, activityAt: t2 }));
    const res = await r.feed({ scope: "following", circleUserIds: ["mutual"], followingUserIds: ["followed", "mutual"], viewerId: "me", domains: ["films"], cursor: null, limit: 10 });
    expect(res.map((e) => e.id).sort()).toEqual(["cir_mutual", "pub_followed"]);
  });
```

- [ ] **Step 10: Run all affected tests**

Run: `npx vitest run tests/application/feed.test.ts tests/adapters/memory.test.ts tests/adapters/mongo-repositories.test.ts`
Expected: PASS (incl. les 2 nouveaux tests buildFeed + le test mémoire following).

- [ ] **Step 11: Typecheck + commit**

```bash
npx tsc --noEmit
git add src/server/ports/repositories.ts src/server/adapters/memory/index.ts src/server/adapters/mongo/repositories.ts src/server/application/feed.ts src/app/api/feed/route.ts tests/application/feed.test.ts tests/adapters/memory.test.ts tests/adapters/mongo-repositories.test.ts
git commit -m "feat(vulu): feed scope 'following' (Suivis = comptes suivis)"
```

---

### Task 2: Renommage onglets feed (`FeedClient.tsx`)

**Files:**
- Modify: `src/app/feed/FeedClient.tsx:9,46,65`

**Interfaces:**
- Consumes: route `/api/feed?scope=following` (Task 1). Le composant envoie déjà `?scope=${tab.id}`.
- Produces: rien (UI).

- [ ] **Step 1: Update the tabs + comment + empty copy**

Dans `src/app/feed/FeedClient.tsx`, remplacer le commentaire ligne 9 :

```ts
// onglet = "foryou" | "following" | "c:<communityId>"
```

Remplacer la définition `tabs` :

```ts
  const tabs = [{ id: "foryou", label: "Pour toi" }, { id: "following", label: "Suivis" }, ...pinned.map((c) => ({ id: `c:${c.id}`, label: c.name }))];
```

Remplacer la copie d'état vide :

```tsx
          {tab === "following" ? "Personne que tu suis n’a publié récemment. Suis plus de monde !" : tab.startsWith("c:") ? "Rien dans cette communauté. Partages-y un avis depuis une fiche !" : "Rien ici pour l’instant. Note un film ou un livre pour lancer ton feed."}
```

- [ ] **Step 2: Typecheck + commit**

```bash
npx tsc --noEmit
git add src/app/feed/FeedClient.tsx
git commit -m "feat(vulu): onglets feed « Pour toi » / « Suivis »"
```

---

### Task 3: Refonte `FeedCard` — effet escalier 3 niveaux

**Files:**
- Modify: `src/components/FeedCard.tsx:31-90`

**Interfaces:**
- Consumes: `FeedItem` (inchangé). `formatProgress`, `activityVerb`, `RatingStars` déjà importés.
- Produces: rien (UI).

- [ ] **Step 1: Replace the card body**

Dans `src/components/FeedCard.tsx`, remplacer tout le `return ( … )` (du `<article>` au `</article>`) par cette structure escalier (avatar en col 1 ; nom/@pseudo en col 3 ; contenu décalé `pl-6` sous le nom ; ordre verbe→texte→titre→affiche→note→progression) :

```tsx
  return (
    <article className="mb-3 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 transition-shadow hover:shadow-[0_2px_20px_rgba(0,0,0,0.05)]">
      <div className="flex gap-3">
        <Link href={`/u/${item.author.username}`} className="shrink-0">
          <Avatar name={item.author.displayName} src={item.author.avatarUrl} size={42} />
        </Link>

        <div className="min-w-0 flex-1">
          <header className="flex items-start gap-2 text-sm">
            <div className="min-w-0">
              <span className="font-semibold">
                <Link href={`/u/${item.author.username}`} className="hover:underline">{item.author.displayName}</Link>
                {item.author.staff && <StaffBadge />}
                {item.author.plus && <CertifiedBadge />}
              </span>
              <span className="text-[var(--color-text-muted)]"> @{item.author.username} · {relativeTime(item.entry.createdAt)}</span>
              <p className="text-xs text-[var(--color-text-muted)]">{item.entry.status === "done" ? "a noté" : (activityVerb(item.entry.status, item.work.type) ?? (item.work.type === "book" ? "veut lire" : "veut voir"))}</p>
            </div>
            <div className="ml-auto flex shrink-0 items-center gap-1.5">
              {item.communities.length > 0 && (
                <Link href={`/communaute/${item.communities[0]!.id}`}
                  className="rounded-full bg-[color-mix(in_srgb,var(--color-primary)_12%,transparent)] px-2.5 py-1 text-xs font-medium text-[var(--color-primary)] hover:underline">
                  via {item.communities[0]!.name}{item.communities.length > 1 ? ` +${item.communities.length - 1}` : ""}
                </Link>
              )}
              <span className={`rounded-full px-2.5 py-1 text-xs ${
                isPublic
                  ? "bg-[color-mix(in_srgb,var(--color-accent)_22%,transparent)] text-[var(--color-text)]"
                  : "bg-[color-mix(in_srgb,var(--color-primary)_14%,transparent)] text-[var(--color-primary)]"
              }`}>{isPublic ? "Public" : "Cercle"}</span>
            </div>
          </header>

          <div className="mt-2 pl-6">
            {item.entry.text && <p className="mb-2 line-clamp-3 text-sm text-[var(--color-text)]">{item.entry.text}</p>}
            <Link href={`/work/${item.work.id}`} className="block">
              <p className="font-display text-lg font-semibold leading-tight">{item.work.title}</p>
              <p className="text-xs text-[var(--color-text-muted)]">{item.work.year ?? ""} · {typeLabel}</p>
              <div className="mt-2 aspect-[2/3] w-40 max-w-[55%] overflow-hidden rounded-xl bg-[var(--color-border)]"
                style={item.work.posterUrl ? { backgroundImage: `url(${item.work.posterUrl})`, backgroundSize: "cover", backgroundPosition: "center" } : undefined} />
              {item.entry.rating !== null && (
                <div className="mt-2 flex items-center gap-2">
                  <RatingStars value={item.entry.rating} size={16} />
                  <span className="text-sm font-semibold">{item.entry.rating.toFixed(1).replace(".", ",")}/5</span>
                </div>
              )}
              {item.entry.status === "in_progress" && formatProgress(item.entry, item.work) && (
                <p className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-[color-mix(in_srgb,var(--color-primary)_12%,transparent)] px-2.5 py-1 text-xs font-semibold text-[var(--color-primary)]">
                  {formatProgress(item.entry, item.work)}
                </p>
              )}
            </Link>
          </div>

          <footer className="mt-2 flex items-center gap-1 pl-6 text-[var(--color-text-muted)]">
            <button onClick={toggleLike} aria-pressed={liked}
              className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm transition-colors hover:bg-[var(--color-border)] ${liked ? "text-[var(--color-primary)]" : ""}`}>
              <Icon name={liked ? "heart-filled" : "heart"} size={19} /> {likes}
            </button>
            <Link href={`/post/${item.entry.id}`}
              className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm transition-colors hover:bg-[var(--color-border)]">
              <Icon name="comment" size={19} /> {item.commentCount}
            </Link>
          </footer>
        </div>
      </div>
    </article>
  );
```

- [ ] **Step 2: Typecheck + visual check + commit**

```bash
npx tsc --noEmit
```
Vérifier sur `/feed` : avatar à gauche, contenu décalé sous le nom (gouttière), affiche sous le titre, note sous l'affiche.

```bash
git add src/components/FeedCard.tsx
git commit -m "feat(vulu): FeedCard en escalier (texte → titre → affiche → note)"
```

---

### Task 4: `/api/me` enrichi (compteurs abonnés/abonnements)

**Files:**
- Modify: `src/app/api/me/route.ts:8-11`

**Interfaces:**
- Consumes: `deps.follows.countFollowers(id)`, `deps.follows.countFollowing(id)`. `selfUser(user)` inclut déjà `activeTabs`.
- Produces: réponse `GET /api/me` = `{ user, followers: number, following: number }`.

- [ ] **Step 1: Update the GET handler**

Dans `src/app/api/me/route.ts`, remplacer le `GET` :

```ts
export async function GET() {
  try {
    const user = await requireUser();
    const deps = await getDeps();
    const [followers, following] = await Promise.all([
      deps.follows.countFollowers(user.id),
      deps.follows.countFollowing(user.id),
    ]);
    return json({ user: selfUser(user), followers, following });
  } catch (e) { return toErrorResponse(e); }
}
```

- [ ] **Step 2: Typecheck + commit**

```bash
npx tsc --noEmit
git add src/app/api/me/route.ts
git commit -m "feat(vulu): /api/me renvoie compteurs abonnés/abonnements"
```

---

### Task 5: `SideMenu` + navigation mobile (`AppShell.tsx`)

**Files:**
- Create: `src/components/SideMenu.tsx`
- Modify: `src/components/AppShell.tsx`

**Interfaces:**
- Consumes: réponse `/api/me` enrichie (Task 4) ; `Avatar`, `ThemeToggle`, `Icon`, `CertifiedBadge`, `StaffBadge`.
- Produces: `SideMenu` (props ci-dessous). Nouvelle interface `Me` de l'AppShell avec `followers`/`following`.

- [ ] **Step 1: Create `SideMenu.tsx`**

```tsx
"use client";
import Link from "next/link";
import { Avatar } from "./Avatar";
import { Icon } from "./Icon";
import { ThemeToggle } from "./ThemeToggle";
import { CertifiedBadge } from "./CertifiedBadge";
import { StaffBadge } from "./StaffBadge";

interface MenuUser { username: string; displayName: string; avatarUrl: string | null; plus: boolean; staff: boolean; private: boolean; followers: number; following: number }

const LINKS = [
  { href: "/u/me", label: "Profil", icon: "profile" as const },
  { href: "/plus", label: "vulu+", icon: "star" as const },
  { href: "/parametres", label: "Paramètres", icon: "settings" as const },
];

/** Panneau glissant depuis la gauche (mobile). Présentationnel : ouverture/fermeture pilotées par le parent. */
export function SideMenu({ open, onClose, me, onLogout }: { open: boolean; onClose: () => void; me: MenuUser | null; onLogout: () => void }) {
  return (
    <div className={`fixed inset-0 z-40 md:hidden ${open ? "" : "pointer-events-none"}`} aria-hidden={!open}>
      <div onClick={onClose}
        className={`absolute inset-0 bg-black/40 transition-opacity ${open ? "opacity-100" : "opacity-0"}`} />
      <aside
        className={`absolute left-0 top-0 flex h-full w-[78%] max-w-xs flex-col gap-4 border-r border-[var(--color-border)] bg-[var(--color-surface)] p-4 transition-transform ${open ? "translate-x-0" : "-translate-x-full"}`}>
        {me && (
          <>
            <Link href="/u/me" onClick={onClose} className="flex flex-col gap-2">
              <Avatar name={me.displayName} src={me.avatarUrl} size={52} />
              <span>
                <span className="flex items-center gap-1 font-semibold">
                  {me.displayName}{me.staff && <StaffBadge size={14} />}{me.plus && <CertifiedBadge size={14} />}
                </span>
                <span className="flex items-center gap-1 text-sm text-[var(--color-text-muted)]">@{me.username}{me.private && <Icon name="lock" size={12} />}</span>
              </span>
            </Link>
            <div className="flex gap-4 text-sm">
              <span><strong>{me.following}</strong> <span className="text-[var(--color-text-muted)]">abonnements</span></span>
              <span><strong>{me.followers}</strong> <span className="text-[var(--color-text-muted)]">abonnés</span></span>
            </div>
          </>
        )}

        <nav className="flex flex-col gap-1 border-t border-[var(--color-border)] pt-3">
          {LINKS.map((l) => (
            <Link key={l.href} href={l.href} onClick={onClose}
              className="flex items-center gap-3 rounded-xl px-2 py-2.5 text-[var(--color-text)] transition-colors hover:bg-[var(--color-border)]">
              <Icon name={l.icon} /> {l.label}
            </Link>
          ))}
        </nav>

        <div className="mt-auto flex flex-col gap-2 border-t border-[var(--color-border)] pt-3">
          <div className="px-1"><ThemeToggle /></div>
          <button onClick={() => { onClose(); onLogout(); }}
            className="flex items-center gap-3 rounded-xl px-2 py-2.5 text-left text-[var(--color-text)] transition-colors hover:bg-[var(--color-border)]">
            <Icon name="logout" /> Se déconnecter
          </button>
        </div>
      </aside>
    </div>
  );
}
```

- [ ] **Step 2: Update `AppShell` — Me interface, state, fetch**

Dans `src/components/AppShell.tsx` : importer `SideMenu` (`import { SideMenu } from "./SideMenu";`), étendre `Me` et ajouter l'état d'ouverture :

```ts
interface Me { username: string; displayName: string; avatarUrl: string | null; plus: boolean; staff: boolean; private: boolean; followers: number; following: number }
```

Ajouter, à côté des autres `useState` :

```ts
  const [menuOpen, setMenuOpen] = useState(false);
```

Remplacer le fetch `/api/me` pour récupérer les compteurs :

```ts
  useEffect(() => {
    api.get<{ user: Omit<Me, "followers" | "following">; followers: number; following: number }>("/api/me")
      .then((d) => setMe({ ...d.user, followers: d.followers, following: d.following }))
      .catch(() => setMe(null));
  }, []);
```

Fermer le menu à chaque navigation :

```ts
  useEffect(() => { setMenuOpen(false); }, [path]);
```

- [ ] **Step 3: Update `AppShell` — bottom nav (4 entrées) + header mobile + SideMenu**

Dans `src/components/AppShell.tsx`, ajouter au-dessus de `NAV` une liste dédiée à la barre du bas mobile :

```ts
const BOTTOM_NAV: { href: string; label: string; icon: IconName; pulse?: boolean }[] = [
  { href: "/feed", label: "Accueil", icon: "home", pulse: true },
  { href: "/communautes", label: "Communautés", icon: "community" },
  { href: "/bibliotheque", label: "Bibliothèque", icon: "lists" },
  { href: "/notifications", label: "Notifications", icon: "bell" },
];
```

Remplacer le bloc `<nav … md:hidden>` (bottom nav) pour itérer sur `BOTTOM_NAV` et gérer le badge non-lus sur `bell` :

```tsx
      <nav className="fixed inset-x-0 bottom-0 z-10 flex justify-around border-t border-[var(--color-border)] bg-[var(--color-surface)] py-2 md:hidden">
        {BOTTOM_NAV.map((n) => (
          <Link key={n.href} href={n.href} aria-label={n.label}
            className={`relative rounded-full p-2 ${active(n.href) ? "text-[var(--color-primary)]" : "text-[var(--color-text-muted)]"}`}>
            <Icon name={n.icon} size={24} />
            {n.pulse && !active(n.href) && (
              <span className="absolute right-1.5 top-1.5 h-2 w-2 animate-ping rounded-full bg-[var(--color-accent)]" />
            )}
            {n.icon === "bell" && unread > 0 && (
              <span className="absolute right-0.5 top-0.5 flex min-w-[1.1rem] items-center justify-center rounded-full bg-[var(--color-primary)] px-1 text-[0.6rem] font-bold leading-4 text-white">{unread > 9 ? "9+" : unread}</span>
            )}
          </Link>
        ))}
      </nav>
```

Ajouter un header mobile sticky (avatar à droite ouvrant le menu) — l'insérer juste à l'intérieur de `<main …>`, avant `{children}` :

```tsx
        <div className="sticky top-0 z-30 -mx-3 mb-2 flex items-center justify-between border-b border-[var(--color-border)] bg-[var(--color-surface)]/90 px-3 py-2 backdrop-blur md:hidden">
          <Link href="/feed" className="font-display text-2xl font-bold text-[var(--color-primary)]">vulu</Link>
          <button onClick={() => setMenuOpen(true)} aria-label="Ouvrir le menu">
            {me && <Avatar name={me.displayName} src={me.avatarUrl} size={32} />}
          </button>
        </div>
```

Monter le `SideMenu` (n'importe où dans le `return`, par ex. juste avant la `<nav>` du bas) :

```tsx
      <SideMenu open={menuOpen} onClose={() => setMenuOpen(false)} me={me} onLogout={logout} />
```

- [ ] **Step 4: Remove the floating `+` button on mobile**

Dans `src/components/AppShell.tsx`, supprimer le `<Link … aria-label="Rechercher une œuvre" … md:hidden>` (le bouton flottant `+`). La recherche mobile passe par l'island (Task 7).

- [ ] **Step 5: Typecheck + visual check + commit**

```bash
npx tsc --noEmit
```
Vérifier en mobile : bottom nav à 4 icônes, header avec avatar à droite, tap → menu glissant, liens + déconnexion OK. Desktop inchangé.

```bash
git add src/components/SideMenu.tsx src/components/AppShell.tsx
git commit -m "feat(vulu): nav mobile — side menu + bottom nav 4 entrées"
```

---

### Task 6: Extraction `SearchPanel` (DRY)

**Files:**
- Create: `src/components/SearchPanel.tsx`
- Modify: `src/app/search/SearchClient.tsx`

**Interfaces:**
- Consumes: rien de nouveau (déplacement de logique existante).
- Produces: `SearchPanel({ activeTabs: Domain[]; autoFocus?: boolean })` — composant client réutilisable (champ + debounce + résultats œuvres/@membres).

- [ ] **Step 1: Create `SearchPanel.tsx` from the current SearchClient body**

Créer `src/components/SearchPanel.tsx` en **déplaçant intégralement** le contenu actuel de `src/app/search/SearchClient.tsx` (toutes les lignes 1→117 : `"use client"`, imports, hooks, `open()`, et le JSX), avec **deux seuls changements** :

1. Renommer la fonction exportée et sa signature :
```ts
export function SearchPanel({ activeTabs, autoFocus = true }: { activeTabs: Domain[]; autoFocus?: boolean }) {
```
2. Rendre l'`autoFocus` de l'`<input>` paramétrable — remplacer `<input autoFocus value={q} …` par :
```tsx
      <input autoFocus={autoFocus} value={q} onChange={(e) => setQ(e.target.value)}
```

Tout le reste (imports `TabSwitcher`, `Avatar`, `api`, états, debounce, `open`, JSX des résultats) est conservé tel quel.

- [ ] **Step 2: Replace `SearchClient.tsx` with a thin wrapper**

Remplacer **tout** le contenu de `src/app/search/SearchClient.tsx` par :

```tsx
"use client";
import { SearchPanel } from "@/components/SearchPanel";
import type { Domain } from "@/server/domain/entities";

export function SearchClient({ activeTabs }: { activeTabs: Domain[] }) {
  return <SearchPanel activeTabs={activeTabs} />;
}
```

- [ ] **Step 3: Typecheck + visual check + commit**

```bash
npx tsc --noEmit
```
Vérifier que la page `/search` fonctionne exactement comme avant (recherche œuvres + `@membres`).

```bash
git add src/components/SearchPanel.tsx src/app/search/SearchClient.tsx
git commit -m "refactor(vulu): extrait SearchPanel réutilisable de SearchClient"
```

---

### Task 7: `SearchIsland` (pilule flottante + overlay, mobile)

**Files:**
- Create: `src/components/SearchIsland.tsx`
- Modify: `src/app/feed/FeedClient.tsx`

**Interfaces:**
- Consumes: `SearchPanel` (Task 6) ; `activeTabs` (déjà prop de `FeedClient`) ; `Icon`.
- Produces: `SearchIsland({ activeTabs: Domain[] })` — pilule sticky `< md` + overlay plein écran.

- [ ] **Step 1: Create `SearchIsland.tsx`**

```tsx
"use client";
import { useEffect, useState } from "react";
import { Icon } from "./Icon";
import { SearchPanel } from "./SearchPanel";
import type { Domain } from "@/server/domain/entities";

/** Recherche mobile : pilule flottante sticky (sous les onglets) + overlay plein écran au tap. */
export function SearchIsland({ activeTabs }: { activeTabs: Domain[] }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <div className="md:hidden">
      <button onClick={() => setOpen(true)}
        className="sticky top-14 z-20 mb-3 flex w-full items-center gap-2 rounded-full border border-[var(--color-border)] bg-[var(--color-surface)]/95 px-4 py-2.5 text-sm text-[var(--color-text-muted)] shadow-sm backdrop-blur">
        <Icon name="search" size={18} /> Rechercher une œuvre, @un membre…
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex flex-col bg-[var(--color-bg)]">
          <div className="flex items-center gap-2 border-b border-[var(--color-border)] px-3 py-2">
            <button onClick={() => setOpen(false)} aria-label="Fermer la recherche" className="rounded-full p-2 hover:bg-[var(--color-border)]">
              <Icon name="back" size={22} />
            </button>
            <span className="font-semibold">Recherche</span>
          </div>
          <div className="flex-1 overflow-y-auto p-3">
            <SearchPanel activeTabs={activeTabs} autoFocus />
          </div>
        </div>
      )}
    </div>
  );
}
```

> Note : `SearchPanel` affiche déjà son propre titre « Recherche » et le `TabSwitcher` ; c'est cohérent dans l'overlay.

- [ ] **Step 2: Mount `SearchIsland` under the tabs in `FeedClient`**

Dans `src/app/feed/FeedClient.tsx` : importer le composant et le rendre **juste après** le bloc des onglets (la `<div>` des tabs) et **avant** `<FeedComposer …>`. Importer aussi le type si besoin (`Domain` déjà importé).

```tsx
import { SearchIsland } from "@/components/SearchIsland";
```

Et dans le JSX, après la `</div>` de fermeture des onglets :

```tsx
      <SearchIsland activeTabs={activeTabs} />
```

`activeTabs` est déjà une prop de `FeedClient` (actuellement non utilisée) — la consommer ici.

- [ ] **Step 3: Hide the desktop composer on mobile**

Toujours dans `src/app/feed/FeedClient.tsx`, le `FeedComposer` doit disparaître `< md` (remplacé par l'island). Envelopper son rendu :

```tsx
      <div className="hidden md:block">
        <FeedComposer displayName={displayName} avatarUrl={avatarUrl} />
      </div>
```

- [ ] **Step 4: Typecheck + full suite + visual check**

```bash
npx tsc --noEmit && npx vitest run
```
Expected : typecheck OK ; suite verte.
Vérifier en mobile : pilule flottante sous les onglets (ne les masque pas), suit le scroll, tap → overlay plein écran avec recherche fonctionnelle ; composer/`+` absents.

- [ ] **Step 5: Commit**

```bash
git add src/components/SearchIsland.tsx src/app/feed/FeedClient.tsx
git commit -m "feat(vulu): recherche mobile en island flottante + overlay"
```

---

## Self-review

- **Couverture spec :** §1 scope `following` → Task 1 ✓ ; §2 renommage onglets → Task 2 ✓ ; §3 FeedCard escalier → Task 3 ✓ ; §4 nav responsive (bottom nav 4, header avatar, suppression `+`/composer) → Tasks 5 & 7 ✓ ; §5 SideMenu → Task 5 ✓ ; §6 SearchPanel + SearchIsland → Tasks 6 & 7 ✓ ; §7 `/api/me` enrichi → Task 4 ✓ ; §8 tests → Task 1 (steps 1, 9) + typecheck/suite dans chaque task ✓.
- **Placeholders :** aucun — chaque étape de code est complète ; l'extraction SearchPanel (Task 6) est un déplacement mécanique précis (2 changements explicités).
- **Cohérence des types :** `feed` opts `{ scope: "foryou" | "following"; circleUserIds; followingUserIds; … }` identique au port (Task 1 step 3), aux deux adaptateurs (steps 4–5) et aux call sites de test (step 8) ; `buildFeed` scope `"foryou" | "following"` cohérent route↔application↔tests ; `Me` enrichi (`followers`/`following`) cohérent entre `/api/me` (Task 4), AppShell (Task 5 step 2) et SideMenu `MenuUser` ; `SearchPanel({ activeTabs, autoFocus })` cohérent entre Tasks 6 et 7.
- **Ordre d'exécution :** Task 4 (api/me) avant Task 5 (AppShell consomme les compteurs) ; Task 6 (SearchPanel) avant Task 7 (SearchIsland l'importe). Respecté par la numérotation.
