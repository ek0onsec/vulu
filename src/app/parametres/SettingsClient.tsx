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

export function SettingsClient({ initialTastes, initialPrivate }: { initialTastes: Tastes; initialPrivate: boolean }) {
  const router = useRouter();
  const [tastes, setTastes] = useState<Tastes>(initialTastes);
  const [isPrivate, setIsPrivate] = useState(initialPrivate);
  const [busy, setBusy] = useState(false);

  async function togglePrivate() {
    const next = !isPrivate;
    setIsPrivate(next);
    try {
      await api.post("/api/me/privacy", { private: next });
      toast(next ? "Compte passé en privé" : "Compte repassé en public");
    } catch (e) {
      setIsPrivate(!next);
      toast(e instanceof ApiError ? e.message : "Erreur", "error");
    }
  }

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
        <p className="mt-3 text-xs text-[var(--color-text-muted)]">Changer l’email, le mot de passe et activer la 2FA : bientôt.</p>
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
