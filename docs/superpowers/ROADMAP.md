# vulu — Roadmap & demandes (réorganisées)

> Source de vérité des demandes utilisateur, pour reprise ultérieure. Mise à jour : 2026-06-18.
> Stack : Next.js 16 / React 19 / Tailwind v4 / MongoDB, architecture hexagonale (domain/application/ports/adapters).
> Dev : Mongo en mémoire (`scripts/smoke-mongo.mjs`) + seed (`scripts/seed-demo.mjs`), `.env.local` contient clés TMDB (v3) et Google Books. Compte démo : demo@vulu.app / password1.

## ✅ Livré
- **Phase 1 (films)** : auth email/mdp (cookies httpOnly), profil, follow + cercle (union), bibliothèque (statut Vu/À voir, note décimale 0–5 au slider, commentaire, visibilité cercle/public), listes, feed filtré par onglets, likes & commentaires, thèmes clair/Aubergine, PWA.
- **v2 UI premium** : icônes SVG sur mesure (plus d'émojis), avatars (image ou dégradé+initiales), cartes feed riches (affiche, temps relatif), commentaires inline, rail droit (À suivre + Tendances), édition profil en modale, listes en modale (création/édition/détail), ajout à une liste depuis la fiche, toasts.
- **Avis communauté** sur la fiche œuvre, sous-filtres profil, skeletons, FAB mobile, page 404, focus clavier.
- **SP1 Livres** : Google Books, `CompositeCatalog` (route films→TMDB / livres→Google Books), `WorkType += book`, `source += googlebooks`, `PersonRole += author`, recherche/fiche/feed livres.
- **SP2 Bibliothèque & playlists mixtes** : onglet Bibliothèque (sections À voir/lus, Vus/lus, collections), filtres Tout/Films/Séries/Livres, covers collage, composer feed.
- **Backend du lot en cours** : note TMDB (`vote_average`) + plateformes « où regarder » (TMDB watch/providers FR) sur la fiche ; collections `kind` (films/livres/mixed) + `bannerUrl` ; endpoint thread d'un post (`GET /api/entries/:id`) ; champ `User.plus` (vulu+) + `POST /api/me/plus` ; toast avec annulation, `BackButton`, `CertifiedBadge`.

## ✅ Livré (lot v3 — 2026-06-18)
- Feed **2 onglets** « Pour vous » / « Mon cercle » + **scroll infini** (IntersectionObserver) + composer + point jaune clignotant sur l'onglet Feed (disparaît une fois sur le feed) + **feed élargi sur PC** (max-w 1320, rail 340).
- Fiche : **note TMDB**, **« Où regarder »** (plateformes FR), **flèche retour** (`BackButton`).
- Profil repensé : stats **vus + lus** (selon onglets), **onglets fluides** (Vus/À voir/Lu/À lire/Collections), **badges** staff + certifié sur le nom.
- Collections (ex-« playlist ») : **type** (Films/Livres/Mixte) + **description** à la création, **bannière** uploadable, **toast d'annulation** au retrait.
- **Thread** `/post/:id` (post + fil de discussion ; le bouton commentaire y mène).
- **vulu+** : page `/plus` (2 €/mois, stub), **badge certifié** + **badge staff Vulu** partout (feed, profil, commentaires, sidebar).
- **Sidebar** : chip compte (nom + @ + badges) en bas + déconnexion ; onglet **Paramètres** (`/parametres` : intérêts éditables, thème, confidentialité placeholder, déconnexion).

## 🗺️ Planifié (prochains sous-projets) — réorganisé 2026-06-18
1. ✅ **SP-Privé — Compte privé & demandes de suivi** (LIVRÉ) : `User.private`, visibilité mutuelle, FollowRequest (envoyer/approuver/refuser via `/demandes`), bouton états (Suivre/Demander/Demande envoyée/Suivi), vue profil verrouillée, toggle dans `/parametres`.
2. ✅ **SP-Compte — Paramètres compte & sécurité** (LIVRÉ) : changer username/email/mot de passe, 2FA préparée (champ `twoFactorEnabled` + UI « bientôt »), **suppression différée** (`deactivatedAt` : désactivation + déconnexion, réactivable par reconnexion < 48 h, purge `purgeUser` au-delà) avec pop-up « SUPPRIMER MON COMPTE ». + vulu+ mensuel/annuel (-10 %), infobulles badges, réseaux Vulu (Discord/Insta/X) dans Paramètres.

## ✅ SP-Notifs (LIVRÉ)
Onglet Notifications (cloche) + agrégation condensée : likes sur tes avis, commentaires sur tes avis, nouveaux abonnés — « Alice et N autres ont aimé ton avis sur <œuvre> ». Dérivé à la lecture (`buildNotifications`), `/api/notifications`. **État lu/non-lu + badge compteur sur la cloche** livré (`notificationsSeenAt`, `/api/notifications/count` + `/seen`, surlignage des non-lus). Reste : like de commentaires (pas de like-sur-commentaire encore), notifs de demandes de suivi/réponses, push.

### Reste planifié : changer **username (@)**, **email**, **mot de passe** ; **préparer 2FA** (TOTP appli d'auth — champs + UI « bientôt ») ; **suppression de compte** = pop-up avec saisie « SUPPRIMER MON COMPTE » → **soft-delete** (`deactivatedAt`), déconnexion + message « réactivable en te reconnectant sous 48 h », purge définitive après 48 h (commentaires + listes). Bien prévenir l'utilisateur.
3. ✅ **SP-Intérêts** (LIVRÉ) : genres films/séries + **genres littéraires** (`tastes.bookGenreIds`) + **acteurs/réalisateurs/auteurs favoris** (recherche TMDB/Google Books, `PersonRole` += author). TasteSelector étendu, éditable dans Paramètres → Centres d'intérêt.
4. ✅ **SP-Vitrine — Profil** (LIVRÉ) : onglet **« Vitrine »** en 1er (top all-time 5 films / 5 séries / 5 livres, `User.showcase`, gestionnaire avec recherche+import, `PUT /api/me/showcase`) + **bannière de collection** affichée sur les cartes du profil.
5. ✅ **SP-Communautés** (LIVRÉ) : créer des communautés (type X, slug auto-dédupliqué), les **rejoindre/quitter**, **épingler une communauté** comme onglet du feed (à côté de Pour vous / Mon cercle / <nom commu>), **fil dédié** par communauté, **partage ciblé** public / cercle / communauté depuis l'EntryEditor (membership vérifiée côté domaine — partage refusé si non-membre). Entités `Community`/`Membership`, `LibraryEntry.communityId`, repos in-memory + Mongo (index slug unique, `entries.communityId`), `/api/communities/*`, pages `/communautes` + `/communaute/[id]`. Tests : `tests/application/communities.test.ts`. **Bug corrigé** : `rateSchema` retirait silencieusement `communityId` à la frontière HTTP (zod strip) → ajout du champ + garde-fou `tests/lib/zod-schemas.test.ts`.
6. **SP-vulu+ features** :
   - **Filtre anti-spoiler IA** : détecte et masque les spoilers (flou + « spoiler potentiel », clic pour révéler).
   - ✅ **Thèmes de couleur supplémentaires** (LIVRÉ) : 5 palettes (Aurore, Forêt, Rétro, Océan, Crépuscule) + marque vulu, surchargeant primary/accent par-dessus clair/sombre (`globals.css [data-palette]`, source `lib/theme.ts PALETTES`). `ThemePicker` dans Affichage : aperçu live pour tous, **sauvegarde réservée à vulu+** (persistée dans `vulu-palette`, restaurée sans flash via `themeNoFlashScript`) ; les non-abonnés voient l'aperçu rétabli en quittant le panneau.
   - paiement réel (Stripe).
7. ✅ **SP3 — Filtres par personne** (LIVRÉ — 2026-06-21) : page `/personne/[id]` (mes œuvres + découverte catalogue via TMDB `combined_credits` / recherche `inauthor:` pour les livres), filtre par personne dans la bibliothèque (`Library.people` + `peopleIds`), noms cliquables sur la fiche œuvre (section « Équipe & casting ») et dans les favoris. Helpers `personHref`/`parsePersonId`, `getPersonProfile`, `catalog.getPersonCredits`. Spec/plan : `docs/superpowers/{specs,plans}/2026-06-20-filtres-par-personne*`.
8. **Mécaniques d'habitude** : Wrapped/Rétrospective, Journal & cartes partageables, Notifications in-app & reco perso.

### ✅ SP-Progression « en cours » (LIVRÉ — 2026-06-20)
Statut `in_progress` + suivi : séries `S1 E5` (totaux épisodes via TMDB), livres `Tome 3 · p.230` (pages via Google Books), films « en cours » sans détail. `LibraryEntry.progress` + `activityAt` (nullable) ; le feed est ordonné par `activityAt` et ne montre une entrée que si un **avis** ou un **jalon partagé** l'a posé (`shareMilestone`) — les bumps silencieux (`updateProgress`) ne remontent rien. EntryEditor : steppers + « Partager ce jalon ». Profil : section « En cours » avec reprise +1. Routes `PUT /api/works/progress`, `POST /api/entries/:id/share`. `workRefSchema` élargi aux livres. Spec/plan : `docs/superpowers/{specs,plans}/2026-06-19-*`. **Différé** : suggestion « Marquer comme terminé ? » à la fin connue.

### ✅ Bannière de communauté (LIVRÉ — 2026-06-20)
Le créateur (`ownerId`) téléverse une bannière depuis `/communaute/[id]` (bouton « Bannière » en overlay, réservé à `isOwner`), redimensionnée client-side 1500×500, validée par magic bytes (`detectImage`), stockée via `MediaStorage`. `CommunityRepository.update`, `setCommunityBanner`, `POST /api/communities/:id/banner`, `CommunityDto.isOwner`. Remplace le dégradé par défaut.

### ⏳ Backlog — Communautés privées & modération (demandé 2026-06-21)
Une communauté peut être **privée** : rejoindre crée une **demande d'adhésion** à approuver par le **créateur ou un modérateur**. Implique : `Community.visibility` (public/privé), rôle `moderator` (membership `role`), file de demandes d'adhésion (réutiliser le pattern `FollowRequest`), fil + contenu masqués aux non-membres d'une communauté privée, UI d'approbation/refus côté owner/mods. Les modérateurs peuvent aussi **inviter** des gens (demande de sens inverse). **En cours de cadrage** (spec → plan).

### ⏳ Backlog — Réponses imbriquées & likes de commentaires (demandé 2026-06-21)
Style Twitter : pouvoir **répondre à un commentaire précis** (fil imbriqué sous le commentaire visé) et **liker des commentaires**. Implique : `Comment.parentId: string | null` (threading), bouton « Répondre » qui cible un commentaire, rendu en arbre (indentation/quinconce conservé), entité/▲ like de commentaire (réutiliser le pattern `Like` en généralisant `entryId`→ cible, ou `CommentLike`), compteur + état likedByMe par commentaire, et notifications associées (réponse à ton commentaire, like de ton commentaire). Cadrer en sous-projet dédié.

### ⏳ Backlog — Signalement de spoilers communautaire (demandé 2026-06-21)
Un avis (review) ou un message de discussion peut être **signalé comme spoiler** par les utilisateurs.
- **Seuil pondéré** : plusieurs signalements de comptes **non-abonnés** sont nécessaires pour flaguer ; **un seul** signalement suffit s'il vient d'un **membre vulu+**, d'un **modérateur de la plateforme** ou d'un **membre de l'équipe vulu**.
- **Effet visuel** (dans le feed ET sur la page d'une œuvre film/série/livre) : le contenu flagué est **flouté** + **bandeau « spoiler potentiel »** par-dessus + **bouton « Afficher quand même »**.
- **Contre-signalement** : option « signaler comme non-spoiler » avec la même mécanique de seuil pour **annuler** le flag.
- **Provenance affichée** : indiquer **par qui** le spoiler a été détecté — soit le **@ de la personne**, soit « détecté par le **Système IA de vulu** » quand c'est l'IA anti-spoiler qui flague (cf. avantage vulu+ « Filtre anti-spoiler IA »).
- Implique : entité `SpoilerReport { targetType: review|comment, targetId, reporterId, kind: spoiler|not_spoiler, weight }`, calcul de seuil au read-time, champ dérivé `spoiler: { flagged, byIa, byUser }` sur les DTO de feed/avis, composant `SpoilerVeil`. Cadrer en sous-projet dédié.
3. **Communautés (gros sous-système)** : créer des communautés (type Twitter Communities), onglet timeline des communautés publiques pour les rejoindre, ajouter un onglet de communauté rejointe sur le feed principal, et **partage ciblé** d'une activité en **public / cercle / communauté précise**.
4. **Mécaniques d'habitude (priorisées par l'utilisateur)** :
   - **Rétrospective / Wrapped** (bilan animé annuel/mensuel à partager, façon Spotify Wrapped).
   - **Journal & cartes partageables** (diary chronologique + export image d'un avis/collection).
   - **Notifications in-app & reco perso** (algo basé sur les goûts).
5. **vulu+ étendu** : nouvelles fonctionnalités réservées aux abonnés (à définir) + paiement réel (Stripe).

## Décisions actées
- Catalogue : TMDB (films/séries) + Google Books (livres).
- Auth : email/mot de passe, cookies httpOnly.
- Stockage images : port `MediaStorage` + adaptateur disque local (S3 plus tard).
- Collections : type Films/Livres/**Mixte** (mixte conservé même si l'utilisateur choisit souvent un domaine).
- Pas d'attribution IA dans le code/commits (préférence utilisateur).
