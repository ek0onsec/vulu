"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api, ApiError } from "@/lib/api-client";
import { TasteSelector } from "@/components/TasteSelector";
import { SIGNUP_KEY, type SignupDraft } from "@/lib/signup";
import type { Tastes } from "@/server/domain/entities";

export default function OnboardingPage() {
  const router = useRouter();
  const [draft, setDraft] = useState<SignupDraft | null>(null);
  const [tastes, setTastes] = useState<Tastes>({ filmGenreIds: [], people: [] });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const raw = sessionStorage.getItem(SIGNUP_KEY);
    if (!raw) { router.replace("/register"); return; }
    setDraft(JSON.parse(raw) as SignupDraft);
  }, [router]);

  async function finish() {
    if (!draft || tastes.filmGenreIds.length < 3) return;
    setError(null); setBusy(true);
    try {
      await api.post("/api/auth/register", { ...draft, tastes });
      sessionStorage.removeItem(SIGNUP_KEY);
      router.push("/feed");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Inscription impossible");
      setBusy(false);
    }
  }

  if (!draft) return null;
  return (
    <main className="mx-auto flex min-h-screen max-w-lg flex-col justify-center px-5 py-10">
      <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-primary)]">Étape 2/2 · Inscription</p>
      <h1 className="font-display mb-1 mt-1 text-3xl font-bold">Affine tes goûts 🎬</h1>
      <p className="mb-6 text-sm text-[var(--color-text-muted)]">On s’en servira pour te suggérer des films & séries qui te ressemblent.</p>

      <TasteSelector value={tastes} onChange={setTastes} />

      {error && <p className="mt-4 text-sm text-red-500">{error}</p>}
      <button onClick={finish} disabled={busy || tastes.filmGenreIds.length < 3}
        className="mt-6 rounded-full bg-[var(--color-primary)] py-3 text-sm font-semibold text-white disabled:opacity-50">
        {busy ? "…" : "Terminer l’inscription"}
      </button>
    </main>
  );
}
