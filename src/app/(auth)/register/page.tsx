"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Domain } from "@/server/domain/entities";
import { SIGNUP_KEY, type SignupDraft } from "@/lib/signup";
import { api } from "@/lib/api-client";
import { VuluLogo } from "@/components/VuluLogo";

export default function RegisterPage() {
  const router = useRouter();
  const [draft, setDraft] = useState<SignupDraft>({
    email: "", username: "", displayName: "", password: "", activeTabs: ["films"],
  });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const raw = sessionStorage.getItem(SIGNUP_KEY);
    if (raw) setDraft(JSON.parse(raw) as SignupDraft);
  }, []);

  function toggleTab(tab: Domain) {
    setDraft((d) => {
      const has = d.activeTabs.includes(tab);
      const next = has ? d.activeTabs.filter((t) => t !== tab) : [...d.activeTabs, tab];
      return { ...d, activeTabs: next.length ? next : d.activeTabs };
    });
  }

  async function next(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const username = draft.username.trim().toLowerCase();
    const email = draft.email.trim().toLowerCase();
    if (!draft.displayName.trim()) { setError("Renseigne un nom affiché"); return; }
    if (!/^[a-z0-9_]{3,20}$/.test(username)) { setError("Pseudo invalide (3–20 caractères : lettres, chiffres, _)"); return; }
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { setError("Email invalide"); return; }
    if (draft.password.length < 8) { setError("Mot de passe : 8 caractères minimum"); return; }
    setBusy(true);
    try {
      const r = await api.get<{ usernameAvailable: boolean; emailAvailable: boolean }>(
        `/api/auth/check-account?u=${encodeURIComponent(username)}&e=${encodeURIComponent(email)}`,
      );
      if (!r.usernameAvailable) { setError("Ce nom d'utilisateur est déjà pris"); return; }
      if (!r.emailAvailable) { setError("Cet email est déjà utilisé"); return; }
      sessionStorage.setItem(SIGNUP_KEY, JSON.stringify(draft));
      router.push("/onboarding");
    } catch {
      setError("Vérification impossible, réessaie");
    } finally {
      setBusy(false);
    }
  }

  const field = "rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3 text-sm";
  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-5">
      <VuluLogo height={40} className="mb-1" />
      <p className="mb-6 text-sm text-[var(--color-text-muted)]">Étape 1/2 · Crée ton compte.</p>
      <form onSubmit={next} className="flex flex-col gap-3">
        <input className={field} placeholder="Nom affiché" value={draft.displayName}
          onChange={(e) => setDraft({ ...draft, displayName: e.target.value })} required />
        <div className={`${field} flex items-center gap-1 px-0`}>
          <span className="pl-4 font-semibold text-[var(--color-text-muted)]">@</span>
          <input className="min-w-0 flex-1 bg-transparent pr-4 outline-none" placeholder="pseudo" value={draft.username}
            onChange={(e) => setDraft({ ...draft, username: e.target.value.replace(/@/g, "") })} required />
        </div>
        <input className={field} type="email" placeholder="Email" value={draft.email}
          onChange={(e) => setDraft({ ...draft, email: e.target.value })} required />
        <input className={field} type="password" placeholder="Mot de passe (8 caractères min.)" value={draft.password}
          onChange={(e) => setDraft({ ...draft, password: e.target.value })} required />

        <div>
          <p className="mb-2 text-sm font-semibold">Que veux-tu suivre ? (au moins un)</p>
          <div className="flex gap-2">
            {(["films", "books"] as Domain[]).map((t) => (
              <button type="button" key={t} onClick={() => toggleTab(t)}
                className={`rounded-full border px-4 py-1.5 text-sm ${
                  draft.activeTabs.includes(t)
                    ? "border-[var(--color-primary)] bg-[var(--color-primary)] text-white"
                    : "border-[var(--color-border)] text-[var(--color-text-muted)]"
                }`}>
                {t === "films" ? "🎬 Films & Séries" : "📚 Livres"}
              </button>
            ))}
          </div>
        </div>

        {error && <p className="text-sm text-red-500">{error}</p>}
        <button disabled={busy} className="rounded-full bg-[var(--color-primary)] py-3 text-sm font-semibold text-white disabled:opacity-50">
          {busy ? "Vérification…" : "Continuer →"}
        </button>
      </form>
      <p className="mt-4 text-center text-sm text-[var(--color-text-muted)]">
        Déjà inscrit ? <Link href="/login" className="font-semibold text-[var(--color-primary)]">Se connecter</Link>
      </p>
    </main>
  );
}
