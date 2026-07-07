"use client";
import { useEffect, useRef, useState } from "react";
import { RatingStars } from "./RatingStars";

// UI optimiste : le curseur/les étoiles réagissent instantanément (état local), et on n'envoie
// en base (onChange) qu'une fois la note stabilisée — au relâchement du curseur, au clic d'une
// étoile, ou après une courte inactivité. Évite la rafale de requêtes pendant le glissement.
export function RatingSlider({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const [local, setLocal] = useState(value);
  const dragging = useRef(false);
  const committed = useRef(value);
  const commitTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Se resynchronise sur la valeur serveur tant que l'utilisateur ne manipule pas le curseur.
  useEffect(() => {
    if (dragging.current) return;
    setLocal(value);
    committed.current = value;
  }, [value]);

  function commit(v: number) {
    if (commitTimer.current) { clearTimeout(commitTimer.current); commitTimer.current = null; }
    dragging.current = false;
    if (v === committed.current) return;
    committed.current = v;
    onChange(v);
  }

  function preview(v: number) {
    dragging.current = true;
    setLocal(v);
    // Filet de sécurité (ex. clavier sans relâchement détecté) : commit après stabilisation.
    if (commitTimer.current) clearTimeout(commitTimer.current);
    commitTimer.current = setTimeout(() => commit(v), 500);
  }

  const label = `${local.toFixed(1).replace(".", ",")}/5`;
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-3">
        <RatingStars value={local} size={28} onSelect={(v) => { setLocal(v); commit(v); }} />
        <span className="text-xl font-extrabold text-[var(--color-text)]">{label}</span>
      </div>
      <input
        type="range" min={0} max={5} step={0.1} value={local} role="slider"
        aria-label="Note sur 5" aria-valuetext={label}
        onChange={(e) => preview(Number(e.target.value))}
        onPointerUp={(e) => commit(Number((e.target as HTMLInputElement).value))}
        onKeyUp={(e) => commit(Number((e.target as HTMLInputElement).value))}
        onBlur={(e) => commit(Number(e.target.value))}
        className="w-full accent-[var(--color-primary)]"
      />
    </div>
  );
}
