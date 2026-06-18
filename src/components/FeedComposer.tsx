"use client";
import { useRouter } from "next/navigation";
import { Icon } from "./Icon";
import { Avatar } from "./Avatar";

export function FeedComposer({ displayName, avatarUrl }: { displayName: string; avatarUrl: string | null }) {
  const router = useRouter();
  return (
    <button onClick={() => router.push("/search")}
      className="mb-4 flex w-full items-center gap-3 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 text-left transition-colors hover:border-[var(--color-primary)]">
      <Avatar name={displayName} src={avatarUrl} size={42} />
      <span className="flex-1 text-sm text-[var(--color-text-muted)]">Qu’as-tu vu ou lu aujourd’hui ?</span>
      <span className="flex items-center gap-1.5 rounded-full bg-[var(--color-primary)] px-4 py-2 text-sm font-semibold text-white">
        <Icon name="plus" size={16} /> Ajouter
      </span>
    </button>
  );
}
