# vulu — Rapport features « game-changer »

Date : 2026-06-24
Objectif : identifier les fonctionnalités à fort effet de levier, dignes des plus grandes apps,
**non encore présentes** dans vulu, et alignées sur son ADN (réseau social *vu & lu* — films/séries/livres).

## Constat de départ

vulu couvre déjà très bien le **socle** (catalogue, bibliothèque, avis, progression, communautés,
listes, feed multi-onglets, personnes, vulu+, notifs). Ce qui manque pour passer de « bon réseau
de niche » à « app dont on ne peut plus se passer », ce sont **3 moteurs** que les leaders maîtrisent :

1. **La décision** — « qu'est-ce que je regarde/lis *maintenant* ? » (réduire la friction).
2. **La connivence** — transformer le goût en lien social mesurable et partagé.
3. **L'habitude** — boucles de rétention et virilité (Wrapped, défis, stories, cartes).

Et un **moat moderne** : l'IA conversationnelle, déjà promise par le positionnement « Système IA de vulu ».

---

## 🥇 Tier 1 — Les vrais game-changers (à prioriser)

### 1. « Soirée » — décision partagée à plusieurs (façon Spotify Blend)
**Quoi** : deux utilisateurs (ou un cercle) lancent une **Soirée** → vulu calcule l'**intersection de leurs
watchlists + recos**, filtrable par **plateforme dispo / humeur / durée / domaine**, et propose 3–5 titres
sur lesquels chacun **swipe** ; le premier match commun gagne.
**Pourquoi game-changer** : c'est *le* cas d'usage couple/colocs/amis que personne ne résout bien.
Spotify Blend et le swipe-to-match (Tinder) ont prouvé la viralité de ce format. Crée un rituel récurrent.
**Fit vulu** : réutilise watchlists (`status: planned`), `watchProviders` TMDB (« Où regarder »), le cercle.
Nouveau : entité `Session`/`SoireeVote`, vue swipe. **Effort : moyen.**

### 2. Compatibilité de goûts (« Match % ») + avis pondérés par affinité
**Quoi** : sur chaque profil, un **score de compatibilité** (« 87 % de goûts communs ») calculé à partir des
notes croisées ; et sur les fiches œuvres, **mettre en avant les avis des gens dont le goût te ressemble**.
**Pourquoi game-changer** : Letterboxd/Goodreads montrent des avis « moyens » ; vulu montrerait des avis
**pertinents pour toi**. Le Match % est un aimant social (on va voir « qui me ressemble »).
**Fit vulu** : similarité (cosinus/Pearson) sur les notes décimales existantes ; pondération au read-time des
DTO d'avis. Pas de nouvelle donnée lourde. **Effort : moyen.**

### 3. IA conversationnelle de reco + recherche sémantique (réservé vulu+)
**Quoi** : une barre « Demande à vulu » — *« un thriller coréen comme Old Boy mais moins violent »*,
*« un livre qui finit bien pour ma sœur qui a aimé Fredrik Backman »* → l'IA interroge le catalogue
(TMDB/Google Books) et **justifie** chaque reco. Plus une **recherche sémantique** (« films sur le deuil »).
**Pourquoi game-changer** : c'est le différenciateur 2026. Aligne parfaitement avec l'avantage vulu+ déjà
annoncé (« Système IA de vulu »), et la même brique sert l'**anti-spoiler IA** (backlog) et les **résumés de goût**.
**Fit vulu** : nouvel adaptateur `RecommenderPort` (LLM) derrière une interface — cohérent avec l'hexagonal ;
embeddings des synopsis pour la recherche sémantique. Monétisable (quota vulu+). **Effort : moyen→élevé.**

### 4. Rétrospective vulu (« Wrapped ») + cartes & stories partageables
**Quoi** : bilan **animé** mensuel/annuel (heures de visionnage, pages lues, genres dominants, top 5, « ton
archétype de spectateur »), exportable en **carte image** ; et un statut **« En ce moment »** éphémère
(story 24 h : *« je regarde S2E4 »*) repris du suivi de progression.
**Pourquoi game-changer** : Spotify Wrapped = pic d'acquisition annuel ; les stories (BeReal/IG) =
engagement quotidien à faible coût. Les cartes partageables amènent du trafic **hors de l'app**.
**Fit vulu** : agrège des données déjà là (`activityAt`, `progress`, notes). Cartes = rendu OG-image.
Déjà partiellement en backlog (Wrapped, cartes) → **à élever en priorité.** **Effort : moyen.**

---

## 🥈 Tier 2 — Forts, à enchaîner

### 5. « Ce soir » — le décideur anti-paralysie (solo)
Bouton qui, selon **plateforme + humeur + durée dispo + domaine**, tire 1 titre de ta watchlist ou des recos.
Le « quoi regarder ce soir » est le point de douleur n°1 du streaming. Réutilise watchlist + providers + recos.
**Effort : faible.** (Brique commune avec la Soirée.)

### 6. Défis & objectifs (streaks, challenges)
« 52 livres en 2026 », « Octobre horreur », anneaux de progression, séries de jours actifs.
Goodreads Reading Challenge et Duolingo prouvent l'effet rétention. **Effort : moyen.**

### 7. Classements / Tier lists partageables (S/A/B/C…)
Glisser-déposer pour ranger ses tops (réalisateurs, sagas, films d'un acteur) → image partageable.
Format ultra-viral (TikTok/Reddit). S'appuie sur la vitrine et les listes. **Effort : moyen.**

### 8. Listes collaboratives
Plusieurs éditeurs sur une collection (co-curation cercle/communauté). Extension naturelle des listes +
rôles déjà présents pour les communautés. **Effort : faible→moyen.**

---

## 🥉 Tier 3 — Bonus à fort potentiel

- **Co-watch / watch-party communautaire** : fil de réactions horodatées synchronisé pendant un visionnage
  (Discord-like). Profondeur d'engagement pour les communautés. **Effort : élevé.**
- **Alertes de disponibilité** : « préviens-moi quand *Dune 2* arrive sur mes plateformes » (suivi
  `watchProviders`). Utilitaire fidélisant. **Effort : faible→moyen.**
- **Résumé de goût IA** sur le profil : « drames lents + SF cérébrale + autrices nordiques » (même brique #3).
- **Avis enrichis** : sections **tagguées spoiler** (synergie anti-spoiler IA), embeds. **Effort : moyen.**
- **Import Letterboxd / Goodreads** : onboarding sans friction pour les utilisateurs qui migrent. **Effort : moyen.**

---

## Synergies avec le backlog existant

- **Anti-spoiler IA** (backlog) et **#3 IA** partagent le même `RecommenderPort`/LLM → mutualiser.
- **Réponses imbriquées + likes de commentaires** (backlog) renforcent le co-watch (#Tier 3) et les avis.
- **Wrapped / journal / cartes** (backlog) = **#4**, à prioriser plutôt qu'à laisser dormir.

## Recommandation de séquencement

1. **#2 Compatibilité de goûts** (rapide, pose la brique de similarité réutilisée partout).
2. **#1 Soirée + #5 Ce soir** (même moteur de décision ; effet « wow » immédiat).
3. **#4 Wrapped + stories** (rétention + acquisition virale).
4. **#3 IA conversationnelle** (moat + monétisation vulu+), qui débloque ensuite anti-spoiler IA et résumés de goût.

> Principe : chaque feature ci-dessus est cadrable en sous-projet `spec → plan → impl` séparé,
> en respectant l'archi hexagonale (toute dépendance externe — LLM, embeddings — derrière un port).
