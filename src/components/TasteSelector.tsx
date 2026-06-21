"use client";
import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/api-client";
import { Avatar } from "./Avatar";
import { personHref } from "@/lib/person";
import type { Tastes, PersonRole } from "@/server/domain/entities";
import type { Genre, Person } from "@/server/ports/catalog";

const chipBase = "rounded-full border px-3 py-1.5 text-sm transition-colors";

function GenreChips({ genres, selected, onToggle }: { genres: Genre[]; selected: number[]; onToggle: (id: number) => void }) {
  if (genres.length === 0) return <p className="text-sm text-[var(--color-text-muted)]">Chargement…</p>;
  return (
    <div className="flex flex-wrap gap-2">
      {genres.map((g) => {
        const on = selected.includes(g.id);
        return (
          <button type="button" key={g.id} onClick={() => onToggle(g.id)}
            className={`${chipBase} ${on ? "border-[var(--color-primary)] bg-[var(--color-primary)] text-white" : "border-[var(--color-border)] text-[var(--color-text)] hover:border-[var(--color-primary)]"}`}>
            {on ? "✓ " : ""}{g.name}
          </button>
        );
      })}
    </div>
  );
}

export function TasteSelector({ value, onChange, showBooks = false, showPeople = false }: {
  value: Tastes; onChange: (t: Tastes) => void; showBooks?: boolean; showPeople?: boolean;
}) {
  const [filmGenres, setFilmGenres] = useState<Genre[]>([]);
  const [bookGenres, setBookGenres] = useState<Genre[]>([]);
  const bookIds = value.bookGenreIds ?? [];

  const [pq, setPq] = useState("");
  const [pDomain, setPDomain] = useState<"films" | "books">("films");
  const [people, setPeople] = useState<Person[]>([]);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    api.get<{ genres: Genre[] }>("/api/catalog/genres?domain=films").then((d) => setFilmGenres(d.genres)).catch(() => setFilmGenres([]));
    if (showBooks) api.get<{ genres: Genre[] }>("/api/catalog/genres?domain=books").then((d) => setBookGenres(d.genres)).catch(() => setBookGenres([]));
  }, [showBooks]);

  useEffect(() => {
    if (!showPeople) return;
    if (timer.current) clearTimeout(timer.current);
    if (!pq.trim()) { setPeople([]); return; }
    timer.current = setTimeout(async () => {
      try { const d = await api.get<{ results: Person[] }>(`/api/catalog/people?q=${encodeURIComponent(pq)}&domain=${pDomain}`); setPeople(d.results); }
      catch { setPeople([]); }
    }, 300);
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [pq, pDomain, showPeople]);

  const toggleFilm = (id: number) => onChange({ ...value, filmGenreIds: value.filmGenreIds.includes(id) ? value.filmGenreIds.filter((g) => g !== id) : [...value.filmGenreIds, id] });
  const toggleBook = (id: number) => onChange({ ...value, bookGenreIds: bookIds.includes(id) ? bookIds.filter((g) => g !== id) : [...bookIds, id] });

  function hasPerson(p: { tmdbId: number; role: PersonRole }) { return value.people.some((x) => x.tmdbId === p.tmdbId && x.role === p.role); }
  function togglePerson(p: Person) {
    const exists = hasPerson(p);
    onChange({ ...value, people: exists ? value.people.filter((x) => !(x.tmdbId === p.tmdbId && x.role === p.role)) : [...value.people, { tmdbId: p.tmdbId, name: p.name, role: p.role }] });
  }

  const roleLabel: Record<PersonRole, string> = { actor: "acteur·rice", director: "réalisateur·rice", author: "auteur·rice" };

  return (
    <div className="flex flex-col gap-5">
      <div>
        <div className="mb-2 flex items-center justify-between text-sm font-semibold">
          <span>Genres films &amp; séries</span>
          <span className={value.filmGenreIds.length >= 3 ? "text-[var(--color-primary)]" : "text-[var(--color-text-muted)]"}>{value.filmGenreIds.length} / min. 3</span>
        </div>
        <GenreChips genres={filmGenres} selected={value.filmGenreIds} onToggle={toggleFilm} />
      </div>

      {showBooks && (
        <div>
          <p className="mb-2 text-sm font-semibold">Genres littéraires</p>
          <GenreChips genres={bookGenres} selected={bookIds} onToggle={toggleBook} />
        </div>
      )}

      {showPeople && (
        <div>
          <p className="mb-2 text-sm font-semibold">Acteurs, réalisateurs &amp; auteurs favoris</p>
          {value.people.length > 0 && (
            <div className="mb-2 flex flex-wrap gap-2">
              {value.people.map((p) => (
                <span key={`${p.role}-${p.tmdbId}`}
                  className="flex items-center gap-1.5 rounded-full bg-[color-mix(in_srgb,var(--color-primary)_14%,transparent)] px-3 py-1 text-sm text-[var(--color-primary)]">
                  <a href={personHref({ tmdbId: p.tmdbId, name: p.name }, p.role === "author" ? "book" : "tmdb")} target="_blank" rel="noopener noreferrer" className="hover:underline">{p.name}</a>
                  <button type="button" onClick={() => togglePerson({ ...p, profileUrl: null })} aria-label={`Retirer ${p.name}`} className="text-xs">✕</button>
                </span>
              ))}
            </div>
          )}
          <div className="mb-2 flex gap-2">
            {(["films", "books"] as const).map((d) => (
              <button type="button" key={d} onClick={() => { setPDomain(d); setPeople([]); }}
                className={`rounded-full border px-3 py-1 text-xs font-semibold ${pDomain === d ? "border-[var(--color-primary)] bg-[var(--color-primary)] text-white" : "border-[var(--color-border)] text-[var(--color-text-muted)]"}`}>
                {d === "films" ? "Acteurs / Réals" : "Auteurs"}
              </button>
            ))}
          </div>
          <input value={pq} onChange={(e) => setPq(e.target.value)} placeholder={pDomain === "films" ? "Chercher un acteur, un réalisateur…" : "Chercher un auteur…"}
            className="w-full rounded-full border border-[var(--color-border)] bg-[var(--color-bg)] px-4 py-2 text-sm" />
          {people.length > 0 && (
            <ul className="mt-2 flex flex-col gap-1">
              {people.slice(0, 8).map((p) => {
                const on = hasPerson(p);
                return (
                  <li key={`${p.role}-${p.tmdbId}`}>
                    <button type="button" onClick={() => togglePerson(p)} className={`flex w-full items-center gap-2 rounded-xl border p-2 text-left ${on ? "border-[var(--color-primary)]" : "border-[var(--color-border)]"}`}>
                      <Avatar name={p.name} src={p.profileUrl} size={28} />
                      <span className="flex-1 text-sm">{p.name} <span className="text-xs text-[var(--color-text-muted)]">· {roleLabel[p.role]}</span></span>
                      {on && <span className="text-sm text-[var(--color-primary)]">✓</span>}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
