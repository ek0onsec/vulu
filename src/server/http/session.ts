import { cookies, headers } from "next/headers";
import { NextResponse } from "next/server";
import { getDeps } from "@/server/container";
import { getCurrentUser } from "@/server/application/get-current-user";
import { AuthError } from "@/server/domain/errors";
import type { User } from "@/server/domain/entities";

const COOKIE = "vulu_session";

export async function setSessionCookie(token: string): Promise<void> {
  (await cookies()).set(COOKIE, token, {
    httpOnly: true, secure: process.env.NODE_ENV === "production",
    sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 7,
  });
}
export async function clearSessionCookie(): Promise<void> { (await cookies()).delete(COOKIE); }

export async function currentUser(): Promise<User | null> {
  const cookieToken = (await cookies()).get(COOKIE)?.value;
  let token = cookieToken;
  if (!token) {
    const authz = (await headers()).get("authorization");
    if (authz?.startsWith("Bearer ")) token = authz.slice(7);
  }
  const deps = await getDeps();
  return getCurrentUser(deps, token);
}

export async function requireUser(): Promise<User> {
  const user = await currentUser();
  if (!user) throw new AuthError("Authentification requise");
  return user;
}

export { COOKIE as SESSION_COOKIE };
export const json = NextResponse.json;
