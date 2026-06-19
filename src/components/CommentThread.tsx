"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api-client";
import { Avatar } from "./Avatar";
import { CertifiedBadge } from "./CertifiedBadge";
import { StaffBadge } from "./StaffBadge";
import { relativeTime } from "@/lib/relative-time";

interface PresentedComment {
  id: string; text: string; createdAt: string;
  author: { username: string; displayName: string; avatarUrl: string | null; plus: boolean; staff: boolean };
}

export function CommentThread({ entryId, onCount }: { entryId: string; onCount?: (n: number) => void }) {
  const [comments, setComments] = useState<PresentedComment[]>([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.get<{ comments: PresentedComment[] }>(`/api/entries/${entryId}/comments`)
      .then((d) => setComments(d.comments)).catch(() => setComments([]));
  }, [entryId]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const value = text.trim();
    if (!value) return;
    setBusy(true);
    try {
      const { comment } = await api.post<{ comment: PresentedComment }>(`/api/entries/${entryId}/comments`, { text: value });
      setComments((prev) => { const next = [...prev, comment]; onCount?.(next.length); return next; });
      setText("");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-3 border-t border-[var(--color-border)] pt-3">
      {/* Fil en quinconce : les commentaires alternent gauche/droite pour un rendu conversationnel. */}
      <ul className="flex flex-col gap-3">
        {comments.map((c, i) => {
          const right = i % 2 === 1;
          return (
            <li key={c.id} className={`flex max-w-[88%] gap-2.5 ${right ? "flex-row-reverse self-end text-right" : "self-start"}`}>
              <Avatar name={c.author.displayName} src={c.author.avatarUrl} size={28} />
              <div className="min-w-0">
                <p className={`flex flex-wrap items-center gap-x-1 text-sm ${right ? "justify-end" : ""}`}>
                  <Link href={`/u/${c.author.username}`} className="font-semibold hover:underline">{c.author.displayName}</Link>
                  {c.author.staff && <StaffBadge size={14} />}
                  {c.author.plus && <CertifiedBadge size={14} />}
                  <span className="text-xs text-[var(--color-text-muted)]">@{c.author.username} · {relativeTime(c.createdAt)}</span>
                </p>
                <div className={`mt-1 inline-block rounded-2xl px-3 py-2 text-sm text-[var(--color-text)] ${right
                  ? "rounded-tr-sm bg-[color-mix(in_srgb,var(--color-primary)_14%,var(--color-surface-2))]"
                  : "rounded-tl-sm bg-[var(--color-surface-2)] border border-[var(--color-border)]"}`}>
                  {c.text}
                </div>
              </div>
            </li>
          );
        })}
        {comments.length === 0 && <li className="text-sm text-[var(--color-text-muted)]">Sois le premier à commenter.</li>}
      </ul>
      <form onSubmit={send} className="mt-3 flex gap-2">
        <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Ajouter un commentaire…"
          className="flex-1 rounded-full border border-[var(--color-border)] bg-[var(--color-bg)] px-4 py-2 text-sm" />
        <button disabled={busy || !text.trim()}
          className="rounded-full bg-[var(--color-primary)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
          Envoyer
        </button>
      </form>
    </div>
  );
}
