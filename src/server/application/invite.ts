import type { Deps } from "@/server/container";
import { NotFoundError } from "@/server/domain/errors";
import { generateUniqueInviteCode } from "./invite-code";

export interface InviteeCard {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
}
export interface InviteInfo {
  code: string;
  invitedCount: number;
  invitees: InviteeCard[];
}

export async function getMyInvite(deps: Deps, userId: string): Promise<InviteInfo> {
  const user = await deps.users.findById(userId);
  if (!user) throw new NotFoundError("Utilisateur introuvable");

  // Backfill lazy : les comptes antérieurs à la feature n'ont pas encore de code.
  let code = user.inviteCode;
  if (!code) {
    code = await generateUniqueInviteCode(deps);
    await deps.users.update({ ...user, inviteCode: code });
  }

  const invitees: InviteeCard[] = (await deps.users.listByInviter(userId)).map((u) => ({
    id: u.id, username: u.username, displayName: u.displayName, avatarUrl: u.avatarUrl,
  }));
  return { code, invitedCount: invitees.length, invitees };
}
