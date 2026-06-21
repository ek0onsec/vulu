# Communautés privées & modération — Design

Date : 2026-06-21
Statut : approuvé (à implémenter)

## Objectif

Permettre des communautés **privées** : rejoindre nécessite une **approbation** par le
créateur ou un modérateur. Introduire des **rôles** (owner / modérateur / membre), une file
de **demandes d'adhésion** et d'**invitations**, et masquer le fil aux non-membres d'une
communauté privée.

Décisions de cadrage (validées) :
- **Modérateurs** : le membership porte un rôle ; **seul l'owner** promeut/rétrograde un membre.
- **Visibilité privée** : la **vitrine** (nom/description/bannière/nombre de membres) reste
  visible dans la découverte et sur la page, mais le **fil est masqué** aux non-membres.
- **public/privé** : choisi à la création, **modifiable** ensuite par l'owner.
- **Entrée** : les utilisateurs **demandent** à rejoindre ; les owner/mods peuvent aussi **inviter**.

## 1. Modèle de données

`Community` gagne :
```ts
visibility: "public" | "private";   // défaut "public"
```

`Membership` gagne :
```ts
role: "owner" | "moderator" | "member";   // "owner" posé à la création
```

Nouvelle entité (calquée sur `FollowRequest`) :
```ts
interface CommunityRequest {
  id: string;
  communityId: string;
  userId: string;             // le membre potentiel
  kind: "request" | "invite"; // "request" = demandé par l'utilisateur ; "invite" = par un mod
  createdAt: Date;
}
```
Un seul couple `(communityId, userId)` en attente à la fois (unicité). À l'acceptation →
création du `Membership` (`role:"member"`) + suppression de la demande.

### Migration / rétro-compat
- `fromCommunityDoc` backfille `visibility: "public"` si absent.
- `fromMembershipDoc` backfille `role`: `"owner"` si `userId === community.ownerId` ne peut
  être déduit au mapping (pas d'accès à la communauté) → backfill `"member"` par défaut, et un
  petit correctif au moment du `present` : si `membership.userId === community.ownerId`, traiter
  comme `owner` quel que soit le champ stocké. (Les nouvelles écritures posent le bon rôle.)
- Seed : memberships du créateur écrits avec `role:"owner"`, communautés avec `visibility`.

## 2. Ports & repositories

`MembershipRepository` gagne :
- `setRole(communityId, userId, role): Promise<void>`
- `listForCommunity(communityId): Promise<Membership[]>` (liste des membres + rôles)

Nouveau `CommunityRequestRepository` (mémoire + Mongo), mêmes méthodes que
`FollowRequestRepository` adaptées :
- `add(r)`, `findById(id)`, `findPair(communityId, userId)`,
  `listForCommunity(communityId)` (demandes `kind:"request"`),
  `listInvitesForUser(userId)` (demandes `kind:"invite"` reçues),
  `remove(id)`, `removeAllForUser(userId)`, `removeAllForCommunity(communityId)`.

Mongo : `_id = request.id` ; index `{ communityId: 1, userId: 1 }` unique, `{ userId: 1 }`,
`{ communityId: 1, kind: 1 }`.

`Community.visibility` est aussi pris en compte par `removeAllForCommunity` lors d'une
suppression éventuelle (pas de suppression de communauté dans ce lot → non requis, mais la
méthode existe pour la purge utilisateur).

## 3. Règles métier (application/communities.ts)

Helper `canModerate(membership)` = `role === "owner" || role === "moderator"`.

- **`createCommunity`** : accepte `visibility` ; membership créateur en `role:"owner"` (et
  reste réservé à vulu+ — déjà en place).
- **`joinCommunity(userId, communityId)`** :
  - communauté **publique** → crée le membership (`role:"member"`) comme aujourd'hui.
  - **privée** → crée `CommunityRequest{kind:"request"}` (no-op si déjà membre ou demande en
    attente). Retourne l'état résultant.
- **`leaveCommunity`** : inchangé, mais **l'owner ne peut pas quitter** (`ForbiddenError`).
  Annule aussi une demande en attente le cas échéant.
- **`approveJoinRequest(actorId, requestId)`** : la demande doit être `kind:"request"` ;
  `actor` doit `canModerate` la communauté ; crée le membership + supprime la demande.
- **`rejectJoinRequest(actorId, requestId)`** : `actor` `canModerate` ; supprime la demande.
- **`inviteToCommunity(actorId, communityId, targetUserId)`** : `actor` `canModerate` ;
  refuse si la cible est déjà membre ou a déjà une demande/invitation ; crée
  `CommunityRequest{kind:"invite"}`.
- **`acceptInvite(userId, requestId)`** : la demande doit être `kind:"invite"` et
  `request.userId === userId` ; crée le membership + supprime.
- **`declineInvite(userId, requestId)`** : idem propriété ; supprime.
- **`setMemberRole(ownerId, communityId, targetUserId, role)`** : `role ∈ {member, moderator}` ;
  acteur doit être l'**owner** ; la cible doit être membre et ≠ owner.
- **`setCommunityVisibility(ownerId, communityId, visibility)`** : owner uniquement.

Erreurs typées : `ForbiddenError`, `NotFoundError`, `ValidationError`, `ConflictError`
(invitation/demande déjà existante) — cohérentes avec l'existant.

## 4. Visibilité du fil & DTO

`CommunityDto` gagne :
```ts
visibility: "public" | "private";
role: "owner" | "moderator" | "member" | null;   // rôle du viewer (null si non-membre)
requestState: "none" | "requested" | "invited";  // état de la demande du viewer
canModerate: boolean;                             // owner ou modérateur
pendingCount: number;                             // demandes en attente (0 si pas mod)
```
(`isOwner`/`isMember`/`isPinned`/`memberCount` restent.)

- **`communityFeed(viewer, communityId, cursor)`** : si `visibility==="private"` **et** viewer
  non-membre → `ForbiddenError`. Sinon inchangé.
- **`getCommunity`** : renvoie la vitrine complète quelle que soit la visibilité (nom,
  description, bannière, `memberCount`) + les champs ci-dessus. `pendingCount` n'est calculé
  (et > 0) que si `canModerate`.
- **`listPublicCommunities`** : continue de lister **toutes** les communautés (vitrine), y
  compris privées (marquées via `visibility`). Le bouton de jointure côté UI s'adapte.
- Nouvelle **`listMembers(viewerId, communityId)`** : liste `{ userId, username, displayName, avatarUrl, role }`
  visible pour les membres (et owner/mod pour les actions). Pour une privée, réservée aux membres.
- Nouvelle **`listJoinRequests(actorId, communityId)`** : demandes `kind:"request"` en attente,
  réservée à `canModerate` ; renvoie `{ requestId, user: {username, displayName, avatarUrl} }`.
- Nouvelle **`myInvites(userId)`** : invitations reçues (`kind:"invite"`) avec la vitrine de la
  communauté, pour l'affichage du bandeau.

## 5. API

- `POST /api/communities` : `createCommunitySchema` gagne `visibility` (`z.enum(["public","private"]).default("public")`).
- `POST /api/communities/:id/join` : demande-ou-rejoint selon la visibilité ; renvoie
  `{ requestState, isMember }`.
- `DELETE /api/communities/:id/join` : quitte (membre) **ou** annule la demande en attente.
- `GET /api/communities/:id/requests` : liste des demandes (owner/mod).
- `POST /api/communities/:id/requests/:reqId/approve` · `/reject` (owner/mod).
- `POST /api/communities/:id/invite` `{ userId }` (owner/mod).
- `GET /api/communities/:id/members` : liste des membres (membres ; actions owner/mod).
- `POST /api/communities/:id/members/:userId/role` `{ role }` (owner).
- `POST /api/communities/:id/visibility` `{ visibility }` (owner).
- `POST /api/community-invites/:reqId/accept` · `/decline` (l'invité).
- `GET /api/community-invites/mine` : mes invitations en attente.

## 6. UI

- **Création** (`CommunitiesClient`) : toggle **Public / Privé** dans la modale.
- **Découverte** : communautés privées affichent un **cadenas** ; bouton « Demander » au lieu de
  « Rejoindre ».
- **Page communauté** (`CommunityClient`) :
  - **Non-membre, privée** : vitrine visible, fil remplacé par un **voile** « Communauté privée —
    demande à rejoindre » ; bouton « Demander à rejoindre » ↔ « Demande envoyée » (annulable).
  - **Invité** : bandeau « Tu es invité — **Accepter** / **Refuser** ».
  - **Owner/mod** : panneau **« Demandes (N) »** (approuver/refuser), bouton **« Inviter »**
    (champ **username exact**, pas d'autocomplétion), **liste des membres** avec badges de rôle ;
    l'**owner** voit promouvoir/rétrograder et le **toggle de visibilité**.
- Réutiliser l'icône `lock` (cadenas) et `community`/`shield` pour les rôles.

## 7. Tests (TDD)

- `createCommunity` : `visibility` par défaut public ; owner membership `role:"owner"`.
- `joinCommunity` : public → membership ; privé → `CommunityRequest{kind:"request"}`.
- `approveJoinRequest` / `rejectJoinRequest` : par owner et par modérateur OK ; par simple
  membre / non-membre → `ForbiddenError`.
- `inviteToCommunity` + `acceptInvite` / `declineInvite` ; double invitation → `ConflictError`.
- `setMemberRole` : owner only ; cible doit être membre ; ne peut pas viser l'owner.
- `setCommunityVisibility` : owner only ; bascule effective.
- `communityFeed` : privée + non-membre → `ForbiddenError` ; membre → OK.
- `leaveCommunity` : owner ne peut pas quitter.
- Repos : `CommunityRequest` mémoire + Mongo (unicité du couple, `findPair`,
  `listForCommunity`, `listInvitesForUser`) ; `Membership.setRole` / `listForCommunity`.
- Mappers Mongo : backfill `visibility`/`role`.

## Hors périmètre (YAGNI)

- **Notifications** de demandes/invitations (bannière sur la page communauté suffit pour ce lot ;
  notifications in-app réutilisables plus tard).
- **Transfert d'ownership** et suppression de communauté.
- Recherche d'utilisateurs / autocomplétion : l'invitation se fait par **username exact**
  (`deps.users.findByUsername`), `NotFoundError` si introuvable.
