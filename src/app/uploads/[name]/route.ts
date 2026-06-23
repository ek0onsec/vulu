import { readFile } from "node:fs/promises";
import { join, basename, extname } from "node:path";
import { getEnv } from "@/lib/env";

const TYPES: Record<string, string> = {
  ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp",
};

export async function GET(_req: Request, { params }: { params: Promise<{ name: string }> }) {
  const { name } = await params;
  const safe = basename(name);
  const type = TYPES[extname(safe).toLowerCase()];
  if (!type) return new Response("Not found", { status: 404 });
  try {
    const bytes = await readFile(join(getEnv().UPLOADS_DIR, safe));
    return new Response(new Uint8Array(bytes), {
      headers: {
        "content-type": type,
        "cache-control": "public, max-age=31536000, immutable",
        "x-content-type-options": "nosniff",
      },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
