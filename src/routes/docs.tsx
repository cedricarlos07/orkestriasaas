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
      { name: "validate_setup", desc: "Connexions + stack V1 (adkit, AdLoop, useproxy) + policy + maturity" },
      { name: "list_capabilities", desc: "Matrice honnête create/read/pause par régie" },
      { name: "list_connections", desc: "Statut de connexion + maturity des régies" },
      { name: "list_ad_accounts", desc: "Comptes publicitaires accessibles sur une plateforme" },
      { name: "list_tool_catalog", desc: "Catalogue name / description / family (+ maturity writes)" },
      { name: "run_tool", desc: "Appelle un tool par nom — long-tail sans exploser le mental model" },
    ],
  },
  {
    family: "Launch",
    tools: [
      { name: "launch_meta_brief", desc: "Meta funnel complet via adkit (PAUSED) — dry_run d'abord" },
      { name: "activate_meta_campaign", desc: "Activation adkit (ad + ad set + campaign) — spend gated" },
      { name: "create_search_campaign", desc: "Google Search via AdLoop quand alc_ lié" },
      { name: "create_pmax_campaign", desc: "Google PMax via AdLoop (alc_)" },
      { name: "create_meta_campaign", desc: "Meta campagne + ad set PAUSED (legacy natif)" },
      { name: "create_linkedin_campaign", desc: "LinkedIn DRAFT (experimental)" },
      { name: "create_reddit_campaign", desc: "Reddit PAUSED (experimental)" },
      { name: "create_campaign", desc: "Campagne générique — vérifier list_capabilities avant" },
      { name: "create_ad_set", desc: "Ad set Meta/TikTok ou campagne DRAFT LinkedIn" },
      { name: "create_ad", desc: "Annonce / créatif Meta, TikTok, LinkedIn" },
      { name: "create_audience", desc: "Audience Meta / Google / LinkedIn / TikTok / Snap" },
      { name: "attach_audience", desc: "Attache une audience (campagne Google/LI ou ad set Meta)" },
      { name: "create_conversion", desc: "Conversion action Google Ads" },
      { name: "update_campaign_budget", desc: "Alias Synter de update_budget / set_budget" },
      { name: "create_media_plan", desc: "Répartit un budget total entre les plateformes selon la perf 30 jours" },
    ],
  },
  {
    family: "Optimize",
    tools: [
      { name: "update_budget", desc: "Modifie le budget (plafonné par la policy)" },
      { name: "pause_campaign", desc: "Met une campagne en pause" },
      { name: "enable_campaign", desc: "Réactive une campagne" },
      { name: "pause_ad_set", desc: "Pause un ad set Meta" },
      { name: "enable_ad_set", desc: "Réactive un ad set Meta" },
      { name: "pause_ad", desc: "Pause une annonce Meta" },
      { name: "reallocate_budget", desc: "Déplace du budget entre deux campagnes" },
      { name: "add_keywords", desc: "Ajoute des mots-clés (Google, Microsoft, Amazon SP)" },
      { name: "add_negative_keywords", desc: "Mots-clés négatifs (Google, Microsoft)" },
      { name: "search_meta_targeting", desc: "Intérêts / job titles Meta via adkit" },
      { name: "optimize_meta_ads", desc: "Recommandations KILL/SCALE/KEEP via adkit" },
    ],
  },
  {
    family: "Create",
    tools: [
      { name: "generate_ad_copy", desc: "Variantes de textes publicitaires (headline, texte, CTA) — studio actuel" },
      { name: "upload_creative", desc: "Upload image Meta / TikTok (pas d'Imagen/Veo)" },
      { name: "list_creatives", desc: "Assets créatifs Google / Meta / TikTok / LinkedIn" },
      { name: "suggest_creative_rotation", desc: "Propose des ads Meta à pauser (CTR faible)" },
    ],
  },
  {
    family: "Measure",
    tools: [
      { name: "research_competitor_ads", desc: "Meta Ad Library via useproxy (mcp.useproxy.dev)" },
      { name: "get_performance", desc: "Perf campagne par campagne sur 30 jours" },
      { name: "list_campaigns", desc: "Toutes les campagnes (une plateforme ou toutes)" },
      { name: "get_account_summary", desc: "Vue consolidée multi-plateformes" },
      { name: "compare_campaigns", desc: "Classement par métrique (spend, conv, ctr, cpa)" },
      { name: "get_daily_spend", desc: "Alias Synter de get_spend" },
      { name: "list_conversions", desc: "Conversions Google / pixels Meta" },
      { name: "diagnose_tracking", desc: "Diagnostic tracking Google / Meta / TikTok" },
      { name: "detect_anomalies", desc: "Dépense sans conversion, CTR faible, CPA aberrant" },
    ],
  },
  {
    family: "Govern",
    tools: [
      { name: "execute", desc: "Action universelle : dry_run=true par défaut, puis dry_run=false pour confirmer" },
      { name: "list_skills", desc: "Skills launch / optimize / audit / audience / creative_rotate + SOPs fichier" },
      { name: "run_skill", desc: "Plan d'étapes d'une skill" },
      { name: "autonomy_tick", desc: "Tick autonomie plafonnée (pause spend sans conv)" },
      { name: "list_pending_approvals", desc: "Écritures en attente d'approbation" },
      { name: "approve_action", desc: "Approuve et exécute (scope write)" },
      { name: "reject_action", desc: "Rejette une action en attente" },
      { name: "get_audit_log", desc: "Journal d'audit filtrable" },
      { name: "get_policies", desc: "Lit la policy du workspace" },
      { name: "set_policy", desc: "Modifie la policy (scope admin), incl. autonomie" },
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
          vos campagnes sous policy — dry-run par défaut, style Synter.
        </p>

        <section className="mt-8 rounded-2xl border border-amber-200 bg-amber-50/80 p-5">
          <p className="text-[14px] font-semibold text-ink">Fair warning</p>
          <p className="mt-2 text-[14px] text-ink-soft">
            Un agent avec scope <code className="rounded bg-white px-1.5 py-0.5 text-[13px]">write</code> peut créer des
            campagnes, changer des budgets et pauser des ads. Toute écriture démarre en{" "}
            <code className="rounded bg-white px-1.5 py-0.5 text-[13px]">dry_run=true</code> ; les créations sont en
            pause/draft quand la régie le permet. Appelez{" "}
            <code className="rounded bg-white px-1.5 py-0.5 text-[13px]">list_capabilities</code> d&apos;abord —
            seules Google Ads et Meta sont en maturité <strong>production</strong> aujourd&apos;hui.
          </p>
        </section>

        <section className="mt-10">
          <h2 className="font-display text-[24px] font-semibold text-ink">Matrice de capacités</h2>
          <p className="mt-2 text-[14px] text-ink-soft">
            Honnête : pas de claim « 10 régies create fiables ». Les creates expérimentaux restent utilisables, tagués
            dans <code className="rounded bg-surface-2 px-1.5 py-0.5 text-[13px]">validate_setup</code>.
          </p>
          <div className="mt-4 overflow-x-auto rounded-2xl border border-line/70">
            <table className="w-full text-left text-[13px]">
              <thead className="border-b border-line/60 bg-surface-2/50 text-[12px] uppercase tracking-wider text-ink-soft">
                <tr>
                  <th className="px-4 py-2.5 font-semibold">Maturity</th>
                  <th className="px-4 py-2.5 font-semibold">Plateformes</th>
                  <th className="px-4 py-2.5 font-semibold">Create</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line/50">
                <tr>
                  <td className="px-4 py-3 font-medium text-emerald-700">production</td>
                  <td className="px-4 py-3 text-ink">Google Ads, Meta</td>
                  <td className="px-4 py-3 text-ink-soft">Google via AdLoop (alc_) · Meta via adkit-mcp · Research useproxy.dev</td>
                </tr>
                <tr>
                  <td className="px-4 py-3 font-medium text-amber-700">experimental</td>
                  <td className="px-4 py-3 text-ink">LinkedIn, TikTok, Snap, Reddit, Microsoft, X, Amazon, Pinterest</td>
                  <td className="px-4 py-3 text-ink-soft">Best-effort PAUSED/DRAFT — erreurs API + lien docs</td>
                </tr>
                <tr>
                  <td className="px-4 py-3 font-medium text-ink-soft">reporting</td>
                  <td className="px-4 py-3 text-ink">GA4</td>
                  <td className="px-4 py-3 text-ink-soft">Lecture seule</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

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
      "args": ["-y", "orkestria-mcp@1.2.0"],
      "env": { "ORKESTRIA_API_KEY": "ork_..." }
    }
  }
}`}
            />
          </div>
          <p className="mt-5 text-[15px] text-ink-soft">
            Option B — hébergé (Streamable HTTP / SSE, fallback JSON-RPC). Endpoint stable :
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
              Transport : <strong>Streamable HTTP</strong> (
              <code className="rounded bg-surface-2 px-1.5 py-0.5 text-[13px]">Accept: text/event-stream</code>) avec
              session <code className="rounded bg-surface-2 px-1.5 py-0.5 text-[13px]">Mcp-Session-Id</code>. Fallback{" "}
              <code className="rounded bg-surface-2 px-1.5 py-0.5 text-[13px]">application/json</code> JSON-RPC.
            </li>
            <li>
              Santé : <code className="rounded bg-surface-2 px-1.5 py-0.5 text-[13px]">GET /api/mcp</code> — catalogue{" "}
              <code className="rounded bg-surface-2 px-1.5 py-0.5 text-[13px]">GET /api/mcp/tools</code>.
            </li>
            <li>
              Skills : <code className="rounded bg-surface-2 px-1.5 py-0.5 text-[13px]">list_skills</code> /{" "}
              <code className="rounded bg-surface-2 px-1.5 py-0.5 text-[13px]">run_skill</code> — autonomie via{" "}
              <code className="rounded bg-surface-2 px-1.5 py-0.5 text-[13px]">autonomy_tick</code>.
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
            <li>
              Demandez : <em>« Valide mon setup Orkestria »</em> →{" "}
              <code className="rounded bg-surface-2 px-1.5 py-0.5 text-[13px]">validate_setup</code> /{" "}
              <code className="rounded bg-surface-2 px-1.5 py-0.5 text-[13px]">list_capabilities</code>.
            </li>
            <li><em>« Liste mes campagnes »</em> → <code className="rounded bg-surface-2 px-1.5 py-0.5 text-[13px]">list_campaigns</code>.</li>
            <li>
              Proposez une écriture →{" "}
              <code className="rounded bg-surface-2 px-1.5 py-0.5 text-[13px]">execute</code> ou tool nommé avec{" "}
              <code className="rounded bg-surface-2 px-1.5 py-0.5 text-[13px]">dry_run: true</code> (défaut) : status{" "}
              <code className="rounded bg-surface-2 px-1.5 py-0.5 text-[13px]">dry_run</code>, payload{" "}
              <code className="rounded bg-surface-2 px-1.5 py-0.5 text-[13px]">confirm</code>, message{" "}
              <em>Re-call with dry_run=false</em>.
            </li>
            <li>
              Après revue humaine : même appel avec{" "}
              <code className="rounded bg-surface-2 px-1.5 py-0.5 text-[13px]">dry_run: false</code>.
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
