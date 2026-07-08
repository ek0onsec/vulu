import type { Deps } from "@/server/container";
import type { Domain, RatedEntry, User } from "@/server/domain/entities";
import { tasteMatchScore } from "@/server/domain/taste-match";
import { canViewProfile, getCircle } from "@/server/application/social";

/** Œuvre aimée des deux côtés, pour la ligne « vous aimez tous les deux ». */
export interface SampleWork {
  workId: string;
  domain: Domain;
  title: string;
}

export interface TasteMatchResult {
  score: number;
  overlap: number;
  sample: SampleWork[];
}

const NEUTRAL: TasteMatchResult = { score: 0, overlap: 0, sample: [] };

/**
 * Compatibilité de goûts entre `viewer` et `target` sur leurs œuvres co-notées.
 * Respecte la visibilité (jamais de self, profil consultable, notes cible visibles
 * uniquement). Le seuil d'affichage (overlap ≥ 3) est appliqué par l'appelant.
 */
export async function computeTasteMatch(deps: Deps, viewerId: string, target: User): Promise<TasteMatchResult> {
  if (viewerId === target.id) return NEUTRAL;
  if (!(await canViewProfile(deps, viewerId, target))) return NEUTRAL;

  const inCircle = (await getCircle(deps, viewerId)).has(target.id);
  const [viewerRated, targetRatedAll] = await Promise.all([
    deps.entries.listRatedByUser(viewerId),
    deps.entries.listRatedByUser(target.id),
  ]);
  const targetByWork = new Map(
    targetRatedAll.filter((e) => e.audiences.public || inCircle).map((e) => [e.workId, e]),
  );

  const pairs: { a: number; b: number }[] = [];
  const sampleEntries: RatedEntry[] = [];
  for (const v of viewerRated) {
    const t = targetByWork.get(v.workId);
    if (!t) continue;
    pairs.push({ a: v.rating, b: t.rating });
    if (sampleEntries.length < 3 && v.rating >= 4 && t.rating >= 4 && Math.abs(v.rating - t.rating) <= 1) {
      sampleEntries.push(t);
    }
  }

  const { score, overlap } = tasteMatchScore(pairs);
  const sampleWorksById = new Map((await deps.works.findByIds(sampleEntries.map((e) => e.workId))).map((w) => [w.id, w]));
  const sample = sampleEntries
    .map((e) => {
      const work = sampleWorksById.get(e.workId);
      return work ? { workId: e.workId, domain: e.domain, title: work.title } : null;
    })
    .filter((s): s is SampleWork => s !== null);

  return { score, overlap, sample };
}
