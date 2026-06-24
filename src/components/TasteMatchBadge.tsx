import Link from "next/link";
import type { SampleWork } from "@/server/application/taste-match";

interface Props {
  score: number;
  overlap: number;
  sample: SampleWork[];
}

/** Pastille « Match % » + ligne d'affinité. Purement présentationnel, piloté par le serveur. */
export function TasteMatchBadge({ score, overlap, sample }: Props) {
  const tone =
    score >= 80
      ? "bg-[var(--color-accent)] text-white"
      : score >= 60
        ? "bg-[var(--color-accent)]/15 text-[var(--color-accent)]"
        : "bg-[var(--color-border)] text-[var(--color-text)]";

  return (
    <div className="mt-3 flex flex-col gap-1">
      <div className="flex flex-wrap items-center gap-2">
        <span className={`inline-flex items-center rounded-full px-3 py-1 text-sm font-semibold ${tone}`}>
          {score} % de goûts communs
        </span>
        <span className="text-xs text-[var(--color-text-muted)]">sur {overlap} œuvres notées en commun</span>
      </div>
      {sample.length > 0 && (
        <p className="text-sm text-[var(--color-text-muted)]">
          Vous aimez tous les deux :{" "}
          {sample.map((work, index) => (
            <span key={work.workId}>
              {index > 0 && ", "}
              <Link href={`/work/${work.workId}`} className="italic text-[var(--color-text)] hover:underline">
                {work.title}
              </Link>
            </span>
          ))}
        </p>
      )}
    </div>
  );
}
