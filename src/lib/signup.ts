import type { Domain } from "@/server/domain/entities";

export const SIGNUP_KEY = "vulu-signup";

export interface SignupDraft {
  email: string;
  username: string;
  displayName: string;
  password: string;
  activeTabs: Domain[];
}
