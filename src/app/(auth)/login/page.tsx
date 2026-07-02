"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api, ApiError } from "@/lib/api-client";
import { toast } from "@/lib/toast";
import { VuluLogo } from "@/components/VuluLogo";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [deleted, setDeleted] = useState(false);
  const [challenge, setChallenge] = useState<string | null>(null);
  const [code, setCode] = useState("");

  useEffect(() => {
    if (typeof window !== "undefined" && new URLSearchParams(window.location.search).get("deleted") === "1") setDeleted(true);
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null); setBusy(true);
    try {
      const res = await api.post<{ reactivated?: boolean; twoFactorRequired?: boolean; challenge?: string }>(
        "/api/auth/login", { email, password },
      );
      if (res.twoFactorRequired && res.challenge) { setChallenge(res.challenge); setBusy(false); return; }
      if (res.reactivated) toast("Suppression annulée — content de te revoir !");
      router.push("/feed");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Connexion impossible");
      setBusy(false);
    }
  }

  async function submitCode(e: React.FormEvent) {
    e.preventDefault();
    setError(null); setBusy(true);
    try {
      await api.post("/api/auth/login/2fa", { challenge, code });
      router.push("/feed");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Code invalide");
      setBusy(false);
    }
  }

  function cancel2fa() { setChallenge(null); setCode(""); setError(null); setPassword(""); }

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-5">
      <VuluLogo height={40} className="mb-1" />
      <p className="mb-6 text-sm text-[var(--color-text-muted)]">Content de te revoir.</p>
      {deleted && (
        <div className="mb-4 rounded-xl border border-[var(--color-border)] bg-[color-mix(in_srgb,var(--color-accent)_15%,transparent)] p-3 text-sm">
          Ton compte est <strong>désactivé</strong>. Reconnecte-toi sous <strong>48 h</strong> pour annuler la suppression — au-delà, il sera définitivement supprimé.
        </div>
      )}
      {challenge ? (
        <form onSubmit={submitCode} className="flex flex-col gap-3">
          <p className="text-sm text-[var(--color-text-muted)]">Entre le code de ton application d’authentification, ou un code de secours.</p>
          <input className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3 text-center font-mono text-lg tracking-widest"
            inputMode="text" autoComplete="one-time-code" autoFocus placeholder="123 456"
            value={code} onChange={(e) => setCode(e.target.value.replace(/[^0-9A-Za-z-]/g, "").slice(0, 20))} required />
          {error && <p className="text-sm text-red-500">{error}</p>}
          <button disabled={busy || code.length < 6} className="rounded-full bg-[var(--color-primary)] py-3 text-sm font-semibold text-white disabled:opacity-50">
            {busy ? "…" : "Vérifier"}
          </button>
          <button type="button" onClick={cancel2fa} className="text-sm font-medium text-[var(--color-text-muted)]">Revenir en arrière</button>
        </form>
      ) : (
      <form onSubmit={submit} className="flex flex-col gap-3">
        <input className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3 text-sm"
          type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        <input className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3 text-sm"
          type="password" placeholder="Mot de passe" value={password} onChange={(e) => setPassword(e.target.value)} required />
        {error && <p className="text-sm text-red-500">{error}</p>}
        <button disabled={busy} className="rounded-full bg-[var(--color-primary)] py-3 text-sm font-semibold text-white disabled:opacity-50">
          {busy ? "…" : "Se connecter"}
        </button>
      </form>
      )}
      <p className="mt-4 text-center text-sm text-[var(--color-text-muted)]">
        Pas de compte ? <Link href="/register" className="font-semibold text-[var(--color-primary)]">Créer un compte</Link>
      </p>
    </main>
  );
}
