# Import de données externes — Étape 1 : entrée UI + bac à sable local

**Date :** 2026-07-13
**Statut :** Design validé
**Portée :** Première étape uniquement. Le moteur d'import (parsing CSV, mapping
TheTVDB→TMDB, déduplication) fera l'objet d'un second brainstorm.

## Contexte

Vulu veut permettre aux utilisateurs de migrer leurs données depuis d'autres
apps. Première source ciblée : **TV Time** (uniquement pour l'instant).
L'utilisatrice Margot a partagé son export GDPR TV Time et a déjà commencé à
ressaisir ses données à la main dans Vulu — le futur moteur d'import devra donc
gérer la déduplication, mais ce n'est pas l'objet de cette étape.

Cette étape livre deux choses :
1. Le **point d'entrée UI** dans les paramètres (coquille TV Time, action finale
   débranchée).
2. Un **bac à sable Mongo local** contenant un clone des données de Margot, pour
   développer le moteur d'import sans jamais toucher à la base de prod (Atlas).

### État des lieux technique constaté

- Paramètres : `src/app/parametres/SettingsClient.tsx` — navigation par sections
  (`SectionId` + tableau `SECTIONS` + fonction `Panel()`). L'icône `download`
  existe déjà dans `Icon.tsx`.
- Modèle cible : `Work` (catalogue TMDB partagé), `LibraryEntry`, `EpisodeEntry`
  dans `src/server/domain/entities.ts`.
- Collections Mongo : `users`, `entries`, `episode_entries`, `works`,
  `episode_cache`, `lists`, `likes`, `comments`, `follows`, `follow_requests`,
  `communities`, `memberships`, `community_requests`.
- Config Mongo : `src/server/adapters/mongo/client.ts` lit `MONGODB_URI` +
  `MONGODB_DB` via `getEnv()`. `.env.local` pointe sur l'Atlas prod.
- **Aucun MongoDB local installé** (ni `mongod`, ni `mongosh`/`mongodump`, ni
  Docker). Le driver npm `mongodb` (^7.3) est présent.
- `.gitignore` ignore déjà `.env*`.
- `scripts/` contient déjà des scripts `.mjs`/`.ts` (patron à suivre).
- Next 16.2.9.

### Format de l'export TV Time (GDPR, dossier de CSV)

Dossier `gdpr-data-tvtime-margot/`. Fichiers pertinents pour Vulu (les autres
sont ignorés — pub, tokens, appareils, etc.) :

| Fichier | Lignes | Contenu utile |
|---|---|---|
| `followed_tv_show.csv` | 219 | Séries suivies : `tv_show_id` (**TheTVDB**), `tv_show_name`, `active`, `archived`, `created_at` |
| `seen_episode_source.csv` | 704 | Épisodes vus : `tv_show_name`, `episode_season_number`, `episode_number`, `episode_id`, `created_at` |
| `show_seen_episode_latest.csv` | 184 | Dernier épisode vu par série (avec `tv_show_id`) |
| `user_tv_show_data.csv` | 267 | `is_followed`, `is_favorited`, `nb_episodes_seen` par série |
| `user_show_special_status.csv` | 19 | Favoris (`status=favorite`) |
| `ratings-*.csv` | ~49 | Notes séries/films/épisodes |
| `comments-prod-comments.csv` | 2258 | Commentaires & likes |
| `lists-prod-lists.csv` | 4 | Listes (favoris séries/films, sérialisation Go) |

**Point dur identifié (pour l'étape moteur, pas celle-ci)** : `tv_show_id` est un
identifiant **TheTVDB**, alors que Vulu utilise **TMDB**. Le pont propre sera
l'endpoint TMDB `find` (`external_source=tvdb_id`).

## Partie A — Section « Import » dans les paramètres

### Comportement

Ajout d'une section `import` dans `SettingsClient.tsx`, sur le même patron que les
sections existantes :

- **Entrée de menu** : label « Importer mes données », icône `download`,
  desc « Migrer depuis TV Time ». Ajoutée au type `SectionId` et au tableau
  `SECTIONS`.
- **Panneau** (`cur === "import"`) :
  - Titre « Importer mes données » + phrase d'intro.
  - **Carte TV Time (active)** : nom/logo TV Time, libellé
    « Séries & épisodes vus, notes, favoris », un `input[type=file]`
    `accept=".zip"` (l'utilisateur zippe son dossier d'export GDPR), et un bouton
    **« Analyser mon export »**.
  - **Autres sources** (Letterboxd, IMDb…) : cartes grisées « Bientôt ».

### Limite explicite de l'étape 1

Le **moteur d'import est différé**. À cette étape :
- Le bouton « Analyser mon export » valide seulement qu'un fichier `.zip` est
  sélectionné puis affiche un toast « Analyse en préparation ».
- **Aucun** endpoint backend, **aucun** parsing, **aucune** écriture en base.

C'est le vrai point d'entrée visuel (pas du jetable) ; seule l'action finale est
débranchée. L'implémentation visuelle suivra le skill `frontend-design`.

### Hors périmètre (étape moteur, plus tard)

Parsing CSV, mapping TheTVDB→TMDB, création des `Work`/`LibraryEntry`/
`EpisodeEntry`, déduplication contre les saisies manuelles existantes,
barre de progression, rapport d'import.

## Partie B — MongoDB local + clonage des données de Margot

### B.1 — Bac à sable local (`mongodb-memory-server`)

- Ajout de la dépendance de dev `mongodb-memory-server`.
- `scripts/local-mongo.mjs` — lanceur longue durée :
  - Démarre un `mongod` (binaire téléchargé automatiquement au premier run) sur
    le **port fixe 27017**.
  - `dbPath` **persistant** : `./.local-mongo` (les données survivent aux
    redémarrages).
  - Reste actif jusqu'à Ctrl+C (arrêt propre du serveur).
- `.gitignore` : ajouter `.local-mongo/`.

### B.2 — Basculement dev/prod par précédence d'environnement Next

- Créer `.env.development.local` :
  ```
  MONGODB_URI=mongodb://localhost:27017
  MONGODB_DB=vulu
  ```
- Précédence Next (du plus fort au plus faible) :
  `.env.$(NODE_ENV).local` > `.env.local` > `.env.$(NODE_ENV)` > `.env`.
- Conséquence :
  - `npm run dev` (`NODE_ENV=development`) → **Mongo local** automatiquement.
  - Build/prod Vercel (`NODE_ENV=production`) → `.env.development.local` ignoré →
    **Atlas prod** inchangé.
- Fichier gitignoré via la règle `.env*` existante. **Aucun risque pour la prod.**

### B.3 — Script de clonage (`scripts/clone-margot.mjs`)

**Lecture seule stricte sur la source (Atlas).**

- **Source** : URI Atlas lue depuis `.env.local` (jamais d'écriture sur la
  source ; uniquement des `find`).
- **Destination** : `mongodb://localhost:27017`, base `vulu` (le lanceur
  `local-mongo` doit tourner).
- **Étapes** :
  1. Localiser Margot dans `users` par `email = delettremargot03@gmail.com` →
     récupérer son `_id`.
  2. Copier son doc `users`.
  3. Copier `entries`, `episode_entries`, `lists`, `likes`, `comments` filtrés
     par `userId = margot._id`.
  4. Constituer l'ensemble des `workId` référencés (entries + episode_entries) et
     copier les `works` correspondants par `_id`.
  5. Copier les `episode_cache` correspondant aux `(source, externalId)` des
     works TV clonés (pour l'affichage des épisodes).
  6. **Ignorer** `follows`, `follow_requests`, `communities`, `memberships`,
     `community_requests` (inutiles pour l'import).
- **Idempotent** : purge des collections de destination concernées avant copie,
  donc réexécutable sans accumuler de doublons.
- **Sécurité** : aucun secret en dur ; l'URI Atlas provient de `.env.local`
  (gitignoré). Le client source n'effectue que des lectures.

### B.4 — Scripts npm

```
"local-mongo": "node scripts/local-mongo.mjs",
"clone:margot": "node scripts/clone-margot.mjs"
```

### Workflow développeur

1. `npm i` (installe `mongodb-memory-server`).
2. Terminal 1 : `npm run local-mongo` (démarre le Mongo local persistant).
3. Terminal 2 : `npm run clone:margot` (copie prod → local).
4. `npm run dev` → l'app tourne sur le Mongo local avec les données de Margot.

## Vérification (manuelle)

- Le script de clonage n'appelle que `find` sur la source → lecture seule
  garantie ; la prod reste intacte.
- Après clonage : `npm run dev`, se connecter en tant que Margot, vérifier que sa
  bibliothèque et ses épisodes clonés s'affichent correctement.
- Vérifier qu'un `npm run build` (NODE_ENV=production) n'utilise pas
  `.env.development.local` (reste sur l'Atlas).
- Section « Import » : la carte TV Time s'affiche, la sélection d'un `.zip`
  active le bouton, le clic affiche le toast « Analyse en préparation ».

## Ce qui suivra (2e brainstorm)

Moteur d'import TV Time : upload/parse du ZIP, mapping TheTVDB→TMDB via l'API
TMDB `find`, création idempotente des `Work`/`LibraryEntry`/`EpisodeEntry`,
déduplication contre les saisies manuelles de Margot, rapport d'import.
