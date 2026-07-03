import { getDeps } from "@/server/container";
import { getWorkReviews, getMyWorkReview } from "@/server/application/feed";
import { requireUser, json } from "@/server/http/session";
import { toErrorResponse } from "@/server/http/errors";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const deps = await getDeps();
    const [mine, others] = await Promise.all([getMyWorkReview(deps, user.id, id), getWorkReviews(deps, user.id, id)]);
    return json({ mine, others });
  } catch (e) { return toErrorResponse(e); }
}
