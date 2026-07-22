import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Check, Copy, KeyRound, Plug, ShieldCheck, Terminal } from "lucide-react";
import { BrandLogo } from "@/components/BrandLogo";

export const Route = createFileRoute("/docs")({
  head: () => ({
    meta: [
      { title: "Docs — Orkestria MCP" },
      {
        name: "description",
        content: "Quickstart Orkestria MCP : créez une clé API, branchez Cursor ou Claude, pilotez vos pubs en dry-run puis en live.",
      },
    ],
  }),
  component: DocsPage,
});

const TOOL_FAMILIES: { family: string; tools: { name: string; desc: string }[] }[] = [
  {
    family: "Core",
    tools: [
      { name: "whoami", desc: "Workspace et scopes de la clé" },
      { name: "validate_setup", desc: "Vérifie la clé, les plateformes connectées et la policy — sans écriture" },
      { name: "list_connections", desc: "Statut de connexion des 10 régies" },
      { name: "list_ad_accounts", desc: "Comptes publicitaires accessibles sur une plateforme" },
    ],
  },
  {
    family: "Launch",
    tools: [
      { name: "create_campaign", desc: "Crée une campagne (en pause quand la plateforme le permet)" },
      { name: "create_ad_set", desc: "Crée un ad set / ad group (Meta en priorité)" },
      { name: "create_ad", desc: "Crée une annonce liée à un ad set + créatif" },
      { name: "create_audience", desc: "Audience custom / lookalike Meta" },
      { name: "set_budget", desc: "Fixe le budget journalier d'une campagne (ou ad set Meta)" },
      { name: "create_media_plan", desc: "Répartit un budget total entre les plateformes selon la perf 30 jours" },
    ],
  },
  {
    family: "Optimize",
    tools: [
      { name: "update_budget", desc: "Modifie le budget (plafonné par la policy)" },
      { name: "pause_campaign", desc: "Met une campagne en pause" },
      { name: "enable_campaign", desc: "Réactive une campagne" },
      { name: "reallocate_budget", desc: "Déplace du budget entre deux campagnes" },
      { name: "add_keywords", desc: "Ajoute des mots-clés (Google, Microsoft, Amazon SP)" },
    ],
  },
  {
    family: "Create",
    tools: [
      { name: "generate_ad_copy", desc: "Variantes de textes publicitaires (headline, texte, CTA)" },
      { name: "upload_creative", desc: "Upload une image et crée un créatif Meta" },
      { name: "list_creatives", desc: "Campagnes et statut des créations" },
    ],
  },
  {
    family: "Measure",
    tools: [
      { name: "get_performance", desc: "Perf campagne par campagne sur 30 jours" },
      { name: "list_campaigns", desc: "Toutes les campagnes (une plateforme ou toutes)" },
      { name: "get_account_summary", desc: "Vue consolidée multi-plateformes" },
      { name: "compare_campaigns", desc: "Classement par métrique (spend, conv, ctr, cpa)" },
      { name: "get_spend", desc: "Dépense totale et par plateforme" },
      { name: "detect_anomalies", desc: "Dépense sans conversion, CTR faible, CPA aberrant" },
    ],
  },
  {
    family: "Govern",
    tools: [
      { name: "execute", desc: "Action universel : dry_run=true par défaut, puis dry_run=false pour confirmer" },
      { name: "list_pending_approvals", desc: "Écritures en attente d'approbation" },
      { name: "approve_action", desc: "Approuve et exécute (scope write)" },
      { name: "reject_action", desc: "Rejette une action en attente" },
      { name: "get_audit_log", desc: "Journal d'audit filtrable" },
      { name: "get_policies", desc: "Lit la policy du workspace" },
      { name: "set_policy", desc: "Modifie la policy (scope admin)" },
    ],
  },
];

function CodeBlock({ title, code }: { title: string; code: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <div className="overflow-hidden rounded-2xl bg-[#101014]">
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-2.5">
        <span className="text-[12px] text-white/50">{title}</span>
        <button
          type="button"
          onClick={() => void copy()}
          className="inline-flex items-center gap-1.5 rounded-lg bg-white/10 px-2.5 py-1 text-[12px] text-white/80 hover:bg-white/20"
        >
          {copied ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
          {copied ? "Copié" : "Copier"}
        </button>
      </div>
      <pre className="overflow-x-auto p-5 text-[13px] leading-relaxed text-emerald-100">{code}</pre>
    </div>
  );
}

function DocsPage() {
  return (
    <main className="min-h-screen bg-white">
      <header className="border-b border-line/60">
        <div className="mx-auto flex max-w-[960px] items-center justify-between px-6 py-4">
          <Link to="/" className="flex items-center gap-2">
            <BrandLogo className="h-7 w-auto" />
          </Link>
          <Link
            to="/app/mcp"
            className="rounded-full bg-ink px-4 py-2 text-[13px] font-medium text-white hover:opacity-90"
          >
            Créer ma clé API
          </Link>
        </div>
      </header>

      <div className="mx-auto max-w-[960px] px-6 py-14">
        <p className="text-[13px] font-semibold uppercase tracking-wider text-[#ff6c02]">Documentation</p>
        <h1 className="mt-2 font-display text-[40px] font-semibold leading-tight text-ink">Orkestria MCP — Quickstart</h1>
        <p className="mt-4 max-w-2xl text-[16px] text-ink-soft">
          En 5 minutes : une clé API, une config MCP, et votre agent (Cursor, Claude Desktop, Claude Code…) pilote
          vos campagnes Google, Meta, LinkedIn, TikTok, Snapchat, Reddit, Microsoft, X, Amazon et Pinterest — sous
          policy.
        </p>

        {/* Étape 1 */}
        <section className="mt-12">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#fff1e2] text-[#ff6c02]">
              <KeyRound className="h-4 w-4" />
            </span>
            <h2 className="font-display text-[24px] font-semibold text-ink">1. Créez votre clé API</h2>
          </div>
          <p className="mt-3 text-[15px] text-ink-soft">
            Dashboard → <Link to="/app/mcp" className="font-medium text-[#ff6c02] hover:underline">Orkestria MCP → Clés API</Link>.
            Choisissez les scopes :
          </p>
          <ul className="mt-3 space-y-2 text-[14px] text-ink">
            <li><code className="rounded bg-surface-2 px-1.5 py-0.5 text-[13px]">read</code> — lecture seule (perf, campagnes, audit).</li>
            <li><code className="rounded bg-surface-2 px-1.5 py-0.5 text-[13px]">write</code> — exécution live et approbations.</li>
            <li><code className="rounded bg-surface-2 px-1.5 py-0.5 text-[13px]">admin</code> — modification des policies.</li>
          </ul>
        </section>

        {/* Étape 2 */}
        <section className="mt-12">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#fff1e2] text-[#ff6c02]">
              <Plug className="h-4 w-4" />
            </span>
            <h2 className="font-display text-[24px] font-semibold text-ink">2. Branchez votre agent</h2>
          </div>
          <p className="mt-3 text-[15px] text-ink-soft">
            Option A — local via npx (Cursor : <code className="rounded bg-surface-2 px-1.5 py-0.5 text-[13px]">~/.cursor/mcp.json</code>,
            Claude Desktop : <code className="rounded bg-surface-2 px-1.5 py-0.5 text-[13px]">claude_desktop_config.json</code>) :
          </p>
          <div className="mt-3">
            <CodeBlock
              title="mcp.json — local (stdio)"
              code={`{
  "mcpServers": {
    "orkestria": {
      "command": "npx",
      "args": ["-y", "orkestria-mcp"],
      "env": { "ORKESTRIA_API_KEY": "ork_..." }
    }
  }
}`}
            />
          </div>
          <p className="mt-5 text-[15px] text-ink-soft">
            Option B — hébergé (JSON-RPC HTTP, aucune installation). Endpoint stable :
          </p>
          <div className="mt-3">
            <CodeBlock
              title="mcp.json — hosted"
              code={`{
  "mcpServers": {
    "orkestria": {
      "url": "https://orkestria.top/api/mcp",
      "headers": { "Authorization": "Bearer ork_..." }
    }
  }
}`}
            />
          </div>
        </section>

        {/* Endpoint stable */}
        <section className="mt-12">
          <h2 className="font-display text-[24px] font-semibold text-ink">Endpoint hébergé stable</h2>
          <ul className="mt-3 space-y-2 text-[14px] text-ink">
            <li>
              URL : <code className="rounded bg-surface-2 px-1.5 py-0.5 text-[13px]">https://orkestria.top/api/mcp</code>
            </li>
            <li>
              Auth : header <code className="rounded bg-surface-2 px-1.5 py-0.5 text-[13px]">Authorization: Bearer ork_…</code>{" "}
              (requis pour <code className="rounded bg-surface-2 px-1.5 py-0.5 text-[13px]">tools/call</code>).
            </li>
            <li>
              Transport : <strong>JSON-RPC HTTP</strong> (<code className="rounded bg-surface-2 px-1.5 py-0.5 text-[13px]">POST</code>{" "}
              <code className="rounded bg-surface-2 px-1.5 py-0.5 text-[13px]">application/json</code>) — pas de SSE Streamable HTTP.
            </li>
            <li>
              Santé / métadonnées : <code className="rounded bg-surface-2 px-1.5 py-0.5 text-[13px]">GET /api/mcp</code>{" "}
              (public). Catalogue tools : <code className="rounded bg-surface-2 px-1.5 py-0.5 text-[13px]">GET /api/mcp/tools</code>.
            </li>
            <li>
              Scopes : <code className="rounded bg-surface-2 px-1.5 py-0.5 text-[13px]">read</code> /{" "}
              <code className="rounded bg-surface-2 px-1.5 py-0.5 text-[13px]">write</code> /{" "}
              <code className="rounded bg-surface-2 px-1.5 py-0.5 text-[13px]">admin</code>.
            </li>
          </ul>
        </section>

        {/* Étape 3 */}
        <section className="mt-12">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#fff1e2] text-[#ff6c02]">
              <Terminal className="h-4 w-4" />
            </span>
            <h2 className="font-display text-[24px] font-semibold text-ink">3. Premier run</h2>
          </div>
          <ol className="mt-3 list-decimal space-y-2 pl-5 text-[15px] text-ink">
            <li>Demandez : <em>« Valide mon setup Orkestria »</em> → l&apos;agent appelle <code className="rounded bg-surface-2 px-1.5 py-0.5 text-[13px]">validate_setup</code>.</li>
            <li><em>« Liste mes campagnes »</em> → <code className="rounded bg-surface-2 px-1.5 py-0.5 text-[13px]">list_campaigns</code>, lecture multi-plateformes.</li>
            <li>
              <em>« Monte le budget de la campagne X à 50 € »</em> →{" "}
              <code className="rounded bg-surface-2 px-1.5 py-0.5 text-[13px]">execute</code> avec{" "}
              <code className="rounded bg-surface-2 px-1.5 py-0.5 text-[13px]">dry_run: true</code> : vous voyez le diff, rien n&apos;est modifié.
            </li>
            <li>
              Relancez <code className="rounded bg-surface-2 px-1.5 py-0.5 text-[13px]">execute</code> avec{" "}
              <code className="rounded bg-surface-2 px-1.5 py-0.5 text-[13px]">dry_run: false</code> (ou mode{" "}
              <code className="rounded bg-surface-2 px-1.5 py-0.5 text-[13px]">approval</code> /{" "}
              <code className="rounded bg-surface-2 px-1.5 py-0.5 text-[13px]">live</code> sur les tools nommés).
            </li>
          </ol>
        </section>

        {/* Policies */}
        <section className="mt-12">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#fff1e2] text-[#ff6c02]">
              <ShieldCheck className="h-4 w-4" />
            </span>
            <h2 className="font-display text-[24px] font-semibold text-ink">Le modèle de sécurité</h2>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            {[
              { t: "Dry run (défaut)", d: "Chaque écriture retourne le diff prévu. Aucune modification tant que vous n'avez pas opté pour un autre mode." },
              { t: "Approbation", d: "L'action attend une validation humaine dans le dashboard (ou via approve_action)." },
              { t: "Live", d: "Exécution directe — uniquement avec le scope write, hors campagnes protégées et sous les spend caps." },
            ].map((m) => (
              <div key={m.t} className="rounded-2xl border border-line/70 p-4">
                <p className="text-[14px] font-semibold text-ink">{m.t}</p>
                <p className="mt-1 text-[13px] text-ink-soft">{m.d}</p>
              </div>
            ))}
          </div>
          <p className="mt-4 text-[14px] text-ink-soft">
            Les garde-fous configurables : plafond de hausse de budget (%), spend caps journaliers/mensuels (globaux et
            par plateforme), campagnes protégées. Chaque appel — lecture comprise — est journalisé dans l&apos;audit.
          </p>
        </section>

        {/* Référence des tools */}
        <section className="mt-12">
          <h2 className="font-display text-[24px] font-semibold text-ink">Référence des tools</h2>
          <div className="mt-4 space-y-6">
            {TOOL_FAMILIES.map((f) => (
              <div key={f.family}>
                <p className="text-[12px] font-semibold uppercase tracking-wider text-[#ff6c02]">{f.family}</p>
                <ul className="mt-2 divide-y divide-line/50 rounded-2xl border border-line/70">
                  {f.tools.map((t) => (
                    <li key={t.name} className="flex flex-wrap items-baseline gap-x-4 gap-y-1 px-4 py-2.5">
                      <code className="w-52 flex-none text-[13px] font-medium text-ink">{t.name}</code>
                      <span className="text-[13px] text-ink-soft">{t.desc}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-14 rounded-3xl bg-ink p-8 text-white">
          <h2 className="font-display text-[24px] font-semibold">Prêt à brancher votre agent ?</h2>
          <p className="mt-2 text-[14px] text-white/70">
            Créez votre compte, connectez vos régies et générez votre première clé en 2 minutes.
          </p>
          <Link
            to="/app/mcp"
            className="mt-5 inline-flex rounded-full bg-[#ff6c02] px-5 py-2.5 text-[14px] font-medium text-white hover:opacity-90"
          >
            Générer ma clé API
          </Link>
        </section>
      </div>
    </main>
  );
}
