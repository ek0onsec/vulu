export function deriveSeriesStatus(
  watchedGrid: number[][] | null, episodeCounts: number[] | null,
): "planned" | "in_progress" | "done" {
  const watched = (watchedGrid ?? []).reduce((n, s) => n + s.length, 0);
  if (watched === 0) return "planned";
  const total = episodeCounts && episodeCounts.length ? episodeCounts.reduce((a, b) => a + b, 0) : null;
  if (total !== null && watched >= total) return "done";
  return "in_progress";
}
