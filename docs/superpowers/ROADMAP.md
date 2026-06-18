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

## 🚧 En cours (frontend du lot courant)
- Feed **2 onglets** « Pour vous » (public selon préférences) / « Mon cercle » (uniquement follows ∪ followers).
- Feed **plus large sur PC**.
- Fiche : afficher **note TMDB** + **où regarder** + **flèche retour**.
- Profil **repensé** : stats avec **lus** (livres) en plus de vus ; **onglets fluides type Twitter** (Vus / À voir si films, Lu / À lire si livres, Collections) ; badge certifié sur le nom.
- Collections : renommer « playlist » → **« Collection »** ; à la création choisir **type** (Films/Livres/Mixte) + **description** ; **bannière** sur une collection ; **toast d'annulation** au retrait d'un élément.
- **Thread type Twitter** : clic sur une activité → page `/post/:id` (le post + le fil de commentaires).
- **vulu+** : page d'abonnement (2 €/mois, stub paiement), badge certifié partout.

## 🗺️ Planifié (prochains sous-projets)
1. **SP3 — Filtres par personne** : explorer œuvres/bibliothèque par acteur / réalisateur / auteur.
2. **SP4 — Centre de paramètres** : confidentialité (compte privé, visibilité par défaut), sécurité (changer mot de passe, sessions, suppression compte), préférences/affichage (thème, langue, densité, onglets), **intérêts** (genres film + littéraires, acteurs/réals/auteurs favoris).
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
