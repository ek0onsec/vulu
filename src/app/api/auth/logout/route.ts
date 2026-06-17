import { clearSessionCookie, json } from "@/server/http/session";
export async function POST() { await clearSessionCookie(); return json({ ok: true }); }
