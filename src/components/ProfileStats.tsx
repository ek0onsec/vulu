"use client";
import { useState } from "react";
import { UserListModal } from "./UserListModal";

export function ProfileStats({ username, followers, following }: { username: string; followers: number; following: number }) {
  const [open, setOpen] = useState<null | "followers" | "following">(null);
  return (
    <>
      <button onClick={() => setOpen("followers")} className="active:scale-95"><b>{followers}</b> <span className="text-[var(--color-text-muted)]">abonnés</span></button>
      <button onClick={() => setOpen("following")} className="active:scale-95"><b>{following}</b> <span className="text-[var(--color-text-muted)]">abonnements</span></button>
      {open === "followers" && <UserListModal title="Abonnés" endpoint={`/api/users/${username}/followers`} onClose={() => setOpen(null)} />}
      {open === "following" && <UserListModal title="Abonnements" endpoint={`/api/users/${username}/following`} onClose={() => setOpen(null)} />}
    </>
  );
}
