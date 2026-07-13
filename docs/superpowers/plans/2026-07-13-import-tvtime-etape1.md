# Import TV Time — Étape 1 (UI + bac à sable local) — Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ajouter le point d'entrée UI « Import » (coquille TV Time) dans les paramètres, et monter un Mongo local persistant contenant un clone lecture-seule des données de Margot, pour développer le moteur d'import sans toucher à la prod.

**Architecture:** Deux volets indépendants. (A) Une section supplémentaire dans le composant paramètres existant, action finale débranchée. (B) Deux scripts Node autonomes — un lanceur `mongodb-memory-server` persistant sur port 27017, et un cloneur qui lit l'Atlas prod (depuis `.env.local`) et écrit en local. Un `.env.development.local` fait basculer `npm run dev` sur le Mongo local sans impacter le build prod.

**Tech Stack:** Next 16.2.9 (React, client component), Node v24, driver `mongodb` ^7.3, `mongodb-memory-server` ^11.2 (déjà installé).

## Global Constraints

- Broker/infra : aucune. Dev local uniquement.
- `mongodb-memory-server` : TOUJOURS épingler le binaire pour Parrot OS —
  `binary: { version: "7.0.14", os: { os: "linux", dist: "ubuntu", release: "22.04" } }`. Sans ça, pas de binaire téléchargeable.
- Le script de clonage n'effectue QUE des lectures (`find`) sur la source (Atlas). Jamais d'écriture sur la source.
- Aucun secret en dur : l'URI Atlas est lue depuis `.env.local` (gitignoré via `.env*`).
- Pas d'attribution AI dans les commits (pas de co-auteur Claude).
- Typage strict, pas de `any`. Nommage explicite en français cohérent avec le code existant.
- Le moteur d'import (parsing CSV, mapping TheTVDB→TMDB, dédup) est HORS PÉRIMÈTRE de ce plan.

## File Structure

- `src/app/parametres/SettingsClient.tsx` — **Modifier** : ajouter la section `import` (type `SectionId`, tableau `SECTIONS`, branche `Panel()`, état + handler d'upload débranché).
- `scripts/local-mongo.mjs` — **Créer** : lanceur Mongo local persistant sur port 27017 (`dbPath ./.local-mongo`), reste vivant.
- `scripts/clone-margot.mjs` — **Créer** : clone lecture-seule Atlas→local des données de Margot.
- `.env.development.local` — **Créer** : override `MONGODB_URI`/`MONGODB_DB` vers le Mongo local pour `npm run dev` uniquement.
- `.gitignore` — **Modifier** : ajouter `.local-mongo/`.
- `package.json` — **Modifier** : scripts `local-mongo` et `clone:margot`.

**Note test harness :** ce repo n'a pas de tests de composants React (vitest ne couvre que `domain`/`application`). Les tâches UI et scripts one-shot sont donc vérifiées par `npx tsc --noEmit` + une vérification manuelle explicite, pas par des tests unitaires automatisés. C'est conforme à l'état du repo.

---

### Task 1 : Section « Import » dans les paramètres (coquille TV Time)

**Files:**
- Modify: `src/app/parametres/SettingsClient.tsx`

**Interfaces:**
- Consumes : composants existants `Icon` (name `download`), `toast(message, variant)`, styles `field`/`primaryBtn` déjà définis dans le fichier.
- Produces : nouvelle `SectionId` `"import"` ; aucune API consommée par d'autres tâches.

- [ ] **Step 1 : Ajouter `"import"` au type `SectionId`**

Dans `src/app/parametres/SettingsClient.tsx`, remplacer la ligne du type (l. 22) :

```tsx
type SectionId = "account" | "plus" | "security" | "privacy" | "display" | "interests" | "accessibility" | "legal" | "community" | "invite";
```
par :
```tsx
type SectionId = "account" | "import" | "plus" | "security" | "privacy" | "display" | "interests" | "accessibility" | "legal" | "community" | "invite";
```

- [ ] **Step 2 : Ajouter l'entrée de menu dans `SECTIONS`**

Insérer cet objet juste après l'entrée `account` dans le tableau `SECTIONS` :

```tsx
  { id: "import", label: "Importer mes données", icon: "download", desc: "Migrer depuis TV Time" },
```

- [ ] **Step 3 : Ajouter l'état d'upload et le handler débranché**

Après la ligne `const [confirmText, setConfirmText] = useState("");` (l. 54), ajouter :

```tsx
  const [importFile, setImportFile] = useState<File | null>(null);
  function analyzeImport() {
    if (!importFile) return;
    // Étape 1 : point d'entrée seulement — le moteur d'import (parsing, mapping
    // TheTVDB→TMDB, dédup) arrive dans une étape ultérieure.
    toast("Analyse en préparation — le moteur d'import arrive bientôt.");
  }
```

- [ ] **Step 4 : Ajouter la branche `Panel()` pour la section import**

Dans la fonction `Panel()`, juste après la branche `if (cur === "account") return (...)` (avant `if (cur === "plus")`), insérer :

```tsx
    if (cur === "import") return (
      <>
        <h2 className="mb-4 font-display text-xl font-bold">Importer mes données</h2>
        <p className="mb-5 text-sm text-[var(--color-text-muted)]">Migre ce que tu suivais ailleurs vers vulu, sans tout ressaisir.</p>
        <div className="mb-3 rounded-2xl border border-[var(--color-border)] p-4">
          <div className="mb-1 flex items-center gap-2">
            <Icon name="download" size={20} />
            <h3 className="font-display text-lg font-bold">TV Time</h3>
          </div>
          <p className="mb-4 text-sm text-[var(--color-text-muted)]">Séries et épisodes vus, notes et favoris. Télécharge ton export depuis TV Time (Réglages → Confidentialité → Télécharger mes données), puis dépose l'archive <strong>.zip</strong> ici.</p>
          <label className="mb-3 flex cursor-pointer items-center gap-3 rounded-xl border border-dashed border-[var(--color-border)] p-3 text-sm transition-colors hover:border-[var(--color-primary)]">
            <Icon name="download" size={18} />
            <span className="min-w-0 truncate text-[var(--color-text-muted)]">{importFile ? importFile.name : "Choisir mon export TV Time (.zip)"}</span>
            <input type="file" accept=".zip" className="hidden" onChange={(e) => setImportFile(e.target.files?.[0] ?? null)} />
          </label>
          <button onClick={analyzeImport} disabled={!importFile} className={primaryBtn}>Analyser mon export</button>
        </div>
        {["Letterboxd", "IMDb", "Trakt"].map((name) => (
          <div key={name} className="mb-2 flex items-center justify-between rounded-xl border border-[var(--color-border)] p-3 text-sm">
            <span className="font-medium">{name}</span>
            <span className="rounded-full bg-[var(--color-border)] px-3 py-1 text-xs font-semibold text-[var(--color-text-muted)]">Bientôt</span>
          </div>
        ))}
      </>
    );
```

- [ ] **Step 5 : Vérifier le typage**

Run: `npx tsc --noEmit`
Expected: aucune erreur.

- [ ] **Step 6 : Vérification manuelle**

Run: `npm run dev` puis ouvrir `/parametres`.
Attendu : la section « Importer mes données » apparaît dans le menu ; la carte TV Time s'affiche ; sélectionner un `.zip` affiche son nom et active le bouton ; le clic affiche le toast « Analyse en préparation ». Les cartes Letterboxd/IMDb/Trakt sont grisées « Bientôt ».

- [ ] **Step 7 : Commit**

```bash
git add src/app/parametres/SettingsClient.tsx
git commit -m "feat(vulu): section « Import » dans les paramètres (coquille TV Time)"
```

---

### Task 2 : Bac à sable Mongo local persistant

**Files:**
- Create: `scripts/local-mongo.mjs`
- Create: `.env.development.local`
- Modify: `.gitignore`
- Modify: `package.json` (bloc `scripts`)

**Interfaces:**
- Produces : un `mongod` accessible sur `mongodb://127.0.0.1:27017`, base `vulu`, dbPath persistant `./.local-mongo`. Consommé par Task 3 (dest) et par `npm run dev`.

- [ ] **Step 1 : Créer le lanceur `scripts/local-mongo.mjs`**

```js
// Démarre un MongoDB local PERSISTANT sur le port 27017 et reste vivant (Ctrl+C pour arrêter).
// Bac à sable de dev : `npm run dev` s'y connecte via .env.development.local.
import { MongoMemoryServer } from "mongodb-memory-server";
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";

const dbPath = resolve(process.cwd(), ".local-mongo");
mkdirSync(dbPath, { recursive: true });

// Parrot OS (base Debian) est mal détecté par mongodb-memory-server → binaire épinglé.
const server = await MongoMemoryServer.create({
  binary: { version: "7.0.14", os: { os: "linux", dist: "ubuntu", release: "22.04" } },
  instance: { port: 27017, dbPath, storageEngine: "wiredTiger" },
});

console.log(`[local-mongo] prêt sur ${server.getUri()} (dbPath: ${dbPath})`);
console.log("[local-mongo] Ctrl+C pour arrêter. Les données sont conservées.");

async function shutdown() {
  console.log("\n[local-mongo] arrêt (données conservées)…");
  await server.stop({ doCleanup: false, force: false });
  process.exit(0);
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
setInterval(() => {}, 1 << 30);
```

- [ ] **Step 2 : Créer `.env.development.local`**

```
# Dev uniquement : bascule l'app sur le Mongo local (bac à sable Margot).
# Précédence Next : ce fichier > .env.local. En prod (NODE_ENV=production) il est ignoré.
MONGODB_URI=mongodb://127.0.0.1:27017
MONGODB_DB=vulu
```

- [ ] **Step 3 : Ignorer le dossier de données local**

Ajouter à la fin de `.gitignore` :

```
# Bac à sable Mongo local (données de dev)
.local-mongo/
```

- [ ] **Step 4 : Ajouter le script npm**

Dans `package.json`, bloc `scripts`, ajouter après `"test:watch"` :

```json
    "local-mongo": "node scripts/local-mongo.mjs"
```
(ajouter la virgule sur la ligne précédente pour un JSON valide.)

- [ ] **Step 5 : Vérifier que le lanceur démarre**

Run: `npm run local-mongo`
Expected: affiche `[local-mongo] prêt sur mongodb://127.0.0.1:27017/`. Laisser tourner dans un terminal dédié (nécessaire pour Task 3). Au 1er run, le binaire mongod se télécharge (peut prendre une minute).

- [ ] **Step 6 : Commit** (le `.env.development.local` est gitignoré via `.env*`, il ne sera pas commité — normal)

```bash
git add scripts/local-mongo.mjs .gitignore package.json
git commit -m "chore(vulu): bac à sable Mongo local persistant (dev)"
```

---

### Task 3 : Clonage lecture-seule des données de Margot (prod → local)

**Files:**
- Create: `scripts/clone-margot.mjs`
- Modify: `package.json` (bloc `scripts`)

**Interfaces:**
- Consumes : la source Atlas via `MONGODB_URI`/`MONGODB_DB` lus depuis `.env.local` ; la destination `mongodb://127.0.0.1:27017` (Mongo local de Task 2, qui doit tourner).
- Produces : base locale `vulu` peuplée du user Margot + ses `entries`/`episode_entries`/`lists`/`likes`/`comments` + les `works` référencés + `episode_cache` associé.

- [ ] **Step 1 : Créer `scripts/clone-margot.mjs`**

```js
// Clone LECTURE-SEULE des données de Margot depuis l'Atlas prod vers le Mongo local.
// Prérequis : `npm run local-mongo` doit tourner (destination sur 127.0.0.1:27017).
// Source (Atlas) lue depuis .env.local. AUCUNE écriture sur la source.
import { MongoClient } from "mongodb";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const MARGOT_EMAIL = "delettremargot03@gmail.com";
const DEST_URI = process.env.DEST_MONGODB_URI ?? "mongodb://127.0.0.1:27017";
const DEST_DB = "vulu";

/** Parse un .env simple (split sur le premier '='). */
function parseEnv(path) {
  const out = {};
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i === -1) continue;
    out[t.slice(0, i).trim()] = t.slice(i + 1).trim();
  }
  return out;
}

/** Purge puis réinsère les documents dans une collection de destination. */
async function replaceCollection(destDb, name, docs) {
  await destDb.collection(name).deleteMany({});
  if (docs.length) await destDb.collection(name).insertMany(docs);
  console.log(`  ${name}: ${docs.length}`);
}

async function main() {
  const env = parseEnv(resolve(process.cwd(), ".env.local"));
  const srcUri = env.MONGODB_URI;
  const srcDb = env.MONGODB_DB || "vulu";
  if (!srcUri) throw new Error(".env.local: MONGODB_URI (Atlas) introuvable");

  const src = new MongoClient(srcUri, { maxPoolSize: 5 });
  const dst = new MongoClient(DEST_URI, { maxPoolSize: 5 });
  await src.connect();
  await dst.connect();
  try {
    const S = src.db(srcDb);
    const D = dst.db(DEST_DB);

    const margot = await S.collection("users").findOne({ email: MARGOT_EMAIL });
    if (!margot) throw new Error(`Utilisatrice introuvable en prod: ${MARGOT_EMAIL}`);
    const userId = margot._id;
    console.log(`Margot trouvée: _id=${userId}`);

    // 1) User
    await replaceCollection(D, "users", [margot]);

    // 2) Collections lui appartenant (filtre userId)
    const entries = await S.collection("entries").find({ userId }).toArray();
    const episodeEntries = await S.collection("episode_entries").find({ userId }).toArray();
    const lists = await S.collection("lists").find({ userId }).toArray();
    const likes = await S.collection("likes").find({ userId }).toArray();
    const comments = await S.collection("comments").find({ userId }).toArray();
    await replaceCollection(D, "entries", entries);
    await replaceCollection(D, "episode_entries", episodeEntries);
    await replaceCollection(D, "lists", lists);
    await replaceCollection(D, "likes", likes);
    await replaceCollection(D, "comments", comments);

    // 3) Works référencés par ses entries + episode_entries
    const workIds = [...new Set([...entries, ...episodeEntries].map((e) => e.workId).filter(Boolean))];
    const works = workIds.length ? await S.collection("works").find({ _id: { $in: workIds } }).toArray() : [];
    await replaceCollection(D, "works", works);

    // 4) episode_cache pour les (source, externalId) des works clonés
    const keys = works.map((w) => ({ source: w.source, externalId: w.externalId }));
    const cache = keys.length ? await S.collection("episode_cache").find({ $or: keys }).toArray() : [];
    await replaceCollection(D, "episode_cache", cache);

    console.log("Clonage terminé.");
  } finally {
    await src.close();
    await dst.close();
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
```

- [ ] **Step 2 : Ajouter le script npm**

Dans `package.json`, bloc `scripts`, ajouter après `"local-mongo"` :

```json
    "clone:margot": "node scripts/clone-margot.mjs"
```
(virgule de séparation correcte.)

- [ ] **Step 3 : Exécuter le clonage** (avec `npm run local-mongo` actif dans un autre terminal)

Run: `npm run clone:margot`
Expected: `Margot trouvée: _id=…` puis le compte de documents par collection (`users: 1`, `entries: N`, `episode_entries: N`, `works: N`, …) et `Clonage terminé.`

- [ ] **Step 4 : Vérifier l'idempotence**

Run: `npm run clone:margot` (une 2e fois)
Expected: mêmes comptes, aucun doublon (les collections sont purgées avant réinsertion).

- [ ] **Step 5 : Vérification bout-en-bout**

Run: `npm run dev` (local-mongo toujours actif) puis se connecter en tant que Margot.
Expected : sa bibliothèque et ses épisodes clonés s'affichent. La prod Atlas est intacte (le script n'a fait que des lectures).

- [ ] **Step 6 : Commit**

```bash
git add scripts/clone-margot.mjs package.json
git commit -m "chore(vulu): script de clonage lecture-seule des données de Margot (prod→local)"
```

---

## Self-Review

**Couverture spec :**
- Partie A (section Import) → Task 1. ✔
- Partie B.1 (bac à sable memory-server) → Task 2. ✔
- Partie B.2 (bascule .env.development.local) → Task 2 steps 2. ✔
- Partie B.3 (clone lecture-seule filtré par Margot + works + episode_cache) → Task 3. ✔
- Partie B.4 (scripts npm) → Task 2 step 4 + Task 3 step 2. ✔
- Idempotence du clone → Task 3 step 4. ✔
- Vérifications (lecture seule, dev bout-en-bout) → Task 3 steps 5. ✔

**Placeholders :** aucun TODO/TBD ; tout le code est complet.

**Cohérence des types/noms :** `importFile`/`analyzeImport` cohérents entre steps ; `SectionId` inclut `"import"` avant usage dans `SECTIONS` et `Panel()` ; noms de collections (`entries`, `episode_entries`, `lists`, `likes`, `comments`, `works`, `episode_cache`) conformes à ceux vérifiés dans l'adapter Mongo ; pin binaire memory-server identique à `tests/helpers/mongo.ts`.
