"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api, ApiError } from "@/lib/api-client";
import { toast } from "@/lib/toast";
import { TasteSelector } from "@/components/TasteSelector";
import { ThemeToggle } from "@/components/ThemeToggle";
import { ThemePicker } from "@/components/ThemePicker";
import { Modal } from "@/components/Modal";
import { Icon, type IconName } from "@/components/Icon";
import { BrandLogo } from "@/components/BrandLogo";
import { TwoFactorSettings } from "@/components/TwoFactorSettings";
import { InviteSection } from "@/components/InviteSection";
import { useTour } from "@/components/tour/TourProvider";
import type { Tastes } from "@/server/domain/entities";

const DELETE_PHRASE = "SUPPRIMER MON COMPTE";
const field = "w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] px-4 py-2.5 text-sm";
const primaryBtn = "rounded-full bg-[var(--color-primary)] px-5 py-2 text-sm font-semibold text-white disabled:opacity-50";

type SectionId = "account" | "plus" | "security" | "privacy" | "display" | "interests" | "accessibility" | "legal" | "community" | "invite";
const SECTIONS: { id: SectionId; label: string; icon: IconName; desc: string }[] = [
  { id: "account", label: "Votre compte", icon: "profile", desc: "Infos, mot de passe, archive, suppression" },
  { id: "plus", label: "vulu+", icon: "star", desc: "Gérer l’abonnement" },
  { id: "security", label: "Sécurité", icon: "shield", desc: "2FA, sessions actives" },
  { id: "privacy", label: "Confidentialité", icon: "lock", desc: "Compte privé, anti-spoiler" },
  { id: "display", label: "Affichage", icon: "sun", desc: "Thème et apparence" },
  { id: "accessibility", label: "Accessibilité", icon: "shield", desc: "Tutoriel, aides" },
  { id: "interests", label: "Centres d’intérêt", icon: "heart", desc: "Genres et favoris" },
  { id: "community", label: "Rejoins-nous", icon: "user-plus", desc: "Discord" },
  { id: "invite", label: "Parrainage", icon: "user-plus", desc: "Ton code d'invitation et tes filleuls" },
  { id: "legal", label: "Légal", icon: "dots", desc: "Conditions, confidentialité, cookies" },
];

export function SettingsClient({ initialTastes, initialPrivate, username, email, twoFactorEnabled, plus }: {
  initialTastes: Tastes; initialPrivate: boolean; username: string; email: string; twoFactorEnabled: boolean; plus: boolean;
}) {
  const router = useRouter();
  const { startTour } = useTour();
  const [section, setSection] = useState<SectionId | null>(null);
  const [busy, setBusy] = useState(false);

  const [tastes, setTastes] = useState<Tastes>(initialTastes);
  const [isPrivate, setIsPrivate] = useState(initialPrivate);
  const [antiSpoiler, setAntiSpoiler] = useState(false);
  const [uname, setUname] = useState(username);
  const [unamePwd, setUnamePwd] = useState("");
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
  const saveUsername = () => run(async () => { await api.put("/api/me/username", { username: uname, currentPassword: unamePwd }); setUnamePwd(""); toast("Nom d'utilisateur mis à jour"); router.refresh(); });
  const saveEmail = () => run(async () => { await api.put("/api/me/email", { email: mail, currentPassword: mailPwd }); setMailPwd(""); toast("Email mis à jour"); });
  const savePassword = () => run(async () => { await api.put("/api/me/password", { currentPassword: curPwd, newPassword: newPwd }); setCurPwd(""); setNewPwd(""); toast("Mot de passe mis à jour"); });

  async function togglePrivate() {
    const next = !isPrivate; setIsPrivate(next);
    try { await api.post("/api/me/privacy", { private: next }); toast(next ? "Compte passé en privé 🔒" : "Compte repassé en public"); router.refresh(); }
    catch (e) { setIsPrivate(!next); toast(e instanceof ApiError ? e.message : "Erreur", "error"); }
  }
  async function deleteAccount() {
    setBusy(true);
    try { await api.post("/api/me/delete"); router.push("/login?deleted=1"); }
    catch (e) { toast(e instanceof ApiError ? e.message : "Erreur", "error"); setBusy(false); }
  }
  async function logout() { await api.post("/api/auth/logout").catch(() => {}); router.push("/login"); }

  const Toggle = ({ on, onClick, disabled }: { on: boolean; onClick: () => void; disabled?: boolean }) => (
    <button onClick={onClick} disabled={disabled} role="switch" aria-checked={on}
      className={`relative h-7 w-12 shrink-0 rounded-full transition-colors disabled:opacity-40 ${on ? "bg-[var(--color-primary)]" : "bg-[var(--color-border)]"}`}>
      <span className={`absolute top-0.5 h-6 w-6 rounded-full bg-white transition-all ${on ? "left-[1.4rem]" : "left-0.5"}`} />
    </button>
  );

  function Panel() {
    const cur = section ?? "account";
    if (cur === "account") return (
      <>
        <h2 className="mb-4 font-display text-xl font-bold">Votre compte</h2>
        <label className="mb-1 block text-sm font-semibold">Nom d’utilisateur</label>
        <div className="relative mb-2">
          <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-sm font-semibold text-[var(--color-text-muted)]">@</span>
          <input className={`${field} pl-8`} value={uname} onChange={(e) => setUname(e.target.value.replace(/^@+/, ""))} />
        </div>
        <div className="mb-5 flex gap-2">
          <input className={field} type="password" placeholder="Mot de passe actuel" value={unamePwd} onChange={(e) => setUnamePwd(e.target.value)} />
          <button onClick={saveUsername} disabled={busy || !unamePwd || uname === username} className={primaryBtn}>OK</button>
        </div>
        <label className="mb-1 block text-sm font-semibold">Email</label>
        <input className={`${field} mb-2`} type="email" value={mail} onChange={(e) => setMail(e.target.value)} />
        <div className="mb-5 flex gap-2">
          <input className={field} type="password" placeholder="Mot de passe actuel" value={mailPwd} onChange={(e) => setMailPwd(e.target.value)} />
          <button onClick={saveEmail} disabled={busy || !mailPwd || mail === email} className={primaryBtn}>OK</button>
        </div>
        <label className="mb-1 block text-sm font-semibold">Changer de mot de passe</label>
        <input className={`${field} mb-2`} type="password" placeholder="Mot de passe actuel" value={curPwd} onChange={(e) => setCurPwd(e.target.value)} />
        <div className="mb-5 flex gap-2">
          <input className={field} type="password" placeholder="Nouveau (8 car. min.)" value={newPwd} onChange={(e) => setNewPwd(e.target.value)} />
          <button onClick={savePassword} disabled={busy || !curPwd || newPwd.length < 8} className={primaryBtn}>OK</button>
        </div>
        <a href="/api/me/export" className="mb-3 flex items-center gap-2 text-sm font-semibold text-[var(--color-primary)]">
          <Icon name="download" size={18} /> Télécharger une archive de vos données
        </a>
        <button onClick={() => { setConfirmText(""); setDeleteOpen(true); }} className="flex items-center gap-2 text-sm font-semibold text-red-500">
          <Icon name="logout" size={18} /> Supprimer mon compte
        </button>
        <button onClick={logout} className="mt-4 block text-sm font-medium text-[var(--color-text-muted)]">Se déconnecter</button>
      </>
    );
    if (cur === "plus") return (
      <>
        <h2 className="mb-4 font-display text-xl font-bold">vulu+</h2>
        <p className="mb-4 text-sm text-[var(--color-text-muted)]">{plus ? "Tu es abonné vulu+. Merci de soutenir vulu ✨" : "Débloque le badge certifié, l’anti-spoiler et les thèmes exclusifs."}</p>
        <Link href="/plus" className={`inline-block ${primaryBtn}`}>{plus ? "Gérer mon abonnement" : "Découvrir vulu+"}</Link>
      </>
    );
    if (cur === "security") return (
      <>
        <h2 className="mb-4 font-display text-xl font-bold">Sécurité</h2>
        <div className="mb-3"><TwoFactorSettings enabled={twoFactorEnabled} /></div>
        <div className="flex items-center justify-between rounded-xl border border-[var(--color-border)] p-3">
          <div><p className="text-sm font-medium">Sessions actives</p><p className="text-xs text-[var(--color-text-muted)]">Gérer les appareils connectés.</p></div>
          <span className="rounded-full bg-[var(--color-border)] px-3 py-1 text-xs font-semibold text-[var(--color-text-muted)]">Bientôt</span>
        </div>
      </>
    );
    if (cur === "privacy") return (
      <>
        <h2 className="mb-4 font-display text-xl font-bold">Confidentialité</h2>
        <div className="mb-3 flex items-center justify-between rounded-xl border border-[var(--color-border)] p-3">
          <div className="pr-4"><p className="text-sm font-medium">Compte privé 🔒</p><p className="text-xs text-[var(--color-text-muted)]">Seuls tes abonnés mutuels te verront. Les nouveaux abonnés enverront une demande.</p></div>
          <Toggle on={isPrivate} onClick={togglePrivate} />
        </div>
        <div className="mb-3 flex items-center justify-between rounded-xl border border-[var(--color-border)] p-3">
          <div className="pr-4"><p className="flex items-center gap-1 text-sm font-medium">Filtre anti-spoiler {!plus && <span className="rounded bg-[color-mix(in_srgb,var(--color-primary)_16%,transparent)] px-1.5 text-[0.65rem] font-bold text-[var(--color-primary)]">vulu+</span>}</p><p className="text-xs text-[var(--color-text-muted)]">Masque automatiquement les spoilers détectés par l’IA (à venir).</p></div>
          <Toggle on={antiSpoiler} disabled={!plus} onClick={() => { setAntiSpoiler((v) => !v); toast("Anti-spoiler : effet à venir"); }} />
        </div>
        <Link href="/demandes" className="flex items-center gap-2 text-sm font-semibold text-[var(--color-primary)]"><Icon name="user-plus" size={18} /> Demandes de suivi</Link>
      </>
    );
    if (cur === "display") return (
      <>
        <h2 className="mb-4 font-display text-xl font-bold">Affichage</h2>
        <div className="mb-4 flex items-center justify-between rounded-xl border border-[var(--color-border)] p-3">
          <span className="text-sm font-medium">Thème clair / sombre</span><ThemeToggle />
        </div>
        <p className="mb-2 text-sm font-semibold">Thèmes de couleur {!plus && <span className="text-xs font-normal text-[var(--color-text-muted)]">(aperçu — sauvegarde réservée à vulu+)</span>}</p>
        <ThemePicker plus={plus} />
      </>
    );
    if (cur === "accessibility") return (
      <>
        <h2 className="mb-4 font-display text-xl font-bold">Accessibilité</h2>
        <div className="rounded-2xl border border-[var(--color-border)] p-4">
          <h3 className="mb-1 font-display text-lg font-bold">Tutoriel</h3>
          <p className="mb-3 text-sm text-[var(--color-text-muted)]">Revois le fonctionnement de l'app avec l'app tour guidé.</p>
          <button onClick={startTour} className="rounded-full bg-[var(--color-primary)] px-5 py-2.5 text-sm font-bold text-white active:scale-[0.98]">
            (Re)lancer l'app tour
          </button>
        </div>
      </>
    );
    if (cur === "interests") return (
      <>
        <h2 className="mb-4 font-display text-xl font-bold">Centres d’intérêt</h2>
        <TasteSelector value={tastes} onChange={setTastes} showBooks showPeople />
        <button onClick={saveTastes} disabled={busy || tastes.filmGenreIds.length < 3} className={`mt-4 ${primaryBtn}`}>Enregistrer</button>
      </>
    );
    if (cur === "community") return (
      <>
        <h2 className="mb-4 font-display text-xl font-bold">Rejoins la communauté vulu</h2>
        <div className="flex flex-col gap-2">
          <a href="https://discord.gg/sgnZmxxUnx" target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 rounded-xl border border-[var(--color-border)] p-3 text-sm font-medium transition-colors hover:border-[var(--color-primary)]"><BrandLogo brand="discord" /> Rejoins le serveur Discord</a>
        </div>
      </>
    );
    if (cur === "invite") return <InviteSection />;
    return (
      <>
        <h2 className="mb-4 font-display text-xl font-bold">Légal</h2>
        {["Conditions d’utilisation", "Politique de confidentialité", "Politique relative aux cookies", "Mentions légales"].map((t) => (
          <div key={t} className="mb-2 flex items-center justify-between rounded-xl border border-[var(--color-border)] p-3 text-sm">
            <span>{t}</span><span className="text-xs text-[var(--color-text-muted)]">Bientôt</span>
          </div>
        ))}
      </>
    );
  }

  return (
    <div className="md:grid md:grid-cols-[230px_1fr] md:gap-6">
      <nav className={`${section ? "hidden" : "block"} md:block`}>
        <h1 className="font-display mb-4 text-2xl font-bold">Paramètres</h1>
        <ul className="flex flex-col gap-1">
          {SECTIONS.map((s) => (
            <li key={s.id}>
              <button onClick={() => setSection(s.id)} data-tour={s.id === "accessibility" ? "settings-accessibility" : undefined}
                className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors ${section === s.id ? "bg-[color-mix(in_srgb,var(--color-primary)_12%,transparent)] text-[var(--color-primary)]" : "hover:bg-[var(--color-border)]"}`}>
                <Icon name={s.icon} size={20} />
                <span className="min-w-0"><span className="block text-sm font-semibold">{s.label}</span><span className="block truncate text-xs text-[var(--color-text-muted)]">{s.desc}</span></span>
              </button>
            </li>
          ))}
        </ul>
      </nav>

      <div className={`${section ? "block" : "hidden"} md:block`}>
        {section && <button onClick={() => setSection(null)} className="mb-3 flex items-center gap-1.5 text-sm font-medium text-[var(--color-text-muted)] md:hidden"><Icon name="back" size={18} /> Paramètres</button>}
        <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5">{Panel()}</div>
      </div>

      <Modal open={deleteOpen} onClose={() => setDeleteOpen(false)} title="Supprimer mon compte">
        <p className="text-sm text-[var(--color-text)]">Veux-tu vraiment supprimer ton compte vulu ?</p>
        <p className="mt-2 text-sm text-[var(--color-text-muted)]">Ton compte sera <strong>désactivé immédiatement</strong> et tu seras déconnecté. Tes commentaires, avis et collections seront <strong>définitivement supprimés sous 48 h</strong>. Pour <strong>annuler</strong>, reconnecte-toi dans ce délai.</p>
        <p className="mt-4 text-sm font-medium">Pour confirmer, écris <span className="font-bold">{DELETE_PHRASE}</span> :</p>
        <input className={`${field} mt-2`} value={confirmText} onChange={(e) => setConfirmText(e.target.value)} placeholder={DELETE_PHRASE} />
        <button onClick={deleteAccount} disabled={busy || confirmText !== DELETE_PHRASE} className="mt-4 w-full rounded-full bg-red-500 py-2.5 text-sm font-bold text-white disabled:opacity-40">
          {busy ? "…" : "Désactiver et programmer la suppression"}
        </button>
      </Modal>
    </div>
  );
}
