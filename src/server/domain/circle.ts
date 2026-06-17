/** Cercle = {gens suivis} ∪ {abonnés}, en excluant soi-même. */
export function computeCircle(userId: string, following: string[], followers: string[]): Set<string> {
  const set = new Set<string>([...following, ...followers]);
  set.delete(userId);
  return set;
}
