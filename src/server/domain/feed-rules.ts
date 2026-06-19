import type { LibraryEntry } from "./entities";

/** Une entrée alimente le mur d'une œuvre / les tendances si elle est "vue" ET notée ou commentée. */
export function isPublishable(entry: LibraryEntry): boolean {
  return entry.status === "done" && (entry.rating !== null || entry.text !== null);
}

/** Une entrée est visible dans le feed dès qu'un avis ou un jalon a été partagé (activityAt posé). */
export function isFeedVisible(entry: LibraryEntry): boolean {
  return entry.activityAt !== null;
}
