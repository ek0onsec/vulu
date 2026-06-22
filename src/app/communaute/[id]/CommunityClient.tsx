"use client";
import { useEffect, useRef, useState } from "react";
import { api, ApiError } from "@/lib/api-client";
import { toast } from "@/lib/toast";
import { resizeImage } from "@/lib/image-resize";
import { FeedCard } from "@/components/FeedCard";
import { Icon } from "@/components/Icon";
import { Avatar } from "@/components/Avatar";
import { Modal } from "@/components/Modal";
import type { FeedItem } from "@/server/application/feed";

type Role = "owner" | "moderator" | "member";
interface CommunityDto {
  id: string; name: string; description: string | null; bannerUrl: string | null;
  memberCount: number; isMember: boolean; isPinned: boolean; isOwner: boolean;
  visibility: "public" | "private"; role: Role | null;
  requestState: "none" | "requested" | "invited"; canModerate: boolean; pendingCount: number;
}
interface JoinRequest { requestId: string; username: string; displayName: string; avatarUrl: string | null }
interface Member { userId: string; username: string; displayName: string; avatarUrl: string | null; role: Role }

const roleLabel: Record<Role, string> = { owner: "Créateur", moderator: "Modérateur", member: "Membre" };

export function CommunityClient({ id }: { id: string }) {
  const [c, setC] = useState<CommunityDto | null>(null);
  const [items, setItems] = useState<FeedItem[] | null>(null);
  const [requests, setRequests] = useState<JoinRequest[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [inviteName, setInviteName] = useState("");
  const [inviteReqId, setInviteReqId] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const bannerInput = useRef<HTMLInputElement>(null);

  function loadCommunity() { return api.get<{ community: CommunityDto }>(`/api/communities/${id}`).then((d) => { setC(d.community); return d.community; }); }

  async function uploadBanner(file: File) {
    try {
      const blob = await resizeImage(file, 1500, 500);
      const res = await fetch(`/api/communities/${id}/banner`, { method: "POST", body: blob, credentials: "same-origin" });
      const data = await res.json();
      if (!res.ok) throw new ApiError(res.status, data.error, data.message);
      setC(data.community);
      toast("Bannière mise à jour");
    } catch (e) { toast(e instanceof ApiError ? e.message : "Échec de l'upload", "error"); }
  }

  // Détail dépendant de l'état d'appartenance : fil, modération, membres, invitation.
  function loadDetails(dto: CommunityDto) {
    const canSeeFeed = dto.isMember || dto.visibility === "public";
    if (canSeeFeed) api.get<{ items: FeedItem[] }>(`/api/communities/${id}/feed`).then((d) => setItems(d.items)).catch(() => setItems([]));
    else setItems(null);
    if (dto.canModerate) api.get<{ requests: JoinRequest[] }>(`/api/communities/${id}/requests`).then((d) => setRequests(d.requests)).catch(() => setRequests([]));
    if (dto.isMember) api.get<{ members: Member[] }>(`/api/communities/${id}/members`).then((d) => setMembers(d.members)).catch(() => setMembers([]));
    if (dto.requestState === "invited") {
      api.get<{ invites: { requestId: string; community: { id: string } }[] }>("/api/community-invites/mine")
        .then((d) => setInviteReqId(d.invites.find((x) => x.community.id === id)?.requestId ?? null)).catch(() => {});
    }
  }

  useEffect(() => { loadCommunity().then((d) => { if (d) loadDetails(d); }).catch(() => setC(null)); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [id]);

  async function refresh() { const d = await loadCommunity(); if (d) loadDetails(d); }

  async function join() {
    if (!c) return;
    try {
      await api.post(`/api/communities/${id}/join`);
      toast(c.visibility === "private" ? "Demande envoyée" : "Bienvenue !");
      await refresh();
    } catch { toast("Action impossible", "error"); }
  }
  async function leaveOrCancel() {
    try { await api.del(`/api/communities/${id}/join`); toast(c?.requestState === "requested" ? "Demande annulée" : "Tu as quitté la communauté"); await refresh(); }
    catch (e) { toast(e instanceof ApiError ? e.message : "Action impossible", "error"); }
  }
  async function togglePin() {
    if (!c) return;
    const next = !c.isPinned; setC({ ...c, isPinned: next });
    try { await api.post(`/api/communities/${id}/pin`, { pinned: next }); toast(next ? "Épinglée sur ton feed" : "Désépinglée"); }
    catch { toast("Action impossible", "error"); setC({ ...c, isPinned: !next }); }
  }
  async function respondInvite(action: "accept" | "decline") {
    if (!inviteReqId) return;
    try { await api.post(`/api/community-invites/${inviteReqId}`, { action }); toast(action === "accept" ? "Bienvenue !" : "Invitation refusée"); await refresh(); }
    catch { toast("Action impossible", "error"); }
  }
  async function moderate(requestId: string, action: "approve" | "reject") {
    try { await api.post(`/api/communities/${id}/requests/${requestId}`, { action }); toast(action === "approve" ? "Demande approuvée" : "Demande refusée"); await refresh(); }
    catch { toast("Action impossible", "error"); }
  }
  async function invite() {
    const username = inviteName.trim();
    if (!username) return;
    try { await api.post(`/api/communities/${id}/invite`, { username }); setInviteName(""); toast(`Invitation envoyée à @${username}`); }
    catch (e) { toast(e instanceof ApiError ? e.message : "Action impossible", "error"); }
  }
  async function setRole(userId: string, role: "member" | "moderator") {
    try { await api.post(`/api/communities/${id}/members/${userId}/role`, { role }); toast(role === "moderator" ? "Promu modérateur" : "Rétrogradé membre"); await refresh(); }
    catch { toast("Action impossible", "error"); }
  }
  async function toggleVisibility() {
    if (!c) return;
    const visibility = c.visibility === "public" ? "private" : "public";
    try { await api.post(`/api/communities/${id}/visibility`, { visibility }); toast(visibility === "private" ? "Communauté passée en privée" : "Communauté passée en publique"); await refresh(); }
    catch { toast("Action impossible", "error"); }
  }

  if (!c) return <div className="h-40 animate-pulse rounded-2xl bg-[var(--color-border)]" />;

  const joinLabel = c.isMember ? "Membre ✓" : c.requestState === "requested" ? "Demande envoyée" : c.visibility === "private" ? "Demander à rejoindre" : "Rejoindre";
  const onJoinClick = () => { if (c.isMember || c.requestState === "requested") leaveOrCancel(); else join(); };

  return (
    <>
      <div className="overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)]">
        <div className="relative h-28 bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-accent)]" style={c.bannerUrl ? { backgroundImage: `url(${c.bannerUrl})`, backgroundSize: "cover", backgroundPosition: "center" } : undefined}>
          {c.isOwner && (
            <>
              <button onClick={() => bannerInput.current?.click()} title="Changer la bannière"
                className="absolute bottom-2 right-2 flex items-center gap-1.5 rounded-full bg-black/45 px-3 py-1.5 text-xs font-semibold text-white backdrop-blur hover:bg-black/60">
                <Icon name="camera" size={15} /> Bannière
              </button>
              <input ref={bannerInput} type="file" accept="image/png,image/jpeg,image/webp" className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadBanner(f); e.target.value = ""; }} />
            </>
          )}
        </div>
        <div className="p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h1 className="flex items-center gap-1.5 font-display text-2xl font-bold">{c.name}{c.visibility === "private" && <Icon name="lock" size={16} />}</h1>
              <p className="text-sm text-[var(--color-text-muted)]">{c.memberCount} membre{c.memberCount > 1 ? "s" : ""}{c.visibility === "private" ? " · privée" : ""}</p>
            </div>
            <div className="flex shrink-0 gap-2">
              {c.isMember && (
                <button onClick={togglePin} title={c.isPinned ? "Désépingler" : "Épingler sur le feed"}
                  className={`rounded-full border p-2 ${c.isPinned ? "border-[var(--color-primary)] text-[var(--color-primary)]" : "border-[var(--color-border)] text-[var(--color-text-muted)]"}`}>
                  <Icon name="home" size={18} />
                </button>
              )}
              {c.isMember && (
                <button onClick={() => setSettingsOpen(true)} title="Membres et modération"
                  className="relative rounded-full border border-[var(--color-border)] p-2 text-[var(--color-text-muted)]">
                  <Icon name="dots" size={18} />
                  {c.canModerate && c.pendingCount > 0 && <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-[var(--color-primary)] px-1 text-[0.6rem] font-bold text-white">{c.pendingCount}</span>}
                </button>
              )}
              {!c.isOwner && (
                <button onClick={onJoinClick} className={`rounded-full px-5 py-2 text-sm font-semibold ${c.isMember || c.requestState === "requested" ? "border border-[var(--color-border)]" : "bg-[var(--color-primary)] text-white"}`}>
                  {joinLabel}
                </button>
              )}
            </div>
          </div>
          {c.description && <p className="mt-3 text-sm text-[var(--color-text)]">{c.description}</p>}
        </div>
      </div>

      {c.requestState === "invited" && (
        <div className="mt-4 flex items-center justify-between gap-3 rounded-2xl border border-[var(--color-primary)] bg-[color-mix(in_srgb,var(--color-primary)_10%,transparent)] p-3">
          <span className="text-sm font-semibold">Tu es invité à rejoindre cette communauté.</span>
          <span className="flex gap-2">
            <button onClick={() => respondInvite("accept")} className="rounded-full bg-[var(--color-primary)] px-3 py-1 text-sm font-semibold text-white">Accepter</button>
            <button onClick={() => respondInvite("decline")} className="rounded-full border border-[var(--color-border)] px-3 py-1 text-sm">Refuser</button>
          </span>
        </div>
      )}

      <Modal open={settingsOpen} onClose={() => setSettingsOpen(false)} title="Membres et modération">
        <div className="flex flex-col gap-5">
          {c.canModerate && (
            <section>
              <h3 className="mb-2 text-sm font-semibold">Demandes en attente ({requests.length})</h3>
              {requests.length === 0 && <p className="text-sm text-[var(--color-text-muted)]">Aucune demande.</p>}
              <ul className="flex flex-col gap-2">
                {requests.map((r) => (
                  <li key={r.requestId} className="flex items-center gap-2">
                    <Avatar name={r.displayName} src={r.avatarUrl} size={28} />
                    <span className="min-w-0 flex-1 text-sm"><b>{r.displayName}</b> <span className="text-[var(--color-text-muted)]">@{r.username}</span></span>
                    <button onClick={() => moderate(r.requestId, "approve")} className="rounded-full bg-[var(--color-primary)] px-3 py-1 text-xs font-semibold text-white">Approuver</button>
                    <button onClick={() => moderate(r.requestId, "reject")} className="rounded-full border border-[var(--color-border)] px-3 py-1 text-xs">Refuser</button>
                  </li>
                ))}
              </ul>
              <div className="mt-3 flex gap-2">
                <input value={inviteName} onChange={(e) => setInviteName(e.target.value)} placeholder="Inviter par @username"
                  className="flex-1 rounded-full border border-[var(--color-border)] bg-[var(--color-bg)] px-4 py-2 text-sm" />
                <button onClick={invite} className="rounded-full bg-[var(--color-primary)] px-4 py-2 text-sm font-semibold text-white">Inviter</button>
              </div>
            </section>
          )}

          <section>
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-sm font-semibold">Membres ({c.memberCount})</h3>
              {c.isOwner && (
                <button onClick={toggleVisibility} className="flex items-center gap-1.5 rounded-full border border-[var(--color-border)] px-3 py-1 text-xs font-semibold">
                  <Icon name="lock" size={13} /> {c.visibility === "public" ? "Passer en privée" : "Passer en publique"}
                </button>
              )}
            </div>
            <ul className="flex flex-col gap-2">
              {members.map((m) => (
                <li key={m.userId} className="flex items-center gap-2">
                  <Avatar name={m.displayName} src={m.avatarUrl} size={28} />
                  <span className="min-w-0 flex-1 text-sm"><b>{m.displayName}</b> <span className="text-[var(--color-text-muted)]">@{m.username}</span></span>
                  <span className="rounded-full bg-[var(--color-bg)] px-2 py-0.5 text-xs text-[var(--color-text-muted)]">{roleLabel[m.role]}</span>
                  {c.isOwner && m.role !== "owner" && (
                    m.role === "moderator"
                      ? <button onClick={() => setRole(m.userId, "member")} className="rounded-full border border-[var(--color-border)] px-2.5 py-0.5 text-xs">Rétrograder</button>
                      : <button onClick={() => setRole(m.userId, "moderator")} className="rounded-full border border-[var(--color-primary)] px-2.5 py-0.5 text-xs text-[var(--color-primary)]">Promouvoir mod</button>
                  )}
                </li>
              ))}
            </ul>
          </section>
        </div>
      </Modal>

      <h2 className="mb-3 mt-6 font-display text-lg font-bold">Fil de la communauté</h2>
      {!c.isMember && c.visibility === "private" ? (
        <div className="rounded-2xl border border-dashed border-[var(--color-border)] p-10 text-center">
          <span className="inline-flex"><Icon name="lock" size={28} /></span>
          <p className="mt-2 font-display text-lg font-bold">Communauté privée</p>
          <p className="mt-1 text-sm text-[var(--color-text-muted)]">Demande à rejoindre pour voir le fil.</p>
        </div>
      ) : (
        <>
          {items === null && <div className="space-y-3">{[0, 1].map((i) => <div key={i} className="h-32 animate-pulse rounded-2xl bg-[var(--color-border)]" />)}</div>}
          {items?.length === 0 && <p className="text-sm text-[var(--color-text-muted)]">Aucune publication. Partage un avis dans cette communauté depuis une fiche !</p>}
          {items?.map((it) => <FeedCard key={it.entry.id} item={it} />)}
        </>
      )}
    </>
  );
}
