# App native vulu (Expo) — M0 Fondations — Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Poser les fondations de l'app native vulu (Expo/React Native) : backend Bearer additif (web intact), projet Expo Router + NativeWind, client API, auth SecureStore + auto-login, shell à onglets et écran Connexion — tournant sur Android contre le serveur local.

**Architecture :** Deux dépôts. (A) Backend vulu (`/home/chamberlain/Desktop/Claude/vulu`) — évolution additive de l'auth. (B) App native vulu-mobile (`/home/chamberlain/Desktop/Claude/vulu-mobile`, git séparé) — Expo Router + NativeWind, consomme l'API vulu.

**Tech Stack :** Backend : Next.js 16, vitest. Mobile : Expo (SDK récent), Expo Router, NativeWind v4, TypeScript, expo-secure-store, jest-expo.

## Global Constraints

- Aucune mention IA / Claude / superpowers dans le code, l'app ou les commits ; aucun co-auteur Claude.
- Ne jamais toucher au dossier `lechatonfat/`.
- La dépendance réseau est isolée derrière un client API ; aucune URL en dur dans les écrans.
- Aucun secret en dur ; typage strict, pas de `any`.
- Backend : `npx tsc --noEmit` + `npx vitest run` verts (dépôt vulu). Mobile : `npx tsc --noEmit` vert (dépôt vulu-mobile).
- API dev : `http://192.168.1.74:3000` (via `EXPO_PUBLIC_API_URL`).
- Commits backend : sur `master` du dépôt vulu. Commits mobile : sur le dépôt vulu-mobile (branche `main` par défaut d'un `git init`).

---

## Partie A — Backend vulu (auth Bearer additive)

### Task A1 : Authentification Bearer + renvoi du token

**Files:**
- Modify: `src/server/http/session.ts`, `src/app/api/auth/login/route.ts`, `src/app/api/auth/register/route.ts`, `src/app/api/auth/login/2fa/route.ts`
- Test: `tests/http/bearer-auth.test.ts`

**Interfaces:**
- Modifie: `currentUser()` lit le token depuis le cookie OU l'en-tête `Authorization: Bearer`.
- Produces: les réponses login/register/2fa incluent `token: string`.

- [ ] **Step 1 : Lire le token cookie OU Bearer dans la session**

Dans `src/server/http/session.ts`, importer `headers` et modifier `currentUser` :

```ts
import { cookies, headers } from "next/headers";
```

Remplacer la fonction `currentUser` par :

```ts
export async function currentUser(): Promise<User | null> {
  const cookieToken = (await cookies()).get(COOKIE)?.value;
  let token = cookieToken;
  if (!token) {
    const authz = (await headers()).get("authorization");
    if (authz?.startsWith("Bearer ")) token = authz.slice(7);
  }
  const deps = await getDeps();
  return getCurrentUser(deps, token);
}
```

- [ ] **Step 2 : Renvoyer le token au login**

Dans `src/app/api/auth/login/route.ts`, la réponse succès (hors 2FA) — remplacer :

```ts
    await setSessionCookie(token);
    return json({ user: selfUser(user), reactivated: Boolean(reactivated) });
```

par :

```ts
    await setSessionCookie(token);
    return json({ user: selfUser(user), token, reactivated: Boolean(reactivated) });
```

- [ ] **Step 3 : Renvoyer le token au register**

Dans `src/app/api/auth/register/route.ts`, remplacer :

```ts
    await setSessionCookie(token);
    return json({ user: selfUser(user) }, { status: 201 });
```

par :

```ts
    await setSessionCookie(token);
    return json({ user: selfUser(user), token }, { status: 201 });
```

- [ ] **Step 4 : Renvoyer le token au 2FA**

Dans `src/app/api/auth/login/2fa/route.ts`, remplacer :

```ts
    return json({ user: selfUser(user) });
```

par :

```ts
    return json({ user: selfUser(user), token });
```

- [ ] **Step 5 : Test — Bearer authentifie**

Créer `tests/http/bearer-auth.test.ts`. Ce test vérifie la logique de résolution du token (cookie absent → Bearer). Comme `currentUser()` dépend de `next/headers` (non dispo hors requête), on teste le comportement sous-jacent via `getCurrentUser` avec un token forgé, plus l'extraction Bearer :

```ts
import { describe, it, expect, beforeEach } from "vitest";
import { makeInMemoryDeps, type Deps } from "@/server/container";
import { FakeCatalog } from "../helpers/fake-catalog";
import { registerUser } from "@/server/application/register-user";
import { getCurrentUser } from "@/server/application/get-current-user";

let deps: Deps; let uid: string;
const tastes = { filmGenreIds: [878, 18, 35], people: [] };
beforeEach(async () => {
  deps = makeInMemoryDeps(new FakeCatalog());
  uid = (await registerUser(deps, { email: "b@x.io", username: "bob", displayName: "Bob", password: "password1", activeTabs: ["films"], tastes })).id;
});

/** Extraction du token depuis un header Authorization (miroir de session.currentUser). */
function bearerToken(authz: string | null): string | undefined {
  return authz?.startsWith("Bearer ") ? authz.slice(7) : undefined;
}

describe("auth Bearer", () => {
  it("un token Bearer valide résout l'utilisateur courant", async () => {
    const token = await deps.tokens.issue({ userId: uid });
    const extracted = bearerToken(`Bearer ${token}`);
    const user = await getCurrentUser(deps, extracted);
    expect(user?.id).toBe(uid);
  });
  it("un header absent → pas de token → pas d'utilisateur", async () => {
    expect(bearerToken(null)).toBeUndefined();
    expect(await getCurrentUser(deps, undefined)).toBeNull();
  });
  it("un token invalide → pas d'utilisateur", async () => {
    expect(await getCurrentUser(deps, "pas-un-jwt")).toBeNull();
  });
});
```

Vérifier la signature de `deps.tokens.issue` (`grep -n "issue" src/server/ports/security.ts`) : `issue(payload: { userId: string }): Promise<string>`.

- [ ] **Step 6 : Vérifier**

Run: `npx tsc --noEmit && npx vitest run tests/http/bearer-auth.test.ts`
Expected: propre + PASS. Puis `npx vitest run` complet vert (non-régression).

- [ ] **Step 7 : Commit (dépôt vulu)**

```bash
git add src/server/http/session.ts src/app/api/auth/login/route.ts src/app/api/auth/register/route.ts "src/app/api/auth/login/2fa/route.ts" tests/http/bearer-auth.test.ts
git commit -m "feat(vulu): auth API par token Bearer (mobile) + renvoi du token au login/register/2fa"
```

---

## Partie B — App native vulu-mobile

> Toutes les commandes de la Partie B s'exécutent depuis `/home/chamberlain/Desktop/Claude/vulu-mobile` (sauf la création initiale). Les commits de la Partie B sont dans **ce dépôt** (indépendant).

### Task B1 : Scaffold Expo + Expo Router + NativeWind

**Files:**
- Create: le projet Expo + `tailwind.config.js`, `babel.config.js`, `metro.config.js`, `global.css`, `nativewind-env.d.ts`, `.env`

- [ ] **Step 1 : Créer le projet Expo**

Run (depuis `/home/chamberlain/Desktop/Claude`) :
```bash
npx create-expo-app@latest vulu-mobile
```
Expected: projet Expo Router (dossier `app/`, TypeScript) créé dans `vulu-mobile/`. (Si l'outil propose un template, prendre le défaut « Navigation ».)

- [ ] **Step 2 : Dépôt git indépendant**

Run (depuis `vulu-mobile/`) :
```bash
git init && git add -A && git commit -m "chore(mobile): scaffold Expo Router (base create-expo-app)"
```
Expected: dépôt git créé, premier commit (le `.gitignore` d'Expo est inclus par le template).

- [ ] **Step 3 : Installer NativeWind + dépendances**

Run :
```bash
npx expo install nativewind tailwindcss@^3.4.17 react-native-reanimated react-native-safe-area-context
npx expo install expo-secure-store
```
Expected: installation OK.

- [ ] **Step 4 : Config NativeWind — tailwind.config.js**

Créer/écraser `tailwind.config.js` (couleurs = tokens web via variables CSS) :

```js
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{js,jsx,ts,tsx}", "./components/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        primary: "var(--color-primary)",
        accent: "var(--color-accent)",
        bg: "var(--color-bg)",
        surface: "var(--color-surface)",
        "surface-2": "var(--color-surface-2)",
        border: "var(--color-border)",
        text: "var(--color-text)",
        muted: "var(--color-text-muted)",
      },
    },
  },
  plugins: [],
};
```

- [ ] **Step 5 : global.css (tokens clair + sombre)**

Créer `global.css` (les variables reproduisent `globals.css` du web ; le sombre suit le schéma système) :

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  --color-primary: #9461C0;
  --color-accent: #F8C84E;
  --color-bg: #F6F2FB;
  --color-surface: #FFFFFF;
  --color-surface-2: #FFFFFF;
  --color-border: #E7DDED;
  --color-text: #2A2233;
  --color-text-muted: #6B6276;
}

@media (prefers-color-scheme: dark) {
  :root {
    --color-primary: #B98DE0;
    --color-accent: #F6C24B;
    --color-bg: #16121C;
    --color-surface: #211B2A;
    --color-surface-2: #2C2438;
    --color-border: #352C44;
    --color-text: #ECE6F2;
    --color-text-muted: #9C93AB;
  }
}
```

- [ ] **Step 6 : babel.config.js + metro.config.js + types**

Écrire `babel.config.js` :

```js
module.exports = function (api) {
  api.cache(true);
  return {
    presets: [["babel-preset-expo", { jsxImportSource: "nativewind" }], "nativewind/babel"],
  };
};
```

Écrire `metro.config.js` :

```js
const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");
const config = getDefaultConfig(__dirname);
module.exports = withNativeWind(config, { input: "./global.css" });
```

Créer `nativewind-env.d.ts` :

```ts
/// <reference types="nativewind/types" />
```

- [ ] **Step 7 : Variable d'environnement API**

Créer `.env` :

```
EXPO_PUBLIC_API_URL=http://192.168.1.74:3000
```

Vérifier que `.env` est bien ignoré par git (le `.gitignore` Expo l'inclut généralement ; sinon l'ajouter). Créer aussi `.env.example` (versionné) avec `EXPO_PUBLIC_API_URL=http://CHANGE_ME:3000`.

- [ ] **Step 8 : Importer global.css + smoke test**

Ouvrir `app/_layout.tsx` généré et ajouter en tête `import "../global.css";`. Lancer :
```bash
npx expo start
```
Expected: le bundler démarre sans erreur NativeWind. (Vérif visuelle ultérieure au Task B6.) Arrêter le bundler.

- [ ] **Step 9 : Commit**

```bash
git add -A && git commit -m "chore(mobile): NativeWind + tokens de thème + config API"
```

---

### Task B2 : Client API (buildHeaders testé) + token store

**Files:**
- Create: `lib/api.ts`, `lib/token-store.ts`, `tests/api.test.ts`, `jest.config.js` (ou `package.json` jest), types de test

**Interfaces:**
- Produces: `buildHeaders(token: string | null, extra?: Record<string,string>): Record<string,string>` ; `api.get/post/put/patch/del` ; `ApiError` ; `getToken/setToken/clearToken`.

- [ ] **Step 1 : Store de token (SecureStore)**

Créer `lib/token-store.ts` :

```ts
import * as SecureStore from "expo-secure-store";

const KEY = "vulu_token";

export async function getToken(): Promise<string | null> {
  return SecureStore.getItemAsync(KEY);
}
export async function setToken(token: string): Promise<void> {
  await SecureStore.setItemAsync(KEY, token);
}
export async function clearToken(): Promise<void> {
  await SecureStore.deleteItemAsync(KEY);
}
```

- [ ] **Step 2 : Client API + buildHeaders pur**

Créer `lib/api.ts` :

```ts
import { getToken } from "./token-store";

const BASE = process.env.EXPO_PUBLIC_API_URL ?? "";

export class ApiError extends Error {
  constructor(public status: number, public code: string, message?: string) { super(message ?? code); }
}

/** Construit les en-têtes de requête (JSON + Bearer si token). Pur, testable. */
export function buildHeaders(token: string | null, extra?: Record<string, string>): Record<string, string> {
  const headers: Record<string, string> = { "content-type": "application/json", ...extra };
  if (token) headers["authorization"] = `Bearer ${token}`;
  return headers;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const token = await getToken();
  const res = await fetch(BASE + path, { ...init, headers: buildHeaders(token, init?.headers as Record<string, string>) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const d = data as { error?: string; message?: string };
    throw new ApiError(res.status, d.error ?? "ERROR", d.message);
  }
  return data as T;
}

export const api = {
  get: <T>(p: string) => request<T>(p),
  post: <T>(p: string, body?: unknown) => request<T>(p, { method: "POST", body: body ? JSON.stringify(body) : undefined }),
  put: <T>(p: string, body: unknown) => request<T>(p, { method: "PUT", body: JSON.stringify(body) }),
  patch: <T>(p: string, body: unknown) => request<T>(p, { method: "PATCH", body: JSON.stringify(body) }),
  del: <T>(p: string, body?: unknown) => request<T>(p, { method: "DELETE", body: body ? JSON.stringify(body) : undefined }),
};
```

- [ ] **Step 3 : Setup jest-expo + test buildHeaders**

Run : `npx expo install jest-expo jest` puis `npm pkg set scripts.test="jest"`.
Ajouter à `package.json` la config jest (ou créer `jest.config.js`) :

```js
module.exports = {
  preset: "jest-expo",
};
```

Créer `tests/api.test.ts` :

```ts
import { buildHeaders } from "../lib/api";

describe("buildHeaders", () => {
  it("ajoute content-type JSON par défaut", () => {
    expect(buildHeaders(null)["content-type"]).toBe("application/json");
  });
  it("ajoute Authorization: Bearer si token présent", () => {
    expect(buildHeaders("abc")["authorization"]).toBe("Bearer abc");
  });
  it("n'ajoute pas Authorization si token null", () => {
    expect(buildHeaders(null)["authorization"]).toBeUndefined();
  });
});
```

- [ ] **Step 4 : Lancer le test**

Run: `npm test -- tests/api.test.ts`
Expected: 3 tests PASS. (`buildHeaders` important depuis `lib/api` : l'import de `token-store`/SecureStore n'est pas exécuté car `buildHeaders` est pur ; si jest tente de charger `expo-secure-store`, `jest-expo` le mocke.)

- [ ] **Step 5 : Vérifier types + commit**

Run: `npx tsc --noEmit`
Expected: aucune sortie.

```bash
git add -A && git commit -m "feat(mobile): client API (Bearer) + store de token SecureStore + test buildHeaders"
```

---

### Task B3 : Types + contexte d'authentification

**Files:**
- Create: `types/user.ts`, `context/AuthContext.tsx`

**Interfaces:**
- Consumes: `api` (B2), `getToken/setToken/clearToken` (B2).
- Produces: `useAuth(): { user: SelfUser | null; loading: boolean; signIn(email,password): Promise<void>; signOut(): Promise<void> }`.

- [ ] **Step 1 : Type SelfUser (miroir minimal)**

Créer `types/user.ts` :

```ts
export interface SelfUser {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  plus: boolean;
  staff: boolean;
  private: boolean;
  activeTabs: ("films" | "books")[];
  tourCompletedAt: string | null;
}
```

- [ ] **Step 2 : AuthContext**

Créer `context/AuthContext.tsx` :

```tsx
import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { api, ApiError } from "../lib/api";
import { getToken, setToken, clearToken } from "../lib/token-store";
import type { SelfUser } from "../types/user";

interface AuthState {
  user: SelfUser | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const Ctx = createContext<AuthState>({ user: null, loading: true, signIn: async () => {}, signOut: async () => {} });
export const useAuth = () => useContext(Ctx);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<SelfUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const token = await getToken();
      if (!token) { setLoading(false); return; }
      try {
        const { user } = await api.get<{ user: SelfUser }>("/api/me");
        setUser(user);
      } catch {
        await clearToken();
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    const res = await api.post<{ user?: SelfUser; token?: string; twoFactorRequired?: boolean }>("/api/auth/login", { email, password });
    if (res.twoFactorRequired) throw new ApiError(400, "TWO_FACTOR", "La double authentification n'est pas encore disponible sur mobile.");
    if (!res.token || !res.user) throw new ApiError(500, "NO_TOKEN", "Réponse de connexion invalide.");
    await setToken(res.token);
    setUser(res.user);
  }, []);

  const signOut = useCallback(async () => {
    try { await api.post("/api/auth/logout"); } catch { /* best-effort */ }
    await clearToken();
    setUser(null);
  }, []);

  return <Ctx.Provider value={{ user, loading, signIn, signOut }}>{children}</Ctx.Provider>;
}
```

- [ ] **Step 3 : Vérifier + commit**

Run: `npx tsc --noEmit`
Expected: aucune sortie.

```bash
git add -A && git commit -m "feat(mobile): contexte d'auth (auto-login, signIn/signOut) + type SelfUser"
```

---

### Task B4 : Navigation, garde d'auth & shell à onglets

**Files:**
- Modify/Create: `app/_layout.tsx`, `app/(auth)/login.tsx` (Task B5), `app/(tabs)/_layout.tsx`, `app/(tabs)/feed.tsx`, `app/(tabs)/search.tsx`, `app/(tabs)/library.tsx`, `app/(tabs)/communities.tsx`, `app/(tabs)/profile.tsx`
- Supprimer les écrans d'exemple du template (`app/(tabs)/index.tsx`, `explore.tsx`, `app/+not-found.tsx` si superflu — garder si utile).

- [ ] **Step 1 : Layout racine avec provider + garde**

Écraser `app/_layout.tsx` :

```tsx
import "../global.css";
import { Stack, Redirect, usePathname } from "expo-router";
import { View, ActivityIndicator } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AuthProvider, useAuth } from "../context/AuthContext";

function Gate() {
  const { user, loading } = useAuth();
  const pathname = usePathname();
  if (loading) {
    return <View className="flex-1 items-center justify-center bg-bg"><ActivityIndicator /></View>;
  }
  const inAuth = pathname.startsWith("/login");
  if (!user && !inAuth) return <Redirect href="/login" />;
  if (user && inAuth) return <Redirect href="/feed" />;
  return <Stack screenOptions={{ headerShown: false }} />;
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <Gate />
      </AuthProvider>
    </SafeAreaProvider>
  );
}
```

- [ ] **Step 2 : Nettoyer les écrans d'exemple**

Supprimer les fichiers d'exemple générés par le template s'ils existent :
```bash
rm -f app/\(tabs\)/index.tsx app/\(tabs\)/explore.tsx
```
(Garder `app/+not-found.tsx` si présent.)

- [ ] **Step 3 : Layout des onglets**

Créer `app/(tabs)/_layout.tsx` :

```tsx
import { Tabs } from "expo-router";

export default function TabsLayout() {
  return (
    <Tabs screenOptions={{ headerShown: false, tabBarActiveTintColor: "#9461C0" }}>
      <Tabs.Screen name="feed" options={{ title: "Feed" }} />
      <Tabs.Screen name="search" options={{ title: "Recherche" }} />
      <Tabs.Screen name="library" options={{ title: "Bibliothèque" }} />
      <Tabs.Screen name="communities" options={{ title: "Communautés" }} />
      <Tabs.Screen name="profile" options={{ title: "Profil" }} />
    </Tabs>
  );
}
```

- [ ] **Step 4 : Écrans placeholder**

Créer les 5 écrans. Modèle pour `app/(tabs)/feed.tsx` (répéter en changeant titre/nom pour search/library/communities/profile) :

```tsx
import { View, Text } from "react-native";

export default function FeedScreen() {
  return (
    <View className="flex-1 items-center justify-center bg-bg">
      <Text className="text-2xl font-bold text-text">Feed</Text>
      <Text className="mt-1 text-muted">Bientôt disponible</Text>
    </View>
  );
}
```

`app/(tabs)/search.tsx` (titre « Recherche »), `library.tsx` (« Bibliothèque »), `communities.tsx` (« Communautés »), `profile.tsx` (« Profil ») — même structure, texte adapté.

- [ ] **Step 5 : Vérifier types + commit**

Run: `npx tsc --noEmit`
Expected: aucune sortie.

```bash
git add -A && git commit -m "feat(mobile): navigation Expo Router — garde d'auth + shell à onglets (placeholders)"
```

---

### Task B5 : Écran Connexion + validation end-to-end

**Files:**
- Create: `app/(auth)/login.tsx`

**Interfaces:**
- Consumes: `useAuth().signIn` (B3), NativeWind classes (B1).

- [ ] **Step 1 : Écran Connexion**

Créer `app/(auth)/login.tsx` :

```tsx
import { useState } from "react";
import { View, Text, TextInput, Pressable, ActivityIndicator, KeyboardAvoidingView, Platform } from "react-native";
import { useAuth } from "../../context/AuthContext";
import { ApiError } from "../../lib/api";

export default function LoginScreen() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true); setError(null);
    try {
      await signIn(email.trim(), password);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Connexion impossible");
    } finally {
      setBusy(false);
    }
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} className="flex-1 bg-bg">
      <View className="flex-1 justify-center px-6">
        <Text className="mb-1 text-4xl font-black text-primary">vulu</Text>
        <Text className="mb-8 text-base text-muted">Vu &amp; lu, entre amis.</Text>

        <TextInput
          value={email} onChangeText={setEmail} placeholder="Email"
          autoCapitalize="none" keyboardType="email-address" autoComplete="email"
          className="mb-3 rounded-2xl border border-border bg-surface px-4 py-3 text-text" placeholderTextColor="#9C93AB"
        />
        <TextInput
          value={password} onChangeText={setPassword} placeholder="Mot de passe" secureTextEntry
          className="mb-3 rounded-2xl border border-border bg-surface px-4 py-3 text-text" placeholderTextColor="#9C93AB"
        />

        {error && <Text className="mb-3 text-sm text-red-500">{error}</Text>}

        <Pressable onPress={submit} disabled={busy || !email || !password}
          className="items-center rounded-full bg-primary py-3.5 active:opacity-90 disabled:opacity-50">
          {busy ? <ActivityIndicator color="#fff" /> : <Text className="text-base font-bold text-white">Se connecter</Text>}
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}
```

- [ ] **Step 2 : Vérifier types**

Run: `npx tsc --noEmit`
Expected: aucune sortie.

- [ ] **Step 3 : Validation end-to-end (manuelle, Android)**

Prérequis : le serveur vulu tourne (`npm run dev` dans `vulu/`, écoute `*:3000`) ; le téléphone Android est sur le même Wi-Fi ; Expo Go installé.
Run (dans `vulu-mobile/`) : `npx expo start`
Puis scanner le QR avec Expo Go. Vérifier :
  - L'app ouvre l'écran **Connexion** (pas de token).
  - Se connecter avec un compte existant → arrivée sur le shell à onglets (Feed/Recherche/Bibliothèque/Communautés/Profil).
  - Fermer/rouvrir l'app → **auto-login** (reste connecté).
  - (Optionnel) ajouter temporairement un bouton « Déconnexion » appelant `signOut` sur l'écran Profil pour vérifier le retour à Connexion — ou tester au jalon Profil.

Si la connexion échoue avec une erreur réseau : vérifier `EXPO_PUBLIC_API_URL` (IP LAN de la machine, port 3000), le pare-feu, et que `next dev` écoute bien sur `*:3000`.

- [ ] **Step 4 : Commit**

```bash
git add -A && git commit -m "feat(mobile): écran Connexion + auth end-to-end contre l'API vulu"
```

---

## Self-Review (couverture spec)

| Élément spec | Tâche |
|---|---|
| A1 Bearer dans la session | A1 (steps 1) |
| A2 renvoi du token login/register/2fa | A1 (steps 2-4) |
| A3 test Bearer | A1 (step 5) |
| B1 scaffold & config | B1 |
| B2 thème (tokens portés) | B1 (steps 4-5) |
| B3 client API (+ buildHeaders testé) | B2 |
| B4 auth & session (SecureStore, AuthContext) | B2 (store), B3 (context) |
| B5 navigation & garde d'auth | B4 |
| B6 écran Connexion + livrable | B5 |
| Types SelfUser | B3 |

Toutes les exigences de la spec M0 sont couvertes.

## Notes pour la session d'exécution

- **Node 24** : si `create-expo-app`/Metro râle, basculer sur Node LTS (20/22) via nvm avant le scaffold ; non bloquant pour le reste.
- **NativeWind v4** : si les variables CSS via `@media` ne s'appliquent pas au sombre, repli : définir les couleurs en dur (clair) dans `tailwind.config` et utiliser les variantes `dark:` sur les composants. Le shell M0 est simple (peu de classes) — ajustable au Task B1.
- **Template create-expo-app** : la structure exacte des écrans d'exemple peut varier ; adapter le nettoyage (B4 step 2) à ce qui est réellement généré, en conservant `app/_layout.tsx` (réécrit) et le groupe `(tabs)`.
- **Deux dépôts** : la Partie A committe dans `vulu/` (master) ; la Partie B committe dans `vulu-mobile/` (dépôt séparé). Ne pas mélanger.
- Le scan caméra, l'inscription/onboarding, et les écrans réels sont hors M0 (jalons suivants).
