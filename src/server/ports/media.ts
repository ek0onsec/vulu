export type ImageExt = "jpg" | "png" | "webp";

export interface MediaStorage {
  /** Persiste les octets d'une image et renvoie son URL publique (ex. /uploads/<id>.jpg). */
  save(bytes: Uint8Array, ext: ImageExt): Promise<string>;
  /** Supprime une image à partir de son URL. Best-effort (ne lève pas si absente). */
  delete(url: string): Promise<void>;
  /** Relit les octets d'une image à partir de son URL. Best-effort : null si absente/non gérée. */
  load(url: string): Promise<Uint8Array | null>;
}
