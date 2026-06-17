"use client";
import { useState } from "react";
import { api } from "@/lib/api-client";

export function FollowButton({ username, initialFollowing }: { username: string; initialFollowing: boolean }) {
  const [following, setFollowing] = useState(initialFollowing);
  const [busy, setBusy] = useState(false);

  async function toggle() {
    const next = !following;
    setBusy(true); setFollowing(next);
    try {
      if (next) await api.post(`/api/users/${username}/follow`);
      else await api.del(`/api/users/${username}/follow`);
    } catch {
      setFollowing(!next);
    } finally {
      setBusy(false);
    }
  }

  return (
    <button onClick={toggle} disabled={busy}
      className={`rounded-full px-5 py-2 text-sm font-semibold transition-colors disabled:opacity-50 ${
        following
          ? "border border-[var(--color-border)] text-[var(--color-text)]"
          : "bg-[var(--color-primary)] text-white"
      }`}>
      {following ? "Suivi ✓" : "Suivre"}
    </button>
  );
}
