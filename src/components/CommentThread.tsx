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
      <ul className="flex flex-col gap-3">
        {comments.map((c) => (
          <li key={c.id} className="flex gap-2.5">
            <Avatar name={c.author.displayName} src={c.author.avatarUrl} size={28} />
            <div className="min-w-0">
              <p className="text-sm">
                <Link href={`/u/${c.author.username}`} className="font-semibold hover:underline">{c.author.displayName}</Link>
                {c.author.staff && <StaffBadge size={14} />}
                {c.author.plus && <CertifiedBadge size={14} />}{" "}
                <span className="text-xs text-[var(--color-text-muted)]">@{c.author.username} · {relativeTime(c.createdAt)}</span>
              </p>
              <p className="text-sm text-[var(--color-text)]">{c.text}</p>
            </div>
          </li>
        ))}
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
