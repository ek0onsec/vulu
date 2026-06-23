# Partage multi-cibles + badge d'origine communauté — Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permettre de partager un avis vers plusieurs destinations à la fois (Public, Cercle, communautés) sans doublon dans un même onglet de feed ; une publication de communauté apparaît aussi dans « Pour vous » avec un badge « via \<communauté\> ».

**Architecture :** On remplace les champs `LibraryEntry.visibility` + `communityId` par un objet `audiences { public, circle, communityIds }`. Une seule `LibraryEntry` par (user, œuvre) ⇒ déduplication structurelle. Les filtres de feed (memory + Mongo), l'application, la validation zod et le mapper Mongo (backfill rétro-compat) sont adaptés. Le badge d'origine et l'UI multi-sélection viennent ensuite.

**Tech Stack :** Next.js 16 (App Router), TypeScript strict (`noUncheckedIndexedAccess`), Vitest, MongoDB (driver natif) + mongodb-memory-server, zod v4, React 19, Tailwind v4.

## Global Constraints

- Toutes les commandes sont préfixées `cd /home/chamberlain/Desktop/Claude/vulu`.
- `tsc` : `node_modules/.bin/tsc --noEmit` doit rester vert.
- Tests : `npx vitest run` ; suite verte à 177 tests avant ce lot, doit le rester (+ nouveaux).
- Aucune mention d'IA / Claude dans le code, l'app ou les commits ; pas de co-auteur Claude.
- Ne pas toucher `lechatonfat/`. Préserver les clés réelles TMDB / Google Books dans `.env.local`.
- Mapping de migration (référence pour TOUTE conversion d'`visibility` legacy → `audiences`) :
  - `visibility: "public"` ⇒ `{ public: true, circle: true, communityIds: [] }`
  - `visibility: "circle"` ⇒ `{ public: false, circle: true, communityIds: [] }`
  - (préserve le comportement actuel : l'onglet « Mon cercle » montrait toute entrée d'un auteur du cercle quelle que soit la visibilité ⇒ `circle: true` partout.)

---

## File Structure

- `src/server/domain/entities.ts` — remplace `Visibility`/`communityId` par `EntryAudiences` + `LibraryEntry.audiences`.
- `src/server/adapters/mongo/mappers.ts` — `fromEntryDoc` backfille `audiences` depuis les champs legacy.
- `src/server/adapters/mongo/indexes.ts` — index feed/communauté basés sur `audiences`.
- `src/lib/zod-schemas.ts` — `rateSchema.audiences`.
- `src/server/application/library-entry.ts` — `rateOrReviewWork` (audiences + membership par communauté), `loadOrCreateEntry` (défaut).
- `src/server/adapters/memory/index.ts` & `src/server/adapters/mongo/repositories.ts` — filtres `feed` / `listRecentPublic` / `feedByCommunity`.
- `src/server/application/feed.ts` — `getEntryItem` / `getWorkReviews` (lecture audiences) + `FeedItem.communities` (Task 2).
- `src/components/FeedCard.tsx` — badge Public/Cercle + badge « via \<communauté\> » (Task 2).
- `src/components/EntryEditor.tsx` — chips multi-sélection (Task 3).
- `src/app/api/users/[username]/route.ts` — filtre profil sur `audiences.public`.
- `scripts/seed-demo.mjs` — écrit `audiences`.
- Tests : `tests/adapters/mongo-mappers.test.ts`, `tests/adapters/memory.test.ts`, `tests/adapters/mongo-repositories.test.ts`, `tests/application/{library-entry,feed,library,engagement,notifications,discover,person,communities}.test.ts`, `tests/domain/feed-rules.test.ts`, `tests/lib/zod-schemas.test.ts`.

---

## Task 1 : Modèle `audiences` + déduplication feed (refactor à comportement préservé)

Changement de type transverse : l'entité, le mapper, la validation, l'application et les deux adaptateurs de feed sont modifiés ensemble pour rester compilables, en préservant le comportement des tests existants. Le multi-ciblage communauté est persisté de bout en bout.

**Files:**
- Modify: `src/server/domain/entities.ts:5`, `:92-93`
- Modify: `src/server/adapters/mongo/mappers.ts:50-56`
- Modify: `src/server/adapters/mongo/indexes.ts:13-19`, `:34`
- Modify: `src/lib/zod-schemas.ts:26-29`
- Modify: `src/server/application/library-entry.ts:1-2`, `:13-21`, `:30-51`
- Modify: `src/server/adapters/memory/index.ts:70-95`
- Modify: `src/server/adapters/mongo/repositories.ts:71-98`
- Modify: `src/server/application/feed.ts:54-74`
- Modify: `src/app/api/users/[username]/route.ts:17-18`
- Modify: `src/components/FeedCard.tsx:29`
- Modify: `src/components/EntryEditor.tsx:22`, `:64-84`, `:137-147` (adaptation minimale au nouveau contrat — l'UI multi-select complète est en Task 3)
- Modify: `scripts/seed-demo.mjs:31-43`
- Test: `tests/adapters/mongo-mappers.test.ts`, `tests/adapters/memory.test.ts`, `tests/adapters/mongo-repositories.test.ts`, `tests/application/{library-entry,feed,library,engagement,notifications,discover,person}.test.ts`, `tests/domain/feed-rules.test.ts`, `tests/lib/zod-schemas.test.ts`

**Interfaces:**
- Produces :
  - `interface EntryAudiences { public: boolean; circle: boolean; communityIds: string[] }`
  - `LibraryEntry.audiences: EntryAudiences` (remplace `visibility` + `communityId`)
  - `rateOrReviewWork(deps, userId, ref, input: { rating: number | null; text: string | null; audiences: EntryAudiences }): Promise<LibraryEntry>`
  - Sémantique feed : `foryou = public OR communityIds.length>0 OR (circle AND auteur∈cercle)` ; `circle = circle AND auteur∈cercle` ; `feedByCommunity(X) = communityIds includes X`.

- [ ] **Step 1 : Test — backfill du mapper depuis les champs legacy**

Dans `tests/adapters/mongo-mappers.test.ts`, ajouter un test (et adapter les littéraux d'entrée existants au mapping de migration). Le helper d'entrée du fichier utilise `visibility: "public", communityId: null` ⇒ remplacer par `audiences: { public: true, circle: true, communityIds: [] }`. Puis ajouter :

```ts
it("backfille audiences depuis les champs legacy visibility/communityId", () => {
  const legacy = {
    _id: "e1", id: "e1", userId: "u1", workId: "w1", domain: "films",
    status: "done", rating: 4, text: "x", progress: null,
    activityAt: new Date(2024, 0, 1), createdAt: new Date(2024, 0, 1), updatedAt: new Date(2024, 0, 1),
    visibility: "circle", communityId: "c1",
  } as unknown as Parameters<typeof fromEntryDoc>[0];
  const e = fromEntryDoc(legacy);
  expect(e.audiences).toEqual({ public: false, circle: true, communityIds: ["c1"] });
});

it("backfille audiences public depuis visibility public sans communauté", () => {
  const legacy = {
    _id: "e2", id: "e2", userId: "u1", workId: "w1", domain: "films",
    status: "done", rating: 4, text: "x", progress: null,
    activityAt: new Date(2024, 0, 1), createdAt: new Date(2024, 0, 1), updatedAt: new Date(2024, 0, 1),
    visibility: "public", communityId: null,
  } as unknown as Parameters<typeof fromEntryDoc>[0];
  expect(fromEntryDoc(legacy).audiences).toEqual({ public: true, circle: true, communityIds: [] });
});
```

- [ ] **Step 2 : Lancer le test, vérifier l'échec de compilation**

Run: `cd /home/chamberlain/Desktop/Claude/vulu && npx vitest run tests/adapters/mongo-mappers.test.ts`
Expected: ÉCHEC — `audiences` n'existe pas sur `LibraryEntry` (erreur de type / `undefined`).

- [ ] **Step 3 : Entité — remplacer `Visibility`/`communityId` par `EntryAudiences`**

Dans `src/server/domain/entities.ts`, supprimer la ligne 5 (`export type Visibility = "circle" | "public";`) et la remplacer par :

```ts
export interface EntryAudiences {
  public: boolean;        // visible par tous dans « Pour vous »
  circle: boolean;        // visible par le cercle (onglet « Mon cercle »)
  communityIds: string[]; // fils de communautés ciblés (implique aussi « Pour vous »)
}
```

Puis remplacer les lignes 92-93 (`visibility: Visibility;` + `communityId: string | null;`) par :

```ts
  audiences: EntryAudiences;
```

- [ ] **Step 4 : Mapper — backfill rétro-compat**

Dans `src/server/adapters/mongo/mappers.ts`, remplacer `toEntryDoc`/`fromEntryDoc` (lignes 50-56) par :

```ts
type LegacyEntryDoc = WithIdEntry & { visibility?: "circle" | "public"; communityId?: string | null };

export const toEntryDoc = (e: LibraryEntry): WithIdEntry => ({ _id: e.id, ...e });
export const fromEntryDoc = (d: WithIdEntry): LibraryEntry => {
  const raw = d as LegacyEntryDoc;
  const e = strip(d);
  const progress = e.progress ?? null;
  const audiences = e.audiences ?? {
    public: raw.visibility === "public",
    circle: true,
    communityIds: raw.communityId ? [raw.communityId] : [],
  };
  const activityAt = e.activityAt ?? (isPublishable({ ...e, audiences, progress, activityAt: null }) ? e.createdAt : null);
  return { ...e, audiences, progress, activityAt };
};
```

(`strip` retire `_id` mais laisse passer les champs legacy ; `e.audiences` peut être `undefined` sur un doc legacy — on caste via `LegacyEntryDoc` pour lire `visibility`/`communityId`. On enlève les anciens champs en ne les ré-émettant jamais : `toEntryDoc` sérialise l'entité, qui n'a plus ces champs.)

- [ ] **Step 5 : zod — `rateSchema.audiences`**

Dans `src/lib/zod-schemas.ts`, remplacer les lignes 27-28 (`visibility:` + `communityId:`) à l'intérieur de `rateSchema` par :

```ts
  audiences: z.object({
    public: z.boolean(),
    circle: z.boolean(),
    communityIds: z.array(z.string()),
  }),
```

- [ ] **Step 6 : Application — `loadOrCreateEntry` + `rateOrReviewWork`**

Dans `src/server/application/library-entry.ts` :

Ligne 2, remplacer l'import `Visibility` par `EntryAudiences` :

```ts
import type { EntryProgress, EntryStatus, LibraryEntry, EntryAudiences, WorkSource, WorkType } from "@/server/domain/entities";
```

Dans `loadOrCreateEntry` (lignes 18-20), remplacer `visibility: "circle", communityId: null,` par `audiences: { public: false, circle: true, communityIds: [] },` :

```ts
  return { id: deps.ids.next(), userId, workId: work.id, domain: work.domain,
    status: "planned", rating: null, text: null, audiences: { public: false, circle: true, communityIds: [] },
    progress: null, activityAt: null, createdAt: now, updatedAt: now };
```

Remplacer entièrement `rateOrReviewWork` (lignes 30-51) par :

```ts
export async function rateOrReviewWork(
  deps: Deps, userId: string, ref: Ref,
  input: { rating: number | null; text: string | null; audiences: EntryAudiences },
): Promise<LibraryEntry> {
  if (input.rating === null && (input.text === null || input.text.trim() === "")) {
    throw new ValidationError("Ajoute une note ou un commentaire");
  }
  if (input.rating !== null && !isValidRating(input.rating)) {
    throw new ValidationError("Note invalide (0 à 5, par pas de 0,1)");
  }
  const { audiences } = input;
  if (!audiences.public && !audiences.circle && audiences.communityIds.length === 0) {
    throw new ValidationError("Choisis au moins une destination");
  }
  // Pour chaque communauté ciblée, l'auteur doit en être membre.
  for (const communityId of audiences.communityIds) {
    const member = await deps.memberships.find(communityId, userId);
    if (!member) throw new ForbiddenError("Tu n'es pas membre de cette communauté");
  }
  const entry = await loadOrCreateEntry(deps, userId, ref);
  const updated: LibraryEntry = { ...entry, status: "done", rating: input.rating,
    text: input.text?.trim() ? input.text.trim() : null, audiences,
    activityAt: deps.clock.now(), updatedAt: deps.clock.now() };
  await deps.entries.upsert(updated);
  return updated;
}
```

- [ ] **Step 7 : Adaptateur memory — filtres feed**

Dans `src/server/adapters/memory/index.ts`, remplacer les corps de `feed` (ligne 75), `listRecentPublic` (ligne 82) et `feedByCommunity` (ligne 93) :

Ligne 75 — la clause de portée devient :

```ts
      .filter((e) => opts.scope === "circle"
        ? (e.audiences.circle && circle.has(e.userId))
        : (e.audiences.public || e.audiences.communityIds.length > 0 || (e.audiences.circle && circle.has(e.userId))))
```

Ligne 82 — `listRecentPublic` :

```ts
      .filter((e) => e.audiences.public && isPublishable(e))
```

Ligne 93 — `feedByCommunity` :

```ts
      .filter((e) => e.audiences.communityIds.includes(communityId) && isFeedVisible(e))
```

- [ ] **Step 8 : Adaptateur Mongo — filtres feed**

Dans `src/server/adapters/mongo/repositories.ts`, remplacer `feed` (lignes 72-74), `listRecentPublic` (ligne 84) et `feedByCommunity` (lignes 92-93) :

`feed` — la sélection de portée :

```ts
    const visibility: Filter<M.WithIdEntry> = opts.scope === "circle"
      ? { "audiences.circle": true, userId: { $in: opts.circleUserIds } }
      : { $or: [
          { "audiences.public": true },
          { "audiences.communityIds.0": { $exists: true } },
          { "audiences.circle": true, userId: { $in: opts.circleUserIds } },
        ] };
```

`listRecentPublic` (ligne 84) :

```ts
    const q: Filter<M.WithIdEntry> = { "audiences.public": true, status: "done", $or: [{ rating: { $ne: null } }, { text: { $ne: null } }] };
```

`feedByCommunity` (le `and` lignes 92-95) :

```ts
    const and: Filter<M.WithIdEntry>[] = [
      { "audiences.communityIds": communityId },
      { activityAt: { $ne: null } },
    ];
```

- [ ] **Step 9 : Application feed — `getEntryItem` / `getWorkReviews`**

Dans `src/server/application/feed.ts` :

Ligne 58 (`getEntryItem`), remplacer `entry.visibility !== "public"` par `!entry.audiences.public` :

```ts
  if (entry.userId !== viewerId && !entry.audiences.public) {
```

Ligne 71 (`getWorkReviews`), remplacer `e.visibility === "public"` par `e.audiences.public` :

```ts
    (e) => e.userId !== viewerId && (e.audiences.public || circle.has(e.userId)),
```

- [ ] **Step 10 : Route profil + FeedCard + EntryEditor + seed + indexes**

`src/app/api/users/[username]/route.ts` ligne 18 :

```ts
      .filter((e) => e.audiences.public || isSelf || inCircle);
```

`src/components/FeedCard.tsx` ligne 29 :

```ts
  const isPublic = item.entry.audiences.public || item.entry.audiences.communityIds.length > 0;
```

`src/components/EntryEditor.tsx` — adaptation minimale pour compiler avec le nouveau contrat (l'UI multi-select complète arrive en Task 3). Remplacer la ligne 22 :

```ts
  const [target, setTarget] = useState<Target>(
    initial?.audiences.communityIds[0] ?? (initial?.audiences.public ? "public" : "circle"),
  );
```

et dans `save()` (lignes 67-72) remplacer le calcul `visibility`/`communityId` par un `audiences` :

```ts
      const isTargetCommunity = target !== "circle" && target !== "public";
      const audiences = {
        public: target === "public",
        circle: target === "circle",
        communityIds: isTargetCommunity ? [target] : [],
      };
      const body = status === "planned" && rating === 0 && !text.trim()
        ? { ref: workRef, status: "planned" }
        : { ref: workRef, rating: rating > 0 ? rating : null, text: text.trim() || null, audiences };
```

`scripts/seed-demo.mjs` — remplacer ligne 32 le bout `visibility, communityId: null,` par `audiences: { public: visibility === "public", circle: true, communityIds: [] },` et ligne 40 `visibility: "public", communityId: null,` par `audiences: { public: true, circle: true, communityIds: [] },`.

`src/server/adapters/mongo/indexes.ts` — remplacer l'index `feed` (ligne 15) par un index sur `audiences.public`, et l'index communauté (ligne 34) par `audiences.communityIds` :

```ts
    { key: { "audiences.public": 1, domain: 1, createdAt: -1 }, name: "feed" },
```

```ts
  await db.collection("entries").createIndex({ "audiences.communityIds": 1, activityAt: -1 }, { name: "by_community" });
```

- [ ] **Step 11 : Migrer les tests restants au mapping `audiences`**

Convertir chaque appel/littéral selon la table de migration (Global Constraints). Remplacer mécaniquement :
- `rateOrReviewWork(..., { rating, text, visibility: "public" })` → `{ rating, text, audiences: { public: true, circle: true, communityIds: [] } }`
- `rateOrReviewWork(..., { rating, text, visibility: "circle" })` → `{ rating, text, audiences: { public: false, circle: true, communityIds: [] } }`
- littéraux d'entrée `visibility: "public", communityId: null` → `audiences: { public: true, circle: true, communityIds: [] }`
- littéraux d'entrée `visibility: "circle"` (et `communityId` éventuel) → `audiences: { public: false, circle: true, communityIds: [] }`

Fichiers concernés : `tests/application/{library-entry,feed,library,engagement,notifications,discover,person}.test.ts`, `tests/domain/feed-rules.test.ts`, `tests/adapters/{memory,mongo-repositories}.test.ts`, `tests/lib/zod-schemas.test.ts`.

Dans `tests/lib/zod-schemas.test.ts`, le garde-fou existant qui vérifiait que `communityId` traverse `rateSchema` doit devenir un garde-fou `audiences` :

```ts
it("rateSchema conserve audiences (garde-fou frontière HTTP)", () => {
  const parsed = rateSchema.parse({
    ref: { source: "tmdb", externalId: "1", type: "movie" },
    rating: 4, text: null,
    audiences: { public: true, circle: false, communityIds: ["c1"] },
  });
  expect(parsed.audiences).toEqual({ public: true, circle: false, communityIds: ["c1"] });
});
```

- [ ] **Step 12 : Ajouter le test de déduplication multi-cibles (feed memory)**

Dans `tests/application/feed.test.ts`, ajouter un test qui prouve qu'une entrée ciblant Public + Cercle + communauté n'apparaît qu'une fois en « Pour vous » :

```ts
it("une entrée multi-cibles n'apparaît qu'une fois en Pour vous", async () => {
  const deps = makeInMemoryDeps();
  // me suit friend ; friend publie en public + cercle
  await deps.follows.add({ followerId: me, followeeId: friend, createdAt: new Date() });
  const ref = { source: "tmdb", externalId: "603", type: "movie" } as const;
  await rateOrReviewWork(deps, friend, ref, { rating: 4, text: "x", audiences: { public: true, circle: true, communityIds: [] } });
  const items = await buildFeed(deps, me, { scope: "foryou", cursor: null, limit: 50 });
  expect(items.filter((i) => i.author.id === friend)).toHaveLength(1);
});
```

(Adapter les noms `me`/`friend`/helpers au style déjà présent dans le fichier.)

- [ ] **Step 13 : Vérifier tsc + suite complète**

Run: `cd /home/chamberlain/Desktop/Claude/vulu && node_modules/.bin/tsc --noEmit && npx vitest run`
Expected: 0 erreur tsc ; toute la suite verte (177 + nouveaux tests).

- [ ] **Step 14 : Commit**

```bash
cd /home/chamberlain/Desktop/Claude/vulu && git add -A && git commit -q -m "feat(vulu): partage multi-cibles — audiences { public, circle, communityIds } + dédup feed"
```

---

## Task 2 : Badge d'origine communauté (« via \<communauté\> »)

`FeedItem` porte les communautés d'origine, résolues dans `enrichEntries` ; `FeedCard` affiche le badge.

**Files:**
- Modify: `src/server/application/feed.ts:6-13` (type `FeedItem`), `:16-33` (`enrichEntries`)
- Modify: `src/components/FeedCard.tsx:42-48`
- Test: `tests/application/feed.test.ts`

**Interfaces:**
- Consumes : `LibraryEntry.audiences.communityIds` (Task 1) ; `deps.communities.listByIds(ids): Promise<Community[]>` (existant).
- Produces : `FeedItem.communities: { id: string; name: string }[]`.

- [ ] **Step 1 : Test — `enrichEntries` résout les communautés d'origine**

Dans `tests/application/feed.test.ts` :

```ts
it("enrichEntries résout les communautés d'origine d'une entrée", async () => {
  const deps = makeInMemoryDeps();
  const now = new Date();
  await deps.communities.upsert({ id: "c1", name: "Ciné Club", slug: "cine-club", description: null, bannerUrl: null, visibility: "public", ownerId: friend, createdAt: now });
  await deps.memberships.add({ communityId: "c1", userId: friend, pinned: false, role: "owner", createdAt: now });
  const ref = { source: "tmdb", externalId: "603", type: "movie" } as const;
  await rateOrReviewWork(deps, friend, ref, { rating: 4, text: "x", audiences: { public: false, circle: false, communityIds: ["c1"] } });
  const items = await buildFeed(deps, friend, { scope: "foryou", cursor: null, limit: 50 });
  const mine = items.find((i) => i.author.id === friend);
  expect(mine?.communities).toEqual([{ id: "c1", name: "Ciné Club" }]);
});
```

(Vérifier le nom exact de la méthode d'upsert du `CommunityRepository` en mémoire — l'utiliser tel quel.)

- [ ] **Step 2 : Lancer le test, vérifier l'échec**

Run: `cd /home/chamberlain/Desktop/Claude/vulu && npx vitest run tests/application/feed.test.ts -t "communautés d'origine"`
Expected: ÉCHEC — `communities` absent de `FeedItem`.

- [ ] **Step 3 : Étendre `FeedItem` + `enrichEntries`**

Dans `src/server/application/feed.ts`, ajouter au type `FeedItem` (après `likedByMe`) :

```ts
  communities: { id: string; name: string }[];
```

Dans `enrichEntries`, résoudre les communautés. Remplacer le corps de `Promise.all(entries.map(...))` pour inclure la résolution :

```ts
  return Promise.all(entries.map(async (entry) => {
    const [author, work, likeCount, commentCount, communities] = await Promise.all([
      deps.users.findById(entry.userId),
      deps.works.findById(entry.workId),
      deps.likes.countByEntry(entry.id),
      deps.comments.countByEntry(entry.id),
      entry.audiences.communityIds.length > 0
        ? deps.communities.listByIds(entry.audiences.communityIds)
        : Promise.resolve([]),
    ]);
    if (!author || !work) throw new NotFoundError("Données de feed incohérentes");
    return {
      entry,
      author: { id: author.id, username: author.username, displayName: author.displayName, avatarUrl: author.avatarUrl, plus: author.plus, staff: author.staff },
      work: { id: work.id, title: work.title, year: work.year, posterUrl: work.posterUrl, type: work.type, episodeCounts: work.episodeCounts, pageCount: work.pageCount },
      likeCount, commentCount, likedByMe: liked.has(entry.id),
      communities: communities.map((c) => ({ id: c.id, name: c.name })),
    };
  }));
```

- [ ] **Step 4 : Vérifier le test passant**

Run: `cd /home/chamberlain/Desktop/Claude/vulu && npx vitest run tests/application/feed.test.ts`
Expected: PASS.

- [ ] **Step 5 : FeedCard — afficher « via \<communauté\> »**

Dans `src/components/FeedCard.tsx`, après le badge Public/Cercle (juste après la `</header>` close du bloc lignes 44-48, à l'intérieur de `<header>` ou en ligne suivante), ajouter le rendu du badge d'origine. Insérer avant la fermeture `</header>` (ligne 49) :

```tsx
        {item.communities.length > 0 && (
          <Link
            href={`/communaute/${item.communities[0]!.id}`}
            className="rounded-full bg-[color-mix(in_srgb,var(--color-primary)_12%,transparent)] px-2.5 py-1 text-xs font-medium text-[var(--color-primary)] hover:underline"
          >
            via {item.communities[0]!.name}{item.communities.length > 1 ? ` +${item.communities.length - 1}` : ""}
          </Link>
        )}
```

(Le badge Public/Cercle existant garde son `ml-auto` ; déplacer `ml-auto` sur le premier des deux badges si besoin pour que le groupe soit poussé à droite — mettre la `<Link>` « via » juste avant le `<span>` Public/Cercle et retirer `ml-auto` du span pour le porter sur la `<Link>` via, sinon laisser tel quel si l'alignement convient.)

- [ ] **Step 6 : Vérifier tsc**

Run: `cd /home/chamberlain/Desktop/Claude/vulu && node_modules/.bin/tsc --noEmit`
Expected: 0 erreur.

- [ ] **Step 7 : Commit**

```bash
cd /home/chamberlain/Desktop/Claude/vulu && git add -A && git commit -q -m "feat(vulu): badge d'origine « via <communauté> » dans le feed"
```

---

## Task 3 : UI EntryEditor — chips de partage multi-sélection

Remplace le sélecteur radio mono-cible par des chips à bascule multi-sélection (Public, Cercle, une chip par communauté rejointe), avec garde « au moins une destination ».

**Files:**
- Modify: `src/components/EntryEditor.tsx:9-11`, `:22-23`, `:64-84`, `:137-147`

**Interfaces:**
- Consumes : `LibraryEntry.audiences` (Task 1) ; `GET /api/communities/mine → { communities: { id; name }[] }` (existant).
- Produces : corps `PUT /api/works/entry` avec `audiences: { public, circle, communityIds }`.

- [ ] **Step 1 : Remplacer l'état mono-cible par l'état multi-sélection**

Dans `src/components/EntryEditor.tsx`, supprimer le type `Target` et la ligne 22 (`const [target, setTarget] = ...`). Remplacer par trois états reconstruits depuis `initial?.audiences` :

```ts
  const [sharePublic, setSharePublic] = useState<boolean>(initial?.audiences.public ?? false);
  const [shareCircle, setShareCircle] = useState<boolean>(initial?.audiences.circle ?? true);
  const [shareCommunities, setShareCommunities] = useState<Set<string>>(
    () => new Set(initial?.audiences.communityIds ?? []),
  );
```

(Le commentaire `// Cible de partage…` et `type Target = string;` lignes 10-11 sont supprimés.)

- [ ] **Step 2 : Calculer `audiences` dans `save()` + garde**

Dans `save()`, remplacer le bloc lignes 64-72 par :

```ts
  async function save() {
    setBusy(true); setMsg(null);
    try {
      const communityIds = [...shareCommunities];
      const audiences = { public: sharePublic, circle: shareCircle, communityIds };
      const isReview = !(status === "planned" && rating === 0 && !text.trim());
      if (isReview && !sharePublic && !shareCircle && communityIds.length === 0) {
        const m = "Choisis au moins une destination";
        setMsg(m); toast(m, "error"); setBusy(false); return;
      }
      const body = isReview
        ? { ref: workRef, rating: rating > 0 ? rating : null, text: text.trim() || null, audiences }
        : { ref: workRef, status: "planned" };
```

(Le reste de `save()` — appel `api.put`, `setEntryId`, `setMsg("Enregistré ✓")`, `catch`/`finally` — reste inchangé.)

- [ ] **Step 3 : Chips multi-sélection dans le rendu**

Remplacer le bloc « Partager dans » (lignes 137-147) par des chips à bascule :

```tsx
      <p className="mt-4 mb-1.5 text-xs font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">Partager dans</p>
      <div className="flex flex-wrap gap-2">
        <button onClick={() => setSharePublic((v) => !v)}
          className={`rounded-full border px-4 py-1.5 text-sm ${sharePublic ? "border-[var(--color-primary)] bg-[var(--color-primary)] text-white" : "border-[var(--color-border)] text-[var(--color-text-muted)]"}`}>
          {sharePublic ? "✓ " : ""}● Public
        </button>
        <button onClick={() => setShareCircle((v) => !v)}
          className={`rounded-full border px-4 py-1.5 text-sm ${shareCircle ? "border-[var(--color-primary)] bg-[var(--color-primary)] text-white" : "border-[var(--color-border)] text-[var(--color-text-muted)]"}`}>
          {shareCircle ? "✓ " : ""}● Cercle
        </button>
        {communities.map((c) => {
          const on = shareCommunities.has(c.id);
          return (
            <button key={c.id} onClick={() => setShareCommunities((prev) => { const next = new Set(prev); next.has(c.id) ? next.delete(c.id) : next.add(c.id); return next; })}
              className={`rounded-full border px-4 py-1.5 text-sm ${on ? "border-[var(--color-primary)] bg-[var(--color-primary)] text-white" : "border-[var(--color-border)] text-[var(--color-text-muted)]"}`}>
              {on ? "✓ " : ""}◆ {c.name}
            </button>
          );
        })}
      </div>
```

- [ ] **Step 4 : Vérifier tsc**

Run: `cd /home/chamberlain/Desktop/Claude/vulu && node_modules/.bin/tsc --noEmit`
Expected: 0 erreur.

- [ ] **Step 5 : Vérifier la suite complète**

Run: `cd /home/chamberlain/Desktop/Claude/vulu && npx vitest run`
Expected: suite verte.

- [ ] **Step 6 : Commit**

```bash
cd /home/chamberlain/Desktop/Claude/vulu && git add -A && git commit -q -m "feat(vulu): EntryEditor — chips de partage multi-sélection (Public, Cercle, communautés)"
```

---

## Self-Review

**Spec coverage :**
- §1 Modèle `audiences` ⇒ Task 1 Steps 3, 5, 6. ✓
- §1 Migration/backfill mapper ⇒ Task 1 Step 4 + test Step 1. ✓
- §2 Feed & dédup (foryou/circle/feedByCommunity, index Mongo) ⇒ Task 1 Steps 7, 8, 10 (indexes) + tests 11, 12. ✓
- §3 Badge d'origine (`FeedItem.communities`, `enrichEntries`, FeedCard) ⇒ Task 2. ✓
- §4 UI multi-select ⇒ Task 3. ✓
- §5 Validation & application (`rateSchema`, `rateOrReviewWork` membership par communauté, `loadOrCreateEntry` défaut, route PUT) ⇒ Task 1 Steps 5, 6 (la route `/api/works/entry` ne change pas : elle fait `rateSchema.parse(body)` puis passe `input` à `rateOrReviewWork` ; le schéma élargi suffit). ✓
- §6 Tests (mappers, rateOrReviewWork, feed memory+mongo, enrichEntries, rateSchema) ⇒ Task 1 Steps 1, 11, 12 + Task 2 Step 1. ✓
- Hors périmètre (note privée, re-partage a posteriori, opt-out par communauté) ⇒ non implémentés. ✓

**Placeholder scan :** aucun TODO/TBD ; chaque step de code montre le code complet.

**Type consistency :** `EntryAudiences { public, circle, communityIds }` cohérent entre entité (Task 1.3), zod (1.5), application (1.6), repos (1.7-1.8), `FeedItem.communities` (2.3), EntryEditor (3). `deps.communities.listByIds` et `deps.memberships.find` vérifiés existants. `rateOrReviewWork` signature `{ rating, text, audiences }` identique entre 1.6 et tous les sites de test (1.11) et la route PUT.

## Execution Handoff

**Plan complet, sauvegardé dans `docs/superpowers/plans/2026-06-22-partage-multi-cibles.md`. Deux options d'exécution :**

**1. Subagent-Driven (recommandé)** — je dispatche un sous-agent par tâche, revue entre chaque, itération rapide.

**2. Inline Execution** — exécution dans cette session via executing-plans, par lots avec points de contrôle.

**Quelle approche ?**
