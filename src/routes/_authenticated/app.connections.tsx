import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, PlugZap, Loader2, Layers } from "lucide-react";
import { CONNECTORS, type ConnectorId } from "@/lib/oauth/connectors";
import { useConnections } from "@/lib/connections-store";
import { checkinAdkit, getAdkitConfig, setAdkitProject } from "@/functions/adkit";

export const Route = createFileRoute("/_authenticated/app/connections")({ component: Connections });

const EXTRA = [
  { id: "whatsapp", label: "WhatsApp Business", group: "business", desc: "Reliez pour mesurer les commandes" },
  { id: "shopify", label: "Shopify", group: "business", desc: "Non connecté" },
];

function Connections() {
  const { isLoading, connect, disconnect, byConnector, catalog } = useConnections();
  const queryClient = useQueryClient();
  const { data: adkit, isLoading: adkitLoading } = useQuery({
    queryKey: ["adkit-config"],
    queryFn: () => getAdkitConfig(),
  });
  const [projectPick, setProjectPick] = useState("");

  useEffect(() => {
    if (adkit?.adkitProjectId) setProjectPick(adkit.adkitProjectId);
    else if (adkit?.defaultProjectId) setProjectPick(adkit.defaultProjectId);
    else if (adkit?.projects?.[0]?.projectId) setProjectPick(adkit.projects[0].projectId);
  }, [adkit?.adkitProjectId, adkit?.defaultProjectId, adkit?.projects]);

  const saveProject = useMutation({
    mutationFn: () => setAdkitProject({ data: { projectId: projectPick || null } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["adkit-config"] }),
  });
  const checkin = useMutation({
    mutationFn: () => checkinAdkit(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["adkit-config"] }),
  });

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("connected") || params.get("error")) {
      window.history.replaceState({}, "", "/app/connections");
    }
  }, []);

  const groups = [
    { title: "Régies publicitaires", filter: "ads" as const },
    { title: "Analytics & tracking", filter: "analytics" as const },
  ];

  const metaConnected = adkit?.status?.metaConnected
    ? { connected: true, accounts: [{ name: adkit.status.metaAccountName ?? undefined }] }
    : null;

  return (
    <div className="mx-auto max-w-[1000px] space-y-6">
      <header>
        <p className="text-[12px] uppercase tracking-wider text-[#ff6c02]">Connexions</p>
        <h1 className="mt-1 font-display text-[26px] font-semibold text-ink">Comptes publicitaires et outils</h1>
        <p className="text-[13px] text-ink-soft">
          OAuth réel — connectez Meta en priorité. AdKit unifie Meta, Google, TikTok et Reddit (draft-first).
        </p>
      </header>

      <section className="rounded-2xl border border-line/70 bg-white">
        <div className="border-b border-line/60 px-5 py-3 flex items-center gap-2 text-[12px] uppercase tracking-wider text-ink-soft">
          <Layers className="h-3.5 w-3.5" /> Couche AdKit
        </div>
        <div className="space-y-4 px-5 py-4">
          {adkitLoading ? (
            <p className="flex items-center gap-2 text-[13px] text-ink-soft">
              <Loader2 className="h-4 w-4 animate-spin" /> Chargement AdKit…
            </p>
          ) : !adkit?.enabled ? (
            <p className="text-[13px] text-ink-soft">
              AdKit non configuré. Ajoutez <code className="text-[12px]">ADKIT_API_KEY</code> dans l&apos;environnement serveur.
            </p>
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-[12px] font-medium text-emerald-700">
                  <CheckCircle2 className="h-3.5 w-3.5" /> API connectée
                </span>
                {metaConnected?.connected ? (
                  <span className="text-[12px] text-ink-soft">
                    Meta AdKit : {metaConnected.accounts?.[0]?.name ?? "compte lié"}
                  </span>
                ) : (
                  <span className="text-[12px] text-amber-700">Meta non lié dans AdKit — ouvrez app.adkit.so</span>
                )}
                {adkit.error && <span className="text-[12px] text-red-600">{adkit.error}</span>}
              </div>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
                <label className="flex-1 text-[13px]">
                  <span className="mb-1 block font-medium text-ink">Projet AdKit (marque)</span>
                  <select
                    value={projectPick}
                    onChange={(e) => setProjectPick(e.target.value)}
                    className="w-full rounded-xl border border-line bg-white px-3 py-2 text-[14px] text-ink"
                  >
                    <option value="">— Sélectionner —</option>
                    {adkit.projects.map((p) => (
                      <option key={p.projectId} value={p.projectId}>
                        {p.name}
                        {p.website ? ` · ${p.website}` : ""}
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  type="button"
                  className="btn-primary !px-3 !py-2 !text-[12px]"
                  disabled={saveProject.isPending || !projectPick}
                  onClick={() => saveProject.mutate()}
                >
                  {saveProject.isPending ? "…" : "Lier à l'organisation"}
                </button>
                <button
                  type="button"
                  className="chip-ghost !px-3 !py-2 !text-[12px]"
                  disabled={checkin.isPending}
                  onClick={() => checkin.mutate()}
                >
                  Check-in
                </button>
              </div>
              <p className="text-[12px] text-ink-soft">
                Un projet AdKit = une marque. Les campagnes Orkestria passent par AdKit quand la clé API est présente.
              </p>
            </>
          )}
        </div>
      </section>

      {isLoading ? (
        <div className="flex items-center gap-2 text-[13px] text-ink-soft">
          <Loader2 className="h-4 w-4 animate-spin" /> Chargement…
        </div>
      ) : (
        groups.map((g) => (
          <section key={g.title} className="rounded-2xl border border-line/70 bg-white">
            <div className="border-b border-line/60 px-5 py-3 text-[12px] uppercase tracking-wider text-ink-soft">
              {g.title}
            </div>
            <ul className="divide-y divide-line/60">
              {Object.values(CONNECTORS)
                .filter((c) => c.group === g.filter)
                .map((cfg) => {
                  const conn = byConnector(cfg.id);
                  const connected = conn?.status === "connectée";
                  const catalogItem = catalog.find((c) => c.id === cfg.id);
                  const configured = catalogItem?.configured ?? false;
                  return (
                    <li key={cfg.id} className="flex items-center justify-between gap-4 px-5 py-4">
                      <div className="flex items-center gap-3">
                        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-surface-2">
                          <PlugZap className="h-4 w-4 text-ink-soft" />
                        </span>
                        <div>
                          <p className="text-[14px] font-medium text-ink">{cfg.label}</p>
                          <p className="text-[12px] text-ink-soft">
                            {connected ? conn?.externalAccount : configured ? "Non connecté" : "Non configuré sur le serveur"}
                          </p>
                        </div>
                      </div>
                      {connected ? (
                        <div className="flex items-center gap-2">
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-[12px] font-medium text-emerald-700">
                            <CheckCircle2 className="h-3.5 w-3.5" /> Connecté
                          </span>
                          <button
                            type="button"
                            onClick={() => conn && disconnect(conn.id)}
                            className="chip-ghost text-[12px]"
                          >
                            Déconnecter
                          </button>
                        </div>
                      ) : configured ? (
                        <button type="button" onClick={() => void connect(cfg.id as ConnectorId)} className="btn-primary !px-3 !py-1.5 !text-[12px]">
                          Connecter
                        </button>
                      ) : (
                        <span className="chip-ghost text-[12px] text-ink-soft">Bientôt</span>
                      )}
                    </li>
                  );
                })}
            </ul>
          </section>
        ))
      )}

      <section className="rounded-2xl border border-line/70 bg-white">
        <div className="border-b border-line/60 px-5 py-3 text-[12px] uppercase tracking-wider text-ink-soft">
          Outils métier (bientôt)
        </div>
        <ul className="divide-y divide-line/60">
          {EXTRA.map((it) => (
            <li key={it.id} className="flex items-center justify-between gap-4 px-5 py-4 opacity-60">
              <div>
                <p className="text-[14px] font-medium text-ink">{it.label}</p>
                <p className="text-[12px] text-ink-soft">{it.desc}</p>
              </div>
              <button type="button" disabled className="chip-ghost bg-surface-2">
                Bientôt
              </button>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
