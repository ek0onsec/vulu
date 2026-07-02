"use client";
import { useState } from "react";
import Link from "next/link";
import { Avatar } from "./Avatar";
import { Icon } from "./Icon";
import { RatingStars } from "./RatingStars";
import { CertifiedBadge } from "./CertifiedBadge";
import { StaffBadge } from "./StaffBadge";
import { relativeTime } from "@/lib/relative-time";
import { formatProgress, activityVerb } from "@/lib/progress";
import { api } from "@/lib/api-client";
import type { FeedItem } from "@/server/application/feed";

export function FeedCard({ item }: { item: FeedItem }) {
  const [liked, setLiked] = useState(item.likedByMe);
  const [likes, setLikes] = useState(item.likeCount);
  const [expanded, setExpanded] = useState(false);

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

  const isPublic = item.entry.audiences.public || item.entry.audiences.communityIds.length > 0;
  const typeLabel = item.work.type === "book" ? "Livre" : item.work.type === "tv" ? "Série" : "Film";
  return (
    <article className="relative mb-3 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 transition-shadow hover:shadow-[0_2px_20px_rgba(0,0,0,0.05)]">
      {/* Lien-overlay : le fond « vide » de la carte mène au post. Frère (non parent)
          des liens internes -> aucun <a> imbriqué. Les éléments interactifs sont en z-10. */}
      <Link href={`/post/${item.entry.id}`} className="absolute inset-0 z-0" aria-label="Voir la publication" />
      <div className="flex gap-3">
        <Link href={`/u/${item.author.username}`} className="relative z-10 shrink-0">
          <Avatar name={item.author.displayName} src={item.author.avatarUrl} size={42} />
        </Link>

        <div className="min-w-0 flex-1">
          <header className="flex items-start gap-2 text-sm">
            <div className="min-w-0">
              <span className="font-semibold">
                <Link href={`/u/${item.author.username}`} className="relative z-10 hover:underline">{item.author.displayName}</Link>
                {item.author.staff && <StaffBadge />}
                {item.author.plus && <CertifiedBadge />}
              </span>
              <span className="text-[var(--color-text-muted)]"> @{item.author.username} · {relativeTime(item.entry.createdAt)}</span>
              <p className="text-xs text-[var(--color-text-muted)]">{item.entry.status === "done" ? "a noté" : (activityVerb(item.entry.status, item.work.type) ?? (item.work.type === "book" ? "veut lire" : "veut voir"))}</p>
            </div>
            <div className="ml-auto flex shrink-0 items-center gap-1.5">
              {item.communities.length > 0 && (
                <Link href={`/communaute/${item.communities[0]!.id}`}
                  className="relative z-10 rounded-full bg-[color-mix(in_srgb,var(--color-primary)_12%,transparent)] px-2.5 py-1 text-xs font-medium text-[var(--color-primary)] hover:underline">
                  via {item.communities[0]!.name}{item.communities.length > 1 ? ` +${item.communities.length - 1}` : ""}
                </Link>
              )}
              <span className={`rounded-full px-2.5 py-1 text-xs ${
                isPublic
                  ? "bg-[color-mix(in_srgb,var(--color-accent)_22%,transparent)] text-[var(--color-text)]"
                  : "bg-[color-mix(in_srgb,var(--color-primary)_14%,transparent)] text-[var(--color-primary)]"
              }`}>{isPublic ? "Public" : "Cercle"}</span>
            </div>
          </header>

          <div className="mt-2">
            {item.entry.text && (
              <div className="mb-2">
                <p className={`whitespace-pre-wrap text-sm text-[var(--color-text)] ${expanded ? "" : "line-clamp-3"}`}>
                  {item.entry.text}
                </p>
                {!expanded && item.entry.text.length > 180 && (
                  <button
                    type="button"
                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); setExpanded(true); }}
                    className="relative z-10 mt-0.5 text-sm font-semibold text-[var(--color-primary)] hover:underline"
                  >
                    Lire plus
                  </button>
                )}
              </div>
            )}
            <Link href={`/work/${item.work.id}`} className="relative z-10 block">
              <p className="font-display text-lg font-semibold leading-tight">{item.work.title}</p>
              <p className="text-xs text-[var(--color-text-muted)]">{item.work.year ?? ""} · {typeLabel}</p>
              <div className="mt-2 aspect-[2/3] w-40 max-w-[55%] overflow-hidden rounded-xl bg-[var(--color-border)]"
                style={item.work.posterUrl ? { backgroundImage: `url(${item.work.posterUrl})`, backgroundSize: "cover", backgroundPosition: "center" } : undefined} />
              {item.entry.rating !== null && (
                <div className="mt-2 flex items-center gap-2">
                  <RatingStars value={item.entry.rating} size={16} />
                  <span className="text-sm font-semibold">{item.entry.rating.toFixed(1).replace(".", ",")}/5</span>
                </div>
              )}
              {item.entry.status === "in_progress" && formatProgress(item.entry, item.work) && (
                <p className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-[color-mix(in_srgb,var(--color-primary)_12%,transparent)] px-2.5 py-1 text-xs font-semibold text-[var(--color-primary)]">
                  {formatProgress(item.entry, item.work)}
                </p>
              )}
            </Link>
          </div>

          <footer className="mt-2 flex items-center gap-1 text-[var(--color-text-muted)]">
            <button onClick={toggleLike} aria-pressed={liked}
              className={`relative z-10 flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm transition-colors hover:bg-[var(--color-border)] ${liked ? "text-[var(--color-primary)]" : ""}`}>
              <Icon name={liked ? "heart-filled" : "heart"} size={19} /> {likes}
            </button>
            <Link href={`/post/${item.entry.id}`}
              className="relative z-10 flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm transition-colors hover:bg-[var(--color-border)]">
              <Icon name="comment" size={19} /> {item.commentCount}
            </Link>
          </footer>
        </div>
      </div>
    </article>
  );
}
