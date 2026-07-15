# « Mes données » : import + export ZIP complet — Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Regrouper import et export dans une section « Mes données » des paramètres, et produire un export ZIP complet et propre (JSON par type + CSV biblio + images) de toutes les données de l'utilisateur.

**Architecture:** Un constructeur d'archive pur (`buildUserArchive`) assemble une map fichier→octets via les ports ; la route `GET /api/me/export` la zippe avec `fflate`. Des méthodes `listByUser` sont ajoutées aux repos épisodes/likes/commentaires et un `load` au port `MediaStorage`.

**Tech Stack:** TypeScript, Vitest, fflate (`zipSync`, `strToU8`).

## Global Constraints

- Auth `requireUser` ; export limité à l'utilisateur courant.
- **Aucun secret** dans l'archive : `profile.json` exclut `passwordHash`, `twoFactorSecret`, `twoFactorBackupCodes`.
- `media` : `basename(url)` (anti-traversée) ; lecture best-effort (`null` si absent), jamais bloquant.
- Nouveaux `listByUser` = filtre `{ userId }` (modèle `removeAllForUser`).
- Pas d'attribution AI dans les commits.

## File Structure

- `src/server/ports/media.ts` — **Modifier** : `load` sur `MediaStorage`.
- `src/server/adapters/media/local-disk-storage.ts` — **Modifier** : `load`.
- `src/server/ports/repositories.ts` — **Modifier** : `listByUser` sur `EpisodeEntryRepository`, `LikeRepository`, `CommentRepository`.
- `src/server/adapters/mongo/repositories.ts` — **Modifier** : 3 impls Mongo `listByUser`.
- `src/server/adapters/memory/index.ts` — **Modifier** : 3 impls in-memory `listByUser`.
- `src/server/export/user-archive.ts` — **Créer** : `buildUserArchive`.
- `src/app/api/me/export/route.ts` — **Modifier** : renvoyer le ZIP.
- `src/server/application/account.ts` — **Modifier** : supprimer `exportUserData`.
- `src/app/parametres/SettingsClient.tsx` — **Modifier** : section « Mes données » + retrait du lien JSON de « Votre compte ».
- Tests : `tests/adapters/list-by-user.test.ts`, `tests/export/user-archive.test.ts`.

---

### Task 1 : `listByUser` (épisodes/likes/commentaires) + `MediaStorage.load`

**Files:**
- Modify: `src/server/ports/media.ts`, `src/server/adapters/media/local-disk-storage.ts`
- Modify: `src/server/ports/repositories.ts`, `src/server/adapters/mongo/repositories.ts`, `src/server/adapters/memory/index.ts`
- Test: `tests/adapters/list-by-user.test.ts`

**Interfaces:**
- Produces :
  - `MediaStorage.load(url: string): Promise<Uint8Array | null>`
  - `EpisodeEntryRepository.listByUser(userId: string): Promise<EpisodeEntry[]>`
  - `LikeRepository.listByUser(userId: string): Promise<Like[]>`
  - `CommentRepository.listByUser(userId: string): Promise<Comment[]>`

- [ ] **Step 1 : Écrire le test**

Créer `tests/adapters/list-by-user.test.ts` :

```ts
import { describe, it, expect } from "vitest";
import { InMemoryEpisodeEntryRepository, InMemoryLikeRepository, InMemoryCommentRepository } from "@/server/adapters/memory";
import { LocalDiskStorage } from "@/server/adapters/media/local-disk-storage";
import { tmpdir } from "node:os";
import { join } from "node:path";

describe("listByUser", () => {
  it("épisodes : ne renvoie que ceux de l'utilisateur", async () => {
    const repo = new InMemoryEpisodeEntryRepository();
    const base = { watched: true, watchedAt: null, rating: null, text: null, audiences: { public: false, circle: false, communityIds: [] }, activityAt: null, createdAt: new Date(), updatedAt: new Date() };
    await repo.upsert({ id: "e1", userId: "u1", workId: "w", season: 1, episode: 1, ...base });
    await repo.upsert({ id: "e2", userId: "u2", workId: "w", season: 1, episode: 1, ...base });
    expect((await repo.listByUser("u1")).map((e) => e.id)).toEqual(["e1"]);
  });
  it("likes : ne renvoie que ceux de l'utilisateur", async () => {
    const repo = new InMemoryLikeRepository();
    await repo.add({ entryId: "a", userId: "u1", createdAt: new Date() });
    await repo.add({ entryId: "b", userId: "u2", createdAt: new Date() });
    expect((await repo.listByUser("u1")).map((l) => l.entryId)).toEqual(["a"]);
  });
  it("commentaires : ne renvoie que ceux de l'utilisateur", async () => {
    const repo = new InMemoryCommentRepository();
    await repo.add({ id: "c1", entryId: "a", userId: "u1", text: "hi", createdAt: new Date() });
    await repo.add({ id: "c2", entryId: "a", userId: "u2", text: "yo", createdAt: new Date() });
    expect((await repo.listByUser("u1")).map((c) => c.id)).toEqual(["c1"]);
  });
  it("media.load : relit les octets écrits, null si absent", async () => {
    const media = new LocalDiskStorage(join(tmpdir(), "vulu-export-test"));
    const url = await media.save(new Uint8Array([1, 2, 3]), "jpg");
    expect([...(await media.load(url))!]).toEqual([1, 2, 3]);
    expect(await media.load("/uploads/inexistant.jpg")).toBeNull();
  });
});
```

- [ ] **Step 2 : Lancer le test (échec attendu)**

Run: `npx vitest run tests/adapters/list-by-user.test.ts`
Expected: FAIL — `listByUser` / `load` inexistants.

- [ ] **Step 3 : Port `MediaStorage.load`**

Dans `src/server/ports/media.ts`, ajouter dans l'interface `MediaStorage` :

```ts
  /** Relit les octets d'une image à partir de son URL. Best-effort : null si absente/non gérée. */
  load(url: string): Promise<Uint8Array | null>;
```

- [ ] **Step 4 : `LocalDiskStorage.load`**

Dans `src/server/adapters/media/local-disk-storage.ts` :
- Compléter l'import fs : `import { mkdir, writeFile, unlink, readFile } from "node:fs/promises";`
- Ajouter la méthode (après `delete`) :

```ts
  async load(url: string): Promise<Uint8Array | null> {
    if (!url.startsWith(PUBLIC_PREFIX)) return null;
    try {
      return new Uint8Array(await readFile(join(this.dir, basename(url))));
    } catch {
      return null; // best-effort : fichier absent
    }
  }
```

- [ ] **Step 5 : Ports repos**

Dans `src/server/ports/repositories.ts` :
- `EpisodeEntryRepository` : ajouter `listByUser(userId: string): Promise<EpisodeEntry[]>;`
- `LikeRepository` : ajouter `listByUser(userId: string): Promise<Like[]>;`
- `CommentRepository` : ajouter `listByUser(userId: string): Promise<Comment[]>;`

- [ ] **Step 6 : Impls Mongo**

Dans `src/server/adapters/mongo/repositories.ts`, ajouter dans chaque classe :
- `MongoEpisodeEntryRepository` :
  ```ts
  async listByUser(userId: string) { return (await this.col.find({ userId }).toArray()).map(M.fromEpisodeEntryDoc); }
  ```
- `MongoLikeRepository` :
  ```ts
  async listByUser(userId: string) { return (await this.col.find({ userId }).toArray()).map(M.fromLikeDoc); }
  ```
- `MongoCommentRepository` :
  ```ts
  async listByUser(userId: string) { return (await this.col.find({ userId }).toArray()).map(M.fromCommentDoc); }
  ```

- [ ] **Step 7 : Impls in-memory**

Dans `src/server/adapters/memory/index.ts`, ajouter dans chaque classe :
- `InMemoryEpisodeEntryRepository` (stockage `this.byId`) :
  ```ts
  async listByUser(userId: string) { return [...this.byId.values()].filter((e) => e.userId === userId); }
  ```
- `InMemoryLikeRepository` (stockage `this.likes`) :
  ```ts
  async listByUser(userId: string) { return this.likes.filter((l) => l.userId === userId); }
  ```
- `InMemoryCommentRepository` (stockage `this.byId`) :
  ```ts
  async listByUser(userId: string) { return [...this.byId.values()].filter((c) => c.userId === userId); }
  ```

- [ ] **Step 8 : Tests + typecheck**

Run: `npx vitest run tests/adapters/list-by-user.test.ts && npx tsc --noEmit`
Expected: 4 tests PASS, typecheck OK.

- [ ] **Step 9 : Commit**

```bash
git add src/server/ports/media.ts src/server/adapters/media/local-disk-storage.ts src/server/ports/repositories.ts src/server/adapters/mongo/repositories.ts src/server/adapters/memory/index.ts tests/adapters/list-by-user.test.ts
git commit -m "feat(vulu): listByUser (épisodes/likes/commentaires) et MediaStorage.load"
```

---

### Task 2 : Constructeur d'archive `buildUserArchive`

**Files:**
- Create: `src/server/export/user-archive.ts`
- Test: `tests/export/user-archive.test.ts`

**Interfaces:**
- Consumes : les `listByUser` + `media.load` (Task 1) ; `entries.listByUser`, `lists.listByUser`, `works.findByIds`, `users.findByIds`, `follows.followeeIdsOf`/`followerIdsOf`.
- Produces : `buildUserArchive(deps: Deps, userId: string): Promise<Record<string, Uint8Array>>`.

- [ ] **Step 1 : Écrire le test**

Créer `tests/export/user-archive.test.ts` :

```ts
import { describe, it, expect, beforeEach } from "vitest";
import { makeInMemoryDeps, type Deps } from "@/server/container";
import { FakeCatalog } from "../helpers/fake-catalog";
import { buildUserArchive } from "@/server/export/user-archive";
import { strFromU8 } from "fflate";

let deps: Deps;
const U = "u1";
beforeEach(async () => {
  deps = makeInMemoryDeps(new FakeCatalog());
  const now = new Date();
  await deps.users.create({
    id: U, email: "u1@test.local", passwordHash: "SECRET-HASH", username: "alice", displayName: "Alice",
    bio: null, avatarUrl: null, bannerUrl: null, activeTabs: ["films"],
    tastes: { filmGenreIds: [], bookGenreIds: [], people: [] }, showcase: { workIds: [] },
    plus: false, staff: false, private: false, twoFactorEnabled: false, twoFactorSecret: "TOTP-SECRET",
    twoFactorBackupCodes: ["CODE"], deactivatedAt: null, notificationsSeenAt: null, tourCompletedAt: null,
    createdAt: now, inviteCode: "INV", invitedBy: null,
  } as Parameters<typeof deps.users.create>[0]);
  // une œuvre + une entrée biblio
  await deps.works.upsert({ id: "w1", source: "tmdb", externalId: "603", type: "movie", domain: "films", title: "The Matrix", year: 1999, posterUrl: null, backdropUrl: null, overview: null, genres: [], people: [], externalRating: null, watchProviders: [], episodeCounts: null, pageCount: null, runtime: null, cachedAt: now } as Parameters<typeof deps.works.upsert>[0]);
  await deps.entries.upsert({ id: "en1", userId: U, workId: "w1", domain: "films", status: "done", rating: 5, text: null, audiences: { public: false, circle: false, communityIds: [] }, completedAt: now, progress: null, activityAt: null, createdAt: now, updatedAt: now } as Parameters<typeof deps.entries.upsert>[0]);
  // un abonné
  await deps.users.create({ id: "u2", email: "u2@test.local", passwordHash: "x", username: "bob", displayName: "Bob", bio: null, avatarUrl: null, bannerUrl: null, activeTabs: ["films"], tastes: { filmGenreIds: [], bookGenreIds: [], people: [] }, showcase: { workIds: [] }, plus: false, staff: false, private: false, twoFactorEnabled: false, twoFactorSecret: null, twoFactorBackupCodes: [], deactivatedAt: null, notificationsSeenAt: null, tourCompletedAt: null, createdAt: now, inviteCode: "INV2", invitedBy: null } as Parameters<typeof deps.users.create>[0]);
  await deps.follows.add({ followerId: U, followeeId: "u2", createdAt: now });
});

describe("buildUserArchive", () => {
  it("produit toutes les entrées attendues", async () => {
    const files = await buildUserArchive(deps, U);
    for (const k of ["README.txt", "profile.json", "library.json", "library.csv", "episodes.json", "lists.json", "social.json", "likes.json", "comments.json"]) {
      expect(files[k]).toBeDefined();
    }
  });
  it("profile.json ne contient aucun secret", async () => {
    const files = await buildUserArchive(deps, U);
    const profile = strFromU8(files["profile.json"]!);
    expect(profile).not.toContain("SECRET-HASH");
    expect(profile).not.toContain("TOTP-SECRET");
    expect(profile).toContain("alice");
  });
  it("library.csv contient le titre de l'œuvre", async () => {
    const files = await buildUserArchive(deps, U);
    expect(strFromU8(files["library.csv"]!)).toContain("The Matrix");
  });
  it("social.json liste les pseudos suivis", async () => {
    const files = await buildUserArchive(deps, U);
    expect(strFromU8(files["social.json"]!)).toContain("bob");
  });
  it("inclut l'avatar si présent et lisible", async () => {
    const url = await deps.media.save(new Uint8Array([9, 9, 9]), "png");
    const u = (await deps.users.findById(U))!;
    await deps.users.update({ ...u, avatarUrl: url });
    const files = await buildUserArchive(deps, U);
    expect(Object.keys(files).some((k) => k.startsWith("media/avatar."))).toBe(true);
  });
});
```

- [ ] **Step 2 : Lancer le test (échec attendu)**

Run: `npx vitest run tests/export/user-archive.test.ts`
Expected: FAIL — module `user-archive` introuvable.

- [ ] **Step 3 : Écrire `buildUserArchive`**

Créer `src/server/export/user-archive.ts` :

```ts
import type { Deps } from "@/server/container";
import { NotFoundError } from "@/server/domain/errors";
import { strToU8 } from "fflate";

/** Échappe une cellule CSV (guillemets, virgules, retours ligne). */
function csvCell(v: unknown): string {
  const s = v === null || v === undefined ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** Extension déduite d'une URL d'image (jpg par défaut). */
function extOf(url: string): string {
  return (url.split("?")[0]!.split(".").pop() ?? "jpg");
}

export async function buildUserArchive(deps: Deps, userId: string): Promise<Record<string, Uint8Array>> {
  const user = await deps.users.findById(userId);
  if (!user) throw new NotFoundError("Utilisateur introuvable");

  const [entries, episodes, lists, likes, comments, followingIds, followerIds] = await Promise.all([
    deps.entries.listByUser(userId, {}),
    deps.episodeEntries.listByUser(userId),
    deps.lists.listByUser(userId),
    deps.likes.listByUser(userId),
    deps.comments.listByUser(userId),
    deps.follows.followeeIdsOf(userId),
    deps.follows.followerIdsOf(userId),
  ]);

  const works = await deps.works.findByIds([...new Set(entries.map((e) => e.workId))]);
  const workById = new Map(works.map((w) => [w.id, w]));

  const socialUsers = await deps.users.findByIds([...new Set([...followingIds, ...followerIds])]);
  const nameById = new Map(socialUsers.map((u) => [u.id, u.username]));
  const usernames = (ids: string[]) => ids.map((id) => nameById.get(id) ?? id);

  const { passwordHash, twoFactorSecret, twoFactorBackupCodes, ...profile } = user;
  void passwordHash; void twoFactorSecret; void twoFactorBackupCodes;

  const files: Record<string, Uint8Array> = {};
  const json = (v: unknown) => strToU8(JSON.stringify(v, null, 2));

  files["profile.json"] = json(profile);
  files["library.json"] = json(entries);
  files["episodes.json"] = json(episodes);
  files["lists.json"] = json(lists);
  files["likes.json"] = json(likes);
  files["comments.json"] = json(comments);
  files["social.json"] = json({ following: usernames(followingIds), followers: usernames(followerIds) });

  const header = ["title", "type", "status", "rating", "completedAt", "domain"];
  const rows = entries.map((e) => {
    const w = workById.get(e.workId);
    return [w?.title ?? "", w?.type ?? "", e.status, e.rating ?? "", e.completedAt ? e.completedAt.toISOString() : "", e.domain]
      .map(csvCell).join(",");
  });
  files["library.csv"] = strToU8([header.join(","), ...rows].join("\n"));

  files["README.txt"] = strToU8(
    "Export de vos données vulu\n" +
    `Utilisateur : @${user.username}\n` +
    `Date : ${deps.clock.now().toISOString()}\n\n` +
    "Contenu :\n" +
    "- profile.json : votre profil (sans mot de passe ni secret de sécurité)\n" +
    "- library.json / library.csv : votre bibliothèque (films, séries, livres)\n" +
    "- episodes.json : votre progression épisode par épisode\n" +
    "- lists.json : vos listes\n" +
    "- social.json : vos abonnements et abonnés\n" +
    "- likes.json / comments.json : vos likes et commentaires\n" +
    "- media/ : votre avatar et votre bannière\n",
  );

  if (user.avatarUrl) {
    const bytes = await deps.media.load(user.avatarUrl);
    if (bytes) files[`media/avatar.${extOf(user.avatarUrl)}`] = bytes;
  }
  if (user.bannerUrl) {
    const bytes = await deps.media.load(user.bannerUrl);
    if (bytes) files[`media/banner.${extOf(user.bannerUrl)}`] = bytes;
  }

  return files;
}
```

- [ ] **Step 4 : Tests + typecheck**

Run: `npx vitest run tests/export/user-archive.test.ts && npx tsc --noEmit`
Expected: 5 tests PASS, typecheck OK.

- [ ] **Step 5 : Commit**

```bash
git add src/server/export/user-archive.ts tests/export/user-archive.test.ts
git commit -m "feat(vulu): constructeur d'archive d'export utilisateur (JSON + CSV + médias)"
```

---

### Task 3 : Route ZIP + suppression de l'ancien export JSON

**Files:**
- Modify: `src/app/api/me/export/route.ts`
- Modify: `src/server/application/account.ts`

**Interfaces:**
- Consumes : `buildUserArchive` (Task 2).

- [ ] **Step 1 : Réécrire la route**

Remplacer `src/app/api/me/export/route.ts` par :

```ts
import { getDeps } from "@/server/container";
import { buildUserArchive } from "@/server/export/user-archive";
import { requireUser } from "@/server/http/session";
import { toErrorResponse } from "@/server/http/errors";
import { zipSync } from "fflate";

export async function GET() {
  try {
    const user = await requireUser();
    const files = await buildUserArchive(await getDeps(), user.id);
    const zip = zipSync(files);
    return new Response(zip, {
      headers: {
        "content-type": "application/zip",
        "content-disposition": `attachment; filename="vulu-${user.username}-export.zip"`,
      },
    });
  } catch (e) { return toErrorResponse(e); }
}
```

- [ ] **Step 2 : Supprimer `exportUserData`**

Dans `src/server/application/account.ts`, supprimer entièrement la fonction `exportUserData` (le bloc `export async function exportUserData(...) { ... }`). Vérifier qu'aucun autre fichier ne l'importe :

Run: `grep -rn "exportUserData" src`
Expected: aucun résultat (sinon adapter).

- [ ] **Step 3 : Typecheck**

Run: `npx tsc --noEmit`
Expected: aucune erreur.

- [ ] **Step 4 : Commit**

```bash
git add src/app/api/me/export/route.ts src/server/application/account.ts
git commit -m "feat(vulu): /api/me/export renvoie une archive ZIP complète"
```

---

### Task 4 : UI — section « Mes données »

**Files:**
- Modify: `src/app/parametres/SettingsClient.tsx`

**Interfaces:**
- Consumes : route `GET /api/me/export` (Task 3).

- [ ] **Step 1 : Renommer la section `import` → `data`**

Dans `src/app/parametres/SettingsClient.tsx` :
- Type : remplacer `"account" | "import" | "plus"` par `"account" | "data" | "plus"` dans `SectionId`.
- Tableau `SECTIONS` : remplacer la ligne
  ```tsx
  { id: "import", label: "Importer mes données", icon: "download", desc: "Migrer depuis TV Time" },
  ```
  par
  ```tsx
  { id: "data", label: "Mes données", icon: "download", desc: "Importer et exporter" },
  ```

- [ ] **Step 2 : Panneau « Mes données » (import + export)**

Remplacer l'en-tête de la branche import — remplacer :
```tsx
    if (cur === "import") return (
      <>
        <h2 className="mb-4 font-display text-xl font-bold">Importer mes données</h2>
        <p className="mb-5 text-sm text-[var(--color-text-muted)]">Migre ce que tu suivais ailleurs vers vulu, sans tout ressaisir.</p>
```
par :
```tsx
    if (cur === "data") return (
      <>
        <h2 className="mb-4 font-display text-xl font-bold">Mes données</h2>
        <div className="mb-6 rounded-2xl border border-[var(--color-border)] p-4">
          <div className="mb-1 flex items-center gap-2">
            <Icon name="download" size={20} />
            <h3 className="font-display text-lg font-bold">Exporter mes données</h3>
          </div>
          <p className="mb-4 text-sm text-[var(--color-text-muted)]">Télécharge une archive complète (.zip) : profil, bibliothèque, épisodes, listes, abonnements, likes, commentaires et images.</p>
          <a href="/api/me/export" className={`inline-flex items-center gap-2 ${primaryBtn}`}>
            <Icon name="download" size={18} /> Télécharger mon archive (.zip)
          </a>
        </div>
        <h3 className="mb-1 font-display text-lg font-bold">Importer mes données</h3>
        <p className="mb-5 text-sm text-[var(--color-text-muted)]">Migre ce que tu suivais ailleurs vers vulu, sans tout ressaisir.</p>
```

(Le reste de la branche — carte TV Time + cartes « Bientôt » + `</>`— est inchangé.)

- [ ] **Step 3 : Retirer le lien JSON de « Votre compte »**

Dans la branche `cur === "account"`, supprimer le bloc :
```tsx
        <a href="/api/me/export" className="mb-3 flex items-center gap-2 text-sm font-semibold text-[var(--color-primary)]">
          <Icon name="download" size={18} /> Télécharger une archive de vos données
        </a>
```

- [ ] **Step 4 : Typecheck**

Run: `npx tsc --noEmit`
Expected: aucune erreur.

- [ ] **Step 5 : Vérification manuelle**

Run: `npm run dev` → `/parametres` → « Mes données ».
Attendu : la section montre l'export (bouton .zip) et l'import (TV Time) ; « Votre compte » n'a plus le lien JSON ; cliquer « Télécharger mon archive » télécharge `vulu-<pseudo>-export.zip` contenant les JSON, `library.csv`, et `media/` si avatar/bannière.

- [ ] **Step 6 : Commit**

```bash
git add src/app/parametres/SettingsClient.tsx
git commit -m "feat(vulu): section « Mes données » regroupant import et export"
```

---

## Self-Review

**Couverture spec :**
- `listByUser` épisodes/likes/commentaires + `MediaStorage.load` → Task 1. ✔
- Archive : profil sans secrets, library.json/csv, episodes, lists, social (pseudos), likes, comments, media, README → Task 2. ✔
- Route ZIP + suppression `exportUserData` → Task 3. ✔
- UI « Mes données » (import + export) + retrait lien JSON de « Votre compte » → Task 4. ✔
- Sécurité (requireUser, pas de secret, basename anti-traversée) → Task 1 (`load`) + Task 2 (exclusion secrets) + route. ✔

**Placeholders :** aucun ; tout le code est fourni.

**Cohérence des types/noms :** `buildUserArchive(deps, userId): Promise<Record<string, Uint8Array>>` identique Task 2/3 ; `listByUser` signatures identiques port/adapters/consommateur ; `MediaStorage.load` identique port/adapter/usage ; mappers `M.fromEpisodeEntryDoc`/`fromLikeDoc`/`fromCommentDoc` conformes ; `SectionId` `"data"` cohérent entre type/SECTIONS/Panel ; `primaryBtn` réutilisé (déjà défini dans le fichier).
