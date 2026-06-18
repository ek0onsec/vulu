"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api, ApiError } from "@/lib/api-client";
import { toast } from "@/lib/toast";
import { TasteSelector } from "@/components/TasteSelector";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Modal } from "@/components/Modal";
import { Icon } from "@/components/Icon";
import type { Tastes } from "@/server/domain/entities";

const DELETE_PHRASE = "SUPPRIMER MON COMPTE";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-6 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
      <h2 className="mb-4 font-display text-lg font-bold">{title}</h2>
      {children}
    </section>
  );
}

const field = "w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] px-4 py-2.5 text-sm";
const primaryBtn = "rounded-full bg-[var(--color-primary)] px-5 py-2 text-sm font-semibold text-white disabled:opacity-50";

export function SettingsClient({ initialTastes, initialPrivate, username, email, twoFactorEnabled }: {
  initialTastes: Tastes; initialPrivate: boolean; username: string; email: string; twoFactorEnabled: boolean;
}) {
  const router = useRouter();
  const [tastes, setTastes] = useState<Tastes>(initialTastes);
  const [isPrivate, setIsPrivate] = useState(initialPrivate);
  const [busy, setBusy] = useState(false);

  const [uname, setUname] = useState(username);
  const [mail, setMail] = useState(email);
  const [mailPwd, setMailPwd] = useState("");
  const [curPwd, setCurPwd] = useState("");
  const [newPwd, setNewPwd] = useState("");
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");

  async function run(fn: () => Promise<void>) {
    setBusy(true);
    try { await fn(); } catch (e) { toast(e instanceof ApiError ? e.message : "Erreur", "error"); } finally { setBusy(false); }
  }

  const saveTastes = () => run(async () => { await api.put("/api/me/tastes", tastes); toast("Goûts enregistrés"); });
  const saveUsername = () => run(async () => { await api.put("/api/me/username", { username: uname }); toast("Nom d'utilisateur mis à jour"); router.refresh(); });
  const saveEmail = () => run(async () => { await api.put("/api/me/email", { email: mail, currentPassword: mailPwd }); setMailPwd(""); toast("Email mis à jour"); });
  const savePassword = () => run(async () => { await api.put("/api/me/password", { currentPassword: curPwd, newPassword: newPwd }); setCurPwd(""); setNewPwd(""); toast("Mot de passe mis à jour"); });

  async function togglePrivate() {
    const next = !isPrivate; setIsPrivate(next);
    try { await api.post("/api/me/privacy", { private: next }); toast(next ? "Compte passé en privé" : "Compte repassé en public"); }
    catch (e) { setIsPrivate(!next); toast(e instanceof ApiError ? e.message : "Erreur", "error"); }
  }

  async function deleteAccount() {
    setBusy(true);
    try {
      await api.post("/api/me/delete");
      router.push("/login?deleted=1");
    } catch (e) {
      toast(e instanceof ApiError ? e.message : "Erreur", "error");
      setBusy(false);
    }
  }

  async function logout() { await api.post("/api/auth/logout").catch(() => {}); router.push("/login"); }

  return (
    <div className="mx-auto max-w-xl">
      <h1 className="font-display mb-5 text-2xl font-bold">Paramètres</h1>

      <Section title="Centre d’intérêt">
        <p className="mb-3 text-sm text-[var(--color-text-muted)]">Affine tes genres pour de meilleures recommandations.</p>
        <TasteSelector value={tastes} onChange={setTastes} />
        <button onClick={saveTastes} disabled={busy || tastes.filmGenreIds.length < 3} className={`mt-4 ${primaryBtn}`}>Enregistrer</button>
      </Section>

      <Section title="Préférences & affichage">
        <div className="flex items-center justify-between">
          <span className="text-sm">Thème clair / sombre</span>
          <ThemeToggle />
        </div>
      </Section>

      <Section title="Confidentialité">
        <div className="flex items-center justify-between">
          <div className="pr-4">
            <p className="text-sm font-medium">Compte privé</p>
            <p className="text-xs text-[var(--color-text-muted)]">Seuls tes abonnés mutuels verront ton profil. Les nouveaux abonnés devront envoyer une demande.</p>
          </div>
          <button onClick={togglePrivate} role="switch" aria-checked={isPrivate}
            className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${isPrivate ? "bg-[var(--color-primary)]" : "bg-[var(--color-border)]"}`}>
            <span className={`absolute top-0.5 h-6 w-6 rounded-full bg-white transition-all ${isPrivate ? "left-[1.4rem]" : "left-0.5"}`} />
          </button>
        </div>
        <Link href="/demandes" className="mt-4 flex items-center gap-2 text-sm font-semibold text-[var(--color-primary)]">
          <Icon name="user-plus" size={18} /> Demandes de suivi
        </Link>
      </Section>

      <Section title="Rejoins la communauté vulu">
        <p className="mb-3 text-sm text-[var(--color-text-muted)]">Suis l’aventure, propose des idées, rencontre d’autres passionnés.</p>
        <div className="flex flex-col gap-2">
          <a href="https://discord.gg/vulu" target="_blank" rel="noopener noreferrer"
            className="flex items-center justify-between rounded-xl border border-[var(--color-border)] p-3 text-sm font-medium transition-colors hover:border-[var(--color-primary)]">
            <span>💬 Discord — rejoins le serveur</span><span className="text-[var(--color-text-muted)]">↗</span>
          </a>
          <a href="https://instagram.com/vulu.app" target="_blank" rel="noopener noreferrer"
            className="flex items-center justify-between rounded-xl border border-[var(--color-border)] p-3 text-sm font-medium transition-colors hover:border-[var(--color-primary)]">
            <span>📸 Instagram — @vulu.app</span><span className="text-[var(--color-text-muted)]">↗</span>
          </a>
          <a href="https://x.com/vulu_app" target="_blank" rel="noopener noreferrer"
            className="flex items-center justify-between rounded-xl border border-[var(--color-border)] p-3 text-sm font-medium transition-colors hover:border-[var(--color-primary)]">
            <span>𝕏 — @vulu_app</span><span className="text-[var(--color-text-muted)]">↗</span>
          </a>
        </div>
      </Section>

      <Section title="Compte & sécurité">
        <label className="mb-1 block text-sm font-semibold">Nom d’utilisateur</label>
        <div className="mb-4 flex gap-2">
          <input className={field} value={uname} onChange={(e) => setUname(e.target.value)} />
          <button onClick={saveUsername} disabled={busy || uname === username} className={primaryBtn}>OK</button>
        </div>

        <label className="mb-1 block text-sm font-semibold">Email</label>
        <input className={`${field} mb-2`} type="email" value={mail} onChange={(e) => setMail(e.target.value)} />
        <div className="mb-4 flex gap-2">
          <input className={field} type="password" placeholder="Mot de passe actuel" value={mailPwd} onChange={(e) => setMailPwd(e.target.value)} />
          <button onClick={saveEmail} disabled={busy || !mailPwd || mail === email} className={primaryBtn}>OK</button>
        </div>

        <label className="mb-1 block text-sm font-semibold">Mot de passe</label>
        <input className={`${field} mb-2`} type="password" placeholder="Mot de passe actuel" value={curPwd} onChange={(e) => setCurPwd(e.target.value)} />
        <div className="mb-4 flex gap-2">
          <input className={field} type="password" placeholder="Nouveau (8 car. min.)" value={newPwd} onChange={(e) => setNewPwd(e.target.value)} />
          <button onClick={savePassword} disabled={busy || !curPwd || newPwd.length < 8} className={primaryBtn}>OK</button>
        </div>

        <div className="flex items-center justify-between rounded-xl border border-[var(--color-border)] p-3">
          <div>
            <p className="text-sm font-medium">Double authentification (2FA)</p>
            <p className="text-xs text-[var(--color-text-muted)]">Par application d’authentification (TOTP).</p>
          </div>
          <span className="rounded-full bg-[var(--color-border)] px-3 py-1 text-xs font-semibold text-[var(--color-text-muted)]">{twoFactorEnabled ? "Activée" : "Bientôt"}</span>
        </div>
      </Section>

      <Section title="Compte">
        <Link href="/plus" className="mb-3 flex items-center gap-2 text-sm font-semibold text-[var(--color-primary)]">
          <Icon name="star" size={18} /> Passer à vulu+
        </Link>
        <button onClick={logout} className="mb-4 flex items-center gap-2 text-sm font-semibold">
          <Icon name="logout" size={18} /> Se déconnecter
        </button>
        <button onClick={() => { setConfirmText(""); setDeleteOpen(true); }} className="text-sm font-semibold text-red-500">
          Supprimer mon compte
        </button>
      </Section>

      <Modal open={deleteOpen} onClose={() => setDeleteOpen(false)} title="Supprimer mon compte">
        <p className="text-sm text-[var(--color-text)]">Veux-tu vraiment supprimer ton compte vulu ?</p>
        <p className="mt-2 text-sm text-[var(--color-text-muted)]">
          Ton compte sera <strong>désactivé immédiatement</strong> et tu seras déconnecté. Tes commentaires, avis et collections seront
          <strong> définitivement supprimés sous 48 h</strong>. Pour <strong>annuler</strong>, il te suffit de te reconnecter dans ce délai.
        </p>
        <p className="mt-4 text-sm font-medium">Pour confirmer, écris <span className="font-bold">{DELETE_PHRASE}</span> :</p>
        <input className={`${field} mt-2`} value={confirmText} onChange={(e) => setConfirmText(e.target.value)} placeholder={DELETE_PHRASE} />
        <button onClick={deleteAccount} disabled={busy || confirmText !== DELETE_PHRASE}
          className="mt-4 w-full rounded-full bg-red-500 py-2.5 text-sm font-bold text-white disabled:opacity-40">
          {busy ? "…" : "Désactiver et programmer la suppression"}
        </button>
      </Modal>
    </div>
  );
}
