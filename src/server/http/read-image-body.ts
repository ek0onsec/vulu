import { ValidationError } from "@/server/domain/errors";

/** Plafond grossier (octets) à la frontière HTTP pour les uploads d'image — garde
 *  anti-DoS mémoire. La validation fine (par champ) reste dans la couche application. */
export const IMAGE_UPLOAD_MAX = 1_536 * 1024;

/**
 * Lit le corps d'une requête d'upload image en rejetant **avant** de tout bufferiser
 * si `Content-Length` dépasse `max`, pour limiter le risque de DoS mémoire.
 */
export async function readImageBody(req: Request, max: number = IMAGE_UPLOAD_MAX): Promise<Uint8Array> {
  const declared = Number(req.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > max) {
    throw new ValidationError("Image trop lourde");
  }
  const bytes = new Uint8Array(await req.arrayBuffer());
  if (bytes.length > max) throw new ValidationError("Image trop lourde");
  return bytes;
}
