import { ValidationError } from "@/server/domain/errors";

/** Plafond par défaut pour l'upload d'un export (octets) — garde anti-DoS mémoire. */
export const UPLOAD_MAX = 30 * 1024 * 1024;

/**
 * Lit le corps binaire d'une requête d'upload en bornant la mémoire.
 * On ne fait pas confiance à `content-length` (falsifiable/absent) : on lit le flux
 * par morceaux et on abandonne dès que le cumul dépasse `max`, sans tout bufferiser.
 */
export async function readUploadBody(req: Request, max: number = UPLOAD_MAX): Promise<Uint8Array> {
  const declared = Number(req.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > max) throw new ValidationError("Fichier trop lourd");

  const body = req.body;
  if (!body) {
    const bytes = new Uint8Array(await req.arrayBuffer());
    if (bytes.length > max) throw new ValidationError("Fichier trop lourd");
    return bytes;
  }

  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value) continue;
    total += value.length;
    if (total > max) { await reader.cancel(); throw new ValidationError("Fichier trop lourd"); }
    chunks.push(value);
  }
  const out = new Uint8Array(total);
  let offset = 0;
  for (const c of chunks) { out.set(c, offset); offset += c.length; }
  return out;
}
