import type { Deps } from "@/server/container";

export interface SignupAvailability {
  usernameAvailable: boolean;
  emailAvailable: boolean;
}

/** Vérifie qu'un pseudo et un email ne sont pas déjà pris (normalisés en minuscules). */
export async function checkSignupAvailability(
  deps: Deps, input: { username: string; email: string },
): Promise<SignupAvailability> {
  const username = input.username.trim().toLowerCase();
  const email = input.email.trim().toLowerCase();
  const [byUsername, byEmail] = await Promise.all([
    deps.users.findByUsername(username),
    deps.users.findByEmail(email),
  ]);
  return { usernameAvailable: byUsername === null, emailAvailable: byEmail === null };
}
