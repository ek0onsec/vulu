import { ValidationError } from "@/server/domain/errors";

/** Plafond par défaut pour l'upload d'un export (octets) — garde anti-DoS mémoire. */
export const UPLOAD_MAX = 30 * 1024 * 1024;

/** Lit le corps binaire d'une requête d'upload, en rejetant si trop lourd (avant/après bufferisation). */
export async function readUploadBody(req: Request, max: number = UPLOAD_MAX): Promise<Uint8Array> {
  const declared = Number(req.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > max) throw new ValidationError("Fichier trop lourd");
  const bytes = new Uint8Array(await req.arrayBuffer());
  if (bytes.length > max) throw new ValidationError("Fichier trop lourd");
  return bytes;
}
