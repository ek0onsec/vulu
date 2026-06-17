"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api, ApiError } from "@/lib/api-client";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null); setBusy(true);
    try {
      await api.post("/api/auth/login", { email, password });
      router.push("/feed");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Connexion impossible");
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-5">
      <h1 className="font-display mb-1 text-4xl font-bold text-[var(--color-primary)]">vulu</h1>
      <p className="mb-6 text-sm text-[var(--color-text-muted)]">Content de te revoir.</p>
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
      <p className="mt-4 text-center text-sm text-[var(--color-text-muted)]">
        Pas de compte ? <Link href="/register" className="font-semibold text-[var(--color-primary)]">Créer un compte</Link>
      </p>
    </main>
  );
}
