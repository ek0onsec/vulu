import { getDeps } from "@/server/container";
import { setEntryStatus, rateOrReviewWork, removeEntry } from "@/server/application/library-entry";
import { setStatusSchema, rateSchema } from "@/lib/zod-schemas";
import { requireUser, json } from "@/server/http/session";
import { toErrorResponse } from "@/server/http/errors";
import { z } from "zod";

export async function PUT(req: Request) {
  try {
    const user = await requireUser();
    const deps = await getDeps();
    const body = await req.json();
    if ("rating" in body || "text" in body) {
      const input = rateSchema.parse(body);
      const completedAt = input.completedAt === undefined ? undefined : (input.completedAt === null ? null : new Date(input.completedAt));
      return json({ entry: await rateOrReviewWork(deps, user.id, input.ref, { ...input, completedAt }) });
    }
    const input = setStatusSchema.parse(body);
    const completedAt = input.completedAt === undefined ? undefined : (input.completedAt === null ? null : new Date(input.completedAt));
    return json({ entry: await setEntryStatus(deps, user.id, input.ref, input.status, completedAt) });
  } catch (e) { return toErrorResponse(e); }
}

export async function DELETE(req: Request) {
  try {
    const user = await requireUser();
    const { entryId } = z.object({ entryId: z.string() }).parse(await req.json());
    await removeEntry(await getDeps(), user.id, entryId);
    return json({ ok: true });
  } catch (e) { return toErrorResponse(e); }
}
