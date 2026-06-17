"use client";
import { useState } from "react";
import Link from "next/link";
import { RatingStars } from "./RatingStars";
import { api } from "@/lib/api-client";
import type { FeedItem } from "@/server/application/feed";

export function FeedCard({ item }: { item: FeedItem }) {
  const [liked, setLiked] = useState(item.likedByMe);
  const [likes, setLikes] = useState(item.likeCount);

  async function toggleLike() {
    const next = !liked;
    setLiked(next); setLikes((n) => n + (next ? 1 : -1));
    try {
      if (next) await api.post(`/api/entries/${item.entry.id}/like`);
      else await api.del(`/api/entries/${item.entry.id}/like`);
    } catch {
      setLiked(!next); setLikes((n) => n + (next ? -1 : 1));
    }
  }

  const isPublic = item.entry.visibility === "public";
  return (
    <article className="mb-3 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
      <header className="flex items-center gap-3">
        <div className="h-9 w-9 shrink-0 rounded-full bg-gradient-to-br from-[var(--color-primary)] to-[var(--color-accent)]" />
        <div className="text-sm">
          <Link href={`/u/${item.author.username}`} className="font-semibold text-[var(--color-text)] hover:underline">
            {item.author.displayName}
          </Link>
          <span className="text-[var(--color-text-muted)]"> @{item.author.username}</span>
          <div className="text-xs text-[var(--color-text-muted)]">
            <Link href={`/work/${item.work.id}`} className="hover:underline">
              {item.work.title}{item.work.year ? ` (${item.work.year})` : ""}
            </Link>
          </div>
        </div>
      </header>

      {item.entry.rating !== null && (
        <div className="mt-2 flex items-center gap-2">
          <RatingStars value={item.entry.rating} />
          <span className="font-semibold text-[var(--color-text)]">{item.entry.rating.toFixed(1).replace(".", ",")}/5</span>
        </div>
      )}
      {item.entry.text && <p className="mt-1 text-sm text-[var(--color-text)]">{item.entry.text}</p>}

      <footer className="mt-3 flex items-center gap-2 text-xs">
        <span
          className={`rounded-full px-3 py-1 ${
            isPublic
              ? "bg-[color-mix(in_srgb,var(--color-accent)_22%,transparent)] text-[var(--color-text)]"
              : "bg-[color-mix(in_srgb,var(--color-primary)_14%,transparent)] text-[var(--color-primary)]"
          }`}
        >
          ● {isPublic ? "Public" : "Cercle"}
        </span>
        <button
          onClick={toggleLike}
          aria-pressed={liked}
          className="rounded-full px-3 py-1 text-[var(--color-primary)] transition-colors hover:bg-[var(--color-border)]"
        >
          {liked ? "♥" : "♡"} {likes}
        </button>
        <Link href={`/work/${item.work.id}`} className="rounded-full px-3 py-1 text-[var(--color-primary)] hover:bg-[var(--color-border)]">
          💬 {item.commentCount}
        </Link>
      </footer>
    </article>
  );
}
