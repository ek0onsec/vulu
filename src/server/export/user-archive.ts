import type { Deps } from "@/server/container";
import { NotFoundError } from "@/server/domain/errors";
import { strToU8 } from "fflate";

/** Échappe une cellule CSV (guillemets, virgules, retours ligne). */
function csvCell(v: unknown): string {
  const s = v === null || v === undefined ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** Extension déduite d'une URL d'image (jpg par défaut). */
function extOf(url: string): string {
  return url.split("?")[0]!.split(".").pop() ?? "jpg";
}

export async function buildUserArchive(deps: Deps, userId: string): Promise<Record<string, Uint8Array>> {
  const user = await deps.users.findById(userId);
  if (!user) throw new NotFoundError("Utilisateur introuvable");

  const [entries, episodes, lists, likes, comments, followingIds, followerIds] = await Promise.all([
    deps.entries.listByUser(userId, {}),
    deps.episodeEntries.listByUser(userId),
    deps.lists.listByUser(userId),
    deps.likes.listByUser(userId),
    deps.comments.listByUser(userId),
    deps.follows.followeeIdsOf(userId),
    deps.follows.followerIdsOf(userId),
  ]);

  const works = await deps.works.findByIds([...new Set(entries.map((e) => e.workId))]);
  const workById = new Map(works.map((w) => [w.id, w]));

  const socialUsers = await deps.users.findByIds([...new Set([...followingIds, ...followerIds])]);
  const nameById = new Map(socialUsers.map((u) => [u.id, u.username]));
  const usernames = (ids: string[]) => ids.map((id) => nameById.get(id) ?? id);

  const { passwordHash, twoFactorSecret, twoFactorBackupCodes, ...profile } = user;
  void passwordHash; void twoFactorSecret; void twoFactorBackupCodes;

  const files: Record<string, Uint8Array> = {};
  const json = (v: unknown) => strToU8(JSON.stringify(v, null, 2));

  files["profile.json"] = json(profile);
  files["library.json"] = json(entries);
  files["episodes.json"] = json(episodes);
  files["lists.json"] = json(lists);
  files["likes.json"] = json(likes);
  files["comments.json"] = json(comments);
  files["social.json"] = json({ following: usernames(followingIds), followers: usernames(followerIds) });

  const header = ["title", "type", "status", "rating", "completedAt", "domain"];
  const rows = entries.map((e) => {
    const w = workById.get(e.workId);
    return [w?.title ?? "", w?.type ?? "", e.status, e.rating ?? "", e.completedAt ? e.completedAt.toISOString() : "", e.domain]
      .map(csvCell).join(",");
  });
  files["library.csv"] = strToU8([header.join(","), ...rows].join("\n"));

  files["README.txt"] = strToU8(
    "Export de vos données vulu\n" +
    `Utilisateur : @${user.username}\n` +
    `Date : ${deps.clock.now().toISOString()}\n\n` +
    "Contenu :\n" +
    "- profile.json : votre profil (sans mot de passe ni secret de sécurité)\n" +
    "- library.json / library.csv : votre bibliothèque (films, séries, livres)\n" +
    "- episodes.json : votre progression épisode par épisode\n" +
    "- lists.json : vos listes\n" +
    "- social.json : vos abonnements et abonnés\n" +
    "- likes.json / comments.json : vos likes et commentaires\n" +
    "- media/ : votre avatar et votre bannière\n",
  );

  if (user.avatarUrl) {
    const bytes = await deps.media.load(user.avatarUrl);
    if (bytes) files[`media/avatar.${extOf(user.avatarUrl)}`] = bytes;
  }
  if (user.bannerUrl) {
    const bytes = await deps.media.load(user.bannerUrl);
    if (bytes) files[`media/banner.${extOf(user.bannerUrl)}`] = bytes;
  }

  return files;
}
