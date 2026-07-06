import { redirect, notFound } from "next/navigation";
import { currentUser } from "@/server/http/session";
import { getDeps } from "@/server/container";
import { AppShell } from "@/components/AppShell";
import { EntryEditor } from "@/components/EntryEditor";
import { AddToListButton } from "@/components/AddToListButton";
import { WorkReviews } from "@/components/WorkReviews";
import { SeriesTabs } from "@/components/SeriesTabs";
import { RatingStars } from "@/components/RatingStars";
import { BackButton } from "@/components/BackButton";
import Link from "next/link";
import { personHref } from "@/lib/person";
import { sanitizeDescription } from "@/lib/sanitize-html";

export default async function WorkPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await currentUser();
  if (!user) redirect("/login");
  const { id } = await params;
  const deps = await getDeps();
  const work = await deps.works.findById(id);
  if (!work) notFound();
  const entry = await deps.entries.findByUserAndWork(user.id, work.id);
  const isBook = work.type === "book";
  const creators = work.people
    .filter((p) => (isBook ? p.role === "author" : p.role === "director"))
    .map((p) => p.name).join(", ");
  const typeLabel = isBook ? "Livre" : work.type === "tv" ? "Série" : "Film";

  return (
    <AppShell>
      <BackButton />
      <div className="overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)]">
        <div className="h-32 w-full bg-gradient-to-br from-[var(--color-primary)] to-[var(--color-accent)]"
          style={work.backdropUrl ? { backgroundImage: `url(${work.backdropUrl})`, backgroundSize: "cover", backgroundPosition: "center" } : undefined} />
        <div className="flex gap-4 px-5 pb-5">
          <div className="-mt-12 h-36 w-24 shrink-0 overflow-hidden rounded-xl border-2 border-[var(--color-surface)] bg-[var(--color-border)]"
            style={work.posterUrl ? { backgroundImage: `url(${work.posterUrl})`, backgroundSize: "cover" } : undefined} />
          <div className="pt-3">
            <h1 className="font-display text-2xl font-bold leading-tight">{work.title}</h1>
            <p className="text-sm text-[var(--color-text-muted)]">
              {[work.year, typeLabel, creators].filter(Boolean).join(" · ")}
            </p>
            {work.externalRating !== null && (
              <p className="mt-1.5 inline-flex items-center gap-1.5 rounded-full bg-[color-mix(in_srgb,var(--color-accent)_22%,transparent)] px-2.5 py-1 text-xs font-semibold text-[var(--color-text)]">
                ★ {work.externalRating.toFixed(1)}/10 <span className="font-normal text-[var(--color-text-muted)]">TMDB</span>
              </p>
            )}
            <div className="mt-2 flex flex-wrap gap-1.5">
              {work.genres.map((g) => (
                <span key={g} className="rounded-full bg-[color-mix(in_srgb,var(--color-primary)_12%,transparent)] px-2.5 py-0.5 text-xs text-[var(--color-primary)]">{g}</span>
              ))}
            </div>
          </div>
        </div>
        {work.overview && (
          <div
            className="px-5 pb-4 text-sm leading-relaxed text-[var(--color-text)] [&_a]:text-[var(--color-primary)] [&_a]:underline [&_blockquote]:my-2 [&_blockquote]:border-l-2 [&_blockquote]:border-[var(--color-border)] [&_blockquote]:pl-3 [&_li]:mt-1 [&_ol]:my-2 [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:mb-2 [&_p:last-child]:mb-0 [&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-5"
            dangerouslySetInnerHTML={{ __html: sanitizeDescription(work.overview) }}
          />
        )}
        {work.watchProviders.length > 0 && (
          <div className="px-5 pb-5">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">Où regarder</p>
            <div className="flex flex-wrap gap-2">
              {work.watchProviders.map((p) => (
                <span key={p.name} className="flex items-center gap-1.5 rounded-full border border-[var(--color-border)] px-3 py-1 text-xs font-medium">
                  {p.logoUrl && <img src={p.logoUrl} alt="" width={18} height={18} className="rounded" />}
                  {p.name}
                </span>
              ))}
            </div>
          </div>
        )}
        {work.people.length > 0 && (
          <div className="px-5 pb-5">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">Équipe &amp; casting</p>
            <div className="flex flex-wrap gap-2">
              {work.people.map((p) => (
                <Link key={`${p.role}-${p.tmdbId}`} href={personHref({ tmdbId: p.tmdbId, name: p.name }, work.type === "book" ? "book" : "tmdb")}
                  className="rounded-full border border-[var(--color-border)] px-3 py-1 text-xs font-medium hover:border-[var(--color-primary)] hover:text-[var(--color-primary)]">
                  {p.name}
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>

      {work.type === "tv" ? (
        <SeriesTabs workId={work.id} episodeCounts={work.episodeCounts} initialWatched={entry?.progress?.watchedEpisodes ?? null}>
          <EntryEditor workRef={{ source: work.source, externalId: work.externalId, type: work.type }} initial={entry} workType={work.type} episodeCounts={work.episodeCounts} pageCount={work.pageCount} workId={work.id} />
          <div className="mt-3">
            <AddToListButton workRef={{ source: work.source, externalId: work.externalId, type: work.type }} workId={work.id} />
          </div>
          {entry?.status === "done" && entry.rating !== null && (
            <p className="mt-4 flex items-center gap-2 text-sm text-[var(--color-text-muted)]">
              Ta note : <RatingStars value={entry.rating} /> {entry.rating.toFixed(1).replace(".", ",")}/5
            </p>
          )}
          <WorkReviews workId={work.id} />
        </SeriesTabs>
      ) : (
        <>
          <div className="mt-4">
            <EntryEditor workRef={{ source: work.source, externalId: work.externalId, type: work.type }} initial={entry} workType={work.type} episodeCounts={work.episodeCounts} pageCount={work.pageCount} workId={work.id} />
          </div>
          <div className="mt-3">
            <AddToListButton workRef={{ source: work.source, externalId: work.externalId, type: work.type }} workId={work.id} />
          </div>
          {entry?.status === "done" && entry.rating !== null && (
            <p className="mt-4 flex items-center gap-2 text-sm text-[var(--color-text-muted)]">
              Ta note : <RatingStars value={entry.rating} /> {entry.rating.toFixed(1).replace(".", ",")}/5
            </p>
          )}
          <WorkReviews workId={work.id} />
        </>
      )}
    </AppShell>
  );
}
