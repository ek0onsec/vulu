"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api-client";
import { toast } from "@/lib/toast";
import { Avatar } from "@/components/Avatar";

interface Req { id: string; requester: { username: string; displayName: string; avatarUrl: string | null } }

export function RequestsClient() {
  const [reqs, setReqs] = useState<Req[] | null>(null);

  useEffect(() => {
    api.get<{ requests: Req[] }>("/api/follow-requests").then((d) => setReqs(d.requests)).catch(() => setReqs([]));
  }, []);

  async function act(id: string, action: "approve" | "reject") {
    setReqs((prev) => prev?.filter((r) => r.id !== id) ?? null);
    try {
      await api.post("/api/follow-requests", { requestId: id, action });
      toast(action === "approve" ? "Demande approuvée" : "Demande refusée");
    } catch {
      toast("Action impossible", "error");
    }
  }

  return (
    <>
      <h1 className="font-display mb-4 text-2xl font-bold">Demandes de suivi</h1>
      {reqs === null && <p className="text-sm text-[var(--color-text-muted)]">Chargement…</p>}
      {reqs?.length === 0 && <p className="text-sm text-[var(--color-text-muted)]">Aucune demande en attente.</p>}
      <ul className="flex flex-col gap-3">
        {reqs?.map((r) => (
          <li key={r.id} className="flex items-center gap-3 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
            <Avatar name={r.requester.displayName} src={r.requester.avatarUrl} size={40} />
            <Link href={`/u/${r.requester.username}`} className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">{r.requester.displayName}</p>
              <p className="truncate text-xs text-[var(--color-text-muted)]">@{r.requester.username}</p>
            </Link>
            <button onClick={() => act(r.id, "approve")} className="rounded-full bg-[var(--color-primary)] px-4 py-1.5 text-sm font-semibold text-white">Approuver</button>
            <button onClick={() => act(r.id, "reject")} className="rounded-full border border-[var(--color-border)] px-4 py-1.5 text-sm font-semibold">Refuser</button>
          </li>
        ))}
      </ul>
    </>
  );
}
