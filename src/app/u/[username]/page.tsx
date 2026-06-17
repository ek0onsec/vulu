import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { currentUser } from "@/server/http/session";
import { getDeps } from "@/server/container";
import { getCircle } from "@/server/application/social";
import { AppShell } from "@/components/AppShell";
import { FollowButton } from "@/components/FollowButton";
import { RatingStars } from "@/components/RatingStars";

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
  const watched = (await deps.entries.listByUser(target.id, { status: "done" }))
    .filter((e) => e.visibility === "public" || isSelf || inCircle);
  const works = await Promise.all(watched.map(async (e) => ({ entry: e, work: await deps.works.findById(e.workId) })));
  const lists = (await deps.lists.listByUser(target.id)).filter((l) => l.visibility === "public" || isSelf);
  const [followers, following] = await Promise.all([deps.follows.countFollowers(target.id), deps.follows.countFollowing(target.id)]);
  const isFollowing = await deps.follows.exists(viewer.id, target.id);

  return (
    <AppShell>
      <div className="overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)]">
        <div className="h-24 bg-gradient-to-r from-[var(--color-primary)] via-[var(--color-primary)] to-[var(--color-accent)]" />
        <div className="px-5 pb-5">
          <div className="flex items-end gap-3">
            <div className="-mt-10 h-20 w-20 rounded-full border-4 border-[var(--color-surface)] bg-gradient-to-br from-[var(--color-primary)] to-[var(--color-accent)]" />
            <div className="flex-1 pb-1">
              <h1 className="font-display text-xl font-bold">{target.displayName}</h1>
              <p className="text-sm text-[var(--color-text-muted)]">@{target.username}</p>
            </div>
            {isSelf
              ? <Link href="/lists" className="rounded-full border border-[var(--color-primary)] px-4 py-2 text-sm font-semibold text-[var(--color-primary)]">Mes listes</Link>
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

      <h2 className="mb-3 mt-6 text-sm font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">Vus</h2>
      {works.length === 0 && <p className="text-sm text-[var(--color-text-muted)]">Aucune œuvre visible.</p>}
      <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
        {works.map(({ entry, work }) => work && (
          <Link key={entry.id} href={`/work/${work.id}`}
            className="relative aspect-[2/3] overflow-hidden rounded-xl bg-[var(--color-border)]"
            style={work.posterUrl ? { backgroundImage: `url(${work.posterUrl})`, backgroundSize: "cover" } : undefined}>
            {entry.rating !== null && (
              <span className="absolute bottom-1 left-1 rounded-md bg-black/70 px-1.5 py-0.5 text-[0.65rem] font-bold text-[var(--color-accent)]">
                ★ {entry.rating.toFixed(1).replace(".", ",")}
              </span>
            )}
          </Link>
        ))}
      </div>

      {lists.length > 0 && (
        <>
          <h2 className="mb-3 mt-6 text-sm font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">Listes</h2>
          <div className="flex flex-wrap gap-3">
            {lists.map((l) => (
              <div key={l.id} className="w-40 rounded-xl border border-[var(--color-border)] p-3">
                <p className="font-semibold">{l.name}</p>
                <p className="text-xs text-[var(--color-text-muted)]">{l.workIds.length} œuvres · {l.visibility === "public" ? "public" : "privé"}</p>
              </div>
            ))}
          </div>
        </>
      )}
    </AppShell>
  );
}
