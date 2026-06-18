"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api, ApiError } from "@/lib/api-client";
import { toast } from "@/lib/toast";
import { TasteSelector } from "@/components/TasteSelector";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Icon } from "@/components/Icon";
import type { Tastes } from "@/server/domain/entities";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-6 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
      <h2 className="mb-4 font-display text-lg font-bold">{title}</h2>
      {children}
    </section>
  );
}

export function SettingsClient({ initialTastes }: { initialTastes: Tastes }) {
  const router = useRouter();
  const [tastes, setTastes] = useState<Tastes>(initialTastes);
  const [busy, setBusy] = useState(false);

  async function saveTastes() {
    setBusy(true);
    try {
      await api.put("/api/me/tastes", tastes);
      toast("Goûts enregistrés");
    } catch (e) {
      toast(e instanceof ApiError ? e.message : "Erreur", "error");
    } finally {
      setBusy(false);
    }
  }

  async function logout() {
    await api.post("/api/auth/logout").catch(() => {});
    router.push("/login");
  }

  return (
    <div className="mx-auto max-w-xl">
      <h1 className="font-display mb-5 text-2xl font-bold">Paramètres</h1>

      <Section title="Centre d’intérêt">
        <p className="mb-3 text-sm text-[var(--color-text-muted)]">Affine tes genres pour de meilleures recommandations.</p>
        <TasteSelector value={tastes} onChange={setTastes} />
        <button onClick={saveTastes} disabled={busy || tastes.filmGenreIds.length < 3}
          className="mt-4 rounded-full bg-[var(--color-primary)] px-6 py-2.5 text-sm font-semibold text-white disabled:opacity-50">
          {busy ? "…" : "Enregistrer"}
        </button>
      </Section>

      <Section title="Préférences & affichage">
        <div className="flex items-center justify-between">
          <span className="text-sm">Thème clair / sombre</span>
          <ThemeToggle />
        </div>
      </Section>

      <Section title="Confidentialité & sécurité">
        <div className="flex items-center justify-between opacity-70">
          <div>
            <p className="text-sm font-medium">Compte privé</p>
            <p className="text-xs text-[var(--color-text-muted)]">Seuls tes abonnés mutuels verront ton profil (demandes à approuver).</p>
          </div>
          <span className="rounded-full bg-[var(--color-border)] px-3 py-1 text-xs font-semibold text-[var(--color-text-muted)]">Bientôt</span>
        </div>
      </Section>

      <Section title="Compte">
        <Link href="/plus" className="mb-3 flex items-center gap-2 text-sm font-semibold text-[var(--color-primary)]">
          <Icon name="star" size={18} /> Passer à vulu+
        </Link>
        <button onClick={logout} className="flex items-center gap-2 text-sm font-semibold text-red-500">
          <Icon name="logout" size={18} /> Se déconnecter
        </button>
      </Section>
    </div>
  );
}
