# Épisodes Incrément 2b-ii : like + commentaires — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permettre de liker et commenter un avis d'épisode partagé, à parité avec les avis d'œuvre, en réutilisant les collections/routes existantes.

**Architecture:** Les likes/commentaires sont clés par id (unique). On ajoute `EpisodeEntryRepository.findById`, on généralise la visibilité de `engagement.ts` à `{ userId, audiences }`, on ajoute les compteurs à `EpisodeFeedItem`, et on généralise la page post via `getPostItem` (union). L'UII `EpisodeFeedCard` gagne like + commentaires + lien `/post/{id}`.

**Tech Stack:** Next.js (version custom — lire `node_modules/next/dist/docs/`), TypeScript strict (`noUncheckedIndexedAccess`), Vitest, MongoDB.

## Global Constraints

- **Typage strict sans `any`** ; accès indexés sécurisés.
- **Réutilisation** : collections `likes`/`comments` et routes `/api/entries/[id]/...` inchangées ; un id d'épisode y transite.
- Un avis d'épisode non partagé (privé) n'est like/commentable que par son auteur (via la visibilité).
- Tests : `npm test` ; typecheck `npx tsc --noEmit` ; build `npm run build`.

---

### Task 1: `EpisodeEntryRepository.findById`

**Files:**
- Modify: `src/server/ports/repositories.ts`
- Modify: `src/server/adapters/memory/index.ts`
- Modify: `src/server/adapters/mongo/repositories.ts`
- Test: `tests/adapters/episode-entry.test.ts`

**Interfaces:**
- Produces: `EpisodeEntryRepository.findById(id: string): Promise<EpisodeEntry | null>`

- [ ] **Step 1: Test (rouge)**

Ajouter à `tests/adapters/episode-entry.test.ts`, dans le premier `describe("InMemoryEpisodeEntryRepository")` :

```ts
  it("findById trouve par id ou renvoie null", async () => {
    const repo = new InMemoryEpisodeEntryRepository();
    await repo.upsert(mk(1, 1));
    expect((await repo.findById("1-1"))?.episode).toBe(1);
    expect(await repo.findById("absent")).toBeNull();
  });
```

- [ ] **Step 2: Lancer, vérifier l'échec**

Run: `npm test -- adapters/episode-entry`
Expected: FAIL — `repo.findById` inexistant.

- [ ] **Step 3: Port**

Dans `src/server/ports/repositories.ts`, `interface EpisodeEntryRepository`, ajouter :

```ts
  findById(id: string): Promise<EpisodeEntry | null>;
```

- [ ] **Step 4: Mémoire**

Dans `InMemoryEpisodeEntryRepository` :

```ts
  async findById(id: string) { return this.byId.get(id) ?? null; }
```

- [ ] **Step 5: Mongo**

Dans `MongoEpisodeEntryRepository` :

```ts
  async findById(id: string) { const d = await this.col.findOne({ _id: id }); return d ? M.fromEpisodeEntryDoc(d) : null; }
```

- [ ] **Step 6: Lancer + suite**

Run: `npm test -- adapters/episode-entry` → PASS. Run: `npx tsc --noEmit` → aucune erreur.

- [ ] **Step 7: Commit**

```bash
git add src/server/ports/repositories.ts src/server/adapters/memory/index.ts src/server/adapters/mongo/repositories.ts tests/adapters/episode-entry.test.ts
git commit -m "feat(vulu): EpisodeEntryRepository.findById"
```

---

### Task 2: Visibilité généralisée (like/commentaire sur épisode)

**Files:**
- Modify: `src/server/application/engagement.ts`
- Test: `tests/application/engagement-episode.test.ts`

**Interfaces:**
- Consumes: `EpisodeEntryRepository.findById` (Task 1).
- Produces: `likeEntry`/`unlikeEntry`/`commentOnEntry`/`listComments` acceptent un id d'épisode.

- [ ] **Step 1: Tests (rouge)**

Créer `tests/application/engagement-episode.test.ts` :

```ts
import { describe, it, expect, beforeEach } from "vitest";
import { makeInMemoryDeps, type Deps } from "@/server/container";
import { FakeCatalog } from "../helpers/fake-catalog";
import { registerUser } from "@/server/application/register-user";
import { updateEpisode } from "@/server/application/episode-entry";
import { likeEntry, commentOnEntry, listComments } from "@/server/application/engagement";
import { ForbiddenError } from "@/server/domain/errors";

const tv = { source: "tmdb" as const, externalId: "1396", type: "tv" as const };
const tastes = { filmGenreIds: [], people: [] };
let deps: Deps; let author: string; let other: string;
beforeEach(async () => {
  deps = makeInMemoryDeps(new FakeCatalog());
  author = (await registerUser(deps, { email: "a@x.io", username: "author", displayName: "A", password: "password1", activeTabs: ["films"], tastes })).id;
  other = (await registerUser(deps, { email: "o@x.io", username: "other", displayName: "O", password: "password1", activeTabs: ["films"], tastes })).id;
});

describe("engagement sur un avis d'épisode", () => {
  async function sharedEpisode() {
    await updateEpisode(deps, author, tv, 1, 1, { rating: 4 });
    const e = await updateEpisode(deps, author, tv, 1, 1, { audiences: { public: true, circle: false, communityIds: [] } });
    return e.id;
  }
  it("like + commentaire d'un avis d'épisode public par un autre", async () => {
    const id = await sharedEpisode();
    await likeEntry(deps, other, id);
    await commentOnEntry(deps, other, id, "super épisode");
    expect(await deps.likes.countByEntry(id)).toBe(1);
    const comments = await listComments(deps, other, id);
    expect(comments.map((c) => c.text)).toContain("super épisode");
  });
  it("refuse like/commentaire sur un avis d'épisode privé d'un autre", async () => {
    await updateEpisode(deps, author, tv, 1, 2, { rating: 4 }); // non partagé (activityAt null)
    const priv = await deps.episodeEntries.findOne(author, (await deps.works.findByExternal("tmdb", "1396"))!.id, 1, 2);
    await expect(likeEntry(deps, other, priv!.id)).rejects.toBeInstanceOf(ForbiddenError);
  });
});
```

- [ ] **Step 2: Lancer, vérifier l'échec**

Run: `npm test -- engagement-episode`
Expected: FAIL — `loadVisible` ne trouve pas l'entrée d'épisode → `NotFoundError` (au lieu du succès / du `ForbiddenError` attendu).

- [ ] **Step 3: Généraliser `engagement.ts`**

Dans `src/server/application/engagement.ts` :
- ajouter `EntryAudiences` à l'import des entités ;
- remplacer `assertVisible` et `loadVisible` :

```ts
type Visible = { userId: string; audiences: EntryAudiences };

async function assertVisible(deps: Deps, viewerId: string, target: Visible): Promise<void> {
  if (target.userId === viewerId) return;
  if (target.audiences.public) return;
  const circle = await getCircle(deps, viewerId);
  if (!circle.has(target.userId)) throw new ForbiddenError("Contenu non accessible");
}

async function loadVisible(deps: Deps, viewerId: string, id: string): Promise<Visible> {
  const entry = await deps.entries.findById(id);
  if (entry) { await assertVisible(deps, viewerId, entry); return entry; }
  const ep = await deps.episodeEntries.findById(id);
  if (ep) { await assertVisible(deps, viewerId, ep); return ep; }
  throw new NotFoundError("Entrée introuvable");
}
```

(Le type de retour de `loadVisible` n'est plus utilisé par les appelants — ils ignorent la valeur — donc `Visible` suffit.)

- [ ] **Step 4: Lancer + suite**

Run: `npm test -- engagement-episode` → PASS.
Run: `npm test` → PASS ; `npx tsc --noEmit` → aucune erreur.

- [ ] **Step 5: Commit**

```bash
git add src/server/application/engagement.ts tests/application/engagement-episode.test.ts
git commit -m "feat(vulu): like/commentaire d'un avis d'épisode (visibilité généralisée)"
```

---

### Task 3: Compteurs `EpisodeFeedItem` + `getPostItem`

**Files:**
- Modify: `src/server/application/feed.ts`
- Modify: `src/app/api/entries/[id]/route.ts`
- Modify: `src/app/post/[id]/page.tsx`
- Test: `tests/application/feed.test.ts`

**Interfaces:**
- Consumes: `EpisodeEntryRepository.findById` (Task 1), `enrichEpisodeEntries` (2b-i).
- Produces:
  - `EpisodeFeedItem` gagne `likeCount`, `commentCount`, `likedByMe`.
  - `getPostItem(deps, viewerId, id): Promise<WorkFeedItem | EpisodeFeedItem>` (remplace `getEntryItem`).

- [ ] **Step 1: Tests (rouge)**

Dans `tests/application/feed.test.ts` :
- remplacer l'import `getEntryItem` par `getPostItem` ;
- dans le `describe("getEntryItem (visibilité)")`, remplacer les deux appels `getEntryItem(` par `getPostItem(` et l'assertion `expect(own.entry.id)` par une version narrow :
  ```ts
    const own = await getPostItem(deps, friend, entry.id);
    expect(own.kind === "work" && own.entry.id).toBe(entry.id);
  ```
- ajouter un nouveau `describe` :
  ```ts
  describe("épisode dans le feed — compteurs + post", () => {
    const tv = { source: "tmdb" as const, externalId: "1396", type: "tv" as const };
    async function sharedEp() {
      const { updateEpisode } = await import("@/server/application/episode-entry");
      await updateEpisode(deps, me, tv, 1, 1, { rating: 5 });
      return (await updateEpisode(deps, me, tv, 1, 1, { audiences: { public: true, circle: false, communityIds: [] } })).id;
    }
    it("enrichEpisodeEntries expose likeCount/commentCount/likedByMe", async () => {
      const id = await sharedEp();
      const { likeEntry } = await import("@/server/application/engagement");
      await likeEntry(deps, me, id);
      const items = await buildFeed(deps, me, { scope: "foryou", cursor: null, limit: 20 });
      const ep = items.find((i) => i.kind === "episode");
      expect(ep && ep.kind === "episode" && ep.likeCount).toBe(1);
      expect(ep && ep.kind === "episode" && ep.likedByMe).toBe(true);
    });
    it("getPostItem renvoie l'avis d'épisode pour son id", async () => {
      const id = await sharedEp();
      const item = await getPostItem(deps, me, id);
      expect(item.kind).toBe("episode");
    });
  });
  ```

- [ ] **Step 2: Lancer, vérifier l'échec**

Run: `npm test -- application/feed`
Expected: FAIL — `getPostItem` inexistant / `EpisodeFeedItem` sans compteurs.

- [ ] **Step 3: Compteurs sur `EpisodeFeedItem`**

Dans `src/server/application/feed.ts`, `interface EpisodeFeedItem`, ajouter avant `communities` :

```ts
  likeCount: number;
  commentCount: number;
  likedByMe: boolean;
```

- [ ] **Step 4: `enrichEpisodeEntries` calcule les compteurs**

Remplacer le corps de `enrichEpisodeEntries` :

```ts
export async function enrichEpisodeEntries(deps: Deps, viewerId: string, entries: EpisodeEntry[]): Promise<EpisodeFeedItem[]> {
  const liked = new Set(await deps.likes.likedEntryIds(viewerId, entries.map((e) => e.id)));
  return Promise.all(entries.map(async (ee) => {
    const [author, work, likeCount, commentCount, communities] = await Promise.all([
      deps.users.findById(ee.userId),
      deps.works.findById(ee.workId),
      deps.likes.countByEntry(ee.id),
      deps.comments.countByEntry(ee.id),
      ee.audiences.communityIds.length > 0 ? deps.communities.listByIds(ee.audiences.communityIds) : Promise.resolve([]),
    ]);
    if (!author || !work) throw new NotFoundError("Données de feed incohérentes");
    let title: string | null = null;
    try {
      const eps = await getSeasonEpisodes(deps, { source: work.source, externalId: work.externalId, type: work.type }, ee.season);
      title = eps.find((e) => e.number === ee.episode)?.title ?? null;
    } catch { title = null; }
    return {
      kind: "episode" as const, episodeEntry: ee,
      author: { id: author.id, username: author.username, displayName: author.displayName, avatarUrl: author.avatarUrl, plus: author.plus, staff: author.staff },
      work: { id: work.id, title: work.title, year: work.year, posterUrl: work.posterUrl, type: work.type, episodeCounts: work.episodeCounts, pageCount: work.pageCount },
      season: ee.season, episode: ee.episode, title,
      likeCount, commentCount, likedByMe: liked.has(ee.id),
      communities: communities.map((c) => ({ id: c.id, name: c.name })),
    };
  }));
}
```

- [ ] **Step 5: Généraliser en `getPostItem`**

Remplacer `getEntryItem` par (garder la généralisation de `isEntryVisibleTo` : sa signature accepte déjà `LibraryEntry`, dont on ne lit que `userId`/`audiences` — changer son type de paramètre `entry: LibraryEntry` en `target: { userId: string; audiences: EntryAudiences }`, et l'import `EntryAudiences`) :

```ts
export async function getPostItem(deps: Deps, viewerId: string, id: string): Promise<WorkFeedItem | EpisodeFeedItem> {
  const entry = await deps.entries.findById(id);
  if (entry) {
    if (entry.userId !== viewerId) {
      const [circle, communityIds] = await Promise.all([getCircle(deps, viewerId), viewerCommunityIdSet(deps, viewerId)]);
      if (!isEntryVisibleTo(entry, viewerId, circle, communityIds)) throw new NotFoundError("Publication introuvable");
    }
    const [item] = await enrichEntries(deps, viewerId, [entry]);
    if (!item) throw new NotFoundError("Publication introuvable");
    return item;
  }
  const ep = await deps.episodeEntries.findById(id);
  if (ep) {
    if (ep.userId !== viewerId) {
      const [circle, communityIds] = await Promise.all([getCircle(deps, viewerId), viewerCommunityIdSet(deps, viewerId)]);
      if (!isEntryVisibleTo(ep, viewerId, circle, communityIds)) throw new NotFoundError("Publication introuvable");
    }
    const [item] = await enrichEpisodeEntries(deps, viewerId, [ep]);
    if (!item) throw new NotFoundError("Publication introuvable");
    return item;
  }
  throw new NotFoundError("Publication introuvable");
}
```

Changer la signature d'`isEntryVisibleTo` :
```ts
export function isEntryVisibleTo(
  target: { userId: string; audiences: EntryAudiences }, viewerId: string, circle: Set<string>, viewerCommunityIds: Set<string>,
): boolean {
```
(Corps inchangé ; `LibraryEntry` et `EpisodeEntry` satisfont ce type.)

- [ ] **Step 6: Mettre à jour les appelants**

`src/app/api/entries/[id]/route.ts` : remplacer `getEntryItem` par `getPostItem` (import + appel).

`src/app/post/[id]/page.tsx` : remplacer l'import et l'appel `getEntryItem` par `getPostItem` ; changer le type `let item: FeedItem;` (garder `FeedItem`, qui est l'union) ; le `CommentThread entryId={item.entry.id}` devient `entryId={id}` (le param, valable pour les deux types).

- [ ] **Step 7: Lancer + typecheck**

Run: `npm test -- application/feed` → PASS.
Run: `npm test` → PASS.
Run: `npx tsc --noEmit`
Expected : erreur attendue dans `src/components/FeedCard.tsx` (la carte épisode n'utilise pas encore les nouveaux compteurs — sans erreur en réalité car champs en plus) ; vérifier qu'aucune erreur ne subsiste hormis d'éventuelles retouches FeedCard (Task 4). Si `tsc` est vert, tant mieux.

- [ ] **Step 8: Commit**

```bash
git add src/server/application/feed.ts "src/app/api/entries/[id]/route.ts" "src/app/post/[id]/page.tsx" tests/application/feed.test.ts
git commit -m "feat(vulu): compteurs like/commentaire sur les avis d'épisode + getPostItem (post unifié)"
```

---

### Task 4: UI — `EpisodeFeedCard` like + commentaires + lien post

**Files:**
- Modify: `src/components/FeedCard.tsx`

**Interfaces:**
- Consumes: `EpisodeFeedItem` avec compteurs (Task 3).

- [ ] **Step 1: Ajouter like/commentaires/lien à `EpisodeFeedCard`**

Dans `src/components/FeedCard.tsx`, remplacer le composant `EpisodeFeedCard` par une version à parité (état de like optimiste, overlay vers `/post/{id}`, rangée d'actions like + commentaires) :

```tsx
function EpisodeFeedCard({ item }: { item: EpisodeFeedItem }) {
  const ep = item.episodeEntry;
  const [liked, setLiked] = useState(item.likedByMe);
  const [likes, setLikes] = useState(item.likeCount);
  async function toggleLike() {
    const next = !liked;
    setLiked(next); setLikes((n) => n + (next ? 1 : -1));
    try {
      if (next) await api.post(`/api/entries/${ep.id}/like`);
      else await api.del(`/api/entries/${ep.id}/like`);
    } catch { setLiked(!next); setLikes((n) => n + (next ? -1 : 1)); }
  }
  return (
    <article className="relative mb-3 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 transition duration-150 hover:shadow-[0_2px_20px_rgba(0,0,0,0.05)]">
      <Link href={`/post/${ep.id}`} className="absolute inset-0 z-0" aria-label="Voir la publication" />
      <div className="flex gap-3">
        <Link href={`/u/${item.author.username}`} className="relative z-10 shrink-0">
          <Avatar name={item.author.displayName} src={item.author.avatarUrl} size={42} />
        </Link>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <Link href={`/u/${item.author.username}`} className="relative z-10 text-sm font-semibold hover:underline">{item.author.displayName}</Link>
            {item.author.plus && <CertifiedBadge />}
            {item.author.staff && <StaffBadge />}
          </div>
          <p className="text-xs text-[var(--color-text-muted)]">a noté un épisode</p>
          <p className="mt-1 text-sm font-semibold">{item.work.title} <span className="font-normal text-[var(--color-text-muted)]">· S{item.season}E{item.episode}{item.title ? ` · ${item.title}` : ""}</span></p>
          {ep.text && <p className="mt-1 whitespace-pre-line text-sm">{ep.text}</p>}
          {ep.rating !== null && (
            <div className="mt-2 flex items-center gap-1.5">
              <RatingStars value={ep.rating} size={16} />
              <span className="text-sm font-semibold">{ep.rating.toFixed(1).replace(".", ",")}/5</span>
            </div>
          )}
          <div className="mt-2 flex items-center gap-1 text-[var(--color-text-muted)]">
            <button onClick={toggleLike} aria-pressed={liked}
              className={`relative z-10 flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm transition-colors hover:bg-[var(--color-border)] ${liked ? "text-[var(--color-primary)]" : ""}`}>
              <Icon name={liked ? "heart-filled" : "heart"} size={19} /> {likes}
            </button>
            <Link href={`/post/${ep.id}`}
              className="relative z-10 flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm transition-colors hover:bg-[var(--color-border)]">
              <Icon name="comment" size={19} /> {item.commentCount}
            </Link>
          </div>
        </div>
      </div>
    </article>
  );
}
```

(`useState`, `Link`, `Avatar`, `Icon`, `RatingStars`, `CertifiedBadge`, `StaffBadge`, `api` sont déjà importés dans le fichier.)

- [ ] **Step 2: Typecheck + build**

Run: `npx tsc --noEmit`
Expected: aucune erreur.
Run: `npm run build`
Expected: build réussi.

- [ ] **Step 3: Vérification manuelle**

Run: `npm run dev`. Partager un avis d'épisode, ouvrir le feed → la carte épisode a un ❤ et un 💬 ; liker met à jour le compteur ; cliquer la carte / le 💬 ouvre `/post/{id}` avec la carte + fil de commentaires ; commenter fonctionne. Lancer `npm test`.

- [ ] **Step 4: Commit**

```bash
git add src/components/FeedCard.tsx
git commit -m "feat(vulu): EpisodeFeedCard — like + commentaires + lien post (parité)"
```

---

## Self-Review

**Spec coverage :**
- `EpisodeEntryRepository.findById` → Task 1 ✓
- Visibilité généralisée `loadVisible`/`assertVisible` → Task 2 ✓
- Compteurs `EpisodeFeedItem` + `enrichEpisodeEntries` → Task 3 Steps 3-4 ✓
- `getPostItem` (union) + `isEntryVisibleTo` générique + appelants → Task 3 Steps 5-6 ✓
- Page `/post/[id]` unifiée → Task 3 Step 6 ✓
- `EpisodeFeedCard` like + commentaires + lien → Task 4 ✓
- Tests : findById, like/commentaire/visibilité épisode, compteurs, getPostItem → Tasks 1-3 ✓

**Placeholder scan :** aucun TBD/TODO ; code complet.

**Type consistency :** `EpisodeEntry.findById` (Task 1) ⇔ `loadVisible` (Task 2) ⇔ `getPostItem` (Task 3). `EpisodeFeedItem` compteurs (Task 3) ⇔ `EpisodeFeedCard` (Task 4). `isEntryVisibleTo(target: { userId; audiences }, …)` accepte `LibraryEntry` et `EpisodeEntry`. `getPostItem` remplace `getEntryItem` dans les 3 appelants (route, page, test).
