# Import TV Time — Endpoint + modal de prévisualisation — Design

**Date :** 2026-07-13
**Statut :** Design validé
**Portée :** Exposer le moteur d'import via HTTP + câbler l'UI. Détection en
prévisualisation, validation utilisateur, puis import en job asynchrone avec
progression.

## Contexte

Le moteur (`parseTvTimeExport`, `importTvTime`, mapping catalogue) est livré et
validé sur le bac à sable (voir `2026-07-13-moteur-import-tvtime-design.md`). La
section « Import » des paramètres est une coquille : le bouton « Analyser mon
export » n'est pas encore branché. Ce design branche le tout.

Décision produit clé (utilisateur) : **exécution en job asynchrone avec barre de
progression**. L'import réel fait ~700–1400 appels TMDB (plusieurs minutes),
au-delà d'un timeout de fonction serverless.

### État des lieux technique

- Uploads existants : body **brut** (`fetch(url, { method:"POST", body: file })`),
  serveur lit `req.arrayBuffer()` (cf. `src/app/api/me/avatar/route.ts`,
  `src/server/http/read-image-body.ts`). L'`api-client` JSON n'est pas utilisé
  pour les fichiers.
- Auth : `requireUser()` (`src/server/http/session.ts`) donne l'utilisateur
  courant. L'import cible **l'utilisateur courant**, plus Margot en dur.
- `Deps` (container) agrège les repos ; wiring in-memory (tests) et Mongo (prod).
- Modal : composant `Modal` réutilisable (déjà utilisé dans `SettingsClient`).
- `fflate` **absent** → à ajouter (dézip en mémoire, pur JS).
- Bascule dev/prod déjà en place : `npm run dev` → Mongo local (bac à sable) ;
  prod → Atlas.

## Architecture

### 1. Endpoints (auth `requireUser`, `userId` = utilisateur courant)

- **`POST /api/import/tvtime/preview`** — body = `.zip`.
  Serveur : garde de taille → dézip (`fflate`) → `parseTvTimeExport` → renvoie la
  détection (rapide, **sans TMDB**) :
  ```ts
  interface ImportPreview {
    seriesTotal: number;
    seriesToWatch: number;   // séries sans épisode vu
    episodesTotal: number;
    moviesTotal: number;
    seriesNames: string[];
    movieNames: string[];
  }
  ```

- **`POST /api/import/tvtime`** (commit) — body = `.zip`.
  Serveur : dézip + parse → crée un `ImportJob` (`pending`) → lance le traitement
  en tâche de fond (**non attendu**) → renvoie `{ jobId }` immédiatement.

- **`GET /api/import/tvtime/status?jobId=`** — renvoie l'état du job pour le
  polling : `{ status, phase, done, total, report?, error? }`. Vérifie que le job
  appartient à l'utilisateur courant.

### 2. Job store (nouvel agrégat, Ports & Adapters)

- Entité (domaine) :
  ```ts
  type ImportJobStatus = "pending" | "running" | "done" | "error";
  interface ImportJob {
    id: string;
    userId: string;
    status: ImportJobStatus;
    phase: "series" | "movies";
    done: number;
    total: number;
    report: ImportReport | null;
    error: string | null;
    createdAt: Date;
    updatedAt: Date;
  }
  ```
- Port `ImportJobRepository` : `create(job)`, `findById(id)`, `update(job)`.
- Adaptateurs : **Mongo** (collection `import_jobs`, mappers dédiés) + **in-memory**
  (tests). Ajout à `Deps` et aux deux wirings (`makeInMemoryDeps`, `getDeps`).
- Pas d'index unique nécessaire ; requêtes par `_id` uniquement.

### 3. Progression dans le service d'import

- Signature étendue, rétro-compatible :
  ```ts
  type ImportProgress = (p: { phase: "series" | "movies"; done: number; total: number }) => void | Promise<void>;
  function importTvTime(deps: Deps, userId: string, data: TvTimeExport, onProgress?: ImportProgress): Promise<ImportReport>;
  ```
- `onProgress` appelé au fil des séries puis des films. **Throttlé** côté appelant
  (traitement de fond) : mise à jour du job toutes N unités (ex. tous les 5) pour
  ne pas marteler Mongo.
- Les tests existants (sans `onProgress`) restent valides.

### 4. Traitement de fond

- Fonction `runImportJob(deps, jobId, userId, data)` :
  1. `status = "running"`.
  2. `importTvTime(..., onProgress)` où `onProgress` met à jour `phase/done/total`
     (throttlé).
  3. Succès → `status = "done"`, `report = <ImportReport>`.
  4. Erreur → `status = "error"`, `error = message` (logué avec contexte).
- Déclenchée en **fire-and-forget** depuis l'endpoint commit (promesse non
  attendue, erreurs catchées vers le job).

### 5. UI — flux modal (skill `frontend-design`)

Composant `TvTimeImportModal` piloté depuis la section « Import » de
`SettingsClient` :
1. Sélection du `.zip` → `POST preview` → ouverture de la modal.
2. La modal **liste ce qui a été détecté** : compteurs (X séries dont Y à voir,
   Z épisodes, W films) + listes défilables des titres. Boutons **« Importer »**
   / **« Annuler »**.
3. « Importer » → `POST commit` → `jobId` → **poll** `status` toutes ~1,5 s →
   **barre de progression** (`done/total`, phase séries/films).
4. Statut `done` → affiche le **rapport** : séries importées, épisodes ajoutés,
   ignorés (déjà présents), films importés, et la **liste des non-mappés** à
   vérifier. Statut `error` → message d'erreur.

## Sécurité

- Upload : plafond de taille au niveau HTTP (garde anti-DoS mémoire, sur le
  modèle de `read-image-body.ts`) avant bufferisation.
- Dézip **en mémoire** avec `fflate` ; on ne lit que les 3 CSV attendus **par
  nom** (`followed_tv_show.csv`, `tracking-prod-records-v2.csv`,
  `tracking-prod-records.csv`) → pas d'écriture disque, pas de zip-slip.
- CSV manquant dans le zip → erreur de validation claire (400), pas de 500.
- `status` et le traitement vérifient l'appartenance du job à l'utilisateur
  courant (autorisation à chaque action).

## Limite prod connue (documentée)

En local (`npm run dev`, process Node persistant) le fire-and-forget tourne
jusqu'au bout — adapté au développement/validation sur le bac à sable. En **prod
serverless**, une tâche de fond de plusieurs minutes n'est pas garantie de
survivre après la réponse HTTP. Le modèle *job* (statut en base + polling) permet
de brancher plus tard un **worker/cron durable** qui consomme les jobs `pending`
**sans changer l'UI ni le contrat d'API**. Ce durcissement prod est hors périmètre
de ce plan.

## Tests

- **Dézip + preview** : petit `.zip` de test (3 CSV) → `ImportPreview` avec les
  bons compteurs ; zip sans CSV attendu → erreur de validation.
- **Job repo in-memory** : create/findById/update.
- **Service avec `onProgress`** : le callback est appelé avec des `done`
  croissants et le bon `total` ; le résultat reste identique à sans callback.
- **Traitement de fond** (`runImportJob`) avec repos in-memory + `FakeCatalog` :
  job passe `pending → running → done`, `report` renseigné ; cas d'erreur →
  `status = "error"`.
- **Endpoints** (si testables via les handlers) : preview renvoie les compteurs ;
  commit crée un job et renvoie un id ; status reflète l'avancement et refuse un
  job d'un autre utilisateur.
- **Validation manuelle** : `npm run dev` (bac à sable), sélectionner l'export de
  Margot, modal → détection → import → progression → rapport ; re-run idempotent
  (0 ajout).

## Hors périmètre

- Worker/cron durable pour la prod (durcissement ultérieur ; le modèle job le
  permet sans casser l'API/UI).
- Import des notes et commentaires (données absentes/non fiables — déjà écarté).
- Autres sources (Letterboxd, IMDb, Trakt) — cartes « Bientôt ».
