"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/api-client";
import type { List } from "@/server/domain/entities";

export function ListsClient() {
  const [lists, setLists] = useState<List[]>([]);
  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    api.get<{ lists: List[] }>("/api/lists").then((d) => setLists(d.lists)).catch(() => setLists([]));
  }, []);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setCreating(true);
    try {
      const { list } = await api.post<{ list: List }>("/api/lists", {
        name, domain: "films", description: null, visibility: "public",
      });
      setLists((prev) => [list, ...prev]);
      setName("");
    } finally {
      setCreating(false);
    }
  }

  async function remove(id: string) {
    await api.del(`/api/lists/${id}`);
    setLists((prev) => prev.filter((l) => l.id !== id));
  }

  return (
    <>
      <h1 className="font-display mb-4 text-2xl font-bold">Mes listes</h1>
      <form onSubmit={create} className="mb-6 flex gap-2">
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nouvelle liste (ex. SF culte)"
          className="flex-1 rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-2 text-sm" />
        <button disabled={creating} className="rounded-full bg-[var(--color-primary)] px-5 py-2 text-sm font-semibold text-white disabled:opacity-50">
          Créer
        </button>
      </form>

      {lists.length === 0 && <p className="text-sm text-[var(--color-text-muted)]">Aucune liste. Crée ta première collection thématique.</p>}
      <div className="flex flex-col gap-3">
        {lists.map((l) => (
          <div key={l.id} className="flex items-center justify-between rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
            <div>
              <p className="font-semibold">{l.name}</p>
              <p className="text-xs text-[var(--color-text-muted)]">{l.workIds.length} œuvres · {l.visibility === "public" ? "public" : "privé"}</p>
            </div>
            <button onClick={() => remove(l.id)} className="text-sm text-[var(--color-text-muted)] hover:text-red-500">Supprimer</button>
          </div>
        ))}
      </div>
    </>
  );
}
