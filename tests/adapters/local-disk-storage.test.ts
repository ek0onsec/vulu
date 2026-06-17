import { describe, it, expect, afterAll } from "vitest";
import { rm, readFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { LocalDiskStorage } from "@/server/adapters/media/local-disk-storage";

const dir = join(tmpdir(), `vulu-storage-${Date.now()}`);
const store = new LocalDiskStorage(dir);
afterAll(async () => { await rm(dir, { recursive: true, force: true }); });

describe("LocalDiskStorage", () => {
  it("save écrit le fichier et renvoie une URL /uploads/", async () => {
    const url = await store.save(new Uint8Array([1, 2, 3]), "png");
    expect(url).toMatch(/^\/uploads\/.+\.png$/);
    const name = url.replace("/uploads/", "");
    expect(await readFile(join(dir, name))).toHaveLength(3);
  });
  it("delete supprime le fichier (best-effort)", async () => {
    const url = await store.save(new Uint8Array([9]), "jpg");
    await store.delete(url);
    await expect(readFile(join(dir, url.replace("/uploads/", "")))).rejects.toThrow();
    await store.delete("/uploads/inexistant.png"); // ne lève pas
  });
});
