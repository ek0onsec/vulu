import { redirect, notFound } from "next/navigation";
import { currentUser } from "@/server/http/session";
import { getDeps } from "@/server/container";
import { getCircle } from "@/server/application/social";
import { AppShell } from "@/components/AppShell";
import { FollowButton } from "@/components/FollowButton";
import { Avatar } from "@/components/Avatar";
import { ProfileEditModal } from "@/components/ProfileEditModal";
import { ProfileTabs, type PosterItem, type ListItem } from "@/components/ProfileTabs";
import type { LibraryEntry } from "@/server/domain/entities";

export default async function ProfilePage({ params }: { params: Promise<{ username: string }> }) {
  const viewer = await currentUser();
  if (!viewer) redirect("/login");
  const { username } = await params;
  if (username === "me") redirect(`/u/${viewer.username}`);

  const deps = await getDeps();
  const target = await deps.users.findByUsername(username.toLowerCase());
  if (!target) notFound();

  const isSelf = viewer.id === target.id;
  const inCircle = (await getCircle(deps, viewer.id)).has(target.id);

  async function toPosters(entries: LibraryEntry[]): Promise<PosterItem[]> {
    const resolved = await Promise.all(entries.map(async (e) => ({ e, w: await deps.works.findById(e.workId) })));
    return resolved
      .filter((x) => x.w !== null)
      .map(({ e, w }) => ({ id: e.id, workId: w!.id, posterUrl: w!.posterUrl, title: w!.title, rating: e.rating }));
  }

  const watchedEntries = (await deps.entries.listByUser(target.id, { status: "done" }))
    .filter((e) => e.visibility === "public" || isSelf || inCircle);
  const watched = await toPosters(watchedEntries);
  const planned = isSelf ? await toPosters(await deps.entries.listByUser(target.id, { status: "planned" })) : null;

  const lists: ListItem[] = (await deps.lists.listByUser(target.id))
    .filter((l) => l.visibility === "public" || isSelf)
    .map((l) => ({ id: l.id, name: l.name, description: l.description, visibility: l.visibility, count: l.workIds.length }));

  const [followers, following] = await Promise.all([deps.follows.countFollowers(target.id), deps.follows.countFollowing(target.id)]);
  const isFollowing = await deps.follows.exists(viewer.id, target.id);

  return (
    <AppShell>
      <div className="overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)]">
        <div className="h-28 bg-gradient-to-r from-[var(--color-primary)] via-[var(--color-primary)] to-[var(--color-accent)]"
          style={target.bannerUrl ? { backgroundImage: `url(${target.bannerUrl})`, backgroundSize: "cover", backgroundPosition: "center" } : undefined} />
        <div className="px-5 pb-5">
          <div className="flex items-end gap-3">
            <span className="-mt-10 block rounded-full ring-4 ring-[var(--color-surface)]">
              <Avatar name={target.displayName} src={target.avatarUrl} size={80} />
            </span>
            <div className="flex-1 pb-1">
              <h1 className="font-display text-xl font-bold">{target.displayName}</h1>
              <p className="text-sm text-[var(--color-text-muted)]">@{target.username}</p>
            </div>
            {isSelf
              ? <ProfileEditModal initial={{ username: target.username, displayName: target.displayName, bio: target.bio, avatarUrl: target.avatarUrl, bannerUrl: target.bannerUrl, activeTabs: target.activeTabs }} />
              : <FollowButton username={target.username} initialFollowing={isFollowing} />}
          </div>
          {target.bio && <p className="mt-3 text-sm text-[var(--color-text)]">{target.bio}</p>}
          <div className="mt-3 flex gap-5 text-sm">
            <span><b>{watched.length}</b> <span className="text-[var(--color-text-muted)]">vus</span></span>
            <span><b>{followers}</b> <span className="text-[var(--color-text-muted)]">abonnés</span></span>
            <span><b>{following}</b> <span className="text-[var(--color-text-muted)]">abonnements</span></span>
          </div>
        </div>
      </div>

      <ProfileTabs watched={watched} planned={planned} lists={lists} isSelf={isSelf} />
    </AppShell>
  );
}
