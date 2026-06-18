# vulu — vu &amp; lu

Réseau social des films, séries et livres. Next.js 16 · React 19 · Tailwind v4 · MongoDB · architecture hexagonale.

## Prérequis
- Node 20+ et npm
- Une base MongoDB (Atlas, Docker, ou le Mongo en mémoire de dev ci-dessous)
- Clés API : **TMDB** (films/séries) et **Google Books** (livres)

## Configuration
Copie `.env.example` vers `.env.local` et renseigne :

```
MONGODB_URI=mongodb://localhost:27017
MONGODB_DB=vulu
JWT_SECRET=une-chaine-de-32-caracteres-minimum
TMDB_API_KEY=ta_cle_tmdb            # clé v3 (api_key) ou jeton v4 (Bearer) — les deux marchent
TMDB_BASE_URL=https://api.themoviedb.org/3
TMDB_IMAGE_BASE=https://image.tmdb.org/t/p
GOOGLE_BOOKS_API_KEY=ta_cle_google_books   # recommandé (sinon 429 en anonyme)
# GOOGLE_BOOKS_BASE_URL a une valeur par défaut, inutile de la définir
# UPLOADS_DIR=./uploads             # dossier des avatars/bannières (défaut: ./uploads)
```

## Lancer en développement

### Option A — avec ton MongoDB
```bash
npm install
# .env.local pointe vers ton MONGODB_URI
npm run dev          # http://localhost:3000 (les index Mongo sont créés au démarrage)
```

### Option B — Mongo en mémoire (aucune install Mongo requise)
Pratique pour tester rapidement. Deux terminaux :

```bash
# 1) démarre un MongoDB en mémoire ; écrit l'URI dans /tmp/vulu-smoke-uri et reste ouvert
node scripts/smoke-mongo.mjs

# 2) injecte un compte démo + du contenu, puis lance l'app sur cette base
MONGODB_URI="$(cat /tmp/vulu-smoke-uri)" node scripts/seed-demo.mjs
MONGODB_URI="$(cat /tmp/vulu-smoke-uri)" MONGODB_DB=vulu \
  JWT_SECRET=dev-only-secret-dev-only-secret-32 \
  TMDB_API_KEY=$TMDB_API_KEY TMDB_BASE_URL=https://api.themoviedb.org/3 TMDB_IMAGE_BASE=https://image.tmdb.org/t/p \
  GOOGLE_BOOKS_API_KEY=$GOOGLE_BOOKS_API_KEY \
  npm run dev
```
> Ou plus simple : mets l'`MONGODB_URI` du Mongo mémoire dans `.env.local`, lance le seed, puis `npm run dev`.
> Données en mémoire : tout disparaît quand `smoke-mongo.mjs` s'arrête.

**Compte démo** (après le seed) : `demo@vulu.app` / `password1`.

## Scripts
- `npm run dev` — serveur de développement (port 3000)
- `npm run build` / `npm start` — build et serveur de production
- `npm test` — suite de tests (Vitest)
- `node_modules/.bin/tsc --noEmit` — vérification de types

## Tests
Les tests d'intégration utilisent `mongodb-memory-server` (téléchargé au 1er run). Sur certaines distributions (ex. Parrot/Debian) le binaire est épinglé dans `tests/helpers/mongo.ts`.

## Documentation
- Roadmap & demandes : `docs/superpowers/ROADMAP.md`
- Specs : `docs/superpowers/specs/`
