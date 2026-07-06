import { redirect, notFound } from "next/navigation";
import { currentUser } from "@/server/http/session";
import { getDeps } from "@/server/container";
import { getCircle, canViewProfile } from "@/server/application/social";
import { computeTasteMatch } from "@/server/application/taste-match";
import { computeWatchMinutes } from "@/server/application/watch-time";
import { formatWatchDuration } from "@/lib/format-duration";
import { TasteMatchBadge } from "@/components/TasteMatchBadge";
import { AppShell } from "@/components/AppShell";
import { FollowButton } from "@/components/FollowButton";
import { Avatar } from "@/components/Avatar";
import { CertifiedBadge } from "@/components/CertifiedBadge";
import { StaffBadge } from "@/components/StaffBadge";
import { Icon } from "@/components/Icon";
import { ProfileEditModal } from "@/components/ProfileEditModal";
import { ProfileTabs, type PosterItem, type ListItem, type ShowcaseWork } from "@/components/ProfileTabs";
import { ProfileStats } from "@/components/ProfileStats";
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
  const rawMatch = !isSelf ? await computeTasteMatch(deps, viewer.id, target) : null;
  const tasteMatch = rawMatch && rawMatch.overlap >= 3 ? rawMatch : null;
  const [followers, following] = await Promise.all([deps.follows.countFollowers(target.id), deps.follows.countFollowing(target.id)]);

  const [watchedEntries, plannedEntries, inProgressEntries] = await Promise.all([
    canView
      ? deps.entries.listByUser(target.id, { status: "done" }).then((es) => es.filter((e) => e.audiences.public || isSelf || inCircle))
      : Promise.resolve<LibraryEntry[]>([]),
    isSelf ? deps.entries.listByUser(target.id, { status: "planned" }) : Promise.resolve<LibraryEntry[]>([]),
    isSelf ? deps.entries.listByUser(target.id, { status: "in_progress" }) : Promise.resolve<LibraryEntry[]>([]),
  ]);

  // Toutes les œuvres nécessaires (posters + vitrine) en UNE requête $in, au lieu d'un findById par entrée.
  const showcaseIds = canView ? [...target.showcase.movie, ...target.showcase.tv, ...target.showcase.book] : [];
  const neededWorkIds = [...new Set([
    ...watchedEntries.map((e) => e.workId),
    ...plannedEntries.map((e) => e.workId),
    ...inProgressEntries.map((e) => e.workId),
    ...showcaseIds,
  ])];
  const worksById = new Map((await deps.works.findByIds(neededWorkIds)).map((w) => [w.id, w]));

  const toPosters = (entries: LibraryEntry[]): PosterItem[] =>
    entries.flatMap((e) => {
      const w = worksById.get(e.workId);
      return w ? [{ id: e.id, workId: w.id, posterUrl: w.posterUrl, title: w.title, rating: e.rating, type: w.type }] : [];
    });
  const watched = toPosters(watchedEntries);
  const planned = isSelf ? toPosters(plannedEntries) : null;
  const inProgress = inProgressEntries.flatMap((e) => {
    const w = worksById.get(e.workId);
    return w ? [{ entryId: e.id, workId: w.id, source: w.source, externalId: w.externalId, title: w.title, posterUrl: w.posterUrl,
      type: w.type, episodeCounts: w.episodeCounts, pageCount: w.pageCount, progress: e.progress, peopleIds: w.people.map((p) => p.tmdbId) }] : [];
  });

  const lists: ListItem[] = canView
    ? (await deps.lists.listByUser(target.id))
        .filter((l) => l.visibility === "public" || isSelf)
        .map((l) => ({ id: l.id, name: l.name, description: l.description, visibility: l.visibility, bannerUrl: l.bannerUrl, count: l.workIds.length }))
    : [];

  const resolveShowcase = (ids: string[]): ShowcaseWork[] =>
    ids.flatMap((id) => { const w = worksById.get(id); return w ? [{ workId: w.id, title: w.title, posterUrl: w.posterUrl }] : []; });
  const showcase = canView
    ? { movie: resolveShowcase(target.showcase.movie), tv: resolveShowcase(target.showcase.tv), book: resolveShowcase(target.showcase.book) }
    : { movie: [], tv: [], book: [] };

  const showFilms = target.activeTabs.includes("films");
  const showBooks = target.activeTabs.includes("books");
  const vusCount = watched.filter((w) => w.type !== "book").length;
  const lusCount = watched.filter((w) => w.type === "book").length;
  const watchMinutes = showFilms && canView ? await computeWatchMinutes(deps, target.id) : 0;

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
            <div className="min-w-0 flex-1 pb-1">
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
          {tasteMatch && <TasteMatchBadge score={tasteMatch.score} overlap={tasteMatch.overlap} sample={tasteMatch.sample} />}
          {target.bio && <p className="mt-3 text-sm text-[var(--color-text)]">{target.bio}</p>}
          <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-sm">
            {showFilms && <a href="#vus" className="active:scale-95"><b>{vusCount}</b> <span className="text-[var(--color-text-muted)]">vus</span></a>}
            {showFilms && watchMinutes > 0 && <span><b>{formatWatchDuration(watchMinutes)}</b> <span className="text-[var(--color-text-muted)]">de visionnage</span></span>}
            {showBooks && <a href="#lus" className="active:scale-95"><b>{lusCount}</b> <span className="text-[var(--color-text-muted)]">lus</span></a>}
            <ProfileStats username={target.username} followers={followers} following={following} />
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
