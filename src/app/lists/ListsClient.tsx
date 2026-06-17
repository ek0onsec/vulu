"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/api-client";
import { Modal } from "@/components/Modal";
import { Icon } from "@/components/Icon";
import type { List, ListVisibility } from "@/server/domain/entities";

export function ListsClient() {
  const [lists, setLists] = useState<List[]>([]);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [visibility, setVisibility] = useState<ListVisibility>("public");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.get<{ lists: List[] }>("/api/lists").then((d) => setLists(d.lists)).catch(() => setLists([]));
  }, []);

  async function create() {
    if (!name.trim()) return;
    setBusy(true);
    try {
      const { list } = await api.post<{ list: List }>("/api/lists", { name, domain: "films", description: null, visibility });
      setLists((prev) => [list, ...prev]);
      setName(""); setVisibility("public"); setOpen(false);
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
        <button onClick={() => setOpen(true)}
          className="flex items-center gap-1.5 rounded-full bg-[var(--color-primary)] px-4 py-2 text-sm font-semibold text-white">
          <Icon name="plus" size={18} /> Nouvelle liste
        </button>
      </div>

      {lists.length === 0 && <p className="text-sm text-[var(--color-text-muted)]">Aucune liste. Crée ta première collection thématique.</p>}
      <div className="flex flex-col gap-3">
        {lists.map((l) => (
          <div key={l.id} className="flex items-center justify-between rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
            <div>
              <p className="font-semibold">{l.name}</p>
              <p className="text-xs text-[var(--color-text-muted)]">{l.workIds.length} œuvres · {l.visibility === "public" ? "public" : "privé"}</p>
            </div>
            <button onClick={() => remove(l.id)} className="text-sm text-[var(--color-text-muted)] transition-colors hover:text-red-500">Supprimer</button>
          </div>
        ))}
      </div>

      <Modal open={open} onClose={() => setOpen(false)} title="Nouvelle liste">
        <div className="flex flex-col gap-4">
          <label className="text-sm font-semibold">Nom
            <input value={name} onChange={(e) => setName(e.target.value)} autoFocus placeholder="ex. SF culte"
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
          <button onClick={create} disabled={busy || !name.trim()}
            className="rounded-full bg-[var(--color-primary)] py-2.5 text-sm font-semibold text-white disabled:opacity-50">
            {busy ? "…" : "Créer la liste"}
          </button>
        </div>
      </Modal>
    </>
  );
}
