# Inscription — vérif disponibilité pseudo/email + retour étape 1 — Design

Date : 2026-06-23
Statut : approuvé (à implémenter)

## Objectif

Pendant l'inscription en deux étapes, empêcher un échec tardif : vérifier que le **pseudo**
et l'**email** sont disponibles **avant** de passer au choix des genres (étape 2). Et
permettre de **revenir à l'étape 1** depuis l'étape 2 sans perdre la saisie.

Décisions de cadrage (validées) :
- Pseudo **et** email vérifiés (pas de doublon de compte).
- Vérification au clic « Continuer » de l'étape 1 (pas en live à chaque frappe).
- La vérification finale au POST `/api/auth/register` est conservée (anti-race).

## Flux actuel (rappel)

- `/register` (étape 1) : nom affiché, pseudo, email, mot de passe, onglets médias →
  `sessionStorage[SIGNUP_KEY]` puis `router.push("/onboarding")`.
- `/onboarding` (étape 2) : `TasteSelector` (genres) → `POST /api/auth/register`.
- Unicité pseudo/email vérifiée seulement dans `registerUser` (échec tardif aujourd'hui).

## 1. Application — `checkSignupAvailability`

Nouveau fichier `src/server/application/signup-availability.ts` :
```ts
export interface SignupAvailability { usernameAvailable: boolean; emailAvailable: boolean }
export async function checkSignupAvailability(
  deps: Deps, input: { username: string; email: string },
): Promise<SignupAvailability>
```
- Normalise `username` et `email` en `trim().toLowerCase()`.
- `usernameAvailable = (await deps.users.findByUsername(username)) === null`.
- `emailAvailable = (await deps.users.findByEmail(email)) === null`.
- Aucune validation de format ici (responsabilité de la frontière HTTP / du client) ; un
  champ vide donne « disponible » côté domaine, mais l'UI bloque avant l'appel.

## 2. API — `GET /api/auth/check-account`

`src/app/api/auth/check-account/route.ts` (public, pas d'auth — phase d'inscription) :
- Lit `u` (pseudo) et `e` (email) dans la query.
- Valide via `checkAccountSchema` (zod) : `u` 3–20 `[a-z0-9_]`, `e` email valide. Format
  invalide → 400 (`toErrorResponse`), le client validant déjà en amont.
- Réponse : `{ usernameAvailable: boolean, emailAvailable: boolean }`.

`checkAccountSchema` ajouté à `src/lib/zod-schemas.ts` :
```ts
export const checkAccountSchema = z.object({
  u: z.string().min(3).max(20).regex(/^[a-z0-9_]+$/i),
  e: z.email(),
});
```

## 3. Étape 1 (`/register`)

- **Préremplissage** : au montage (`useEffect`), si `sessionStorage[SIGNUP_KEY]` existe, en
  hydrater `draft` (retour depuis l'étape 2 sans perte de saisie).
- **`next` devient asynchrone** avec un état `busy` :
  1. Valide format : `displayName` non vide, `email` valide (regex simple), `username`
     match `^[a-z0-9_]{3,20}$`, `password.length >= 8`. Sinon `setError` ciblé, stop.
  2. Appelle `GET /api/auth/check-account?u=…&e=…`.
  3. Si `!usernameAvailable` → « Ce nom d'utilisateur est déjà pris ». Sinon si
     `!emailAvailable` → « Cet email est déjà utilisé ». Stop dans les deux cas.
  4. Sinon : `sessionStorage[SIGNUP_KEY] = draft` puis `router.push("/onboarding")`.
- Le bouton « Continuer » affiche « … » et est désactivé pendant `busy`.

## 4. Étape 2 (`/onboarding`)

- Ajout d'un bouton **« ← Retour »** (style secondaire, au-dessus ou à côté du bouton
  « Terminer ») qui fait `router.push("/register")`. Le brouillon reste en `sessionStorage`,
  donc l'étape 1 se préremplit.

## 5. Tests (TDD)

- `checkSignupAvailability` :
  - pseudo libre + email libre → `{ true, true }`.
  - pseudo pris (insensible à la casse) → `usernameAvailable false`.
  - email pris (insensible à la casse) → `emailAvailable false`.
- `checkAccountSchema` : accepte `{ u, e }` valides ; rejette pseudo trop court / email
  invalide.

## Hors périmètre (YAGNI)

- Pas de vérification live à chaque frappe (uniquement au clic « Continuer »).
- Pas de suggestion de pseudo alternatif.
- Pas de changement du modèle de données ni de la logique de `registerUser` (sa vérif
  d'unicité reste le garde-fou final anti-race).
