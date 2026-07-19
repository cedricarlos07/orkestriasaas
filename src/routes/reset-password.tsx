import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { BrandLogo } from "@/components/BrandLogo";
import { useState } from "react";
import { z } from "zod";
import { ArrowRight, Lock, Eye, EyeOff, AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
import { authClient } from "@/lib/auth-client";

const searchSchema = z.object({ token: z.string().optional() });

export const Route = createFileRoute("/reset-password")({
  validateSearch: (s) => searchSchema.parse(s),
  head: () => ({
    meta: [
      { title: "Réinitialiser le mot de passe — Orkestria" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const navigate = useNavigate();
  const { token } = Route.useSearch();
  const [pwd, setPwd] = useState("");
  const [pwd2, setPwd2] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!token) return setError("Aucun jeton fourni. Redemandez un lien de réinitialisation.");
    if (pwd.length < 6) return setError("6 caractères minimum.");
    if (!/[0-9]/.test(pwd)) return setError("Ajoutez au moins un chiffre.");
    if (pwd !== pwd2) return setError("Les deux mots de passe ne correspondent pas.");
    setLoading(true);
    const { error } = await authClient.resetPassword({
      newPassword: pwd,
      token: token!,
    });
    setLoading(false);
    if (error) return setError(error.message ?? "Impossible de réinitialiser.");
    setDone(true);
    setTimeout(() => navigate({ to: "/auth" }), 1500);
  };

  return (
    <main className="min-h-screen grid place-items-center bg-surface px-6 py-12">
      <div className="w-full max-w-[420px]">
        <Link to="/" className="mb-8 flex items-center justify-center gap-2">
          <BrandLogo className="h-8 w-auto" />
        </Link>

        <div className="rounded-2xl border border-line bg-white p-6 shadow-sm">
          <h1 className="font-display text-[24px] font-semibold text-ink">Nouveau mot de passe</h1>
          <p className="mt-1 text-[13px] text-ink-soft">Choisissez un mot de passe sûr, différent de vos autres services.</p>

          {done ? (
            <div className="mt-6 flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-[13px] text-emerald-700">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
              <span>Mot de passe mis à jour. Redirection…</span>
            </div>
          ) : (
            <form onSubmit={submit} className="mt-6 space-y-4">
              {error && (
                <div className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2.5 text-[13px] text-rose-700">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}
              <PwdField value={pwd} onChange={setPwd} show={show} setShow={setShow} label="Nouveau mot de passe" />
              <PwdField value={pwd2} onChange={setPwd2} show={show} setShow={setShow} label="Confirmer" />
              <button type="submit" disabled={loading} className="btn-primary w-full disabled:opacity-50">
                {loading ? <><Loader2 className="h-4 w-4 animate-spin" /> Un instant…</> : (<>Mettre à jour <ArrowRight className="h-4 w-4" /></>)}
              </button>
            </form>
          )}

          <p className="mt-6 text-center text-[13px] text-ink-soft">
            <Link to="/auth" className="font-medium text-ink hover:underline">Retour à la connexion</Link>
          </p>
        </div>
      </div>
    </main>
  );
}

function PwdField({ value, onChange, show, setShow, label }: { value: string; onChange: (v: string) => void; show: boolean; setShow: (b: boolean) => void; label: string }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[13px] font-medium text-ink">{label}</span>
      <div className="relative">
        <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-soft" />
        <input
          type={show ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="block w-full rounded-xl border border-line bg-white pl-9 pr-10 py-2.5 text-[14px] text-ink focus:border-[#ff6c02] focus:outline-none focus:ring-2 focus:ring-[#ff6c02]/20"
        />
        <button type="button" onClick={() => setShow(!show)} className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-soft hover:text-ink" aria-label="Afficher">
          {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
    </label>
  );
}