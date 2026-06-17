import type { Deps } from "@/server/container";
import type { User } from "@/server/domain/entities";
import type { ImageExt } from "@/server/ports/media";
import { NotFoundError, ValidationError } from "@/server/domain/errors";

const AVATAR_MAX = 512 * 1024;
const BANNER_MAX = 1_536 * 1024;

/** Détecte le type d'image par ses octets de signature (magic bytes). */
export function detectImage(bytes: Uint8Array): ImageExt | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "jpg";
  if (bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return "png";
  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
    bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50
  ) return "webp";
  return null;
}

async function replaceImage(
  deps: Deps, userId: string, bytes: Uint8Array, max: number, field: "avatarUrl" | "bannerUrl",
): Promise<User> {
  if (bytes.length === 0) throw new ValidationError("Fichier vide");
  if (bytes.length > max) throw new ValidationError("Image trop lourde");
  const ext = detectImage(bytes);
  if (!ext) throw new ValidationError("Format non supporté (JPEG, PNG ou WebP)");

  const user = await deps.users.findById(userId);
  if (!user) throw new NotFoundError("Utilisateur introuvable");

  const url = await deps.media.save(bytes, ext);
  const previous = user[field];
  const updated: User = { ...user, [field]: url };
  await deps.users.update(updated);
  if (previous) await deps.media.delete(previous);
  return updated;
}

export function updateAvatar(deps: Deps, userId: string, bytes: Uint8Array): Promise<User> {
  return replaceImage(deps, userId, bytes, AVATAR_MAX, "avatarUrl");
}

export function updateBanner(deps: Deps, userId: string, bytes: Uint8Array): Promise<User> {
  return replaceImage(deps, userId, bytes, BANNER_MAX, "bannerUrl");
}
