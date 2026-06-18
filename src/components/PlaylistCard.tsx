"use client";
import { Icon } from "./Icon";
import type { LibraryPlaylist } from "@/server/application/library";

function Cover({ covers }: { covers: string[] }) {
  if (covers.length === 0) {
    return <div className="flex aspect-square items-center justify-center rounded-xl bg-gradient-to-br from-[var(--color-primary)] to-[var(--color-accent)] text-white"><Icon name="lists" size={28} /></div>;
  }
  if (covers.length < 4) {
    return <div className="aspect-square overflow-hidden rounded-xl bg-[var(--color-border)]" style={{ backgroundImage: `url(${covers[0]})`, backgroundSize: "cover", backgroundPosition: "center" }} />;
  }
  return (
    <div className="grid aspect-square grid-cols-2 grid-rows-2 overflow-hidden rounded-xl">
      {covers.slice(0, 4).map((c, i) => (
        <div key={i} className="bg-[var(--color-border)]" style={{ backgroundImage: `url(${c})`, backgroundSize: "cover", backgroundPosition: "center" }} />
      ))}
    </div>
  );
}

export function PlaylistCard({ playlist, onOpen }: { playlist: LibraryPlaylist; onOpen: () => void }) {
  return (
    <button onClick={onOpen} className="group text-left">
      <div className="transition-transform group-hover:scale-[1.03]"><Cover covers={playlist.covers} /></div>
      <p className="mt-2 truncate text-sm font-semibold">{playlist.name}</p>
      <p className="text-xs text-[var(--color-text-muted)]">{playlist.count} œuvre{playlist.count > 1 ? "s" : ""} · {playlist.visibility === "public" ? "public" : "privé"}</p>
    </button>
  );
}
