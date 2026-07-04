"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api-client";
import { Avatar } from "@/components/Avatar";
import { Icon, type IconName } from "@/components/Icon";
import { relativeTime } from "@/lib/relative-time";
import type { Notification } from "@/server/application/notifications";

function actorNames(n: Notification): string {
  const names = n.actors.map((a) => a.displayName);
  const others = n.totalActors - names.length;
  if (n.totalActors === 1) return names[0] ?? "Quelqu’un";
  if (others <= 0) {
    if (names.length === 2) return `${names[0]} et ${names[1]}`;
    return `${names.slice(0, -1).join(", ")} et ${names[names.length - 1]}`;
  }
  return `${names.join(", ")} et ${others} autre${others > 1 ? "s" : ""}`;
}

function verb(n: Notification): string {
  const plural = n.totalActors > 1;
  if (n.kind === "like") return plural ? "ont aimé ton avis sur" : "a aimé ton avis sur";
  if (n.kind === "comment") return plural ? "ont commenté ton avis sur" : "a commenté ton avis sur";
  return plural ? "t’ont suivi" : "t’a suivi";
}

const ICON: Record<Notification["kind"], IconName> = { like: "heart-filled", comment: "comment", follow: "user-plus" };

export function NotificationsClient() {
  const [notifs, setNotifs] = useState<Notification[] | null>(null);

  useEffect(() => {
    api.get<{ notifications: Notification[] }>("/api/notifications")
      .then((d) => { setNotifs(d.notifications); api.post("/api/notifications/seen").catch(() => {}); })
      .catch(() => setNotifs([]));
  }, []);

  return (
    <>
      <h1 data-tour="notifications-heading" className="font-display mb-4 text-2xl font-bold">Notifications</h1>
      {notifs === null && <div className="space-y-2">{[0, 1, 2].map((i) => <div key={i} className="h-16 animate-pulse rounded-2xl bg-[var(--color-border)]" />)}</div>}
      {notifs?.length === 0 && <p className="text-sm text-[var(--color-text-muted)]">Pas encore de notifications. Publie un avis et fais-toi des amis !</p>}
      <ul className="flex flex-col gap-2">
        {notifs?.map((n) => {
          const href = n.kind === "follow" ? `/u/${n.actors[0]?.username ?? ""}` : `/post/${n.entryId}`;
          return (
            <li key={n.id}>
              <Link href={href} className={`flex items-center gap-3 rounded-2xl border p-4 transition-colors hover:border-[var(--color-primary)] ${n.unread ? "border-[color-mix(in_srgb,var(--color-primary)_45%,transparent)] bg-[color-mix(in_srgb,var(--color-primary)_8%,transparent)]" : "border-[var(--color-border)] bg-[var(--color-surface)]"}`}>
                <span className="shrink-0 text-[var(--color-primary)]"><Icon name={ICON[n.kind]} size={20} /></span>
                <span className="flex -space-x-2">
                  {n.actors.map((a) => <Avatar key={a.username} name={a.displayName} src={a.avatarUrl} size={32} />)}
                </span>
                <span className="min-w-0 flex-1 text-sm">
                  <span className="font-semibold">{actorNames(n)}</span> {verb(n)}{n.work ? <> <span className="font-medium">{n.work.title}</span></> : ""}
                  <span className="block text-xs text-[var(--color-text-muted)]">{relativeTime(n.createdAt)}</span>
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </>
  );
}
