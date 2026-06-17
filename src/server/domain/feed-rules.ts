import type { LibraryEntry } from "./entities";

/** Une entrée alimente le feed si elle est "vue" ET porte une note ou un commentaire. */
export function isPublishable(entry: LibraryEntry): boolean {
  return entry.status === "done" && (entry.rating !== null || entry.text !== null);
}
