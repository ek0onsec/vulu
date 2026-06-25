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

  useEffect(() => {
    if (typeof window !== "undefined" && new URLSearchParams(window.location.search).get("deleted") === "1") setDeleted(true);
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null); setBusy(true);
    try {
      const { reactivated } = await api.post<{ reactivated: boolean }>("/api/auth/login", { email, password });
      if (reactivated) toast("Suppression annulée — content de te revoir !");
      router.push("/feed");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Connexion impossible");
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-5">
      <VuluLogo height={40} className="mb-1" />
      <p className="mb-6 text-sm text-[var(--color-text-muted)]">Content de te revoir.</p>
      {deleted && (
        <div className="mb-4 rounded-xl border border-[var(--color-border)] bg-[color-mix(in_srgb,var(--color-accent)_15%,transparent)] p-3 text-sm">
          Ton compte est <strong>désactivé</strong>. Reconnecte-toi sous <strong>48 h</strong> pour annuler la suppression — au-delà, il sera définitivement supprimé.
        </div>
      )}
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
