"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/api-client";
import type { Tastes } from "@/server/domain/entities";
import type { Genre } from "@/server/ports/catalog";

export function TasteSelector({ value, onChange }: { value: Tastes; onChange: (t: Tastes) => void }) {
  const [genres, setGenres] = useState<Genre[]>([]);

  useEffect(() => {
    api.get<{ genres: Genre[] }>("/api/catalog/genres").then((d) => setGenres(d.genres)).catch(() => setGenres([]));
  }, []);

  function toggleGenre(id: number) {
    const has = value.filmGenreIds.includes(id);
    onChange({ ...value, filmGenreIds: has ? value.filmGenreIds.filter((g) => g !== id) : [...value.filmGenreIds, id] });
  }

  return (
    <div>
      <div className="mb-2 flex items-center justify-between text-sm font-semibold">
        <span>Genres que tu aimes</span>
        <span className={value.filmGenreIds.length >= 3 ? "text-[var(--color-primary)]" : "text-[var(--color-text-muted)]"}>
          {value.filmGenreIds.length} / min. 3
        </span>
      </div>
      <div className="flex flex-wrap gap-2">
        {genres.map((g) => {
          const on = value.filmGenreIds.includes(g.id);
          return (
            <button type="button" key={g.id} onClick={() => toggleGenre(g.id)}
              className={`rounded-full border px-3 py-1.5 text-sm transition-colors ${
                on ? "border-[var(--color-primary)] bg-[var(--color-primary)] text-white"
                   : "border-[var(--color-border)] text-[var(--color-text)] hover:border-[var(--color-primary)]"
              }`}>
              {on ? "✓ " : ""}{g.name}
            </button>
          );
        })}
        {genres.length === 0 && <p className="text-sm text-[var(--color-text-muted)]">Chargement des genres…</p>}
      </div>
    </div>
  );
}
