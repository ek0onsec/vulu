"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/api-client";
import { toast } from "@/lib/toast";
import { Avatar } from "@/components/Avatar";
import type { InviteInfo } from "@/server/application/invite";

export function InviteSection() {
  const [info, setInfo] = useState<InviteInfo | null>(null);

  useEffect(() => {
    api.get<InviteInfo>("/api/me/invite").then(setInfo).catch(() => setInfo(null));
  }, []);

  async function copy() {
    if (!info) return;
    try { await navigator.clipboard.writeText(info.code); toast("Code copié"); }
    catch { toast("Copie impossible", "error"); }
  }

  return (
    <>
      <h2 className="mb-4 font-display text-xl font-bold">Parrainage</h2>
      <p className="mb-4 text-sm text-[var(--color-text-muted)]">
        Partage ton code pour inviter de nouveaux membres sur vulu.
      </p>
      {info === null ? (
        <div className="h-12 animate-pulse rounded-xl bg-[var(--color-border)]" />
      ) : (
        <>
          <div className="mb-5 flex items-center gap-2">
            <span className="flex-1 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] px-4 py-2.5 font-mono text-lg font-bold tracking-widest">
              {info.code}
            </span>
            <button onClick={copy} aria-label="Copier le code"
              className="flex items-center gap-1.5 rounded-full bg-[var(--color-primary)] px-4 py-2.5 text-sm font-semibold text-white">
              Copier
            </button>
          </div>
          <p className="mb-3 text-sm font-semibold">
            {info.invitedCount === 0
              ? "Personne n'a encore utilisé ton code."
              : `${info.invitedCount} personne${info.invitedCount > 1 ? "s" : ""} inscrite${info.invitedCount > 1 ? "s" : ""} grâce à ton code`}
          </p>
          <ul className="flex flex-col gap-1">
            {info.invitees.map((u) => (
              <li key={u.id} className="flex items-center gap-3 rounded-xl p-2">
                <Avatar name={u.displayName} src={u.avatarUrl} size={36} />
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold">{u.displayName}</span>
                  <span className="block truncate text-xs text-[var(--color-text-muted)]">@{u.username}</span>
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </>
  );
}
