import { describe, it, expect, beforeEach } from "vitest";
import { makeInMemoryDeps, type Deps } from "@/server/container";
import { FakeCatalog } from "../helpers/fake-catalog";
import { registerUser } from "@/server/application/register-user";
import { requestOrFollow, approveFollowRequest, rejectFollowRequest, listFollowRequests, setAccountPrivacy, canViewProfile, followUser } from "@/server/application/social";

const tastes = { filmGenreIds: [1, 2, 3], people: [] };
let deps: Deps; let me: string; let priv: string;
beforeEach(async () => {
  deps = makeInMemoryDeps(new FakeCatalog());
  me = (await registerUser(deps, { email: "me@x.io", username: "me", displayName: "Me", password: "password1", activeTabs: ["films"], tastes })).id;
  const p = await registerUser(deps, { email: "p@x.io", username: "priv", displayName: "Priv", password: "password1", activeTabs: ["films"], tastes });
  priv = p.id;
  await setAccountPrivacy(deps, priv, true);
});

describe("compte privé & demandes", () => {
  it("suivre un compte public = following direct", async () => {
    const pub = await registerUser(deps, { email: "x@x.io", username: "pub", displayName: "Pub", password: "password1", activeTabs: ["films"], tastes });
    expect(await requestOrFollow(deps, me, pub.id)).toBe("following");
  });
  it("suivre un compte privé crée une demande", async () => {
    expect(await requestOrFollow(deps, me, priv)).toBe("requested");
    expect(await deps.follows.exists(me, priv)).toBe(false);
    expect((await listFollowRequests(deps, priv))[0]?.requester.username).toBe("me");
  });
  it("approuver crée le follow et retire la demande", async () => {
    await requestOrFollow(deps, me, priv);
    const req = (await listFollowRequests(deps, priv))[0]!;
    await approveFollowRequest(deps, priv, req.id);
    expect(await deps.follows.exists(me, priv)).toBe(true);
    expect(await listFollowRequests(deps, priv)).toHaveLength(0);
  });
  it("refuser retire la demande sans follow", async () => {
    await requestOrFollow(deps, me, priv);
    const req = (await listFollowRequests(deps, priv))[0]!;
    await rejectFollowRequest(deps, priv, req.id);
    expect(await deps.follows.exists(me, priv)).toBe(false);
  });
  it("canViewProfile : privé visible seulement aux mutuels", async () => {
    const target = (await deps.users.findById(priv))!;
    expect(await canViewProfile(deps, me, target)).toBe(false);
    await followUser(deps, me, priv);
    await followUser(deps, priv, me);
    expect(await canViewProfile(deps, me, target)).toBe(true);
  });
});
