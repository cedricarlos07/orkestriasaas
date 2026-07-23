import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Check, Loader2 } from "lucide-react";
import { StepHeader } from "@/components/onboarding/StepHeader";
import { useOnboarding } from "@/lib/onboarding-store";
import { listAdAccounts, selectAdAccount } from "@/functions/ad-accounts";

export const Route = createFileRoute("/onboarding/accounts")({ component: Step });

function Step() {
  const { data, setField } = useOnboarding();
  const [oauthBanner, setOauthBanner] = useState<string | null>(null);
  const { data: accounts = [], isLoading, error } = useQuery({
    queryKey: ["ad-accounts"],
    queryFn: () => listAdAccounts(),
  });

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const connected = params.get("connected");
    const err = params.get("error");
    if (connected || err) {
      window.history.replaceState({}, "", "/onboarding/accounts");
      setOauthBanner(err ? `Connexion échouée : ${err}` : "Compte connecté — sélectionnez-le ci-dessous.");
    }
  }, []);

  const toggle = async (accountKey: string, connectionId: string, accountId: string, accountName: string) => {
    const selected = data.selectedAccounts.includes(accountKey)
      ? data.selectedAccounts.filter((x) => x !== accountKey)
      : [...data.selectedAccounts, accountKey];
    setField("selectedAccounts", selected);
    if (!data.selectedAccounts.includes(accountKey)) {
      await selectAdAccount({ data: { connectionId, accountId, accountName } });
    }
  };

  return (
    <>
      <StepHeader
        eyebrow="Étape 4 · Comptes"
        title="Sélectionnez les comptes à rattacher"
        desc="Comptes récupérés via OAuth depuis vos plateformes connectées."
      />
      {oauthBanner ? (
        <p
          className={`mb-4 rounded-xl px-4 py-3 text-[13px] ${
            oauthBanner.startsWith("Connexion échouée")
              ? "border border-rose-200 bg-rose-50 text-rose-800"
              : "border border-emerald-200 bg-emerald-50 text-emerald-900"
          }`}
        >
          {oauthBanner}
        </p>
      ) : null}
      {isLoading ? (
        <div className="flex items-center gap-2 py-8 text-[13px] text-ink-soft">
          <Loader2 className="h-4 w-4 animate-spin" /> Chargement des comptes publicitaires…
        </div>
      ) : error ? (
        <p className="text-[14px] text-rose-600">
          Impossible de charger les comptes. Connectez d&apos;abord Meta Ads à l&apos;étape précédente.
        </p>
      ) : accounts.length === 0 ? (
        <p className="text-[14px] text-ink-soft">
          Aucun compte trouvé. Vérifiez vos connexions OAuth et les permissions de l&apos;application.
        </p>
      ) : (
        <div className="card-soft divide-y divide-line/60 overflow-hidden !p-0">
          {accounts.map((a) => {
            const active = data.selectedAccounts.includes(a.id);
            const [, accountId] = a.id.split(":");
            return (
              <button
                key={a.id}
                type="button"
                onClick={() => void toggle(a.id, a.connectionId, accountId, a.name)}
                className={`relative z-10 flex w-full items-center justify-between gap-4 px-5 py-4 text-left transition ${active ? "bg-[#fff5ea]" : "hover:bg-white/60"}`}
              >
                <div>
                  <p className="text-[14px] font-semibold text-ink">
                    {a.name} · {a.platform}
                  </p>
                  <p className="text-[13px] text-ink-soft">
                    {a.masked} · {a.currency}
                  </p>
                </div>
                <span
                  className={`flex h-5 w-5 items-center justify-center rounded-md border transition ${active ? "border-[#ff6c02] bg-gradient-to-b from-[#ff9040] to-[#e55a00] text-white" : "border-line bg-white"}`}
                >
                  {active && <Check className="h-3.5 w-3.5" />}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </>
  );
}
