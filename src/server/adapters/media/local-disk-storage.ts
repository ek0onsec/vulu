import { mkdir, writeFile, unlink, readFile } from "node:fs/promises";
import { join, basename } from "node:path";
import { randomUUID } from "node:crypto";
import type { MediaStorage, ImageExt } from "@/server/ports/media";

const PUBLIC_PREFIX = "/uploads/";

/** Stocke les images sur le disque dans `dir`, servies sous /uploads/<name>. */
export class LocalDiskStorage implements MediaStorage {
  constructor(private dir: string) {}

  async save(bytes: Uint8Array, ext: ImageExt): Promise<string> {
    await mkdir(this.dir, { recursive: true });
    const name = `${randomUUID()}.${ext}`;
    await writeFile(join(this.dir, name), bytes);
    return PUBLIC_PREFIX + name;
  }

  async delete(url: string): Promise<void> {
    if (!url.startsWith(PUBLIC_PREFIX)) return;
    const name = basename(url); // empêche toute traversée de chemin
    try {
      await unlink(join(this.dir, name));
    } catch {
      /* best-effort : fichier déjà absent */
    }
  }

  async load(url: string): Promise<Uint8Array | null> {
    if (!url.startsWith(PUBLIC_PREFIX)) return null;
    try {
      return new Uint8Array(await readFile(join(this.dir, basename(url))));
    } catch {
      return null; // best-effort : fichier absent
    }
  }

  /** Chemin disque d'un fichier servi, ou null si l'URL n'est pas gérée ici. */
  resolve(name: string): string {
    return join(this.dir, basename(name));
  }
}
