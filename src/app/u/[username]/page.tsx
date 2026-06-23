import { redirect, notFound } from "next/navigation";
import { currentUser } from "@/server/http/session";
import { getDeps } from "@/server/container";
import { getCircle, canViewProfile } from "@/server/application/social";
import { AppShell } from "@/components/AppShell";
import { FollowButton } from "@/components/FollowButton";
import { Avatar } from "@/components/Avatar";
import { CertifiedBadge } from "@/components/CertifiedBadge";
import { StaffBadge } from "@/components/StaffBadge";
import { Icon } from "@/components/Icon";
import { ProfileEditModal } from "@/components/ProfileEditModal";
import { ProfileTabs, type PosterItem, type ListItem, type ShowcaseWork } from "@/components/ProfileTabs";
import { InProgressShelf } from "@/components/InProgressShelf";
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
  const canView = await canViewProfile(deps, viewer.id, target);
  const isFollowing = await deps.follows.exists(viewer.id, target.id);
  const requested = !isSelf && Boolean(await deps.followRequests.findPair(viewer.id, target.id));
  const [followers, following] = await Promise.all([deps.follows.countFollowers(target.id), deps.follows.countFollowing(target.id)]);

  async function toPosters(entries: LibraryEntry[]): Promise<PosterItem[]> {
    const resolved = await Promise.all(entries.map(async (e) => ({ e, w: await deps.works.findById(e.workId) })));
    return resolved
      .filter((x) => x.w !== null)
      .map(({ e, w }) => ({ id: e.id, workId: w!.id, posterUrl: w!.posterUrl, title: w!.title, rating: e.rating, type: w!.type }));
  }

  const watchedEntries = canView
    ? (await deps.entries.listByUser(target.id, { status: "done" })).filter((e) => e.audiences.public || isSelf || inCircle)
    : [];
  const watched = await toPosters(watchedEntries);
  const planned = isSelf ? await toPosters(await deps.entries.listByUser(target.id, { status: "planned" })) : null;
  const inProgress = isSelf
    ? await Promise.all((await deps.entries.listByUser(target.id, { status: "in_progress" })).map(async (e) => {
        const w = await deps.works.findById(e.workId);
        return w ? { entryId: e.id, workId: w.id, source: w.source, externalId: w.externalId, title: w.title, posterUrl: w.posterUrl,
          type: w.type, episodeCounts: w.episodeCounts, pageCount: w.pageCount, progress: e.progress } : null;
      })).then((xs) => xs.filter((x): x is NonNullable<typeof x> => x !== null))
    : [];

  const lists: ListItem[] = canView
    ? (await deps.lists.listByUser(target.id))
        .filter((l) => l.visibility === "public" || isSelf)
        .map((l) => ({ id: l.id, name: l.name, description: l.description, visibility: l.visibility, bannerUrl: l.bannerUrl, count: l.workIds.length }))
    : [];

  async function resolveShowcase(ids: string[]): Promise<ShowcaseWork[]> {
    const works = await Promise.all(ids.map((id) => deps.works.findById(id)));
    return works.filter((w) => w !== null).map((w) => ({ workId: w!.id, title: w!.title, posterUrl: w!.posterUrl }));
  }
  const showcase = canView
    ? { movie: await resolveShowcase(target.showcase.movie), tv: await resolveShowcase(target.showcase.tv), book: await resolveShowcase(target.showcase.book) }
    : { movie: [], tv: [], book: [] };

  const showFilms = target.activeTabs.includes("films");
  const showBooks = target.activeTabs.includes("books");
  const vusCount = watched.filter((w) => w.type !== "book").length;
  const lusCount = watched.filter((w) => w.type === "book").length;

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
              <h1 className="font-display flex items-center gap-1 text-xl font-bold">
                {target.displayName}{target.staff && <StaffBadge />}{target.plus && <CertifiedBadge />}
              </h1>
              <p className="flex items-center gap-1 text-sm text-[var(--color-text-muted)]">
                @{target.username}
                {target.private && <span title="Compte privé" className="inline-flex"><Icon name="lock" size={14} /></span>}
              </p>
            </div>
            {isSelf
              ? <ProfileEditModal initial={{ username: target.username, displayName: target.displayName, bio: target.bio, avatarUrl: target.avatarUrl, bannerUrl: target.bannerUrl, activeTabs: target.activeTabs }} />
              : <FollowButton username={target.username} initialFollowing={isFollowing} isPrivate={target.private} initialRequested={requested} />}
          </div>
          {target.bio && <p className="mt-3 text-sm text-[var(--color-text)]">{target.bio}</p>}
          <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-sm">
            {showFilms && <span><b>{vusCount}</b> <span className="text-[var(--color-text-muted)]">vus</span></span>}
            {showBooks && <span><b>{lusCount}</b> <span className="text-[var(--color-text-muted)]">lus</span></span>}
            <span><b>{followers}</b> <span className="text-[var(--color-text-muted)]">abonnés</span></span>
            <span><b>{following}</b> <span className="text-[var(--color-text-muted)]">abonnements</span></span>
          </div>
        </div>
      </div>

      {isSelf && inProgress.length > 0 && <div className="mt-6"><InProgressShelf items={inProgress} /></div>}

      {canView
        ? <ProfileTabs watched={watched} planned={planned} lists={lists} isSelf={isSelf} showFilms={showFilms} showBooks={showBooks} showcase={showcase} />
        : <div className="mt-8 rounded-2xl border border-dashed border-[var(--color-border)] p-10 text-center">
            <p className="font-display text-lg font-bold">Ce compte est privé</p>
            <p className="mt-1 text-sm text-[var(--color-text-muted)]">Suis @{target.username} (et qu'il te suive en retour) pour voir sa bibliothèque et ses avis.</p>
          </div>}
    </AppShell>
  );
}
