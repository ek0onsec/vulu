import type { Deps } from "@/server/container";
import type { WorkSummary } from "@/server/ports/catalog";

/**
 * Résout un code-barres/ISBN de livre en WorkSummary via le catalogue.
 * Normalise (retire tout sauf chiffres et X final), valide la longueur (10 ou 13)
 * et n'interroge le catalogue que pour un ISBN plausible.
 */
export async function findBookByIsbn(deps: Deps, rawIsbn: string): Promise<WorkSummary | null> {
  const isbn = rawIsbn.replace(/[^0-9Xx]/g, "").toUpperCase();
  if (isbn.length !== 10 && isbn.length !== 13) return null;
  return deps.catalog.findByIsbn(isbn);
}
