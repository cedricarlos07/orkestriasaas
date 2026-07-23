import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Mail, Lock, User, Sparkles, Check, Eye, EyeOff, AlertCircle, Loader2, ArrowLeft } from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { getProfile } from "@/functions/profiles";
import { getOAuthAvailability } from "@/functions/platform-config";
import { BrandLogo } from "@/components/BrandLogo";

export const Route = createFileRoute("/auth")({
  validateSearch: (search: Record<string, unknown>) => ({
    redirect: typeof search.redirect === "string" ? search.redirect : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Créer un compte — Orkestria" },
      { name: "description", content: "Rejoignez Orkestria en 30 secondes. Aucune carte bancaire demandée." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AuthPage,
});

/** Same-origin app path only — blocks open redirects. */
function safePostAuthPath(raw?: string | null): string | null {
  if (!raw) return null;
  try {
    const u = new URL(raw, typeof window !== "undefined" ? window.location.origin : "http://localhost");
    if (typeof window !== "undefined" && u.origin !== window.location.origin) return null;
    if (!u.pathname.startsWith("/") || u.pathname.startsWith("//")) return null;
    if (u.pathname.startsWith("/auth")) return null;
    return `${u.pathname}${u.search}${u.hash}`;
  } catch {
    return null;
  }
}

function AuthPage() {
  const navigate = useNavigate();
  const { redirect: redirectParam } = Route.useSearch();
  const { data: platformConfig } = useQuery({
    queryKey: ["platform-config"],
    queryFn: () => getOAuthAvailability(),
  });
  const googleLoginEnabled = platformConfig?.googleLoginConfigured ?? false;
  const facebookLoginEnabled = platformConfig?.facebookLoginConfigured ?? false;
  const socialLoginEnabled = googleLoginEnabled || facebookLoginEnabled;
  const [mode, setMode] = useState<"signup" | "login" | "forgot">("signup");
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [rootError, setRootError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState<null | "google" | "facebook" | "submit">(null);
  const [resetToken, setResetToken] = useState<string | null>(null);
  const set = (k: string, v: string) => {
    setForm({ ...form, [k]: v });
    setErrors((e) => ({ ...e, [k]: "" }));
    setRootError(null);
  };

  const validate = () => {
    const e: Record<string, string> = {};
    if (mode === "signup" && form.name.trim().length < 2) e.name = "Indiquez votre nom (2 caractères min).";
    const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim());
    if (!emailOk) e.email = "E-mail invalide.";
    if (mode !== "forgot") {
      if (form.password.length < 6) e.password = "6 caractères minimum.";
      else if (mode === "signup" && !/[0-9]/.test(form.password)) e.password = "Ajoutez au moins un chiffre.";
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const goAfterAuth = async (fallback: string) => {
    const dest = safePostAuthPath(redirectParam);
    if (dest) {
      window.location.assign(dest);
      return;
    }
    navigate({ to: fallback });
  };

  const submit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    setRootError(null);
    setInfo(null);
    if (!validate()) return;
    setLoading("submit");
    try {
      if (mode === "signup") {
        const { error } = await authClient.signUp.email({
          email: form.email.trim().toLowerCase(),
          password: form.password,
          name: form.name.trim(),
        });
        if (error) throw new Error(error.message ?? "Inscription impossible.");
        await goAfterAuth("/setup");
      } else if (mode === "login") {
        const { error } = await authClient.signIn.email({
          email: form.email.trim().toLowerCase(),
          password: form.password,
        });
        if (error) throw new Error(error.message ?? "E-mail ou mot de passe incorrect.");
        const p = await getProfile();
        if (!p) await goAfterAuth("/setup");
        else await goAfterAuth(p.appRole === "agency" ? "/app/agency" : "/app");
      } else {
        const { error } = await authClient.forgetPassword({
          email: form.email.trim().toLowerCase(),
          redirectTo: `${window.location.origin}/reset-password`,
        });
        if (error) throw new Error(error.message ?? "Impossible d'envoyer l'e-mail.");
        setInfo("Si un compte existe, un lien de réinitialisation a été envoyé.");
      }
    } catch (err) {
      setRootError((err as Error).message);
    } finally {
      setLoading(null);
    }
  };

  const oauthSignIn = async (provider: "google" | "facebook") => {
    setRootError(null);
    setLoading(provider);
    try {
      await authClient.signIn.social({
        provider,
        callbackURL: safePostAuthPath(redirectParam) ?? "/setup",
      });
    } catch (err) {
      setRootError((err as Error).message ?? "Connexion OAuth indisponible.");
      setLoading(null);
    }
  };

  const pwdStrength = passwordScore(form.password);

  return (
    <main className="min-h-screen grid lg:grid-cols-2 bg-surface">
      {/* Visual panel */}
      <aside className="relative hidden lg:flex flex-col justify-between overflow-hidden bg-gradient-to-br from-[#ff6c02] via-[#ff8a3d] to-[#f0d78c] p-12 text-white">
        <div className="absolute inset-0 opacity-30 bg-noise" />
        <Link to="/" className="relative flex items-center gap-2">
          <BrandLogo className="h-8 w-auto brightness-0 invert" />
        </Link>

        <div className="relative max-w-md">
          <p className="text-[13px] uppercase tracking-[0.2em] opacity-80">Votre équipe pub, en un chat</p>
          <h1 className="mt-4 font-display text-[42px] font-semibold leading-[1.05]">
            Plus de clients. Sans y passer vos nuits.
          </h1>
          <p className="mt-4 text-[15px] opacity-90">
            Orkestria lance, analyse et optimise vos campagnes Meta, Google et TikTok — depuis une simple conversation.
          </p>
          <ul className="mt-8 space-y-3 text-[14px]">
            {["Zéro carte bancaire", "Prêt en moins de 5 minutes", "Vous gardez le contrôle"].map((t) => (
              <li key={t} className="flex items-center gap-2">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white/25">
                  <Check className="h-3 w-3" />
                </span>
                {t}
              </li>
            ))}
          </ul>
        </div>

        <div className="relative rounded-2xl bg-white/15 backdrop-blur p-4 text-[13px]">
          <div className="flex items-center gap-2 opacity-90">
            <Sparkles className="h-4 w-4" /> « Orkestria a triplé nos commandes en 6 semaines. »
          </div>
          <p className="mt-2 opacity-75">— Aïcha K., restauratrice à Cocody</p>
        </div>
      </aside>

      {/* Form panel */}
      <section className="flex flex-col justify-center px-6 py-12 sm:px-12">
        <div className="mx-auto w-full max-w-[420px]">
          <Link to="/" className="mb-8 flex items-center gap-2 lg:hidden">
            <BrandLogo className="h-7 w-auto" />
          </Link>

          {mode !== "forgot" && (
          <div className="inline-flex rounded-full bg-surface-2 p-1 text-[13px]">
            <button
              onClick={() => setMode("signup")}
              className={`rounded-full px-4 py-1.5 transition ${mode === "signup" ? "bg-white text-ink shadow-sm" : "text-ink-soft"}`}
            >
              Créer un compte
            </button>
            <button
              onClick={() => setMode("login")}
              className={`rounded-full px-4 py-1.5 transition ${mode === "login" ? "bg-white text-ink shadow-sm" : "text-ink-soft"}`}
            >
              Se connecter
            </button>
          </div>
          )}
          {mode === "forgot" && (
            <button onClick={() => { setMode("login"); setInfo(null); setResetToken(null); }} className="inline-flex items-center gap-1.5 text-[13px] text-ink-soft hover:text-ink">
              <ArrowLeft className="h-3.5 w-3.5" /> Retour à la connexion
            </button>
          )}

          <h2 className="mt-6 font-display text-[30px] font-semibold text-ink">
            {mode === "signup" ? "Créez votre espace" : mode === "login" ? "Content de vous revoir" : "Mot de passe oublié ?"}
          </h2>
          <p className="mt-2 text-[14px] text-ink-soft">
            {mode === "signup" && "30 secondes pour démarrer. Ensuite Orkestria s'occupe de tout."}
            {mode === "login" && "Connectez-vous pour retrouver votre espace publicitaire."}
            {mode === "forgot" && "Indiquez votre e-mail, nous vous envoyons un lien pour définir un nouveau mot de passe."}
          </p>

          {mode !== "forgot" && socialLoginEnabled && (
            <>
              <div className={`mt-6 grid gap-3 ${googleLoginEnabled && facebookLoginEnabled ? "grid-cols-2" : "grid-cols-1"}`}>
                {googleLoginEnabled && (
                  <button type="button" onClick={() => oauthSignIn("google")} disabled={loading !== null} className="flex items-center justify-center gap-2 rounded-full border border-line bg-white py-2.5 text-[13px] font-medium text-ink hover:bg-surface-2 disabled:opacity-60">
                    {loading === "google" ? <Loader2 className="h-4 w-4 animate-spin" /> : <GoogleIcon />} Google
                  </button>
                )}
                {facebookLoginEnabled && (
                  <button type="button" onClick={() => oauthSignIn("facebook")} disabled={loading !== null} className="flex items-center justify-center gap-2 rounded-full border border-line bg-white py-2.5 text-[13px] font-medium text-ink hover:bg-surface-2 disabled:opacity-60">
                    {loading === "facebook" ? <Loader2 className="h-4 w-4 animate-spin" /> : <FacebookIcon />} Facebook
                  </button>
                )}
              </div>

              <div className="my-6 flex items-center gap-3 text-[12px] text-ink-soft">
                <span className="h-px flex-1 bg-line" /> ou avec un e-mail <span className="h-px flex-1 bg-line" />
              </div>
            </>
          )}

          {mode !== "forgot" && !socialLoginEnabled && (
            <p className="mt-4 text-[13px] text-ink-soft">Connectez-vous avec votre e-mail et mot de passe.</p>
          )}

          {rootError && (
            <div className="mb-4 flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2.5 text-[13px] text-rose-700">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{rootError}</span>
            </div>
          )}
          {info && (
            <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-[13px] text-emerald-700">
              {info}
              {resetToken && (
                <div className="mt-2">
                  <Link
                    to="/reset-password"
                    search={{ token: resetToken }}
                    className="inline-flex items-center gap-1 font-medium underline"
                  >
                    Ouvrir le lien de réinitialisation <ArrowRight className="h-3 w-3" />
                  </Link>
                </div>
              )}
            </div>
          )}

          <form onSubmit={submit} className="space-y-4">
            {mode === "signup" && (
              <FormRow icon={User} label="Nom complet" value={form.name} onChange={(v) => set("name", v)} placeholder="Aïcha Konaté" error={errors.name} autoComplete="name" />
            )}
            <FormRow icon={Mail} label="E-mail" type="email" value={form.email} onChange={(v) => set("email", v)} placeholder="vous@exemple.com" error={errors.email} autoComplete="email" />
            {mode !== "forgot" && (
              <div>
                <div className="mb-1.5 flex items-center justify-between">
                  <span className="text-[13px] font-medium text-ink">Mot de passe</span>
                  {mode === "login" && (
                    <button type="button" onClick={() => { setMode("forgot"); setErrors({}); setRootError(null); }} className="text-[12px] font-medium text-[#ff6c02] hover:underline">
                      Oublié ?
                    </button>
                  )}
                </div>
                <div className="relative">
                  <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-soft" />
                  <input
                    type={showPwd ? "text" : "password"}
                    value={form.password}
                    onChange={(e) => set("password", e.target.value)}
                    placeholder="6 caractères minimum"
                    autoComplete={mode === "signup" ? "new-password" : "current-password"}
                    className={`block w-full rounded-xl border bg-white pl-9 pr-10 py-2.5 text-[14px] text-ink placeholder:text-ink/40 focus:outline-none focus:ring-2 ${errors.password ? "border-rose-300 focus:border-rose-400 focus:ring-rose-200" : "border-line focus:border-[#ff6c02] focus:ring-[#ff6c02]/20"}`}
                  />
                  <button type="button" onClick={() => setShowPwd((s) => !s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-soft hover:text-ink" aria-label="Afficher le mot de passe">
                    {showPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {errors.password && <p className="mt-1 text-[12px] text-rose-600">{errors.password}</p>}
                {mode === "signup" && form.password.length > 0 && (
                  <div className="mt-2 flex items-center gap-2">
                    <div className="flex flex-1 gap-1">
                      {[0, 1, 2, 3].map((i) => (
                        <span key={i} className={`h-1 flex-1 rounded-full transition ${i < pwdStrength.score ? pwdStrength.color : "bg-line"}`} />
                      ))}
                    </div>
                    <span className="text-[11px] text-ink-soft">{pwdStrength.label}</span>
                  </div>
                )}
              </div>
            )}

            {mode === "signup" && (
              <p className="text-[12px] text-ink-soft">
                En continuant, vous acceptez les{" "}
                <Link to="/terms" className="underline hover:text-ink">CGU</Link>
                {" "}et la{" "}
                <Link to="/privacy" className="underline hover:text-ink">Politique de confidentialité</Link>.
              </p>
            )}

            <button
              type="submit"
              disabled={loading !== null}
              className="btn-primary w-full disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading === "submit" ? <><Loader2 className="h-4 w-4 animate-spin" /> Un instant…</> : (
                <>
                  {mode === "signup" && "Créer mon compte"}
                  {mode === "login" && "Se connecter"}
                  {mode === "forgot" && "Envoyer le lien"}
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          </form>

          {mode !== "forgot" && (
            <p className="mt-6 text-center text-[13px] text-ink-soft">
              {mode === "signup" ? (
                <>Déjà un compte ? <button onClick={() => setMode("login")} className="font-medium text-ink hover:underline">Se connecter</button></>
              ) : (
                <>Pas encore de compte ? <button onClick={() => setMode("signup")} className="font-medium text-ink hover:underline">Créer un compte</button></>
              )}
            </p>
          )}
        </div>
      </section>
    </main>
  );
}

function FormRow({
  icon: Icon,
  label,
  value,
  onChange,
  type = "text",
  placeholder,
  error,
  autoComplete,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
  error?: string;
  autoComplete?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[13px] font-medium text-ink">{label}</span>
      <div className="relative">
        <Icon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-soft" />
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          autoComplete={autoComplete}
          className={`block w-full rounded-xl border bg-white pl-9 pr-4 py-2.5 text-[14px] text-ink placeholder:text-ink/40 focus:outline-none focus:ring-2 ${error ? "border-rose-300 focus:border-rose-400 focus:ring-rose-200" : "border-line focus:border-[#ff6c02] focus:ring-[#ff6c02]/20"}`}
        />
      </div>
      {error && <p className="mt-1 text-[12px] text-rose-600">{error}</p>}
    </label>
  );
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 48 48" className="h-4 w-4" aria-hidden>
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
    </svg>
  );
}

function FacebookIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden>
      <path fill="#1877F2" d="M24 12C24 5.373 18.627 0 12 0S0 5.373 0 12c0 5.99 4.388 10.954 10.125 11.854V15.47H7.078V12h3.047V9.356c0-3.007 1.792-4.668 4.533-4.668 1.312 0 2.686.234 2.686.234v2.953H15.83c-1.491 0-1.956.925-1.956 1.874V12h3.328l-.532 3.47h-2.796v8.385C19.612 22.954 24 17.99 24 12z"/>
    </svg>
  );
}

function passwordScore(pw: string): { score: number; label: string; color: string } {
  let s = 0;
  if (pw.length >= 6) s++;
  if (pw.length >= 10) s++;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) s++;
  if (/[0-9]/.test(pw) && /[^A-Za-z0-9]/.test(pw)) s++;
  const map = [
    { label: "Trop court", color: "bg-rose-400" },
    { label: "Faible", color: "bg-rose-400" },
    { label: "Correct", color: "bg-amber-400" },
    { label: "Bon", color: "bg-emerald-400" },
    { label: "Excellent", color: "bg-emerald-500" },
  ];
  return { score: s, ...map[s] };
}