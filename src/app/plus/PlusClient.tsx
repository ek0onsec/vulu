"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { api, ApiError } from "@/lib/api-client";
import { toast } from "@/lib/toast";
import { CertifiedBadge } from "@/components/CertifiedBadge";
import { Icon } from "@/components/Icon";
import { VuluLogo } from "@/components/VuluLogo";

const PERKS = [
  { icon: "check" as const, title: "Badge certifié vulu+", desc: "Un badge certifié à côté de ton nom, partout dans l’app." },
  { icon: "community" as const, title: "Créer des communautés", desc: "Lance tes propres communautés et anime-les (réservé aux abonnés)." },
  { icon: "sun" as const, title: "Thèmes de couleur exclusifs", desc: "Aurore, Forêt, Rétro, Océan, Crépuscule — prévisualisables par tous, sauvegardables seulement avec vulu+." },
  { icon: "shield" as const, title: "Filtre anti-spoiler IA", desc: "Masque automatiquement les spoilers détectés dans les avis (à venir)." },
  { icon: "trending" as const, title: "Rétrospective avancée", desc: "Ton Wrapped détaillé et des statistiques exclusives (à venir)." },
  { icon: "star" as const, title: "Accès anticipé", desc: "Les nouvelles fonctionnalités en avant-première." },
  { icon: "heart" as const, title: "Soutiens vulu", desc: "Tu aides une app indépendante à grandir sans publicité." },
];

const MONTHLY = 2;
const ANNUAL = Math.round(MONTHLY * 12 * 0.9 * 100) / 100; // -10%

export function PlusClient({ active }: { active: boolean }) {
  const router = useRouter();
  const [plus, setPlus] = useState(active);
  const [period, setPeriod] = useState<"monthly" | "annual">("monthly");
  const [busy, setBusy] = useState(false);

  async function toggle() {
    setBusy(true);
    try {
      await api.post("/api/me/plus", { active: !plus });
      setPlus(!plus);
      toast(!plus ? "Bienvenue dans vulu+ ✨" : "Abonnement vulu+ désactivé");
      router.refresh();
    } catch (e) {
      toast(e instanceof ApiError ? e.message : "Action impossible", "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-lg">
      <div className="rounded-3xl border border-[color-mix(in_srgb,var(--color-primary)_40%,transparent)] bg-gradient-to-br from-[color-mix(in_srgb,var(--color-primary)_12%,transparent)] to-[color-mix(in_srgb,var(--color-accent)_14%,transparent)] p-6 text-center">
        <p className="flex items-center justify-center gap-0.5 font-display text-4xl font-bold"><VuluLogo height={36} /><span className="text-[var(--color-accent)]">+</span></p>
        <p className="mt-1 text-sm text-[var(--color-text-muted)]">Passe au niveau supérieur de vu &amp; lu.</p>

        <div className="mx-auto mt-4 inline-flex rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] p-1">
          <button onClick={() => setPeriod("monthly")}
            className={`rounded-full px-4 py-1.5 text-sm font-semibold ${period === "monthly" ? "bg-[var(--color-primary)] text-white" : "text-[var(--color-text-muted)]"}`}>
            Mensuel
          </button>
          <button onClick={() => setPeriod("annual")}
            className={`rounded-full px-4 py-1.5 text-sm font-semibold ${period === "annual" ? "bg-[var(--color-primary)] text-white" : "text-[var(--color-text-muted)]"}`}>
            Annuel <span className="text-[var(--color-accent)]">-10%</span>
          </button>
        </div>

        {period === "monthly" ? (
          <p className="mt-3 text-3xl font-extrabold">{MONTHLY.toFixed(2).replace(".", ",")}&nbsp;€<span className="text-base font-medium text-[var(--color-text-muted)]">/mois</span></p>
        ) : (
          <p className="mt-3 text-3xl font-extrabold">
            {ANNUAL.toFixed(2).replace(".", ",")}&nbsp;€<span className="text-base font-medium text-[var(--color-text-muted)]">/an</span>
            <span className="mt-1 block text-xs font-medium text-[var(--color-text-muted)]">soit {(ANNUAL / 12).toFixed(2).replace(".", ",")} €/mois — 2 mois offerts</span>
          </p>
        )}
        {plus ? (
          <p className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-[var(--color-surface)] px-4 py-2 text-sm font-semibold text-[var(--color-primary)]">
            <CertifiedBadge /> Tu es abonné vulu+
          </p>
        ) : null}
        <button onClick={toggle} disabled={busy}
          className={`mt-4 w-full rounded-full py-3 text-sm font-bold disabled:opacity-50 ${plus ? "border border-[var(--color-border)] text-[var(--color-text)]" : "bg-[var(--color-primary)] text-white"}`}>
          {busy ? "…" : plus ? "Gérer / se désabonner" : period === "annual" ? "S’abonner à l’année" : "S’abonner au mois"}
        </button>
        <p className="mt-2 text-xs text-[var(--color-text-muted)]">Paiement de démonstration — Stripe branché plus tard.</p>
      </div>

      <ul className="mt-6 flex flex-col gap-3">
        {PERKS.map((p) => (
          <li key={p.title} className="flex items-start gap-3 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
            <span className="rounded-full bg-[color-mix(in_srgb,var(--color-primary)_14%,transparent)] p-2 text-[var(--color-primary)]"><Icon name={p.icon} size={18} /></span>
            <div>
              <p className="font-semibold">{p.title}</p>
              <p className="text-sm text-[var(--color-text-muted)]">{p.desc}</p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
