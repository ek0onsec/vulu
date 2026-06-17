"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/api-client";
import { Modal } from "@/components/Modal";
import { Icon } from "@/components/Icon";
import { ListDetailModal } from "@/components/ListDetailModal";
import type { List, ListVisibility } from "@/server/domain/entities";

type Editing = { mode: "create" } | { mode: "edit"; list: List };

export function ListsClient() {
  const [lists, setLists] = useState<List[]>([]);
  const [editing, setEditing] = useState<Editing | null>(null);
  const [viewing, setViewing] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [visibility, setVisibility] = useState<ListVisibility>("public");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.get<{ lists: List[] }>("/api/lists").then((d) => setLists(d.lists)).catch(() => setLists([]));
  }, []);

  function openCreate() {
    setName(""); setDescription(""); setVisibility("public"); setEditing({ mode: "create" });
  }
  function openEdit(list: List) {
    setName(list.name); setDescription(list.description ?? ""); setVisibility(list.visibility);
    setEditing({ mode: "edit", list });
  }

  async function submit() {
    if (!name.trim() || !editing) return;
    setBusy(true);
    try {
      const payload = { name, domain: "films", description: description.trim() || null, visibility };
      if (editing.mode === "create") {
        const { list } = await api.post<{ list: List }>("/api/lists", payload);
        setLists((prev) => [list, ...prev]);
      } else {
        const { list } = await api.patch<{ list: List }>(`/api/lists/${editing.list.id}`, payload);
        setLists((prev) => prev.map((l) => (l.id === list.id ? list : l)));
      }
      setEditing(null);
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    await api.del(`/api/lists/${id}`);
    setLists((prev) => prev.filter((l) => l.id !== id));
  }

  return (
    <>
      <div className="mb-5 flex items-center justify-between">
        <h1 className="font-display text-2xl font-bold">Mes listes</h1>
        <button onClick={openCreate}
          className="flex items-center gap-1.5 rounded-full bg-[var(--color-primary)] px-4 py-2 text-sm font-semibold text-white">
          <Icon name="plus" size={18} /> Nouvelle liste
        </button>
      </div>

      {lists.length === 0 && <p className="text-sm text-[var(--color-text-muted)]">Aucune liste. Crée ta première collection thématique.</p>}
      <div className="flex flex-col gap-3">
        {lists.map((l) => (
          <div key={l.id} className="flex items-center gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 transition-colors hover:border-[var(--color-primary)]">
            <button onClick={() => setViewing(l.id)} className="min-w-0 flex-1 text-left" aria-label={`Ouvrir ${l.name}`}>
              <p className="font-semibold">{l.name}</p>
              {l.description && <p className="truncate text-sm text-[var(--color-text)]">{l.description}</p>}
              <p className="text-xs text-[var(--color-text-muted)]">{l.workIds.length} œuvres · {l.visibility === "public" ? "public" : "privé"}</p>
            </button>
            <button onClick={() => openEdit(l)} aria-label="Éditer la liste"
              className="rounded-full p-2 text-[var(--color-text-muted)] transition-colors hover:bg-[var(--color-border)] hover:text-[var(--color-primary)]">
              <Icon name="settings" size={18} />
            </button>
            <button onClick={() => remove(l.id)} className="text-sm text-[var(--color-text-muted)] transition-colors hover:text-red-500">Supprimer</button>
          </div>
        ))}
      </div>

      <Modal open={editing !== null} onClose={() => setEditing(null)}
        title={editing?.mode === "edit" ? "Éditer la liste" : "Nouvelle liste"}>
        <div className="flex flex-col gap-4">
          <label className="text-sm font-semibold">Nom
            <input value={name} onChange={(e) => setName(e.target.value)} autoFocus placeholder="ex. SF culte"
              className="mt-1 w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] px-4 py-2.5 text-sm font-normal" />
          </label>
          <label className="text-sm font-semibold">Description <span className="font-normal text-[var(--color-text-muted)]">(optionnel)</span>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} maxLength={300} rows={2}
              className="mt-1 w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] px-4 py-2.5 text-sm font-normal" />
          </label>
          <div>
            <p className="mb-2 text-sm font-semibold">Visibilité</p>
            <div className="flex gap-2">
              {(["public", "private"] as ListVisibility[]).map((v) => (
                <button key={v} onClick={() => setVisibility(v)}
                  className={`rounded-full border px-4 py-1.5 text-sm ${visibility === v ? "border-[var(--color-primary)] bg-[var(--color-primary)] text-white" : "border-[var(--color-border)] text-[var(--color-text-muted)]"}`}>
                  {v === "public" ? "Public" : "Privé"}
                </button>
              ))}
            </div>
          </div>
          <button onClick={submit} disabled={busy || !name.trim()}
            className="rounded-full bg-[var(--color-primary)] py-2.5 text-sm font-semibold text-white disabled:opacity-50">
            {busy ? "…" : editing?.mode === "edit" ? "Enregistrer" : "Créer la liste"}
          </button>
        </div>
      </Modal>

      {viewing && (
        <ListDetailModal
          listId={viewing}
          onClose={() => setViewing(null)}
          onChanged={(count) => setLists((prev) => prev.map((l) => (l.id === viewing ? { ...l, workIds: Array.from({ length: count }, (_, i) => l.workIds[i] ?? String(i)) } : l)))}
        />
      )}
    </>
  );
}
