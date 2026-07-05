# Épisodes Incrément 2b-i : partage au feed — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rendre un avis d'épisode partageable (audiences) et l'afficher, fusionné, dans le feed ; passer la note d'épisode à un slider 0–5 par pas de 0,1.

**Architecture:** `EpisodeEntry` gagne `audiences`/`activityAt`. `updateEpisode` gère le partage. Requête `episodeEntries.feed` + fusion dans `buildFeed`. `FeedItem` devient une union discriminée `work | episode` ; `FeedCard`/`FeedClient`/route feed manipulent l'union, les fonctions d'avis d'œuvre restent typées `WorkFeedItem`.

**Tech Stack:** Next.js (version custom — lire `node_modules/next/dist/docs/`), TypeScript strict (`noUncheckedIndexedAccess`), Vitest, MongoDB, Zod.

## Global Constraints

- **Typage strict sans `any`** ; accès indexés sécurisés.
- **2b-i = affichage** : pas de like/commentaire sur les avis d'épisode (→ 2b-ii).
- Note épisode : **0–5 pas 0,1** (`RatingSlider`).
- Partage : champ `audiences` sur le PUT épisode ; « gardé pour moi » (aucune destination) → `activityAt = null`.
- Rétro-compat entrées 2a : `audiences` défaut `{ public:false, circle:false, communityIds:[] }`, `activityAt` défaut `null`.
- Tests : `npm test` ; typecheck `npx tsc --noEmit` ; build `npm run build`.

---

### Task 1: `EpisodeEntry` gagne `audiences` + `activityAt` (rétro-compat)

**Files:**
- Modify: `src/server/domain/entities.ts`
- Modify: `src/server/adapters/mongo/mappers.ts`
- Modify: `src/server/application/episode-entry.ts` (init à la création)
- Test: `tests/application/episode-entry.test.ts` (défauts)

**Interfaces:**
- Produces: `EpisodeEntry.audiences: EntryAudiences`, `EpisodeEntry.activityAt: Date | null`.

- [ ] **Step 1: Test des défauts (rouge)**

Ajouter à `tests/application/episode-entry.test.ts`, dans `describe("updateEpisode")` :

```ts
  it("initialise audiences vides et activityAt null à la création", async () => {
    const e = await updateEpisode(deps, "u1", tv, 1, 1, { watched: true });
    expect(e.audiences).toEqual({ public: false, circle: false, communityIds: [] });
    expect(e.activityAt).toBeNull();
  });
```

- [ ] **Step 2: Lancer, vérifier l'échec**

Run: `npm test -- application/episode-entry`
Expected: FAIL — `e.audiences` undefined.

- [ ] **Step 3: Étendre le type**

Dans `src/server/domain/entities.ts`, dans `interface EpisodeEntry`, après `text`:

```ts
  audiences: EntryAudiences;
  activityAt: Date | null;
```

(`EntryAudiences` est déjà défini dans ce fichier.)

- [ ] **Step 4: Mapper mongo rétro-compat**

Dans `src/server/adapters/mongo/mappers.ts`, remplacer :

```ts
export const fromEpisodeEntryDoc = (d: WithIdEpisodeEntry): EpisodeEntry => strip(d);
```
par :
```ts
export const fromEpisodeEntryDoc = (d: WithIdEpisodeEntry): EpisodeEntry => {
  const e = strip(d);
  return {
    ...e,
    audiences: e.audiences ?? { public: false, circle: false, communityIds: [] },
    activityAt: e.activityAt ?? null,
  };
};
```

- [ ] **Step 5: Init à la création dans `updateEpisode`**

Dans `src/server/application/episode-entry.ts`, dans l'objet `base` (création d'une `EpisodeEntry` neuve), ajouter les deux champs :

```ts
  const base: EpisodeEntry = existing ?? {
    id: deps.ids.next(), userId, workId: work.id, season, episode,
    watched: false, watchedAt: null, rating: null, text: null,
    audiences: { public: false, circle: false, communityIds: [] }, activityAt: null,
    createdAt: now, updatedAt: now,
  };
```

- [ ] **Step 6: Lancer, vérifier le succès + suite**

Run: `npm test -- application/episode-entry`
Expected: PASS.
Run: `npx tsc --noEmit`
Expected: aucune erreur (l'ancien test `tests/adapters/episode-entry.test.ts` construit un `EpisodeEntry` littéral → il manquera `audiences`/`activityAt`).

- [ ] **Step 7: Corriger le littéral du test adaptateur**

Dans `tests/adapters/episode-entry.test.ts`, dans `mk(...)`, ajouter au littéral :

```ts
  audiences: { public: false, circle: false, communityIds: [] }, activityAt: null,
```

Run: `npm test` → PASS. Run: `npx tsc --noEmit` → aucune erreur.

- [ ] **Step 8: Commit**

```bash
git add src/server/domain/entities.ts src/server/adapters/mongo/mappers.ts src/server/application/episode-entry.ts tests/application/episode-entry.test.ts tests/adapters/episode-entry.test.ts
git commit -m "feat(vulu): EpisodeEntry gagne audiences + activityAt (défauts rétro-compat)"
```

---

### Task 2: Partage dans `updateEpisode`

**Files:**
- Modify: `src/server/application/episode-entry.ts`
- Test: `tests/application/episode-entry.test.ts`

**Interfaces:**
- Produces: `updateEpisode(..., input: { …; audiences?: EntryAudiences })` pose `activityAt`/`audiences`.

- [ ] **Step 1: Tests partage (rouge)**

Ajouter à `tests/application/episode-entry.test.ts` :

```ts
  it("partage : audiences + activityAt posés (exige note ou texte)", async () => {
    await updateEpisode(deps, "u1", tv, 1, 1, { rating: 3.2 });
    const e = await updateEpisode(deps, "u1", tv, 1, 1, { audiences: { public: true, circle: false, communityIds: [] } });
    expect(e.audiences.public).toBe(true);
    expect(e.activityAt).not.toBeNull();
  });
  it("partage sans note ni texte → ValidationError", async () => {
    await expect(updateEpisode(deps, "u1", tv, 1, 2, { audiences: { public: true, circle: false, communityIds: [] } }))
      .rejects.toThrow(ValidationError);
  });
  it("« gardé pour moi » (aucune destination) → activityAt null", async () => {
    await updateEpisode(deps, "u1", tv, 1, 1, { rating: 3.2, audiences: { public: true, circle: false, communityIds: [] } });
    const e = await updateEpisode(deps, "u1", tv, 1, 1, { audiences: { public: false, circle: false, communityIds: [] } });
    expect(e.activityAt).toBeNull();
  });
```

- [ ] **Step 2: Lancer, vérifier l'échec**

Run: `npm test -- application/episode-entry`
Expected: FAIL — `audiences` non géré.

- [ ] **Step 3: Implémenter le partage**

Dans `src/server/application/episode-entry.ts` :
- ajouter `EntryAudiences` à l'import des entités et `ForbiddenError` à l'import des erreurs ;
- étendre le type de `input` : `; audiences?: EntryAudiences` ;
- juste avant `await deps.episodeEntries.upsert(next);`, insérer :

```ts
  if (input.audiences !== undefined) {
    const hasContent = next.rating !== null || (next.text !== null && next.text.trim() !== "");
    const anyDest = input.audiences.public || input.audiences.circle || input.audiences.communityIds.length > 0;
    if (anyDest && !hasContent) throw new ValidationError("Ajoute une note ou un commentaire");
    for (const communityId of input.audiences.communityIds) {
      const member = await deps.memberships.find(communityId, userId);
      if (!member) throw new ForbiddenError("Tu n'es pas membre de cette communauté");
    }
    next.audiences = input.audiences;
    next.activityAt = anyDest ? now : null;
  }
```

- [ ] **Step 4: Lancer, vérifier le succès + suite**

Run: `npm test -- application/episode-entry`
Expected: PASS.
Run: `npm test` → PASS ; `npx tsc --noEmit` → aucune erreur.

- [ ] **Step 5: Commit**

```bash
git add src/server/application/episode-entry.ts tests/application/episode-entry.test.ts
git commit -m "feat(vulu): partage d'un avis d'épisode (audiences + activityAt via updateEpisode)"
```

---

### Task 3: `EpisodeEntryRepository.feed` (mémoire + mongo)

**Files:**
- Modify: `src/server/ports/repositories.ts`
- Modify: `src/server/adapters/memory/index.ts`
- Modify: `src/server/adapters/mongo/repositories.ts`
- Test: `tests/adapters/episode-entry.test.ts`

**Interfaces:**
- Produces: `EpisodeEntryRepository.feed(opts: { scope: "foryou" | "following"; circleUserIds: string[]; followingUserIds: string[]; viewerId: string; cursor: { activityAt: Date; id: string } | null; limit: number }): Promise<EpisodeEntry[]>`

- [ ] **Step 1: Test feed mémoire (rouge)**

Ajouter à `tests/adapters/episode-entry.test.ts` :

```ts
import type { EntryAudiences } from "@/server/domain/entities";

const shared = (season: number, episode: number, audiences: EntryAudiences, activityAt: Date | null): EpisodeEntry => ({
  ...mk(season, episode), id: `${season}-${episode}`, audiences, activityAt,
});

describe("InMemoryEpisodeEntryRepository.feed", () => {
  const opts = { scope: "foryou" as const, circleUserIds: [], followingUserIds: [], viewerId: "v", cursor: null, limit: 20 };
  it("inclut public, ignore activityAt null et privé", async () => {
    const repo = new InMemoryEpisodeEntryRepository();
    await repo.upsert(shared(1, 1, { public: true, circle: false, communityIds: [] }, new Date(2)));
    await repo.upsert(shared(1, 2, { public: true, circle: false, communityIds: [] }, null));
    await repo.upsert(shared(1, 3, { public: false, circle: false, communityIds: [] }, new Date(1)));
    const res = await repo.feed(opts);
    expect(res.map((e) => e.episode)).toEqual([1]);
  });
});
```

- [ ] **Step 2: Lancer, vérifier l'échec**

Run: `npm test -- adapters/episode-entry`
Expected: FAIL — `repo.feed` inexistant.

- [ ] **Step 3: Port**

Dans `src/server/ports/repositories.ts`, dans `interface EpisodeEntryRepository`, ajouter :

```ts
  feed(opts: { scope: "foryou" | "following"; circleUserIds: string[]; followingUserIds: string[]; viewerId: string; cursor: { activityAt: Date; id: string } | null; limit: number }): Promise<EpisodeEntry[]>;
```

- [ ] **Step 4: Adaptateur mémoire**

Dans `src/server/adapters/memory/index.ts`, `InMemoryEpisodeEntryRepository`, ajouter :

```ts
  async feed(opts: { scope: "foryou" | "following"; circleUserIds: string[]; followingUserIds: string[]; viewerId: string; cursor: { activityAt: Date; id: string } | null; limit: number }) {
    const circle = new Set(opts.circleUserIds);
    const following = new Set(opts.followingUserIds);
    return [...this.byId.values()]
      .filter((e) => e.activityAt !== null)
      .filter((e) => opts.scope === "following"
        ? (following.has(e.userId) && (e.audiences.public || (e.audiences.circle && circle.has(e.userId))))
        : (e.audiences.public || e.audiences.communityIds.length > 0 || (e.audiences.circle && circle.has(e.userId))))
      .filter((e) => !opts.cursor || e.activityAt!.getTime() < opts.cursor.activityAt.getTime())
      .sort((a, b) => b.activityAt!.getTime() - a.activityAt!.getTime())
      .slice(0, opts.limit);
  }
```

- [ ] **Step 5: Adaptateur mongo**

Dans `src/server/adapters/mongo/repositories.ts`, `MongoEpisodeEntryRepository`, ajouter (import `Filter` déjà présent en tête de fichier) :

```ts
  async feed(opts: { scope: "foryou" | "following"; circleUserIds: string[]; followingUserIds: string[]; viewerId: string; cursor: { activityAt: Date; id: string } | null; limit: number }) {
    const visibility: Filter<M.WithIdEpisodeEntry> = opts.scope === "following"
      ? { userId: { $in: opts.followingUserIds }, $or: [
          { "audiences.public": true },
          { "audiences.circle": true, userId: { $in: opts.circleUserIds } },
        ] }
      : { $or: [
          { "audiences.public": true },
          { "audiences.communityIds.0": { $exists: true } },
          { "audiences.circle": true, userId: { $in: opts.circleUserIds } },
        ] };
    const q: Filter<M.WithIdEpisodeEntry> = { activityAt: { $ne: null }, ...visibility };
    if (opts.cursor) q.activityAt = { $ne: null, $lt: opts.cursor.activityAt };
    return (await this.col.find(q).sort({ activityAt: -1 }).limit(opts.limit).toArray()).map(M.fromEpisodeEntryDoc);
  }
```

- [ ] **Step 6: Lancer, vérifier le succès + suite**

Run: `npm test -- adapters/episode-entry` → PASS.
Run: `npm test` → PASS ; `npx tsc --noEmit` → aucune erreur.

- [ ] **Step 7: Commit**

```bash
git add src/server/ports/repositories.ts src/server/adapters/memory/index.ts src/server/adapters/mongo/repositories.ts tests/adapters/episode-entry.test.ts
git commit -m "feat(vulu): EpisodeEntryRepository.feed (visibilité par audiences)"
```

---

### Task 4: Union `FeedItem` + fusion `buildFeed` + route feed

**Files:**
- Modify: `src/server/application/feed.ts`
- Modify: `src/app/api/feed/route.ts`
- Test: `tests/application/feed.test.ts`

**Interfaces:**
- Consumes: `episodeEntries.feed` (Task 3), `getSeasonEpisodes` (incr. 1), `updateEpisode` partage (Task 2).
- Produces:
  - `type FeedItem = WorkFeedItem | EpisodeFeedItem` (union discriminée par `kind`).
  - `enrichEpisodeEntries(deps, viewerId, entries): Promise<EpisodeFeedItem[]>`
  - `feedCursor(item: FeedItem): { activityAt: Date; id: string }`
  - `feedKey(item: FeedItem): string`
  - `buildFeed` retourne `FeedItem[]` (fusion).
  - `getEntryItem`/`getMyWorkReview`/`getWorkReviews` typés `WorkFeedItem`.

- [ ] **Step 1: Test de fusion (rouge)**

Ajouter à `tests/application/feed.test.ts` un cas (les helpers `deps`/`me` y existent ; importer `updateEpisode` et `buildFeed` si absents) :

```ts
  it("buildFeed fusionne avis d'œuvre et avis d'épisode, triés par activityAt", async () => {
    const { updateEpisode } = await import("@/server/application/episode-entry");
    // avis d'œuvre partagé (film)
    await rateOrReviewWork(deps, me, film, { rating: 4, text: null, audiences: { public: true, circle: false, communityIds: [] } });
    // avis d'épisode partagé (série)
    await updateEpisode(deps, me, { source: "tmdb", externalId: "1396", type: "tv" }, 1, 1, { rating: 5 });
    await updateEpisode(deps, me, { source: "tmdb", externalId: "1396", type: "tv" }, 1, 1, { audiences: { public: true, circle: false, communityIds: [] } });
    const items = await buildFeed(deps, me, { scope: "foryou", cursor: null, limit: 20 });
    const kinds = items.map((i) => i.kind).sort();
    expect(kinds).toContain("work");
    expect(kinds).toContain("episode");
  });
```

(Si `film`/`rateOrReviewWork`/`buildFeed` ne sont pas déjà importés dans ce fichier, ajouter les imports : `film` depuis les refs locales du test, `rateOrReviewWork` depuis `@/server/application/library-entry`, `buildFeed` depuis `@/server/application/feed`. Vérifier l'entête du fichier de test.)

- [ ] **Step 2: Lancer, vérifier l'échec**

Run: `npm test -- application/feed`
Expected: FAIL — `i.kind` inexistant / union absente.

- [ ] **Step 3: Union et alias dans `feed.ts`**

Dans `src/server/application/feed.ts` : ajouter l'import `EpisodeEntry` aux entités et `getSeasonEpisodes` (`import { getSeasonEpisodes } from "./get-episodes";`). Remplacer l'`interface FeedItem` par :

```ts
export type AuthorLite = Pick<User, "id" | "username" | "displayName" | "avatarUrl" | "plus" | "staff">;
export type WorkLite = Pick<Work, "id" | "title" | "year" | "posterUrl" | "type" | "episodeCounts" | "pageCount">;

export interface WorkFeedItem {
  kind: "work";
  entry: LibraryEntry;
  author: AuthorLite;
  work: WorkLite;
  likeCount: number; commentCount: number; likedByMe: boolean;
  communities: { id: string; name: string }[];
}
export interface EpisodeFeedItem {
  kind: "episode";
  episodeEntry: EpisodeEntry;
  author: AuthorLite;
  work: WorkLite;
  season: number; episode: number; title: string | null;
  communities: { id: string; name: string }[];
}
export type FeedItem = WorkFeedItem | EpisodeFeedItem;

export function feedCursor(item: FeedItem): { activityAt: Date; id: string } {
  return item.kind === "episode"
    ? { activityAt: item.episodeEntry.activityAt ?? item.episodeEntry.updatedAt, id: item.episodeEntry.id }
    : { activityAt: item.entry.activityAt ?? item.entry.createdAt, id: item.entry.id };
}
export function feedKey(item: FeedItem): string {
  return item.kind === "episode" ? `ep:${item.episodeEntry.id}` : `wk:${item.entry.id}`;
}
```

- [ ] **Step 4: `enrichEntries` renvoie des `WorkFeedItem`**

Dans `enrichEntries`, changer la signature de retour en `Promise<WorkFeedItem[]>` et ajouter `kind: "work" as const,` dans l'objet retourné (première propriété).

- [ ] **Step 5: `enrichEpisodeEntries`**

Ajouter dans `feed.ts` :

```ts
export async function enrichEpisodeEntries(deps: Deps, viewerId: string, entries: EpisodeEntry[]): Promise<EpisodeFeedItem[]> {
  void viewerId;
  return Promise.all(entries.map(async (ee) => {
    const [author, work, communities] = await Promise.all([
      deps.users.findById(ee.userId),
      deps.works.findById(ee.workId),
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
      communities: communities.map((c) => ({ id: c.id, name: c.name })),
    };
  }));
}
```

- [ ] **Step 6: `buildFeed` fusionne**

Remplacer le corps de `buildFeed` après le calcul de `[circle, following]` par :

```ts
  const [workEntries, epEntries] = await Promise.all([
    deps.entries.feed({
      scope: opts.scope, circleUserIds: [...circle], followingUserIds: following,
      viewerId, domains: viewer.activeTabs, cursor: opts.cursor, limit: opts.limit,
    }),
    deps.episodeEntries.feed({
      scope: opts.scope, circleUserIds: [...circle], followingUserIds: following,
      viewerId, cursor: opts.cursor, limit: opts.limit,
    }),
  ]);
  const [workItems, epItems] = await Promise.all([
    enrichEntries(deps, viewerId, workEntries),
    enrichEpisodeEntries(deps, viewerId, epEntries),
  ]);
  return [...workItems, ...epItems]
    .sort((a, b) => feedCursor(b).activityAt.getTime() - feedCursor(a).activityAt.getTime())
    .slice(0, opts.limit);
```

Et changer le type de retour de `buildFeed` en `Promise<FeedItem[]>`.

- [ ] **Step 7: Typer les fonctions d'avis d'œuvre en `WorkFeedItem`**

Changer les signatures de retour : `getEntryItem` → `Promise<WorkFeedItem>`, `getMyWorkReview` → `Promise<WorkFeedItem | null>`, `getWorkReviews` → `Promise<WorkFeedItem[]>`. (Leurs corps appellent `enrichEntries`, qui renvoie déjà `WorkFeedItem[]`.)

- [ ] **Step 8: Route feed — curseur via `feedCursor`**

Dans `src/app/api/feed/route.ts`, importer `feedCursor` et remplacer la ligne `nextCursor` :

```ts
    const nextCursor = last ? JSON.stringify(feedCursor(last)) : null;
```

- [ ] **Step 9: Lancer les tests + typecheck**

Run: `npm test` → PASS (le nouveau cas + tous les autres ; les consommateurs `WorkReviews`/`post` restent typés `WorkFeedItem`).
Run: `npx tsc --noEmit`
Expected : erreur attendue dans `src/components/FeedCard.tsx` (accède `item.entry` sur l'union) → corrigée en Task 6. Vérifier qu'aucune autre erreur ne subsiste (notamment `FeedClient`, corrigé en Task 6 aussi).

- [ ] **Step 10: Commit**

```bash
git add src/server/application/feed.ts src/app/api/feed/route.ts tests/application/feed.test.ts
git commit -m "feat(vulu): feed — union FeedItem (work|episode) + fusion buildFeed"
```

---

### Task 5: API — `audiences` sur le PUT épisode

**Files:**
- Modify: `src/lib/zod-schemas.ts`
- Modify: `src/app/api/works/[id]/episodes/route.ts`

- [ ] **Step 1: Schéma**

Dans `src/lib/zod-schemas.ts`, `episodeUpdateSchema`, ajouter le champ :

```ts
  audiences: z.object({ public: z.boolean(), circle: z.boolean(), communityIds: z.array(z.string()) }).optional(),
```

- [ ] **Step 2: Route passe `audiences`**

Dans `src/app/api/works/[id]/episodes/route.ts`, ajouter `audiences: input.audiences` à l'objet `input` de `updateEpisode` :

```ts
      { watched: input.watched, watchedAt, rating: input.rating, text: input.text, audiences: input.audiences },
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected : seule l'erreur `FeedCard`/`FeedClient` attendue (Task 6).

- [ ] **Step 4: Commit**

```bash
git add src/lib/zod-schemas.ts "src/app/api/works/[id]/episodes/route.ts"
git commit -m "feat(vulu): API — champ audiences sur le PUT épisode (déclenche le partage)"
```

---

### Task 6: UI feed — `FeedCard` branche `kind`, `FeedClient` clé union

**Files:**
- Modify: `src/components/FeedCard.tsx`
- Modify: `src/app/feed/FeedClient.tsx`

**Interfaces:**
- Consumes: `FeedItem` union, `feedKey` (Task 4).

- [ ] **Step 1: `FeedClient` — clé par union**

Dans `src/app/feed/FeedClient.tsx` : importer `feedKey` (`import { feedKey } from "@/server/application/feed";` — ajouter à l'import type existant en import de valeur séparé) et remplacer :

```tsx
      {ready && items.map((i) => <FeedCard key={i.entry.id} item={i} />)}
```
par :
```tsx
      {ready && items.map((i) => <FeedCard key={feedKey(i)} item={i} />)}
```

- [ ] **Step 2: `FeedCard` — branche épisode en tête**

Dans `src/components/FeedCard.tsx`, au tout début du composant (avant les `useState`), ajouter une branche dédiée aux items épisode, laissant le reste (rendu œuvre) inchangé sous le narrowing `item.kind === "work"`. Concrètement :

1. juste après `export function FeedCard({ item }: { item: FeedItem }) {`, insérer :

```tsx
  if (item.kind === "episode") return <EpisodeFeedCard item={item} />;
```

2. TypeScript ne narrow pas automatiquement après un `return` dans les hooks suivants ; pour éviter de réécrire tout le corps, extraire le corps actuel dans un sous-composant `WorkFeedCard` prenant `item: WorkFeedItem`. Renommer la fonction existante en `WorkFeedCard` (signature `{ item }: { item: WorkFeedItem }`) et créer le nouveau wrapper :

```tsx
export function FeedCard({ item }: { item: FeedItem }) {
  return item.kind === "episode" ? <EpisodeFeedCard item={item} /> : <WorkFeedCard item={item} />;
}
```

3. Ajouter le composant épisode (import `WorkFeedItem`/`EpisodeFeedItem` depuis `@/server/application/feed`) :

```tsx
function EpisodeFeedCard({ item }: { item: EpisodeFeedItem }) {
  const ep = item.episodeEntry;
  return (
    <article className="relative mb-3 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
      <Link href={`/work/${item.work.id}`} className="absolute inset-0 z-0" aria-label="Voir la série" />
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
        </div>
      </div>
    </article>
  );
}
```

(Les imports `Link`, `Avatar`, `CertifiedBadge`, `StaffBadge`, `RatingStars` sont déjà présents dans le fichier.)

- [ ] **Step 3: Typecheck + build**

Run: `npx tsc --noEmit`
Expected: aucune erreur.
Run: `npm run build`
Expected: build réussi.

- [ ] **Step 4: Commit**

```bash
git add src/components/FeedCard.tsx src/app/feed/FeedClient.tsx
git commit -m "feat(vulu): FeedCard — rendu des avis d'épisode dans le feed (union kind)"
```

---

### Task 7: UI `EpisodesTab` — slider de note + partage

**Files:**
- Modify: `src/components/EpisodesTab.tsx`

**Interfaces:**
- Consumes: `PUT /api/works/[id]/episodes` avec `rating`/`audiences` ; `RatingSlider`.

- [ ] **Step 1: Remplacer les étoiles par un `RatingSlider`, ajouter le partage**

Dans `src/components/EpisodesTab.tsx` :

1. importer le slider et le type d'entrée enrichi :
```tsx
import { RatingSlider } from "./RatingSlider";
import { useEffect } from "react";
```
2. étendre l'interface locale `EpisodeEntry` avec `audiences: { public: boolean; circle: boolean; communityIds: string[] }; activityAt: string | null;`
3. charger les communautés de l'utilisateur (comme `EntryEditor`), au niveau du composant :
```tsx
  const [communities, setCommunities] = useState<{ id: string; name: string }[]>([]);
  useEffect(() => { api.get<{ communities: { id: string; name: string }[] }>("/api/communities/mine").then((d) => setCommunities(d.communities)).catch(() => {}); }, []);
```
4. remplacer le bloc des 5 boutons étoiles par le slider :
```tsx
                              <div className="mt-2">
                                <RatingSlider value={entry?.rating ?? 0} onChange={(v) => patch(season, ep, { rating: v > 0 ? v : null })} />
                              </div>
```
5. sous le commentaire, ajouter les chips de partage (visibles quand l'épisode a une note ou un texte) :
```tsx
                              {(entry?.rating != null || (entry?.text && entry.text.length > 0)) && (
                                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                                  <span className="text-xs text-[var(--color-text-muted)]">Partager :</span>
                                  {([["public", "● Public"], ["circle", "● Cercle"]] as const).map(([key, label]) => {
                                    const on = key === "public" ? !!entry?.audiences?.public : !!entry?.audiences?.circle;
                                    return (
                                      <button key={key} onClick={() => patch(season, ep, { audiences: {
                                        public: key === "public" ? !on : !!entry?.audiences?.public,
                                        circle: key === "circle" ? !on : !!entry?.audiences?.circle,
                                        communityIds: entry?.audiences?.communityIds ?? [],
                                      } })}
                                        className={`rounded-full border px-3 py-1 text-xs ${on ? "border-[var(--color-primary)] bg-[var(--color-primary)] text-white" : "border-[var(--color-border)] text-[var(--color-text-muted)]"}`}>
                                        {on ? "✓ " : ""}{label}
                                      </button>
                                    );
                                  })}
                                  {communities.map((c) => {
                                    const on = entry?.audiences?.communityIds?.includes(c.id) ?? false;
                                    return (
                                      <button key={c.id} onClick={() => patch(season, ep, { audiences: {
                                        public: !!entry?.audiences?.public, circle: !!entry?.audiences?.circle,
                                        communityIds: on ? (entry?.audiences?.communityIds ?? []).filter((x) => x !== c.id) : [ ...(entry?.audiences?.communityIds ?? []), c.id ],
                                      } })}
                                        className={`rounded-full border px-3 py-1 text-xs ${on ? "border-[var(--color-primary)] bg-[var(--color-primary)] text-white" : "border-[var(--color-border)] text-[var(--color-text-muted)]"}`}>
                                        {on ? "✓ " : ""}◆ {c.name}
                                      </button>
                                    );
                                  })}
                                  {entry?.activityAt && <span className="text-xs font-semibold text-[var(--color-primary)]">✓ partagé</span>}
                                </div>
                              )}
```

- [ ] **Step 2: Typecheck + build**

Run: `npx tsc --noEmit`
Expected: aucune erreur.
Run: `npm run build`
Expected: build réussi.

- [ ] **Step 3: Vérification manuelle**

Run: `npm run dev`, ouvrir une série → onglet Épisodes.
Expected : la note est un **slider** (ex. 3,2/5) ; noter/commenter, puis « Partager · Public/Cercle/communautés » ; le badge « ✓ partagé » apparaît ; l'avis d'épisode apparaît dans le feed (Pour vous) avec « Titre · S1E1 · … », note et commentaire ; pas de bouton like (2b-ii). Lancer `npm test`.

- [ ] **Step 4: Commit**

```bash
git add src/components/EpisodesTab.tsx
git commit -m "feat(vulu): EpisodesTab — slider de note (0,1) + contrôles de partage par épisode"
```

---

## Self-Review

**Spec coverage :**
- `EpisodeEntry.audiences`/`activityAt` + rétro-compat → Task 1 ✓
- Partage dans `updateEpisode` (contenu requis, membership, gardé pour moi) → Task 2 ✓
- `episodeEntries.feed` mémoire+mongo → Task 3 ✓
- Union `FeedItem`, `enrichEpisodeEntries`, fusion `buildFeed`, `feedCursor`/`feedKey`, retype work-only, route feed → Task 4 ✓
- `audiences` sur `episodeUpdateSchema` + route → Task 5 ✓
- `FeedCard` branche `kind` + `FeedClient` clé → Task 6 ✓
- Slider note épisode + chips partage `EpisodesTab` → Task 7 ✓
- Tests : partage, feed visibilité, fusion → Tasks 2-4 ✓

**Placeholder scan :** aucun TBD/TODO ; code complet.

**Type consistency :** `EpisodeEntry` (Task 1) ⇔ repo.feed (Task 3) ⇔ `EpisodeFeedItem`/`enrichEpisodeEntries` (Task 4) ⇔ `EpisodeFeedCard` (Task 6). `feedCursor`/`feedKey` (Task 4) consommés route (Task 4) et `FeedClient` (Task 6). `audiences` : `EntryAudiences` (domaine) ⇔ zod (Task 5) ⇔ `updateEpisode` (Task 2) ⇔ chips (Task 7). `WorkFeedItem` renvoyé par `getWorkReviews`/`getEntryItem` → `WorkReviews`/`post` inchangés.
