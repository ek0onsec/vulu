import { redirect, notFound } from "next/navigation";
import { currentUser } from "@/server/http/session";
import { getDeps } from "@/server/container";
import { AppShell } from "@/components/AppShell";
import { EntryEditor } from "@/components/EntryEditor";
import { RatingStars } from "@/components/RatingStars";

export default async function WorkPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await currentUser();
  if (!user) redirect("/login");
  const { id } = await params;
  const deps = await getDeps();
  const work = await deps.works.findById(id);
  if (!work) notFound();
  const entry = await deps.entries.findByUserAndWork(user.id, work.id);
  const directors = work.people.filter((p) => p.role === "director").map((p) => p.name).join(", ");

  return (
    <AppShell>
      <div className="overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)]">
        <div className="h-32 w-full bg-gradient-to-br from-[var(--color-primary)] to-[var(--color-accent)]"
          style={work.backdropUrl ? { backgroundImage: `url(${work.backdropUrl})`, backgroundSize: "cover", backgroundPosition: "center" } : undefined} />
        <div className="flex gap-4 px-5 pb-5">
          <div className="-mt-12 h-36 w-24 shrink-0 overflow-hidden rounded-xl border-2 border-[var(--color-surface)] bg-[var(--color-border)]"
            style={work.posterUrl ? { backgroundImage: `url(${work.posterUrl})`, backgroundSize: "cover" } : undefined} />
          <div className="pt-3">
            <h1 className="font-display text-2xl font-bold leading-tight">{work.title}</h1>
            <p className="text-sm text-[var(--color-text-muted)]">
              {[work.year, work.type === "tv" ? "Série" : "Film", directors].filter(Boolean).join(" · ")}
            </p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {work.genres.map((g) => (
                <span key={g} className="rounded-full bg-[color-mix(in_srgb,var(--color-primary)_12%,transparent)] px-2.5 py-0.5 text-xs text-[var(--color-primary)]">{g}</span>
              ))}
            </div>
          </div>
        </div>
        {work.overview && <p className="px-5 pb-5 text-sm leading-relaxed text-[var(--color-text)]">{work.overview}</p>}
      </div>

      <div className="mt-4">
        <EntryEditor workRef={{ source: work.source, externalId: work.externalId, type: work.type }} initial={entry} />
      </div>

      {entry?.status === "done" && entry.rating !== null && (
        <p className="mt-4 flex items-center gap-2 text-sm text-[var(--color-text-muted)]">
          Ta note : <RatingStars value={entry.rating} /> {entry.rating.toFixed(1).replace(".", ",")}/5
        </p>
      )}
    </AppShell>
  );
}
