import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { BrandLogo } from "@/components/BrandLogo";
import { useEffect, useState } from "react";
import { ArrowRight, Briefcase, User, Check, Loader2 } from "lucide-react";
import { getSession } from "@/lib/auth.functions";
import { getProfile, saveUserProfile } from "@/functions/profiles";
import { createOrganizationForUser } from "@/functions/organizations";

export type DemoRole = "agency" | "client";

export const Route = createFileRoute("/setup")({
  head: () => ({
    meta: [
      { title: "Configurer votre espace — Orkestria" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: SetupPage,
});

const SECTORS = ["Restauration", "E-commerce", "Beauté", "Immobilier", "Services", "Autre"];
const SIZES = ["Indépendant", "2 — 10 personnes", "11 — 50 personnes", "50+ personnes"];

function SetupPage() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [step, setStep] = useState<1 | 2>(1);
  const [role, setRole] = useState<DemoRole | null>(null);
  const [company, setCompany] = useState("");
  const [sector, setSector] = useState<string>(SECTORS[0]);
  const [size, setSize] = useState<string>(SIZES[0]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void (async () => {
      const s = await getSession();
      if (!s) {
        navigate({ to: "/auth" });
        return;
      }
      const p = await getProfile();
      if (p) {
        navigate({ to: p.appRole === "agency" ? "/app/agency" : "/app" });
        return;
      }
      setReady(true);
    })();
  }, [navigate]);

  if (!ready) {
    return (
      <main className="grid min-h-screen place-items-center bg-surface">
        <Loader2 className="h-6 w-6 animate-spin text-[#ff6c02]" />
      </main>
    );
  }

  const finish = async () => {
    if (!role || company.trim().length < 2) return;
    setSaving(true);
    try {
      await saveUserProfile({
        data: { appRole: role, company: company.trim(), sector, size },
      });
      await createOrganizationForUser({ data: { name: company.trim() } });
      navigate({ to: role === "agency" ? "/app/agency" : "/app" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="min-h-screen bg-surface px-6 py-12">
      <div className="mx-auto max-w-[720px]">
        <Link to="/" className="mb-8 flex items-center gap-2">
          <BrandLogo className="h-8 w-auto" />
        </Link>

        <div className="mb-6 flex items-center gap-2 text-[12px] text-ink-soft">
          <span className={`flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-semibold ${step >= 1 ? "bg-[#ff6c02] text-white" : "bg-line text-ink-soft"}`}>1</span>
          <span className={step === 1 ? "font-medium text-ink" : ""}>Votre rôle</span>
          <span className="mx-2 h-px w-8 bg-line" />
          <span className={`flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-semibold ${step >= 2 ? "bg-[#ff6c02] text-white" : "bg-line text-ink-soft"}`}>2</span>
          <span className={step === 2 ? "font-medium text-ink" : ""}>Votre entreprise</span>
        </div>

        <div className="rounded-3xl bg-white p-8 shadow-[0_10px_40px_-20px_rgba(0,0,0,0.15)] ring-1 ring-black/5">
          {step === 1 && (
            <>
              <h1 className="font-display text-[28px] font-semibold text-ink">Comment utilisez-vous Orkestria ?</h1>
              <p className="mt-1 text-[14px] text-ink-soft">On adapte votre espace en fonction de votre rôle.</p>

              <div className="mt-6 grid gap-3 sm:grid-cols-2">
                <RoleCard
                  active={role === "client"}
                  onClick={() => setRole("client")}
                  icon={<User className="h-5 w-5" />}
                  title="Marque / annonceur"
                  desc="Je pilote mes propres campagnes publicitaires."
                />
                <RoleCard
                  active={role === "agency"}
                  onClick={() => setRole("agency")}
                  icon={<Briefcase className="h-5 w-5" />}
                  title="Agence / freelance"
                  desc="Je gère plusieurs clients et je veux un portail dédié."
                />
              </div>

              <div className="mt-8 flex justify-end">
                <button onClick={() => setStep(2)} disabled={!role} className="btn-primary disabled:opacity-50">
                  Continuer <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <h1 className="font-display text-[28px] font-semibold text-ink">
                {role === "agency" ? "Votre agence" : "Votre entreprise"}
              </h1>
              <p className="mt-1 text-[14px] text-ink-soft">
                Ces informations pré-remplissent votre espace. Vous pourrez les modifier plus tard.
              </p>

              <div className="mt-6 space-y-4">
                <label className="block">
                  <span className="mb-1.5 block text-[13px] font-medium text-ink">
                    {role === "agency" ? "Nom de l'agence" : "Nom de l'entreprise"}
                  </span>
                  <input
                    value={company}
                    onChange={(e) => setCompany(e.target.value)}
                    placeholder={role === "agency" ? "Velvet Studio" : "Ma boutique"}
                    className="block w-full rounded-xl border border-line bg-white px-4 py-2.5 text-[14px] text-ink focus:border-[#ff6c02] focus:outline-none focus:ring-2 focus:ring-[#ff6c02]/20"
                  />
                </label>

                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="block">
                    <span className="mb-1.5 block text-[13px] font-medium text-ink">Secteur</span>
                    <select value={sector} onChange={(e) => setSector(e.target.value)} className="block w-full rounded-xl border border-line bg-white px-3 py-2.5 text-[14px] text-ink focus:border-[#ff6c02] focus:outline-none focus:ring-2 focus:ring-[#ff6c02]/20">
                      {SECTORS.map((s) => <option key={s}>{s}</option>)}
                    </select>
                  </label>
                  <label className="block">
                    <span className="mb-1.5 block text-[13px] font-medium text-ink">Taille</span>
                    <select value={size} onChange={(e) => setSize(e.target.value)} className="block w-full rounded-xl border border-line bg-white px-3 py-2.5 text-[14px] text-ink focus:border-[#ff6c02] focus:outline-none focus:ring-2 focus:ring-[#ff6c02]/20">
                      {SIZES.map((s) => <option key={s}>{s}</option>)}
                    </select>
                  </label>
                </div>
              </div>

              <div className="mt-8 flex items-center justify-between">
                <button onClick={() => setStep(1)} className="chip-ghost">Retour</button>
                <button onClick={finish} disabled={saving || company.trim().length < 2} className="btn-primary disabled:opacity-50">
                  {saving ? <><Loader2 className="h-4 w-4 animate-spin" /> Création…</> : (<>Ouvrir mon espace <ArrowRight className="h-4 w-4" /></>)}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </main>
  );
}

function RoleCard({ active, onClick, icon, title, desc }: { active: boolean; onClick: () => void; icon: React.ReactNode; title: string; desc: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`group relative overflow-hidden rounded-2xl border p-5 text-left transition ${
        active ? "border-[#ff6c02] bg-[#fff6ee] shadow-sm" : "border-line bg-white hover:border-ink/20"
      }`}
    >
      <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${active ? "bg-[#ff6c02] text-white" : "bg-surface-2 text-ink-soft"}`}>
        {icon}
      </div>
      <p className="mt-3 text-[15px] font-semibold text-ink">{title}</p>
      <p className="mt-1 text-[13px] text-ink-soft">{desc}</p>
      {active && (
        <span className="absolute right-3 top-3 flex h-5 w-5 items-center justify-center rounded-full bg-[#ff6c02] text-white">
          <Check className="h-3 w-3" />
        </span>
      )}
    </button>
  );
}