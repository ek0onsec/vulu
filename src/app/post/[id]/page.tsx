import { redirect, notFound } from "next/navigation";
import { currentUser } from "@/server/http/session";
import { getDeps } from "@/server/container";
import { getEntryItem } from "@/server/application/feed";
import { DomainError } from "@/server/domain/errors";
import { AppShell } from "@/components/AppShell";
import { BackButton } from "@/components/BackButton";
import { FeedCard } from "@/components/FeedCard";
import { CommentThread } from "@/components/CommentThread";
import type { FeedItem } from "@/server/application/feed";

export default async function PostPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await currentUser();
  if (!user) redirect("/login");
  const { id } = await params;
  const deps = await getDeps();
  let item: FeedItem;
  try {
    item = await getEntryItem(deps, user.id, id);
  } catch (e) {
    if (e instanceof DomainError) notFound();
    throw e;
  }

  return (
    <AppShell>
      <BackButton />
      <FeedCard item={item} />
      <section className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
        <h2 className="mb-1 font-display text-lg font-bold">Discussion</h2>
        <CommentThread entryId={item.entry.id} me={user.username} />
      </section>
    </AppShell>
  );
}
