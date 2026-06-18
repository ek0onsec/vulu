"use client";
import { useState } from "react";
import Link from "next/link";
import { Modal } from "./Modal";
import { Icon } from "./Icon";
import { api } from "@/lib/api-client";
import { toast } from "@/lib/toast";
import type { List, WorkSource, WorkType } from "@/server/domain/entities";

interface Ref { source: WorkSource; externalId: string; type: WorkType }

export function AddToListButton({ workRef, workId }: { workRef: Ref; workId: string }) {
  const [open, setOpen] = useState(false);
  const [lists, setLists] = useState<List[] | null>(null);
  const [pending, setPending] = useState<Set<string>>(new Set());

  async function openModal() {
    setOpen(true);
    if (!lists) {
      try { setLists((await api.get<{ lists: List[] }>("/api/lists")).lists); }
      catch { setLists([]); }
    }
  }

  function isMember(l: List) { return l.workIds.includes(workId); }

  async function toggle(l: List) {
    if (pending.has(l.id)) return;
    setPending((s) => new Set(s).add(l.id));
    const member = isMember(l);
    try {
      const { list } = member
        ? await api.del<{ list: List }>(`/api/lists/${l.id}/items`, { workId })
        : await api.post<{ list: List }>(`/api/lists/${l.id}/items`, workRef);
      setLists((prev) => prev?.map((x) => (x.id === list.id ? list : x)) ?? null);
      toast(member ? `Retiré de « ${l.name} »` : `Ajouté à « ${l.name} »`);
    } catch {
      toast("Action impossible", "error");
    } finally {
      setPending((s) => { const n = new Set(s); n.delete(l.id); return n; });
    }
  }

  return (
    <>
      <button onClick={openModal}
        className="flex items-center gap-1.5 rounded-full border border-[var(--color-border)] px-4 py-2 text-sm font-semibold text-[var(--color-text)] transition-colors hover:border-[var(--color-primary)] hover:text-[var(--color-primary)]">
        <Icon name="lists" size={18} /> Ajouter à une liste
      </button>

      <Modal open={open} onClose={() => setOpen(false)} title="Ajouter à une liste">
        {lists === null && <p className="text-sm text-[var(--color-text-muted)]">Chargement…</p>}
        {lists?.length === 0 && (
          <p className="text-sm text-[var(--color-text-muted)]">
            Aucune liste. <Link href="/lists" className="font-semibold text-[var(--color-primary)]">Créer une liste</Link>.
          </p>
        )}
        <ul className="flex flex-col gap-2">
          {lists?.map((l) => {
            const member = isMember(l);
            return (
              <li key={l.id}>
                <button onClick={() => toggle(l)} disabled={pending.has(l.id)}
                  className={`flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-left transition-colors disabled:opacity-50 ${
                    member ? "border-[var(--color-primary)] bg-[color-mix(in_srgb,var(--color-primary)_10%,transparent)]" : "border-[var(--color-border)] hover:border-[var(--color-primary)]"
                  }`}>
                  <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border ${member ? "border-[var(--color-primary)] bg-[var(--color-primary)] text-white" : "border-[var(--color-border)] text-transparent"}`}>
                    <Icon name="check" size={14} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold">{l.name}</span>
                    <span className="block text-xs text-[var(--color-text-muted)]">{l.workIds.length} œuvres · {l.visibility === "public" ? "public" : "privé"}</span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </Modal>
    </>
  );
}
