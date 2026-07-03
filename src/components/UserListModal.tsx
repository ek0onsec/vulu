"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Modal } from "./Modal";
import { Avatar } from "./Avatar";
import { CertifiedBadge } from "./CertifiedBadge";
import { StaffBadge } from "./StaffBadge";
import { api } from "@/lib/api-client";
import type { UserCard } from "@/server/application/follow-lists";

export function UserListModal({ title, endpoint, onClose }: { title: string; endpoint: string; onClose: () => void }) {
  const [users, setUsers] = useState<UserCard[] | null>(null);

  useEffect(() => {
    api.get<{ users: UserCard[] }>(endpoint).then((d) => setUsers(d.users)).catch(() => setUsers([]));
  }, [endpoint]);

  return (
    <Modal open onClose={onClose} title={title}>
      {users === null && <div className="space-y-2">{[0, 1, 2].map((i) => <div key={i} className="h-12 animate-pulse rounded-xl bg-[var(--color-border)]" />)}</div>}
      {users?.length === 0 && <p className="py-6 text-center text-sm text-[var(--color-text-muted)]">Personne pour l’instant.</p>}
      <div className="flex flex-col gap-1">
        {users?.map((u) => (
          <Link key={u.id} href={`/u/${u.username}`} onClick={onClose}
            className="flex items-center gap-3 rounded-xl p-2 transition-colors hover:bg-[var(--color-border)]">
            <Avatar name={u.displayName} src={u.avatarUrl} size={40} />
            <span className="min-w-0">
              <span className="flex items-center gap-1 font-semibold">{u.displayName}{u.staff && <StaffBadge />}{u.plus && <CertifiedBadge />}</span>
              <span className="block text-sm text-[var(--color-text-muted)]">@{u.username}</span>
            </span>
          </Link>
        ))}
      </div>
    </Modal>
  );
}
