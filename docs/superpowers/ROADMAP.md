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
2. **SP-Compte — Paramètres compte & sécurité** (PROCHAIN) : changer **username (@)**, **email**, **mot de passe** ; **préparer 2FA** (TOTP appli d'auth — champs + UI « bientôt ») ; **suppression de compte** = pop-up avec saisie « SUPPRIMER MON COMPTE » → **soft-delete** (`deactivatedAt`), déconnexion + message « réactivable en te reconnectant sous 48 h », purge définitive après 48 h (commentaires + listes). Bien prévenir l'utilisateur.
3. **SP-Intérêts — Centres d'intérêt complets** : genres **films/séries** + genres **littéraires** + cocher **acteurs / réalisateurs / auteurs** favoris (recherche TMDB/Google Books). `tastes` étendu : `bookGenres`, `people` (actor/director/author).
4. **SP-Vitrine — Profil** : afficher la **bannière de collection** sur le profil ; onglet **« Vitrine »** (1er onglet vu) = top all-time **5 films / 5 séries / 5 livres** choisis par l'utilisateur.
5. **SP-Communautés** : créer des communautés (type X), les rejoindre, **épingler une communauté** comme onglet du feed (à côté de Pour vous / Mon cercle / <nom commu>), **partage ciblé** public / cercle / communauté.
6. **SP-vulu+ features** :
   - **Filtre anti-spoiler IA** : détecte et masque les spoilers (flou + « spoiler potentiel », clic pour révéler).
   - **Thèmes de couleur supplémentaires** : visibles par tous dans Préférences d'affichage mais **verrouillés** pour les non-vulu+ (prévisualisables, non sauvegardables).
   - paiement réel (Stripe).
7. **SP3 — Filtres par personne** : explorer œuvres/bibliothèque par acteur / réalisateur / auteur.
8. **Mécaniques d'habitude** : Wrapped/Rétrospective, Journal & cartes partageables, Notifications in-app & reco perso.
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
