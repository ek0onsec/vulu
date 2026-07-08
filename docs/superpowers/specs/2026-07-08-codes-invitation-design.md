# Codes d'invitation — Design

## Objectif

L'inscription sur vulu requiert désormais un **code d'invitation**. Chaque utilisateur
possède un code permanent, réutilisable à l'infini, qu'il partage pour parrainer de
nouveaux membres. Dans ses paramètres, il retrouve son code, le nombre de personnes
inscrites grâce à lui, et la liste de ces filleuls.

Périmètre volontairement restreint (pas de quota, pas de codes à usage unique, pas de
récompenses) — une base solide et extensible.

## Décisions de conception

- **Un code permanent par utilisateur**, réutilisable sans limite. Le compteur monte à
  chaque inscription.
- **Bootstrap** : les comptes déjà existants reçoivent leur code en *backfill lazy* (à la
  première ouverture des paramètres). Des **codes fondateurs** définis en variable
  d'environnement permettent les toutes premières inscriptions même sur base vierge.
- **Comparaison insensible à la casse** : tout code est normalisé en majuscules.

## Modèle de données

Deux champs ajoutés à l'entité `User` (`src/server/domain/entities.ts`) :

| Champ        | Type              | Sens                                                            |
|--------------|-------------------|----------------------------------------------------------------|
| `inviteCode` | `string`          | Code permanent, unique, partageable de l'utilisateur.          |
| `invitedBy`  | `string \| null`  | Id du parrain. `null` si inscrit via code fondateur ou compte pré-existant backfillé. |

Le compteur et la liste des filleuls se déduisent de `invitedBy === monId`. Aucune
nouvelle collection.

**Transition** : les documents utilisateurs existants n'ont pas encore ces champs. Le
mapper Mongo (`fromUserDoc`) tolère leur absence (`inviteCode` généré lazily, `invitedBy`
= `null` par défaut). Aucun script de migration destructif.

## Génération du code

Nouveau port `InviteCodeGenerator` injecté dans `Deps`, avec un adaptateur par défaut :

- 8 caractères, alphabet non ambigu : `ABCDEFGHJKMNPQRSTUVWXYZ23456789` (sans
  `O/0/I/1/L`).
- Unicité garantie par retry : régénération tant que `users.findByInviteCode(code)`
  renvoie un utilisateur existant (borne de sécurité : ~10 tentatives puis erreur).

Le code est attribué à l'inscription pour les nouveaux comptes, et généré à la volée pour
les comptes existants lors du premier `getMyInvite`.

## Configuration (env)

Ajout à `src/lib/env.ts` :

```
INVITE_FOUNDER_CODES: z.string().optional()   // ex. "VULUONE,VULUTWO"
```

Parsée en `ReadonlySet<string>` (majuscules, trim, entrées vides ignorées) et injectée
dans `Deps` sous `founderCodes`. Vide par défaut.

Le lien Discord affiché à l'inscription est une constante applicative :
`https://discord.gg/apREpGzK7K` (dans `src/lib/copy.ts`).

## Ports & adaptateurs

`UserRepository` (`src/server/ports/repositories.ts`) gagne :

- `findByInviteCode(code: string): Promise<User | null>`
  - Mongo : `findOne({ inviteCode: code })`, avec **index unique sparse** sur `inviteCode`.
  - Mémoire : scan `find((u) => u.inviteCode === code)`.
- `listByInviter(inviterId: string): Promise<User[]>`
  - Mongo : `find({ invitedBy: inviterId })`.
  - Mémoire : `filter((u) => u.invitedBy === inviterId)`.

Nouveau port `InviteCodeGenerator` :

```ts
export interface InviteCodeGenerator {
  next(): string;   // un code brut de 8 caractères (unicité vérifiée par l'appelant)
}
```

Adaptateur `RandomInviteCodeGenerator` (dans `src/server/adapters/security/`), utilisant
`crypto` pour le tirage aléatoire.

## Services applicatifs

### `registerUser` (modifié)

`RegisterInput` gagne `inviteCode: string`.

1. Normaliser : `code = inviteCode.trim().toUpperCase()`.
2. Valider : `code` est accepté ssi
   - `deps.founderCodes.has(code)`, **ou**
   - `parrain = await deps.users.findByInviteCode(code)` existe.
   Sinon → `ValidationError("Code d'invitation invalide")`.
3. `invitedBy = parrain?.id ?? null`.
4. Générer un `inviteCode` unique pour le nouvel inscrit (retry sur collision).
5. Créer l'utilisateur avec ces deux champs.

La validation du code intervient **après** les vérifs email/username existantes.

### `getMyInvite` (nouveau)

`getMyInvite(deps, userId): Promise<{ code: string; invitedCount: number; invitees: UserCard[] }>`

1. Charger l'utilisateur (`NotFoundError` si absent).
2. Si `inviteCode` absent → générer + persister (backfill lazy).
3. `invitees = (await deps.users.listByInviter(userId)).map(toCard)` (réutilise `UserCard`
   de `follow-lists.ts`, ou un type local équivalent).
4. `invitedCount = invitees.length`.

## HTTP

- `registerSchema` (`src/lib/zod-schemas.ts`) : `+ inviteCode: z.string().min(1)`.
- Route `POST /api/auth/register` : transmet `inviteCode` à `registerUser`.
- Nouvelle route `GET /api/me/invite` : `requireUser` → `getMyInvite` → JSON
  `{ code, invitedCount, invitees }`.

## UI

### Inscription (`src/app/(auth)/register/page.tsx`)

- Champ « Code d'invitation » (requis), normalisé visuellement en majuscules.
- Sous le champ, message discret : *« Pas de code d'invitation ? Rejoins le Discord »*
  avec lien vers `https://discord.gg/apREpGzK7K` (nouvel onglet, `rel="noreferrer"`).
- Validation front minimale (non vide) ; la vérité vient du serveur (`ValidationError`
  affichée dans le bandeau d'erreur existant).

### Paramètres (`src/app/parametres/SettingsClient.tsx`)

Nouvelle section « Parrainage » :
- Code affiché en évidence + bouton **Copier** (toast de confirmation).
- Compteur : « N personne(s) inscrite(s) grâce à ton code ».
- Liste des filleuls (avatar + pseudo), ou état vide si aucun.
- Données via `GET /api/me/invite` (fetch au montage de la section).

## Gestion des erreurs

- Code vide/invalide à l'inscription → `ValidationError` (400), affichée dans le bandeau
  du formulaire.
- Rate limiting déjà en place sur la route register (inchangé).
- `getMyInvite` sur utilisateur introuvable → `NotFoundError` (404).

## Tests

- **`register-user`** : inscription avec code fondateur (OK, `invitedBy = null`) ;
  inscription avec code d'un user existant (OK, `invitedBy = parrain.id`, code propre
  généré) ; code invalide rejeté ; code insensible à la casse.
- **`getMyInvite`** : génération lazy si code absent + persistance ; comptage et liste des
  filleuls corrects ; utilisateur inconnu → erreur.
- **Générateur** : format (longueur, alphabet), collision gérée par retry côté service.
- **Adaptateurs** : `findByInviteCode` / `listByInviter` (mémoire, et couverture Mongo si
  suite d'intégration existante).

## Hors périmètre (YAGNI)

Quota d'invitations, codes à usage unique, révocation/rotation de code, récompenses de
parrainage, arbre de parrainage multi-niveaux.
