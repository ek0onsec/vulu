"use client";
import { useEffect, useState } from "react";
import { Icon } from "./Icon";
import { SearchPanel } from "./SearchPanel";
import type { Domain } from "@/server/domain/entities";

/** Recherche mobile : pilule flottante sticky (sous les onglets) + overlay plein écran au tap. */
export function SearchIsland({ activeTabs }: { activeTabs: Domain[] }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      {/* Pilule épinglée sous les onglets : enfant direct du flux du feed pour que `sticky` ait de la course → suit le scroll, superposée, sans chevaucher les onglets. */}
      <button onClick={() => setOpen(true)}
        className="sticky top-28 z-20 mb-3 flex w-full items-center gap-2 rounded-full border border-[var(--color-border)] bg-[var(--color-surface)]/95 px-4 py-2.5 text-sm text-[var(--color-text-muted)] shadow-md backdrop-blur md:hidden">
        <Icon name="search" size={18} /> Rechercher une œuvre, @un membre…
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex flex-col bg-[var(--color-bg)] md:hidden">
          <div className="flex items-center gap-2 border-b border-[var(--color-border)] px-3 py-2">
            <button onClick={() => setOpen(false)} aria-label="Fermer la recherche" className="rounded-full p-2 hover:bg-[var(--color-border)]">
              <Icon name="back" size={22} />
            </button>
            <span className="font-semibold">Recherche</span>
          </div>
          <div className="flex-1 overflow-y-auto p-3">
            <SearchPanel activeTabs={activeTabs} autoFocus />
          </div>
        </div>
      )}
    </>
  );
}
