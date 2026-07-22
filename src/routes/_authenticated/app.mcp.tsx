import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  KeyRound,
  ShieldCheck,
  ClipboardCheck,
  ScrollText,
  Copy,
  Check,
  X,
  Loader2,
  Plug,
  Trash2,
} from "lucide-react";
import {
  approveMcpAction,
  createMcpApiKey,
  getMcpPolicy,
  listMcpActionRuns,
  listMcpApiKeys,
  listMcpApprovals,
  listMcpSkills,
  rejectMcpAction,
  revokeMcpApiKey,
  runMcpAutonomyTick,
  updateMcpPolicy,
} from "@/functions/mcp-agent";

export const Route = createFileRoute("/_authenticated/app/mcp")({ component: McpPage });

type Tab = "keys" | "policies" | "approvals" | "audit";

const TABS: { id: Tab; label: string; icon: typeof KeyRound }[] = [
  { id: "keys", label: "Clés API", icon: KeyRound },
  { id: "policies", label: "Policies", icon: ShieldCheck },
  { id: "approvals", label: "Approbations", icon: ClipboardCheck },
  { id: "audit", label: "Audit", icon: ScrollText },
];

function McpPage() {
  const [tab, setTab] = useState<Tab>("keys");

  return (
    <div className="mx-auto max-w-[1100px] space-y-6">
      <header className="flex items-center gap-3">
        <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-[#ff6c02] to-[#ffb04a] text-white shadow-[0_10px_30px_-10px_rgba(255,108,2,0.6)]">
          <Plug className="h-5 w-5" />
        </span>
        <div>
          <p className="text-[12px] uppercase tracking-wider text-[#ff6c02]">Orkestria MCP</p>
          <h1 className="mt-0.5 font-display text-[26px] font-semibold text-ink">Accès agents</h1>
          <p className="text-[13px] text-ink-soft">
            Clés API, policies, approbations et audit — tout ce qui gouverne les agents externes (Cursor, Claude…).
          </p>
        </div>
      </header>

      <nav className="flex flex-wrap gap-2">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-[13px] font-medium transition ${
              tab === t.id
                ? "bg-[#ff6c02] text-white shadow-[0_6px_20px_-8px_rgba(255,108,2,0.7)]"
                : "border border-line/70 bg-white text-ink-soft hover:text-ink"
            }`}
          >
            <t.icon className="h-3.5 w-3.5" /> {t.label}
          </button>
        ))}
      </nav>

      {tab === "keys" && <KeysTab />}
      {tab === "policies" && <PoliciesTab />}
      {tab === "approvals" && <ApprovalsTab />}
      {tab === "audit" && <AuditTab />}
    </div>
  );
}

// ─── Clés API ─────────────────────────────────────────────────────────────────

function KeysTab() {
  const qc = useQueryClient();
  const { data: keys, isLoading } = useQuery({ queryKey: ["mcp-keys"], queryFn: () => listMcpApiKeys() });
  const [name, setName] = useState("");
  const [scopes, setScopes] = useState<string[]>(["read"]);
  const [newKey, setNewKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const create = useMutation({
    mutationFn: () =>
      createMcpApiKey({ data: { name, scopes: scopes as ("read" | "write" | "admin")[] } }),
    onSuccess: (res) => {
      setNewKey(res.key);
      setName("");
      void qc.invalidateQueries({ queryKey: ["mcp-keys"] });
    },
  });

  const revoke = useMutation({
    mutationFn: (keyId: string) => revokeMcpApiKey({ data: { keyId } }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["mcp-keys"] }),
  });

  const toggleScope = (s: string) =>
    setScopes((prev) => (prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]));

  const copy = async (text: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const keyPlaceholder = newKey ?? "ork_...";
  const snippet = `{
  "mcpServers": {
    "orkestria": {
      "command": "npx",
      "args": ["-y", "orkestria-mcp"],
      "env": { "ORKESTRIA_API_KEY": "${keyPlaceholder}" }
    }
  }
}`;
  const hostedSnippet = `{
  "mcpServers": {
    "orkestria": {
      "url": "https://orkestria.top/api/mcp",
      "headers": { "Authorization": "Bearer ${keyPlaceholder}" }
    }
  }
}`;

  return (
    <div className="space-y-5">
      <section className="card-soft rounded-2xl p-6">
        <p className="mb-3 font-display text-[16px] font-semibold text-ink">Générer une clé</p>
        <div className="flex flex-wrap items-center gap-3">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Nom (ex. Cursor perso)"
            className="w-64 rounded-xl border border-line/70 bg-white px-3 py-2 text-[13px] text-ink outline-none focus:border-[#ff6c02]"
          />
          <div className="flex gap-2">
            {["read", "write", "admin"].map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => toggleScope(s)}
                className={`rounded-full px-3 py-1.5 text-[12px] font-medium ${
                  scopes.includes(s)
                    ? "bg-[#ff6c02]/10 text-[#ff6c02] ring-1 ring-[#ff6c02]/40"
                    : "border border-line/70 text-ink-soft"
                }`}
              >
                {s}
              </button>
            ))}
          </div>
          <button
            type="button"
            disabled={create.isPending || !scopes.length}
            onClick={() => create.mutate()}
            className="inline-flex items-center gap-2 rounded-xl bg-ink px-4 py-2 text-[13px] font-medium text-white disabled:opacity-50"
          >
            {create.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <KeyRound className="h-3.5 w-3.5" />}
            Créer la clé
          </button>
        </div>

        {newKey && (
          <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
            <p className="text-[13px] font-medium text-emerald-800">
              Clé créée — copiez-la maintenant, elle ne sera plus jamais affichée.
            </p>
            <div className="mt-2 flex items-center gap-2">
              <code className="flex-1 overflow-x-auto rounded-lg bg-white px-3 py-2 text-[12px] text-ink">{newKey}</code>
              <button type="button" onClick={() => void copy(newKey)} className="chip-ghost">
                {copied ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
              </button>
            </div>
            <p className="mt-3 text-[12px] font-medium text-emerald-800">Local (npx / stdio) :</p>
            <pre className="mt-1 overflow-x-auto rounded-lg bg-[#101014] p-3 text-[11px] leading-relaxed text-emerald-100">{snippet}</pre>
            <p className="mt-3 text-[12px] font-medium text-emerald-800">Hébergé (JSON-RPC HTTP) :</p>
            <pre className="mt-1 overflow-x-auto rounded-lg bg-[#101014] p-3 text-[11px] leading-relaxed text-emerald-100">{hostedSnippet}</pre>
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-line/70 bg-white">
        <div className="border-b border-line/60 px-5 py-3 text-[12px] uppercase tracking-wider text-ink-soft">
          Clés existantes
        </div>
        {isLoading ? (
          <p className="flex items-center gap-2 px-5 py-4 text-[13px] text-ink-soft">
            <Loader2 className="h-4 w-4 animate-spin" /> Chargement…
          </p>
        ) : !keys?.length ? (
          <p className="px-5 py-4 text-[13px] text-ink-soft">Aucune clé. Créez-en une pour brancher un agent.</p>
        ) : (
          <ul className="divide-y divide-line/60">
            {keys.map((k) => (
              <li key={k.id} className="flex items-center justify-between gap-4 px-5 py-4">
                <div>
                  <p className="text-[14px] font-medium text-ink">
                    {k.name} <code className="ml-2 text-[12px] text-ink-soft">{k.prefix}</code>
                  </p>
                  <p className="text-[12px] text-ink-soft">
                    Scopes : {k.scopes.join(", ")} · Créée le {new Date(k.createdAt).toLocaleDateString("fr-FR")}
                    {k.lastUsedAt ? ` · Dernier usage ${new Date(k.lastUsedAt).toLocaleString("fr-FR")}` : " · Jamais utilisée"}
                  </p>
                </div>
                {k.revokedAt ? (
                  <span className="rounded-full bg-surface-2 px-2.5 py-1 text-[12px] text-ink-soft">Révoquée</span>
                ) : (
                  <button
                    type="button"
                    onClick={() => revoke.mutate(k.id)}
                    className="inline-flex items-center gap-1 rounded-full border border-red-200 px-3 py-1.5 text-[12px] font-medium text-red-600 hover:bg-red-50"
                  >
                    <Trash2 className="h-3.5 w-3.5" /> Révoquer
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

// ─── Policies ─────────────────────────────────────────────────────────────────

function PoliciesTab() {
  const qc = useQueryClient();
  const { data: policy, isLoading } = useQuery({ queryKey: ["mcp-policy"], queryFn: () => getMcpPolicy() });
  const [draft, setDraft] = useState<{
    defaultMode: "dry_run" | "approval" | "live";
    dailySpendCap: string;
    monthlySpendCap: string;
    maxBudgetChangePct: string;
    protectedCampaignIds: string;
    autonomyEnabled: boolean;
  } | null>(null);

  const current = draft ?? (policy
    ? {
        defaultMode: policy.defaultMode,
        dailySpendCap: policy.dailySpendCap?.toString() ?? "",
        monthlySpendCap: policy.monthlySpendCap?.toString() ?? "",
        maxBudgetChangePct: String(policy.maxBudgetChangePct),
        protectedCampaignIds: policy.protectedCampaignIds.join(", "),
        autonomyEnabled: Boolean(policy.autonomyEnabled),
      }
    : null);

  const save = useMutation({
    mutationFn: () =>
      updateMcpPolicy({
        data: {
          defaultMode: current!.defaultMode,
          dailySpendCap: current!.dailySpendCap ? Number(current!.dailySpendCap) : null,
          monthlySpendCap: current!.monthlySpendCap ? Number(current!.monthlySpendCap) : null,
          maxBudgetChangePct: Number(current!.maxBudgetChangePct) || 50,
          protectedCampaignIds: current!.protectedCampaignIds
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean),
          autonomyEnabled: current!.autonomyEnabled,
        },
      }),
    onSuccess: () => {
      setDraft(null);
      void qc.invalidateQueries({ queryKey: ["mcp-policy"] });
    },
  });

  const tick = useMutation({
    mutationFn: () => runMcpAutonomyTick({ data: { forceDryRun: true } }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["mcp-policy"] });
    },
  });

  if (isLoading || !current) {
    return (
      <p className="flex items-center gap-2 text-[13px] text-ink-soft">
        <Loader2 className="h-4 w-4 animate-spin" /> Chargement…
      </p>
    );
  }

  const set = (patch: Partial<NonNullable<typeof draft>>) => setDraft({ ...current, ...patch });

  const MODES = [
    { id: "dry_run" as const, t: "Dry run", d: "Les écritures retournent un diff, rien n'est exécuté." },
    { id: "approval" as const, t: "Approbation", d: "Chaque écriture attend une validation humaine." },
    { id: "live" as const, t: "Live", d: "Exécution directe si la clé a le scope write." },
  ];

  return (
    <div className="space-y-5">
      <section className="card-soft rounded-2xl p-6">
        <p className="mb-4 font-display text-[16px] font-semibold text-ink">Mode par défaut des écritures</p>
        <div className="grid gap-3 sm:grid-cols-3">
          {MODES.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => set({ defaultMode: m.id })}
              className={`rounded-2xl border p-4 text-left transition ${
                current.defaultMode === m.id
                  ? "border-[#ff6c02] bg-[#fff1e2]"
                  : "border-line/70 bg-white hover:border-ink/30"
              }`}
            >
              <p className="text-[14px] font-semibold text-ink">{m.t}</p>
              <p className="mt-1 text-[12px] text-ink-soft">{m.d}</p>
            </button>
          ))}
        </div>
      </section>

      <section className="card-soft rounded-2xl p-6">
        <p className="mb-2 font-display text-[16px] font-semibold text-ink">Autonomie plafonnée</p>
        <p className="mb-4 text-[13px] text-ink-soft">
          Quand activée, <code className="rounded bg-surface-2 px-1">autonomy_tick</code> peut proposer (ou
          exécuter selon le mode) la pause de campagnes avec dépense sans conversion. Jamais de création
          automatique.
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => set({ autonomyEnabled: !current.autonomyEnabled })}
            className={`rounded-full px-4 py-2 text-[13px] font-medium ${
              current.autonomyEnabled
                ? "bg-[#ff6c02] text-white"
                : "border border-line/70 text-ink-soft hover:text-ink"
            }`}
          >
            {current.autonomyEnabled ? "Autonomie activée" : "Autonomie désactivée"}
          </button>
          <button
            type="button"
            disabled={tick.isPending}
            onClick={() => tick.mutate()}
            className="inline-flex items-center gap-2 rounded-full border border-line/70 px-4 py-2 text-[13px] font-medium text-ink hover:border-ink/40 disabled:opacity-50"
          >
            {tick.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
            Lancer un tick (dry-run)
          </button>
        </div>
        {tick.data ? (
          <div className="mt-4 rounded-xl border border-line/60 bg-surface-2/50 p-3 text-[12px] text-ink-soft">
            {tick.data.enabled ? (
              <>
                {tick.data.proposals.length} proposition(s)
                {tick.data.proposals.length > 0 ? (
                  <ul className="mt-2 list-disc space-y-1 pl-4">
                    {tick.data.proposals.slice(0, 8).map((p) => (
                      <li key={`${p.connector}-${p.campaignId}`}>
                        [{p.connector}] {p.campaignName} — {p.reason}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-1">Aucune campagne à pauser pour l’instant.</p>
                )}
              </>
            ) : (
              <p>Autonomie désactivée — activez le toggle puis relancez.</p>
            )}
          </div>
        ) : null}
        {tick.isError ? (
          <p className="mt-3 text-[12px] text-red-600">{(tick.error as Error).message}</p>
        ) : null}
        {policy?.lastAutonomyAt ? (
          <p className="mt-3 text-[12px] text-ink-soft">
            Dernier tick : {new Date(policy.lastAutonomyAt).toLocaleString()} —{" "}
            {policy.lastAutonomySummary ?? "—"}
          </p>
        ) : (
          <p className="mt-3 text-[12px] text-ink-soft">Aucun tick enregistré pour l’instant.</p>
        )}
        <p className="mt-2 text-[11px] text-ink-soft">
          Cron hébergé : <code className="rounded bg-surface-2 px-1">GET/POST /api/cron/autonomy</code>{" "}
          avec <code className="rounded bg-surface-2 px-1">Authorization: Bearer $CRON_SECRET</code>
        </p>
      </section>

      <SkillsPanel />

      <section className="card-soft rounded-2xl p-6">
        <p className="mb-4 font-display text-[16px] font-semibold text-ink">Garde-fous</p>
        <div className="grid gap-4 sm:grid-cols-3">
          <label className="block">
            <span className="text-[12px] text-ink-soft">Spend cap journalier (vide = illimité)</span>
            <input
              value={current.dailySpendCap}
              onChange={(e) => set({ dailySpendCap: e.target.value })}
              type="number"
              className="mt-1 w-full rounded-xl border border-line/70 px-3 py-2 text-[13px] outline-none focus:border-[#ff6c02]"
            />
          </label>
          <label className="block">
            <span className="text-[12px] text-ink-soft">Spend cap mensuel (vide = illimité)</span>
            <input
              value={current.monthlySpendCap}
              onChange={(e) => set({ monthlySpendCap: e.target.value })}
              type="number"
              className="mt-1 w-full rounded-xl border border-line/70 px-3 py-2 text-[13px] outline-none focus:border-[#ff6c02]"
            />
          </label>
          <label className="block">
            <span className="text-[12px] text-ink-soft">Hausse de budget max (%)</span>
            <input
              value={current.maxBudgetChangePct}
              onChange={(e) => set({ maxBudgetChangePct: e.target.value })}
              type="number"
              className="mt-1 w-full rounded-xl border border-line/70 px-3 py-2 text-[13px] outline-none focus:border-[#ff6c02]"
            />
          </label>
        </div>
        <label className="mt-4 block">
          <span className="text-[12px] text-ink-soft">Campagnes protégées (IDs séparés par des virgules)</span>
          <input
            value={current.protectedCampaignIds}
            onChange={(e) => set({ protectedCampaignIds: e.target.value })}
            placeholder="123456, 789012"
            className="mt-1 w-full rounded-xl border border-line/70 px-3 py-2 text-[13px] outline-none focus:border-[#ff6c02]"
          />
        </label>
        <button
          type="button"
          disabled={save.isPending}
          onClick={() => save.mutate()}
          className="mt-5 inline-flex items-center gap-2 rounded-xl bg-ink px-4 py-2 text-[13px] font-medium text-white disabled:opacity-50"
        >
          {save.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ShieldCheck className="h-3.5 w-3.5" />}
          Enregistrer la policy
        </button>
      </section>
    </div>
  );
}

function SkillsPanel() {
  const { data: skills, isLoading } = useQuery({ queryKey: ["mcp-skills"], queryFn: () => listMcpSkills() });

  return (
    <section className="card-soft rounded-2xl p-6">
      <p className="mb-2 font-display text-[16px] font-semibold text-ink">Skills MCP</p>
      <p className="mb-4 text-[13px] text-ink-soft">
        SOPs appelables via <code className="rounded bg-surface-2 px-1">list_skills</code> /{" "}
        <code className="rounded bg-surface-2 px-1">run_skill</code> — pas un Campaign IDE.
      </p>
      {isLoading ? (
        <p className="flex items-center gap-2 text-[13px] text-ink-soft">
          <Loader2 className="h-4 w-4 animate-spin" /> Chargement…
        </p>
      ) : (
        <ul className="space-y-3">
          {(skills ?? []).map((s) => (
            <li key={s.id} className="rounded-xl border border-line/60 bg-white p-4">
              <p className="text-[14px] font-semibold text-ink">
                {s.name}{" "}
                <span className="font-mono text-[11px] font-normal text-ink-soft">({s.id})</span>
              </p>
              <p className="mt-1 text-[12px] text-ink-soft">{s.description}</p>
              <ol className="mt-2 list-decimal space-y-0.5 pl-4 text-[12px] text-ink-soft">
                {s.steps.map((step) => (
                  <li key={step.tool}>
                    <code>{step.tool}</code> — {step.hint}
                  </li>
                ))}
              </ol>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

// ─── Approbations ─────────────────────────────────────────────────────────────

function ApprovalsTab() {
  const qc = useQueryClient();
  const { data: items, isLoading } = useQuery({
    queryKey: ["mcp-approvals"],
    queryFn: () => listMcpApprovals(),
    refetchInterval: 15_000,
  });

  const approve = useMutation({
    mutationFn: (approvalId: string) => approveMcpAction({ data: { approvalId } }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["mcp-approvals"] });
      void qc.invalidateQueries({ queryKey: ["mcp-audit"] });
    },
  });
  const reject = useMutation({
    mutationFn: (approvalId: string) => rejectMcpAction({ data: { approvalId } }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["mcp-approvals"] }),
  });

  return (
    <section className="rounded-2xl border border-line/70 bg-white">
      <div className="border-b border-line/60 px-5 py-3 text-[12px] uppercase tracking-wider text-ink-soft">
        Écritures en attente d&apos;approbation
      </div>
      {isLoading ? (
        <p className="flex items-center gap-2 px-5 py-4 text-[13px] text-ink-soft">
          <Loader2 className="h-4 w-4 animate-spin" /> Chargement…
        </p>
      ) : !items?.length ? (
        <p className="px-5 py-4 text-[13px] text-ink-soft">
          Aucune action en attente. Les agents en mode « approval » alimenteront cette file.
        </p>
      ) : (
        <ul className="divide-y divide-line/60">
          {items.map((a) => (
            <li key={a.approvalId} className="px-5 py-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-[14px] font-medium text-ink">
                    {a.action} <span className="text-ink-soft">· {a.connector}</span>
                  </p>
                  <p className="text-[12px] text-ink-soft">
                    Demandée le {new Date(a.createdAt).toLocaleString("fr-FR")}
                    {a.expiresAt ? ` · expire le ${new Date(a.expiresAt).toLocaleDateString("fr-FR")}` : ""}
                  </p>
                  {a.diffJson && (
                    <pre className="mt-2 max-w-[560px] overflow-x-auto rounded-lg bg-surface-2 p-3 text-[11px] leading-relaxed text-ink">
                      {a.diffJson}
                    </pre>
                  )}
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={approve.isPending}
                    onClick={() => approve.mutate(a.approvalId)}
                    className="inline-flex items-center gap-1 rounded-full bg-emerald-600 px-3 py-1.5 text-[12px] font-medium text-white disabled:opacity-50"
                  >
                    <Check className="h-3.5 w-3.5" /> Approuver
                  </button>
                  <button
                    type="button"
                    disabled={reject.isPending}
                    onClick={() => reject.mutate(a.approvalId)}
                    className="inline-flex items-center gap-1 rounded-full border border-red-200 px-3 py-1.5 text-[12px] font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
                  >
                    <X className="h-3.5 w-3.5" /> Rejeter
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
      {approve.error && (
        <p className="border-t border-line/60 px-5 py-3 text-[12px] text-red-600">
          {approve.error instanceof Error ? approve.error.message : "Erreur lors de l'exécution"}
        </p>
      )}
    </section>
  );
}

// ─── Audit ────────────────────────────────────────────────────────────────────

const MODE_BADGE: Record<string, string> = {
  read: "bg-surface-2 text-ink-soft",
  dry_run: "bg-sky-50 text-sky-700",
  approval: "bg-amber-50 text-amber-700",
  live: "bg-emerald-50 text-emerald-700",
};

function AuditTab() {
  const { data: runs, isLoading } = useQuery({
    queryKey: ["mcp-audit"],
    queryFn: () => listMcpActionRuns({ data: { limit: 100 } }),
    refetchInterval: 30_000,
  });

  return (
    <section className="rounded-2xl border border-line/70 bg-white">
      <div className="border-b border-line/60 px-5 py-3 text-[12px] uppercase tracking-wider text-ink-soft">
        Journal d&apos;audit (100 dernières actions)
      </div>
      {isLoading ? (
        <p className="flex items-center gap-2 px-5 py-4 text-[13px] text-ink-soft">
          <Loader2 className="h-4 w-4 animate-spin" /> Chargement…
        </p>
      ) : !runs?.length ? (
        <p className="px-5 py-4 text-[13px] text-ink-soft">Aucune action pour le moment.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-[13px]">
            <thead>
              <tr className="border-b border-line/60 text-[11px] uppercase tracking-wider text-ink-soft">
                <th className="px-5 py-2.5">Date</th>
                <th className="px-5 py-2.5">Tool</th>
                <th className="px-5 py-2.5">Plateforme</th>
                <th className="px-5 py-2.5">Mode</th>
                <th className="px-5 py-2.5">Statut</th>
                <th className="px-5 py-2.5">Latence</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line/50">
              {runs.map((r) => (
                <tr key={r.id}>
                  <td className="whitespace-nowrap px-5 py-2.5 text-ink-soft">
                    {new Date(r.createdAt).toLocaleString("fr-FR")}
                  </td>
                  <td className="px-5 py-2.5 font-medium text-ink">{r.tool}</td>
                  <td className="px-5 py-2.5 text-ink-soft">{r.connector || "—"}</td>
                  <td className="px-5 py-2.5">
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${MODE_BADGE[r.mode] ?? "bg-surface-2 text-ink-soft"}`}>
                      {r.mode}
                    </span>
                  </td>
                  <td className="px-5 py-2.5">
                    {r.status === "ok" ? (
                      <span className="text-emerald-600">ok</span>
                    ) : r.status === "pending_approval" ? (
                      <span className="text-amber-600">en attente</span>
                    ) : (
                      <span className="text-red-600" title={r.error ?? undefined}>
                        {r.status}
                      </span>
                    )}
                  </td>
                  <td className="px-5 py-2.5 text-ink-soft">{r.latencyMs} ms</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
