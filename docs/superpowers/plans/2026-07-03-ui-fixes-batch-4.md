# Batch 4 — Teaser communauté proéminent, édition de collection, drag vitrine — Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rendre le teaser « Créer une communauté avec vulu+ » proéminent (desktop + mobile), permettre de renommer/éditer une collection (nom + description), et réordonner les affiches de la vitrine par glisser-déposer tactile.

**Architecture :** App Next.js 16 (App Router). Features quasi exclusivement front : les endpoints backend nécessaires existent déjà (`PATCH /api/lists/[id]` → `updateList` ; `PUT /api/me/showcase` → `updateShowcase`). Aucune modification domaine/application.

**Tech Stack :** Next.js 16.2.9, React 19, Tailwind v4, TypeScript strict, @dnd-kit (drag tactile).

## Global Constraints

- Aucune mention IA / Claude / superpowers dans le code, l'app ou les commits ; aucun co-auteur Claude.
- Ne jamais toucher au dossier `lechatonfat/`.
- Architecture hexagonale : toute dépendance externe derrière un port ; le domaine ne connaît aucun driver/SDK.
- Aucun secret en dur ; validation des entrées aux frontières ; typage strict, pas de `any`.
- Commits fréquents, un par tâche, directement sur `master`.
- Vérifier avant de conclure : `npx tsc --noEmit` propre + `npx vitest run` vert.

## File Structure

- `src/app/communautes/CommunitiesClient.tsx` — hero teaser vulu+ (F1).
- `src/components/ListDetailModal.tsx` — édition nom + description (F2).
- `src/components/ProfileTabs.tsx` — grilles sortables @dnd-kit dans `ShowcaseManager` (F3).
- `package.json` / `package-lock.json` — dépendance @dnd-kit (F3).

---

## Task F1 : Teaser communauté vulu+ proéminent

**Files:**
- Modify: `src/app/communautes/CommunitiesClient.tsx`

**Contexte :** le bloc actuel (`!plus`) est un `<Link>` dégradé discret. On le remplace par un hero plus grand avec grande typo de fond, lisible desktop + mobile, réservé aux non-vulu+.

- [ ] **Step 1 : Remplacer le teaser par un hero proéminent**

Dans `src/app/communautes/CommunitiesClient.tsx`, remplacer le bloc existant :

```tsx
      {!plus && (
        <Link href="/plus" className="relative mb-6 block overflow-hidden rounded-3xl bg-gradient-to-br from-[var(--color-primary)] to-[var(--color-accent)] p-8 text-white shadow-[0_8px_30px_rgba(0,0,0,0.12)]">
          <span aria-hidden className="pointer-events-none absolute -right-6 -top-8 select-none font-display text-[7rem] font-black leading-none text-white/10">vulu+</span>
          <p className="relative font-display text-2xl font-black leading-tight sm:text-3xl">Crée ta communauté<br />avec vulu+</p>
          <p className="relative mt-2 max-w-sm text-sm text-white/85">Rassemble tes proches autour de vos films, séries et livres. Réservé aux membres vulu+.</p>
          <span className="relative mt-4 inline-flex items-center gap-1.5 rounded-full bg-white px-4 py-2 text-sm font-semibold text-[var(--color-primary)]">
            <Icon name="lock" size={16} /> Débloquer avec vulu+
          </span>
        </Link>
      )}
```

par :

```tsx
      {!plus && (
        <Link href="/plus" className="relative mb-6 flex min-h-52 flex-col justify-end overflow-hidden rounded-3xl bg-gradient-to-br from-[var(--color-primary)] to-[var(--color-accent)] p-6 text-white shadow-[0_10px_40px_rgba(0,0,0,0.15)] transition-transform active:scale-[0.99] sm:min-h-64 sm:p-8">
          <span aria-hidden className="pointer-events-none absolute -right-4 -top-6 select-none font-display text-[28vw] font-black leading-[0.8] tracking-tighter text-white/10 sm:-top-10 sm:text-[12rem]">vulu+</span>
          <p className="relative font-display text-3xl font-black leading-[1.05] sm:text-5xl">Créer une communauté<br /><span className="text-white/90">avec vulu+</span></p>
          <p className="relative mt-3 max-w-md text-sm text-white/85 sm:text-base">Rassemble tes proches autour de vos films, séries et livres. La création de communautés est réservée aux membres vulu+.</p>
          <span className="relative mt-5 inline-flex w-fit items-center gap-1.5 rounded-full bg-white px-5 py-2.5 text-sm font-bold text-[var(--color-primary)] shadow-md">
            <Icon name="lock" size={16} /> Débloquer avec vulu+
          </span>
        </Link>
      )}
```

- [ ] **Step 2 : Vérifier**

Run: `npx tsc --noEmit`
Expected: aucune sortie. Manuel : en compte non-vulu+, la page Communautés affiche un grand hero avec « vulu+ » en filigrane de fond, accroche « Créer une communauté avec vulu+ », lisible en desktop (≥ sm) et mobile (375px), cliquable vers `/plus`. En compte vulu+ : pas de hero, bouton « Créer » conservé.

- [ ] **Step 3 : Commit**

```bash
git add src/app/communautes/CommunitiesClient.tsx
git commit -m "feat(vulu): communautés — hero proéminent « Créer une communauté avec vulu+ » (non-plus)"
```

---

## Task F2 : Renommer / éditer une collection

**Files:**
- Modify: `src/components/ListDetailModal.tsx`

**Contexte :** le backend `PATCH /api/lists/[id]` (via `updateList`) accepte `{ name, kind, description, visibility }` (schéma `createListSchema` : `name` 1–60, `description` ≤ 300 nullable). `ListDetailModal` charge déjà `list: List` et possède `refresh()`. On ajoute un formulaire d'édition inline (nom + description) en mode `editable`.

**Interfaces:**
- Consumes: `api.patch<T>(path, body)` (déjà présent) ; `refresh()` (déjà présent) ; `list: List` (chargé).

- [ ] **Step 1 : État d'édition + handler de sauvegarde**

Dans `src/components/ListDetailModal.tsx`, ajouter les états près des autres (après `const [scanning, setScanning] = useState(false);`) :

```tsx
  const [editingMeta, setEditingMeta] = useState(false);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
```

Ajouter le handler (près de `uploadBanner`) :

```tsx
  function openMetaEdit() {
    if (!list) return;
    setEditName(list.name);
    setEditDescription(list.description ?? "");
    setEditingMeta(true);
  }

  async function saveMeta() {
    if (!list) return;
    const name = editName.trim();
    if (name.length < 1 || name.length > 60) { toast("Nom : 1 à 60 caractères", "error"); return; }
    try {
      await api.patch(`/api/lists/${listId}`, {
        name,
        kind: list.kind,
        description: editDescription.trim() ? editDescription.trim().slice(0, 300) : null,
        visibility: list.visibility,
      });
      setEditingMeta(false);
      await refresh();
      toast("Collection mise à jour");
    } catch (e) {
      toast(e instanceof ApiError ? e.message : "Modification impossible", "error");
    }
  }
```

- [ ] **Step 2 : Bouton crayon + formulaire inline**

Dans le corps du `Modal`, juste après l'input caché de bannière (`<input ref={bannerInput} .../>`) et avant la ligne `{list?.description && <p ...>`, insérer le bloc d'édition (mode `editable`) :

```tsx
      {editable && list && (
        editingMeta ? (
          <div className="mb-3 flex flex-col gap-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] p-3">
            <input value={editName} onChange={(e) => setEditName(e.target.value)} maxLength={60} placeholder="Nom de la collection"
              className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm font-semibold" />
            <textarea value={editDescription} onChange={(e) => setEditDescription(e.target.value)} maxLength={300} rows={2} placeholder="Description (optionnel)"
              className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm" />
            <div className="flex gap-2">
              <button onClick={saveMeta} className="rounded-full bg-[var(--color-primary)] px-4 py-1.5 text-sm font-semibold text-white">Enregistrer</button>
              <button onClick={() => setEditingMeta(false)} className="rounded-full border border-[var(--color-border)] px-4 py-1.5 text-sm font-semibold">Annuler</button>
            </div>
          </div>
        ) : (
          <button onClick={openMetaEdit} className="mb-3 flex items-center gap-1.5 rounded-full border border-[var(--color-border)] px-3 py-1.5 text-sm font-semibold text-[var(--color-text-muted)] transition-colors hover:text-[var(--color-text)]">
            <Icon name="settings" size={15} /> Renommer / éditer
          </button>
        )
      )}
```

(Le titre de la modale reste `list?.name` et se met à jour après `refresh()`.)

- [ ] **Step 3 : Vérifier**

Run: `npx tsc --noEmit`
Expected: aucune sortie. Manuel : ouvrir une collection (éditable) → « Renommer / éditer » → changer le nom et la description → « Enregistrer » → le titre et la description se mettent à jour ; nom vide refusé.

- [ ] **Step 4 : Commit**

```bash
git add src/components/ListDetailModal.tsx
git commit -m "feat(vulu): collections — renommer et éditer la description depuis le détail"
```

---

## Task F3 : Réordonnancement de la vitrine par glisser-déposer

**Files:**
- Modify: `src/components/ProfileTabs.tsx`, `package.json`, `package-lock.json`

**Contexte :** `ShowcaseManager` persiste l'ordre via `persist(next)` → `PUT /api/me/showcase`. L'ordre du tableau `sc[cat]` EST l'ordre affiché. On rend chaque catégorie *sortable* avec @dnd-kit.

**Interfaces:**
- Consumes: `persist(next: Showcase): Promise<void>`, `removeFrom(cat, workId)`, `sc: Showcase` (dans `ShowcaseManager`).

- [ ] **Step 1 : Installer @dnd-kit**

Run: `npm install @dnd-kit/core@^6 @dnd-kit/sortable@^8 @dnd-kit/utilities@^3`
Expected: installation réussie ; `package.json` liste `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities`.

- [ ] **Step 2 : Vérifier que le build résout la lib**

Run: `npx tsc --noEmit`
Expected: aucune sortie (les paquets fournissent leurs types).

- [ ] **Step 3 : Imports @dnd-kit dans ProfileTabs**

Dans `src/components/ProfileTabs.tsx`, ajouter en haut (après les imports existants) :

```tsx
import { DndContext, PointerSensor, useSensor, useSensors, closestCenter, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, useSortable, arrayMove, rectSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
```

- [ ] **Step 4 : Composant d'affiche sortable**

Toujours dans `src/components/ProfileTabs.tsx`, ajouter un composant (au niveau module, avant `ShowcaseManager`) qui rend une affiche déplaçable avec bouton retirer :

```tsx
function SortablePoster({ id, posterUrl, title, onRemove }: { id: string; posterUrl: string | null; title: string; onRemove: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
    touchAction: "none",
  };
  return (
    <div ref={setNodeRef} style={style} className="group relative">
      <div {...attributes} {...listeners}
        className="aspect-[2/3] cursor-grab overflow-hidden rounded-md bg-[var(--color-border)] active:cursor-grabbing"
        style={posterUrl ? { backgroundImage: `url("${posterUrl}")`, backgroundSize: "cover", backgroundPosition: "center" } : undefined}
        aria-label={`Déplacer ${title}`} />
      <button onClick={onRemove} aria-label={`Retirer ${title}`} className="absolute right-0.5 top-0.5 rounded-full bg-black/65 p-0.5 text-white">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M6 6l12 12M18 6 6 18" /></svg>
      </button>
    </div>
  );
}
```

- [ ] **Step 5 : Rendre chaque catégorie sortable**

Dans `ShowcaseManager` (`src/components/ProfileTabs.tsx`), déclarer les capteurs en début de composant (après les `useState`) :

```tsx
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  function reorder(cat: Cat, event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const items = sc[cat];
    const oldIndex = items.findIndex((x) => x.workId === active.id);
    const newIndex = items.findIndex((x) => x.workId === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    persist({ ...sc, [cat]: arrayMove(items, oldIndex, newIndex) });
  }
```

Puis remplacer la grille de chaque catégorie. Repérer le bloc :

```tsx
          <div className="grid grid-cols-5 gap-2">
            {sc[cat].map((wk) => (
              <div key={wk.workId} className="group relative">
                <div className="aspect-[2/3] overflow-hidden rounded-md bg-[var(--color-border)]" style={wk.posterUrl ? { backgroundImage: `url(${wk.posterUrl})`, backgroundSize: "cover" } : undefined} />
                <button onClick={() => removeFrom(cat, wk.workId)} aria-label={`Retirer ${wk.title}`} className="absolute right-0.5 top-0.5 rounded-full bg-black/65 p-0.5 text-white">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M6 6l12 12M18 6 6 18" /></svg>
                </button>
              </div>
            ))}
            {sc[cat].length === 0 && <p className="col-span-5 text-xs text-[var(--color-text-muted)]">Rien pour l’instant.</p>}
          </div>
```

et le remplacer par :

```tsx
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={(e) => reorder(cat, e)}>
            <SortableContext items={sc[cat].map((x) => x.workId)} strategy={rectSortingStrategy}>
              <div className="grid grid-cols-5 gap-2">
                {sc[cat].map((wk) => (
                  <SortablePoster key={wk.workId} id={wk.workId} posterUrl={wk.posterUrl} title={wk.title} onRemove={() => removeFrom(cat, wk.workId)} />
                ))}
                {sc[cat].length === 0 && <p className="col-span-5 text-xs text-[var(--color-text-muted)]">Rien pour l’instant.</p>}
              </div>
            </SortableContext>
          </DndContext>
```

- [ ] **Step 6 : Vérifier**

Run: `npx tsc --noEmit && npx vitest run`
Expected: propre + vert. Manuel (desktop + mobile réel) : ouvrir « Éditer ma vitrine » → glisser une affiche dans une catégorie pour la réordonner → l'ordre est conservé après fermeture/réouverture (persisté). Le bouton retirer (×) fonctionne toujours ; un simple tap ne déclenche pas un drag (seuil 6px).

- [ ] **Step 7 : Commit**

```bash
git add src/components/ProfileTabs.tsx package.json package-lock.json
git commit -m "feat(vulu): vitrine — réordonnancement des affiches par glisser-déposer (@dnd-kit)"
```

---

## Self-Review (couverture spec)

| Demande utilisateur | Tâche |
|---|---|
| Onglet Communauté : « Créer une communauté avec vulu+ » en grand (desktop + mobile) | F1 |
| Renommer une collection à tout moment (+ description) | F2 |
| Vitrine : drag des affiches pour les ordonner | F3 |

Toutes les demandes du batch sont couvertes. Chaque tâche est indépendamment testable et livrable.

## Notes pour la session d'exécution

- Base de dev : MongoDB Atlas. Serveur : `npm run dev`.
- F2 : `updateList` exige tous les champs (`name, kind, description, visibility`) via `createListSchema` — on renvoie `kind`/`visibility` inchangés depuis la liste chargée.
- F3 : @dnd-kit ajoute une dépendance (déploiement Vercel installe automatiquement). `touchAction: "none"` sur la poignée est requis pour le drag tactile. Le drag est surtout à valider sur mobile réel.
- Aucune modification backend dans ce batch : les endpoints/use-cases sont déjà en place et testés.
