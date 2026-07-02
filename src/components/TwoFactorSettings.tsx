"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { api, ApiError } from "@/lib/api-client";
import { toast } from "@/lib/toast";
import { Modal } from "@/components/Modal";
import { Icon } from "@/components/Icon";

const field = "w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] px-4 py-2.5 text-sm";
const primaryBtn = "rounded-full bg-[var(--color-primary)] px-5 py-2 text-sm font-semibold text-white disabled:opacity-50";

type Setup = { qrSvg: string; secret: string };

/** Bloc « Double authentification » des réglages : activation (QR + code), codes de secours, désactivation. */
export function TwoFactorSettings({ enabled }: { enabled: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [setup, setSetup] = useState<Setup | null>(null);
  const [code, setCode] = useState("");
  const [backupCodes, setBackupCodes] = useState<string[] | null>(null);
  const [disableOpen, setDisableOpen] = useState(false);
  const [pwd, setPwd] = useState("");

  async function run(fn: () => Promise<void>) {
    setBusy(true);
    try { await fn(); } catch (e) { toast(e instanceof ApiError ? e.message : "Erreur", "error"); } finally { setBusy(false); }
  }

  const begin = () => run(async () => {
    const res = await api.post<Setup>("/api/me/2fa/setup");
    setSetup({ qrSvg: res.qrSvg, secret: res.secret }); setCode("");
  });
  const confirm = () => run(async () => {
    const res = await api.post<{ backupCodes: string[] }>("/api/me/2fa/confirm", { code });
    setSetup(null); setCode(""); setBackupCodes(res.backupCodes); router.refresh();
    toast("Double authentification activée ✅");
  });
  const disable = () => run(async () => {
    await api.post("/api/me/2fa/disable", { password: pwd });
    setDisableOpen(false); setPwd(""); router.refresh();
    toast("Double authentification désactivée");
  });

  // Écran des codes de secours (après activation) — affichés une seule fois.
  if (backupCodes) return (
    <div className="rounded-xl border border-[var(--color-border)] p-4">
      <p className="mb-1 flex items-center gap-2 text-sm font-semibold"><Icon name="shield" size={18} /> Codes de secours</p>
      <p className="mb-3 text-xs text-[var(--color-text-muted)]">Conserve-les précieusement : chacun ne fonctionne qu’une fois et remplace ton téléphone en cas de perte. Ils ne seront plus jamais affichés.</p>
      <div className="mb-3 grid grid-cols-2 gap-2">
        {backupCodes.map((c) => (
          <code key={c} className="rounded-lg bg-[var(--color-bg)] px-3 py-2 text-center font-mono text-sm tracking-wider">{c}</code>
        ))}
      </div>
      <div className="flex gap-2">
        <button onClick={() => { navigator.clipboard?.writeText(backupCodes.join("\n")); toast("Codes copiés"); }}
          className="rounded-full border border-[var(--color-border)] px-4 py-2 text-sm font-semibold">Copier</button>
        <button onClick={() => setBackupCodes(null)} className={primaryBtn}>J’ai noté mes codes</button>
      </div>
    </div>
  );

  // Écran de configuration en cours (QR + saisie du code).
  if (setup) return (
    <div className="rounded-xl border border-[var(--color-border)] p-4">
      <p className="mb-2 text-sm font-semibold">1. Scanne ce QR code</p>
      <p className="mb-3 text-xs text-[var(--color-text-muted)]">Avec Google Authenticator, Authy, 1Password ou une autre appli TOTP.</p>
      {/* Rendu via data-URI (pas d'injection HTML) : le SVG est encodé comme image, jamais interprété comme markup dans le DOM. */}
      <img alt="QR code de configuration 2FA" className="mx-auto mb-3 w-40 rounded-xl bg-white p-2"
        src={`data:image/svg+xml;utf8,${encodeURIComponent(setup.qrSvg)}`} />
      <p className="mb-1 text-xs text-[var(--color-text-muted)]">Ou saisis la clé manuellement :</p>
      <code className="mb-4 block break-all rounded-lg bg-[var(--color-bg)] px-3 py-2 text-center font-mono text-xs tracking-wider">{setup.secret}</code>
      <p className="mb-2 text-sm font-semibold">2. Entre le code à 6 chiffres</p>
      <div className="flex gap-2">
        <input className={field} inputMode="numeric" autoComplete="one-time-code" placeholder="123456"
          value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))} />
        <button onClick={confirm} disabled={busy || code.length < 6} className={primaryBtn}>Activer</button>
      </div>
      <button onClick={() => setSetup(null)} className="mt-3 text-sm font-medium text-[var(--color-text-muted)]">Annuler</button>
    </div>
  );

  // État nominal : activée ou désactivée.
  return (
    <>
      <div className="flex items-center justify-between rounded-xl border border-[var(--color-border)] p-3">
        <div className="pr-4">
          <p className="text-sm font-medium">Double authentification (2FA)</p>
          <p className="text-xs text-[var(--color-text-muted)]">Application d’authentification (TOTP).</p>
        </div>
        {enabled ? (
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-[color-mix(in_srgb,var(--color-primary)_16%,transparent)] px-3 py-1 text-xs font-semibold text-[var(--color-primary)]">Activée</span>
            <button onClick={() => { setPwd(""); setDisableOpen(true); }} className="text-sm font-semibold text-red-500">Désactiver</button>
          </div>
        ) : (
          <button onClick={begin} disabled={busy} className={primaryBtn}>Configurer</button>
        )}
      </div>

      <Modal open={disableOpen} onClose={() => setDisableOpen(false)} title="Désactiver la 2FA">
        <p className="text-sm text-[var(--color-text-muted)]">Confirme avec ton mot de passe. Tes codes de secours seront invalidés.</p>
        <input className={`${field} mt-3`} type="password" placeholder="Mot de passe" value={pwd} onChange={(e) => setPwd(e.target.value)} />
        <button onClick={disable} disabled={busy || !pwd} className="mt-4 w-full rounded-full bg-red-500 py-2.5 text-sm font-bold text-white disabled:opacity-40">
          {busy ? "…" : "Désactiver"}
        </button>
      </Modal>
    </>
  );
}
