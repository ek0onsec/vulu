import type { Deps } from "@/server/container";

/** Génère un code d'invitation garanti unique (retry sur collision). */
export async function generateUniqueInviteCode(deps: Deps): Promise<string> {
  for (let attempt = 0; attempt < 10; attempt++) {
    const code = deps.inviteCodes.next();
    if (!(await deps.users.findByInviteCode(code))) return code;
  }
  throw new Error("Impossible de générer un code d'invitation unique");
}
