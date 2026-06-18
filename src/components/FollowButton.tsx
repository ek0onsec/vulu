"use client";
import { useState } from "react";
import { api } from "@/lib/api-client";
import { toast } from "@/lib/toast";

export function FollowButton({ username, initialFollowing, isPrivate = false, initialRequested = false }: {
  username: string; initialFollowing: boolean; isPrivate?: boolean; initialRequested?: boolean;
}) {
  const [following, setFollowing] = useState(initialFollowing);
  const [requested, setRequested] = useState(initialRequested);
  const [busy, setBusy] = useState(false);

  async function onClick() {
    if (busy) return;
    setBusy(true);
    try {
      if (following) {
        setFollowing(false);
        await api.del(`/api/users/${username}/follow`);
        toast(`Tu ne suis plus @${username}`);
      } else if (requested) {
        // demande déjà envoyée : on annule en se désabonnant côté serveur (no-op si pas de follow)
        await api.del(`/api/users/${username}/follow`).catch(() => {});
        setRequested(false);
        toast("Demande annulée");
      } else {
        const { result } = await api.post<{ result: "following" | "requested" }>(`/api/users/${username}/follow`);
        if (result === "requested") { setRequested(true); toast("Demande de suivi envoyée"); }
        else { setFollowing(true); toast(`Tu suis @${username}`); }
      }
    } catch {
      toast("Action impossible", "error");
    } finally {
      setBusy(false);
    }
  }

  const label = following ? "Suivi ✓" : requested ? "Demande envoyée" : isPrivate ? "Demander à suivre" : "Suivre";
  const filled = !following && !requested;

  return (
    <button onClick={onClick} disabled={busy}
      className={`rounded-full px-5 py-2 text-sm font-semibold transition-colors disabled:opacity-50 ${
        filled ? "bg-[var(--color-primary)] text-white" : "border border-[var(--color-border)] text-[var(--color-text)]"
      }`}>
      {label}
    </button>
  );
}
