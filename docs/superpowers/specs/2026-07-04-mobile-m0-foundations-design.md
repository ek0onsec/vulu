# App native vulu (Expo/React Native) — M0 : Fondations (scaffold + auth + shell)

**Statut :** design validé (2026-07-04).

**Contexte :** porter l'app vulu (web/Next.js) en application native Android via Expo/React Native, tout en conservant le web/PWA. Stratégie : **réutiliser le backend vulu existant** (API Next.js + MongoDB, architecture hexagonale) et construire un **nouveau client Expo** qui le consomme. Ce document couvre **M0 — les fondations** : le premier jalon livrable qui prouve l'architecture de bout en bout (connexion + session + shell à onglets sur Android).

## Décisions validées

1. **Backend** : réutiliser l'API vulu. Évolution **additive** : accepter un token **Bearer** (en plus du cookie web) et le renvoyer au login. Le web reste inchangé.
2. **Styling** : **NativeWind** (Tailwind en React Native) pour réutiliser les tokens de couleur/typo et l'idiome Tailwind du web.
3. **Navigation** : **Expo Router** (routing par fichiers, calqué sur l'App Router web).
4. **Dépôt** : nouveau **dépôt git séparé** dans `/home/chamberlain/Desktop/Claude/vulu-mobile`.
5. **Périmètre M0** : **connexion (login) seule** + session persistante + shell à onglets vide. L'inscription + onboarding des goûts sera le jalon suivant.
6. **API dev** : pointe vers le **serveur local** `http://192.168.1.74:3000` (configurable via `EXPO_PUBLIC_API_URL`). Le `next dev` écoute déjà sur `*:3000` (joignable en LAN).
7. **Cible/exécution** : **Android via Expo Go** en M0 (aucun module natif custom ; le scan caméra viendra en M3 avec un dev build).

## Contraintes globales

- Aucune mention IA / Claude / superpowers dans le code, l'app ou les commits ; aucun co-auteur Claude.
- Ne jamais toucher au dossier `lechatonfat/`.
- Architecture découplée : la dépendance réseau (API) est isolée derrière un client API ; les écrans ne connaissent pas les URLs en dur.
- Aucun secret en dur ; typage strict, pas de `any`.
- Backend : vérifier `npx tsc --noEmit` + `npx vitest run` verts (dépôt vulu). Mobile : `npx tsc --noEmit` vert (dépôt vulu-mobile).

---

## Partie A — Évolution backend (dépôt vulu, additive)

**But :** permettre l'authentification native par token Bearer, sans casser le web (cookie).

### A1 — Auth Bearer dans la session
`src/server/http/session.ts` : `currentUser()` récupère le token depuis le **cookie** `COOKIE`, sinon depuis l'en-tête **`Authorization: Bearer <token>`** de la requête. `requireUser()` inchangé (s'appuie sur `currentUser`). La vérification passe toujours par `getCurrentUser(deps, token)` (JWT `deps.tokens.verify`).
- Détail : `currentUser()` ne reçoit pas la `Request` aujourd'hui (il lit `cookies()` via `next/headers`). Pour lire l'en-tête, utiliser `headers()` de `next/headers` (request-scoped, disponible dans les route handlers) : `const authz = (await headers()).get("authorization")`. Token = cookie ?? (authz?.startsWith("Bearer ") ? authz.slice(7) : undefined).

### A2 — Renvoi du token au login/register/2fa
Routes `src/app/api/auth/login/route.ts`, `register/route.ts`, `login/2fa/route.ts` : ajouter `token` au JSON renvoyé (en plus de `setSessionCookie(token)`). Le web ignore ce champ (continue via cookie) ; l'app native le stocke. Pour le login 2FA, renvoyer aussi le token final après validation du challenge.

### A3 — Test
`tests/http/bearer-auth.test.ts` (ou intégration existante) : une requête avec `Authorization: Bearer <token valide>` résout l'utilisateur courant ; un token invalide → non authentifié. S'appuyer sur `deps.tokens.issue({ userId })` pour forger un token de test.

**Fichiers backend :** `src/server/http/session.ts`, `src/app/api/auth/login/route.ts`, `src/app/api/auth/register/route.ts`, `src/app/api/auth/login/2fa/route.ts`, test.

---

## Partie B — App native (dépôt vulu-mobile)

### B1 — Scaffold & configuration
- Projet Expo TypeScript (`create-expo-app`), **Expo Router**, **NativeWind** (+ `tailwind.config.js`, `babel.config.js`, `metro.config.js`, `global.css`, `nativewind-env.d.ts`).
- `.env` / `app.json` : `EXPO_PUBLIC_API_URL=http://192.168.1.74:3000`.
- `git init` dans `vulu-mobile/` (dépôt indépendant) + `.gitignore` Expo.

### B2 — Thème (tokens portés)
`theme/colors.ts` : les valeurs des variables CSS du web (primary `#9461C0`, accent, bg, surface, text, border…) en clair et sombre. `tailwind.config.js` mappe ces couleurs sur des classes NativeWind (`bg-primary`, `text-muted`, etc.). Un `ThemeProvider` lit le schéma système (`useColorScheme`) et applique le jeu clair/sombre.

### B3 — Client API
`lib/api.ts` : `get/post/put/patch/del` vers `EXPO_PUBLIC_API_URL + path`, en-têtes `content-type: application/json` + `Authorization: Bearer <token>` si présent, parse JSON, lève `ApiError(status, code, message)` sur échec (miroir du client web). La lecture du token passe par une fonction injectée (pas de couplage direct au stockage) — voir B4.
- **Pur & testable** : extraire `buildHeaders(token: string | null, extra?): Record<string,string>` (fonction pure) pour tester l'ajout de l'en-tête Bearer.

### B4 — Auth & session
`lib/token-store.ts` : `getToken/setToken/clearToken` via **`expo-secure-store`**.
`context/AuthContext.tsx` : état `{ user: SelfUser | null; loading: boolean }`. Au montage : lit le token → `GET /api/me` → `user` ou `null` (token invalide → clear). Actions : `signIn(email, password)` → `POST /api/auth/login` → si `twoFactorRequired`, remonter une erreur « 2FA bientôt disponible sur mobile » (géré plus tard) ; sinon stocker `token` + poser `user`. `signOut()` → `POST /api/auth/logout` (best-effort) + `clearToken()` + `user = null`.
`types/user.ts` : type `SelfUser` mirroir de `selfUser()` (champs non sensibles) — écrit à la main pour M0 (id, username, displayName, avatarUrl, plus, staff, private, activeTabs, tourCompletedAt…).

### B5 — Navigation & garde d'auth
Structure Expo Router :
```
app/_layout.tsx        → ThemeProvider + AuthProvider + Slot ; redirige selon l'état
app/(auth)/login.tsx   → écran Connexion
app/(tabs)/_layout.tsx → Tabs (barre d'onglets stylée)
app/(tabs)/feed.tsx        (placeholder)
app/(tabs)/search.tsx      (placeholder)
app/(tabs)/library.tsx     (placeholder)
app/(tabs)/communities.tsx (placeholder)
app/(tabs)/profile.tsx     (placeholder)
```
Garde : dans `_layout.tsx`, tant que `loading` → splash ; si `user === null` → rediriger vers `(auth)/login` ; sinon → `(tabs)`. Utiliser `expo-router` `Redirect`/`router.replace`.

### B6 — Écran Connexion
Champs email + mot de passe, bouton « Se connecter », affichage d'erreur (`ApiError.message`), logo/marque vulu (texte stylé en attendant l'asset). Appelle `signIn`. Écrans onglets = placeholders titrés (« Feed », etc.) pour valider la navigation.

**Livrable M0 :** `npx expo start` → ouvrir sur Android (Expo Go, même réseau que le serveur) → se connecter avec un compte existant → arriver sur le shell à onglets ; relancer l'app → **auto-login** (token persistant) ; se déconnecter → retour à l'écran Connexion.

**Fichiers mobile (indicatif) :** `app/_layout.tsx`, `app/(auth)/login.tsx`, `app/(tabs)/_layout.tsx`, `app/(tabs)/*.tsx`, `lib/api.ts`, `lib/token-store.ts`, `context/AuthContext.tsx`, `theme/colors.ts`, `theme/ThemeProvider.tsx`, `types/user.ts`, `tailwind.config.js`, `babel.config.js`, `metro.config.js`, `global.css`, `app.json`, `.gitignore`, tests.

---

## Testing

- **Backend (vulu, vitest)** : Bearer authentifie (A3).
- **Mobile (jest-expo)** : setup minimal + test unitaire de `buildHeaders` (token → `Authorization: Bearer`). Les écrans sont validés manuellement sur Android.

## Hors périmètre M0 (jalons suivants)

- Inscription + onboarding des goûts (M0.5/M1) — nécessite le sélecteur de genres + `/api/catalog/genres`.
- Écrans Feed/Recherche/Bibliothèque/Communautés/Profil réels (M1→M5).
- Scan de code-barres natif (M3, dev build + `expo-camera`).
- 2FA sur mobile, notifications push, app tour natif (jalons ultérieurs).

## Risques & notes

- **Joignabilité LAN** : le téléphone doit être sur le même réseau Wi-Fi que la machine ; `next dev` écoute sur `*:3000` (OK). Si pare-feu, autoriser le port 3000.
- **CORS** : non applicable — `fetch` natif n'est pas soumis à la politique CORS du navigateur.
- **Node 24** : très récent pour Expo ; si l'outillage râle, utiliser la version LTS recommandée par Expo (à traiter au scaffold, non bloquant pour le design).
- **Parité visuelle** : NativeWind ne couvre pas 100 % des classes web (ex. `backdrop-blur`, pseudo-états) ; les écrans réels adapteront au cas par cas (hors M0, shell simple).

## Self-Review (couverture demande)

| Demande utilisateur | Partie |
|---|---|
| Refaire l'app en React Native via Expo | B (scaffold Expo/RN) |
| Dans un autre dossier / dépôt séparé | B1 (`vulu-mobile`, git init) |
| Garder le web/PWA intact | A (changement backend additif) |
| Native Android pour commencer | B5/B6 (Android via Expo Go) |
| Commencer le portage (première tranche) | M0 = fondations + login |

Périmètre M0 cohérent et livrable indépendamment. Les jalons suivants réutilisent ces fondations.
