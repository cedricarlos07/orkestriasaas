// Super Admin demo data store — in-memory + localStorage + Neon sync.

import {
  getGlobalKPIs as fetchGlobalKPIs,
  listOrganizations as fetchOrganizations,
  listPlatformUsers as fetchUsers,
  listInvoices as fetchInvoices,
  listConnections as fetchConnections,
  listAdminRuns as fetchRuns,
  listAdActions as fetchAdActions,
  listApprovals as fetchApprovals,
  listIncidents as fetchIncidents,
  listPlatformIncidents as fetchPlatformIncidents,
  listMCPStatuses as fetchMCPStatuses,
  listSupportTickets as fetchTickets,
  getAiLimits as fetchAiLimits,
} from "@/functions/admin";
import { ORKESTRIA_PLANS, type PlanId as PricingPlanId } from "@/lib/pricing/plans";
export { fmtMoney, BILLING_CURRENCY } from "@/lib/pricing/money";

export type OrgType = "entreprise" | "agence" | "groupe";
export type OrgStatus = "active" | "essai" | "suspendue" | "impayée";
export type RiskLevel = "faible" | "moyen" | "élevé";
export type PlanId = PricingPlanId;

export type Organization = {
  id: string; name: string; type: OrgType; country: string; plan: PlanId; status: OrgStatus;
  members: number; adAccounts: number; adSpend: number; aiSpend: number;
  createdAt: string; lastActive: string; risk: RiskLevel;
  sector: string; currency: string; timezone: string; language: string;
  renewsAt: string; accountManager: string; health: "ok" | "attention" | "critique";
  workspaces: number; autopilot: boolean; writeBlocked: boolean;
};

export type PlatformUser = {
  id: string; name: string; email: string; phone: string; orgId: string;
  role: string;
  country: string; status: "actif" | "suspendu" | "invité"; twoFA: boolean;
  lastLogin: string; device: string; consumption: number; incidents: number;
};

export type Plan = {
  id: PlanId; name: string; audience: "annonceur" | "agence" | "enterprise";
  priceMonthly: number; priceYearly: number;
  orgs: number | "illimité"; workspaces: number | "illimité"; adAccounts: number | "illimité";
  users: number | "illimité"; runsPerMonth: number | "illimité"; historyDays: number;
  automations: "aucune" | "basique" | "avancée" | "complète";
  autonomy: "conseil" | "assistée" | "supervisée" | "autopilot";
  support: string;
};

export type Invoice = {
  id: string; orgId: string; amount: number; currency: string;
  status: "payée" | "échec" | "en_attente" | "remboursée";
  method: "carte" | "mobile_money" | "virement" | "manuel";
  issuedAt: string;
};

export type ConnectorId =
  | "meta" | "google_ads" | "google_ads_write" | "tiktok" | "ga4"
  | "whatsapp" | "crm" | "sheets" | "shopify";

export type Connection = {
  id: string; orgId: string; connector: ConnectorId;
  status: "active" | "expirée" | "erreur" | "permissions_manquantes" | "déconnectée";
  lastSync: string; calls24h: number; errorRate: number; scopes: string[];
};

export type Incident = {
  id: string;
  kind: "cap_dépassé" | "action_non_confirmée" | "mcp_erreurs" | "org_suspecte" | "coût_ia_anormal" | "oauth_perdu";
  severity: "info" | "warn" | "critique";
  message: string; orgId?: string; at: string;
};

export type MCPService =
  | "meta_mcp" | "google_ads_mcp" | "google_ads_write_mcp" | "tiktok_mcp" | "ga4_mcp"
  | "database" | "workers" | "storage" | "queues" | "notifications";

export type MCPStatus = {
  id: MCPService; label: string; status: "ok" | "dégradé" | "down";
  latency: number; uptime: number;
  version: string; errorRate: number; calls24h: number; quota: string;
  updatedAt: string; lastErrors: string[]; tenantAffected?: string;
  tools: string[];
};

const COUNTRIES = ["Sénégal", "Côte d'Ivoire", "France", "Cameroun", "Maroc", "Bénin", "Togo", "Mali"];
const SECTORS = ["Restauration", "E-commerce", "Beauté", "Immobilier", "Éducation", "Services", "Mode", "Santé"];
const MANAGERS = ["Awa Diop", "Kader Ba", "Fatou Sy", "Yaya Kanté", "Léa Martin", "Ismaël N."];

function pick<T>(arr: T[], i: number): T { return arr[i % arr.length]; }
function pad(n: number, size = 4) { return n.toString().padStart(size, "0"); }
function daysAgo(d: number) { return new Date(Date.now() - d * 864e5).toISOString(); }
function fmtDate(d: number) { return new Date(Date.now() + d * 864e5).toISOString(); }

export const PLANS: Plan[] = ORKESTRIA_PLANS.map((p) => ({
  id: p.id,
  name: p.name,
  audience: p.audience,
  priceMonthly: p.priceMonthlyCents,
  priceYearly: p.priceYearlyCents,
  orgs: p.orgs,
  workspaces: p.workspaces,
  adAccounts: p.quotas.adAccounts >= 999 ? "illimité" : p.quotas.adAccounts,
  users: p.quotas.users < 0 ? "illimité" : p.quotas.users,
  runsPerMonth: p.quotas.runsPerMonth < 0 ? "illimité" : p.quotas.runsPerMonth,
  historyDays: p.historyDays,
  automations: p.automations,
  autonomy: p.autonomy,
  support: p.support,
}));

const ORG_NAMES = [
  "Velvet Studio", "Baobab Retail", "Tera Foods", "MamaCosmetics", "Kaay Delivery",
  "SunSet Immo", "Loop Media", "Elikya Group", "Djolof Academy", "Nawa Fitness",
  "Casa Ceramics", "Yassa Fashion", "Teranga Cars", "OuestCode", "Diva Beauté",
  "Palm Realty", "Aya Cosmetics", "Bissap Bar", "TaxiAfrik", "GreenLeaf Farms",
  "Sokhna Boutique", "Signal Media", "Roots Records", "PixelForge", "Marcopolo Tours",
  "Baraka Meubles", "Setal Clean", "Nekh Digital", "Fajr Learning", "Zawadi Gifts",
];

function buildOrgs(): Organization[] {
  const plans: PlanId[] = ["solo", "business", "growth", "autopilot", "agency_start", "agency_growth", "agency_scale", "enterprise"];
  const statuses: OrgStatus[] = ["active", "active", "active", "essai", "suspendue", "impayée"];
  const risks: RiskLevel[] = ["faible", "faible", "moyen", "élevé"];
  const types: OrgType[] = ["entreprise", "entreprise", "agence", "groupe"];
  return ORG_NAMES.map((name, i) => {
    const type = pick(types, i);
    const plan = pick(plans, i);
    const status = pick(statuses, i);
    const risk = pick(risks, i);
    return {
      id: `org_${pad(i + 1)}`, name, type,
      country: pick(COUNTRIES, i), plan, status,
      members: 2 + ((i * 7) % 40),
      adAccounts: 1 + ((i * 3) % 12),
      adSpend: 800 + ((i * 1370) % 85_000),
      aiSpend: 0.5 + ((i * 0.17) % 6.4),
      createdAt: daysAgo(30 + i * 11),
      lastActive: daysAgo((i * 3) % 14),
      risk, sector: pick(SECTORS, i),
      currency: "USD",
      timezone: "Africa/Dakar", language: "fr",
      renewsAt: fmtDate(3 + ((i * 5) % 60)),
      accountManager: pick(MANAGERS, i),
      health: status === "suspendue" || status === "impayée" ? "critique" : (risk === "élevé" ? "attention" : "ok"),
      workspaces: 1 + ((i * 2) % 6),
      autopilot: plan === "autopilot" || plan === "agency_scale" || plan === "enterprise",
      writeBlocked: status === "impayée" || status === "suspendue",
    };
  });
}

let _orgs: Organization[] | null = null;
let _serverSynced = false;
let _serverKpis: {
  activeOrgs: number;
  activeUsers: number;
  payingSubs: number;
  mrr: number;
  arr: number;
  supervisedCampaigns: number;
  adSpendOrchestrated: number;
  agentActionsToday: number;
  actionFailureRate: number;
  connectionErrors: number;
  aiCostTotal: number;
  criticalIncidents: number;
  pendingApprovals: number;
  failedInvoices: number;
} | null = null;
export function getOrganizations(): Organization[] {
  if (_orgs) return _orgs;
  if (_serverSynced) return [];
  _orgs = buildOrgs();
  return _orgs;
}
export function getOrganization(id: string): Organization | undefined { return getOrganizations().find((o) => o.id === id); }
export function updateOrganization(id: string, patch: Partial<Organization>) {
  const list = getOrganizations();
  const i = list.findIndex((o) => o.id === id);
  if (i >= 0) list[i] = { ...list[i], ...patch };
}

const FIRST = ["Awa", "Moussa", "Fatou", "Ibrahima", "Léa", "Yaya", "Sokhna", "Kader", "Aminata", "Cheikh", "Mariama", "Boubacar", "Nadia", "Ismaël", "Rokhaya"];
const LAST = ["Diop", "Ndiaye", "Sy", "Ba", "Fall", "Sarr", "Cissé", "Kane", "Sow", "Diallo", "Traoré", "Gueye", "Mbaye", "Kanté"];

function buildUsers(): PlatformUser[] {
  const orgs = getOrganizations();
  const roles: PlatformUser["role"][] = ["owner", "admin", "media_buyer", "analyst", "viewer"];
  const devices = ["Chrome / macOS", "Safari / iOS", "Chrome / Android", "Firefox / Windows", "Edge / Windows"];
  const users: PlatformUser[] = [];
  let seed = 0;
  for (const org of orgs) {
    const count = Math.min(org.members, 8);
    for (let k = 0; k < count; k++) {
      const fn = pick(FIRST, seed);
      const ln = pick(LAST, seed + 3);
      users.push({
        id: `usr_${pad(seed + 1, 5)}`,
        name: `${fn} ${ln}`,
        email: `${fn.toLowerCase()}.${ln.toLowerCase()}@${org.name.toLowerCase().replace(/[^a-z]/g, "")}.io`,
        phone: `+221 77 ${pad((seed * 137) % 10000, 3)} ${pad((seed * 91) % 100, 2)} ${pad((seed * 53) % 100, 2)}`,
        orgId: org.id,
        role: k === 0 ? "owner" : pick(roles, seed),
        country: org.country,
        status: seed % 17 === 0 ? "suspendu" : seed % 11 === 0 ? "invité" : "actif",
        twoFA: seed % 3 !== 0,
        lastLogin: daysAgo(seed % 20),
        device: pick(devices, seed),
        consumption: 2 + ((seed * 7) % 80),
        incidents: seed % 23 === 0 ? 1 + (seed % 4) : 0,
      });
      seed++;
    }
  }
  return users;
}
let _users: PlatformUser[] | null = null;
export function getUsers(): PlatformUser[] {
  if (_users) return _users;
  if (_serverSynced) return [];
  _users = buildUsers();
  return _users;
}

function buildInvoices(): Invoice[] {
  const orgs = getOrganizations();
  const methods: Invoice["method"][] = ["carte", "mobile_money", "virement", "manuel"];
  const statuses: Invoice["status"][] = ["payée", "payée", "payée", "échec", "en_attente", "remboursée"];
  const out: Invoice[] = [];
  orgs.forEach((org, i) => {
    for (let k = 0; k < 3; k++) {
      const plan = PLANS.find((p) => p.id === org.plan)!;
      out.push({
        id: `INV-${pad(i * 10 + k, 5)}`,
        orgId: org.id, amount: plan.priceMonthly, currency: org.currency,
        status: pick(statuses, i * 3 + k),
        method: pick(methods, i + k),
        issuedAt: daysAgo(k * 30 + (i % 7)),
      });
    }
  });
  return out;
}
let _invoices: Invoice[] | null = null;
export function getInvoices(): Invoice[] {
  if (_invoices) return _invoices;
  if (_serverSynced) return [];
  _invoices = buildInvoices();
  return _invoices;
}

const CONNECTORS: { id: ConnectorId; label: string }[] = [
  { id: "meta", label: "Meta Ads" },
  { id: "google_ads", label: "Google Ads" },
  { id: "google_ads_write", label: "Google Ads (écriture)" },
  { id: "tiktok", label: "TikTok Ads" },
  { id: "ga4", label: "Google Analytics 4" },
  { id: "whatsapp", label: "WhatsApp" },
  { id: "crm", label: "CRM" },
  { id: "sheets", label: "Google Sheets" },
  { id: "shopify", label: "Shopify" },
];
export function getConnectorCatalog() { return CONNECTORS; }

function buildConnections(): Connection[] {
  const orgs = getOrganizations();
  const statuses: Connection["status"][] = ["active", "active", "active", "active", "expirée", "erreur", "permissions_manquantes", "déconnectée"];
  const out: Connection[] = [];
  orgs.forEach((org, i) => {
    CONNECTORS.forEach((c, k) => {
      if ((i + k) % 5 === 3) return;
      out.push({
        id: `cnx_${org.id}_${c.id}`,
        orgId: org.id, connector: c.id,
        status: pick(statuses, i * 3 + k),
        lastSync: daysAgo(((i + k) * 2) % 10),
        calls24h: 40 + ((i * 13 + k * 7) % 2400),
        errorRate: ((i * 3 + k) % 12) / 100,
        scopes: c.id === "meta" ? ["ads_read", "ads_management"] : c.id.startsWith("google") ? ["ads.readonly", "ads.management"] : ["read"],
      });
    });
  });
  return out;
}
let _connections: Connection[] | null = null;
export function getConnections(): Connection[] {
  if (_connections) return _connections;
  if (_serverSynced) return [];
  _connections = buildConnections();
  return _connections;
}
export function getConnection(id: string) { return getConnections().find((c) => c.id === id); }
export function updateConnection(id: string, patch: Partial<Connection>) {
  const list = getConnections();
  const i = list.findIndex((c) => c.id === id);
  if (i >= 0) list[i] = { ...list[i], ...patch };
}

// Connection detail extras — deterministic per id, never expose raw tokens.
export type ConnectionDetail = {
  externalAccount: string;
  connectedAt: string;
  expiresAt: string;
  lastErrors: { at: string; code: string; message: string }[];
  allowedActions: string[];
  readWrite: "lecture" | "lecture_écriture" | "aucune";
  writeDisabled: boolean;
  isolated: boolean;
  tokenMasked: string;
};
const CNX_EXTRA_KEY = "orkestria.admin.cnx.extra";
export function getConnectionDetail(c: Connection): ConnectionDetail {
  const overrides = isBrowser() ? JSON.parse(localStorage.getItem(CNX_EXTRA_KEY) || "{}") : {};
  const seed = c.id.length + c.orgId.length;
  const base: ConnectionDetail = {
    externalAccount: c.connector === "meta" ? `act_10203040${seed}` : c.connector.startsWith("google") ? `123-456-78${seed % 10}` : `acc_${seed}${c.connector}`,
    connectedAt: daysAgo(30 + seed),
    expiresAt: fmtDate(c.status === "expirée" ? -2 : 15 + (seed % 40)),
    lastErrors: c.errorRate > 0.03
      ? [
          { at: daysAgo(0.2), code: "RATE_LIMIT", message: "Quota API dépassé (429)." },
          { at: daysAgo(1.1), code: "OAUTH_INVALID", message: "Token refusé par le fournisseur." },
        ]
      : [],
    allowedActions: c.connector === "ga4" ? ["read"] : ["read", "create_campaign", "update_budget", "pause", "creatives"],
    readWrite: c.connector === "ga4" ? "lecture" : (c.status === "déconnectée" ? "aucune" : "lecture_écriture"),
    writeDisabled: false,
    isolated: false,
    tokenMasked: "•••• •••• •••• " + c.id.slice(-4).toUpperCase(),
  };
  return { ...base, ...(overrides[c.id] || {}) };
}
export function patchConnectionDetail(id: string, patch: Partial<ConnectionDetail>) {
  if (!isBrowser()) return;
  const o = JSON.parse(localStorage.getItem(CNX_EXTRA_KEY) || "{}");
  o[id] = { ...(o[id] || {}), ...patch };
  localStorage.setItem(CNX_EXTRA_KEY, JSON.stringify(o));
}

// ============= MCP capability registry & kill switches =============
export type MCPCapabilityRow = {
  platform: string;
  read: "oui" | "non" | "partiel";
  create: "oui" | "non" | "partiel";
  modify: "oui" | "non" | "partiel";
  pause: "oui" | "non" | "partiel";
  budget: "oui" | "non" | "partiel";
  creatives: "oui" | "non" | "partiel";
};
export const MCP_CAPABILITIES: MCPCapabilityRow[] = [
  { platform: "Meta", read: "oui", create: "oui", modify: "oui", pause: "oui", budget: "oui", creatives: "oui" },
  { platform: "Google", read: "oui", create: "oui", modify: "oui", pause: "oui", budget: "oui", creatives: "partiel" },
  { platform: "TikTok", read: "oui", create: "oui", modify: "oui", pause: "oui", budget: "oui", creatives: "oui" },
  { platform: "GA4", read: "oui", create: "non", modify: "non", pause: "non", budget: "non", creatives: "non" },
];

export type KillSwitch = {
  meta_all: boolean; google_mutations: boolean; tiktok_all: boolean;
  category?: string; mcp?: string; orgId?: string;
};
const KILL_KEY = "orkestria.admin.kill";
export function getKillSwitches(): KillSwitch {
  if (!isBrowser()) return { meta_all: false, google_mutations: false, tiktok_all: false };
  return JSON.parse(localStorage.getItem(KILL_KEY) || '{"meta_all":false,"google_mutations":false,"tiktok_all":false}');
}
export function setKillSwitches(k: KillSwitch) { if (isBrowser()) localStorage.setItem(KILL_KEY, JSON.stringify(k)); }

// ============= Agent Runs =============
export type RunState =
  | "planification" | "collecte" | "attente_utilisateur" | "attente_approbation"
  | "exécution" | "vérification" | "terminé" | "partiellement_terminé" | "échoué" | "annulé";
export type AgentRun = {
  id: string; orgId: string; user: string; goal: string; state: RunState;
  durationSec: number; model: string; toolsCalled: string[]; costUSD: number;
  actions: number; result: string; risk: RiskLevel; startedAt: string;
  plan: string[]; events: { at: string; kind: string; message: string }[];
  decisions: string[]; approvals: string[]; errors: string[]; verifications: string[];
};
const RUN_GOALS = [
  "100 commandes ce mois-ci", "Réduire CPA sous $35", "Lancer campagne Ramadan",
  "Audit performance juillet", "Réallocation budget Meta→Google", "Test créa vidéo 15 s",
  "Booster leads WhatsApp", "Pause campagnes non rentables",
];
const TOOL_NAMES = ["meta.read", "meta.create_campaign", "google.read", "google.update_budget", "tiktok.read", "tiktok.pause", "ga4.report", "policy.check"];
const MODELS = ["orkestria-planner-v2", "orkestria-executor-v3", "orkestria-critic-v1"];
const RUN_STATES: RunState[] = ["planification", "collecte", "attente_approbation", "exécution", "vérification", "terminé", "terminé", "partiellement_terminé", "échoué", "annulé"];
function buildRuns(): AgentRun[] {
  const orgs = getOrganizations();
  const out: AgentRun[] = [];
  for (let i = 0; i < 42; i++) {
    const org = orgs[i % orgs.length];
    const state = pick(RUN_STATES, i);
    const tools = TOOL_NAMES.slice(0, 2 + (i % 5));
    out.push({
      id: `run_${pad(i + 1, 5)}`, orgId: org.id, user: `${pick(FIRST, i)} ${pick(LAST, i)}`,
      goal: pick(RUN_GOALS, i), state,
      durationSec: 8 + ((i * 37) % 340), model: pick(MODELS, i),
      toolsCalled: tools, costUSD: 0.02 + ((i * 7) % 180) / 100,
      actions: 1 + (i % 12), result: state === "terminé" ? "Objectif atteint" : state === "échoué" ? "Erreur MCP" : "En cours",
      risk: pick(["faible", "faible", "moyen", "élevé"] as RiskLevel[], i),
      startedAt: daysAgo(((i * 0.4)) % 6),
      plan: ["Analyser historique 30 j", "Construire plan média", "Valider avec le client", "Exécuter mutations", "Vérifier résultats"],
      events: [
        { at: daysAgo(0.3), kind: "plan", message: "Plan proposé" },
        { at: daysAgo(0.28), kind: "tool", message: "meta.read → 42 campagnes" },
        { at: daysAgo(0.2), kind: "approval", message: "Client a approuvé la mutation" },
        { at: daysAgo(0.1), kind: "action", message: "google.update_budget +12%" },
      ],
      decisions: ["Réduire budget campagne #A32", "Augmenter budget Meta advantage+"],
      approvals: state === "attente_approbation" ? ["Client en attente"] : ["Client approuvé"],
      errors: state === "échoué" ? ["MCP Google Write timeout"] : [],
      verifications: ["Budget sous plafond", "Aucune audience interdite", "Créations conformes"],
    });
  }
  return out;
}
let _runs: AgentRun[] | null = null;
export function getRuns(): AgentRun[] {
  if (_runs) return _runs;
  if (_serverSynced) return [];
  _runs = buildRuns();
  return _runs;
}
export function getRun(id: string) { return getRuns().find((r) => r.id === id); }
export function updateRun(id: string, patch: Partial<AgentRun>) {
  const list = getRuns();
  const i = list.findIndex((r) => r.id === id);
  if (i >= 0) list[i] = { ...list[i], ...patch };
}

// ============= Ad actions (mutations) =============
export type AdActionCategory =
  | "création_campagne" | "modification_budget" | "pause" | "activation"
  | "création_annonce" | "changement_audience" | "ajout_mots_clés" | "réallocation_budget" | "remplacement_création";
export type AdActionStatus =
  | "proposée" | "approuvée" | "refusée" | "en_cours" | "exécutée" | "vérifiée" | "échouée" | "annulée" | "rollback";
export type AdAction = {
  id: string; orgId: string; platform: "Meta" | "Google" | "TikTok"; account: string;
  campaign: string; category: AdActionCategory; before: string; after: string;
  amount?: number; initiator: string; policy: string; approver?: string;
  verification: "ok" | "à_faire" | "échouée"; status: AdActionStatus; at: string;
};
function buildAdActions(): AdAction[] {
  const orgs = getOrganizations();
  const cats: AdActionCategory[] = ["création_campagne", "modification_budget", "pause", "activation", "création_annonce", "changement_audience", "ajout_mots_clés", "réallocation_budget", "remplacement_création"];
  const statuses: AdActionStatus[] = ["proposée", "approuvée", "en_cours", "exécutée", "vérifiée", "échouée", "annulée", "rollback"];
  const platforms: AdAction["platform"][] = ["Meta", "Google", "TikTok"];
  return Array.from({ length: 60 }, (_, i) => {
    const org = orgs[i % orgs.length];
    const cat = pick(cats, i);
    const status = pick(statuses, i);
    return {
      id: `act_${pad(i + 1, 5)}`, orgId: org.id, platform: pick(platforms, i),
      account: `acc_${1000 + i}`, campaign: `Campagne #${100 + i}`,
      category: cat,
      before: cat === "modification_budget" ? "$120/j" : cat === "pause" ? "active" : "n/a",
      after: cat === "modification_budget" ? "$170/j" : cat === "pause" ? "pause" : "créée",
      amount: cat.includes("budget") ? 30_000 + (i * 5000) % 400_000 : undefined,
      initiator: i % 3 === 0 ? "Agent Orkestria" : `${pick(FIRST, i)} ${pick(LAST, i)}`,
      policy: pick(["Assistant", "Autopilot prudent", "Autopilot avancé", "Conseiller"], i),
      approver: status === "proposée" ? undefined : `${pick(FIRST, i + 3)} ${pick(LAST, i + 3)}`,
      verification: status === "vérifiée" ? "ok" : status === "échouée" ? "échouée" : "à_faire",
      status, at: daysAgo(((i * 0.3)) % 8),
    };
  });
}
let _actions: AdAction[] | null = null;
export function getAdActions(): AdAction[] {
  if (_actions) return _actions;
  if (_serverSynced) return [];
  _actions = buildAdActions();
  return _actions;
}
export function updateAdAction(id: string, patch: Partial<AdAction>) {
  const list = getAdActions();
  const i = list.findIndex((a) => a.id === id);
  if (i >= 0) list[i] = { ...list[i], ...patch };
}

// ============= Approvals =============
export type ApprovalTrack = "utilisateur" | "agence" | "client" | "finance";
export type Approval = {
  id: string; orgId: string; actionId: string; label: string; amount: number;
  platform: "Meta" | "Google" | "TikTok"; campaign: string; reason: string;
  impactEstimated: string; confidence: number; risk: RiskLevel;
  requiredApprovers: string[]; track: ApprovalTrack; expiresAt: string;
  status: "en_attente" | "expirée" | "bloquée"; issues: string[];
};
function buildApprovals(): Approval[] {
  const orgs = getOrganizations();
  const tracks: ApprovalTrack[] = ["utilisateur", "agence", "client", "finance"];
  return Array.from({ length: 24 }, (_, i) => {
    const org = orgs[i % orgs.length];
    const days = (i * 1.3) % 8;
    const issues: string[] = [];
    if (days > 3) issues.push("Bloquée depuis plusieurs jours");
    if (i % 7 === 0) issues.push("Double approbation incomplète");
    if (i % 11 === 0) issues.push("Montant différent de l'initial");
    return {
      id: `apr_${pad(i + 1, 4)}`, orgId: org.id, actionId: `act_${pad(i + 1, 5)}`,
      label: pick(["Augmenter budget Meta", "Lancer campagne TikTok", "Réallocation Google→Meta", "Créer set d'annonces"], i),
      amount: 40_000 + (i * 17_000) % 900_000,
      platform: pick(["Meta", "Google", "TikTok"] as const, i),
      campaign: `Campagne #${100 + i}`,
      reason: "ROAS prévisionnel supérieur au benchmark",
      impactEstimated: `+${8 + (i % 20)} conversions estimées`,
      confidence: 0.55 + ((i * 3) % 40) / 100,
      risk: pick(["faible", "moyen", "élevé"] as RiskLevel[], i),
      requiredApprovers: i % 4 === 0 ? ["Client", "Finance"] : ["Client"],
      track: pick(tracks, i),
      expiresAt: fmtDate(days > 5 ? -1 : 2 + (i % 5)),
      status: days > 5 ? "expirée" : (issues.length > 1 ? "bloquée" : "en_attente"),
      issues,
    };
  });
}
let _approvals: Approval[] | null = null;
export function getApprovals(): Approval[] {
  if (_approvals) return _approvals;
  if (_serverSynced) return [];
  _approvals = buildApprovals();
  return _approvals;
}

// ============= Policies / autonomy =============
export type PolicyTemplate = {
  id: "conseiller" | "assistant" | "autopilot_prudent" | "autopilot_avance";
  name: string; description: string; features: string[]; caps: string;
};
export const POLICY_TEMPLATES: PolicyTemplate[] = [
  { id: "conseiller", name: "Conseiller", description: "Lecture uniquement, recommandations, aucune mutation.", features: ["Lecture seule", "Recommandations", "Aucune mutation"], caps: "Aucun budget engagé" },
  { id: "assistant", name: "Assistant", description: "Préparation + validation obligatoire, campagnes créées en pause.", features: ["Préparation d'actions", "Validation obligatoire", "Création en pause"], caps: "Toute mutation nécessite un humain" },
  { id: "autopilot_prudent", name: "Autopilot prudent", description: "Petites réductions auto, pauses de protection, aucune hausse importante.", features: ["Réductions ≤ 10%", "Pauses de protection", "Plafond strict"], caps: "Hausses > 5% interdites sans validation" },
  { id: "autopilot_avance", name: "Autopilot avancé", description: "Réallocation limitée, remplacement créations, optimisation continue.", features: ["Réallocation ≤ 25%", "Remplacement créations", "Optimisation continue"], caps: "Actions sensibles avec approbation" },
];
export type GlobalPolicy = {
  maxDailyBudgetUsd: number;
  forbiddenActions: string[];
  monthlySpendCapUsd: number;
  alwaysApprove: string[];
  countryRules: { country: string; rule: string }[];
  regulatedSectors: string[];
  rollbackRules: string[];
};
const POLICY_KEY = "orkestria.admin.policy";
const DEFAULT_POLICY: GlobalPolicy = {
  maxDailyBudgetUsd: 500,
  forbiddenActions: ["Audiences politiques", "Ciblage < 18 ans", "Substances réglementées"],
  monthlySpendCapUsd: 25_000,
  alwaysApprove: ["Modification budget > 20%", "Création nouvelle campagne", "Changement audience principale"],
  countryRules: [
    { country: "Sénégal", rule: "Bloquer catégorie paris sportifs sans licence" },
    { country: "France", rule: "RGPD strict, opt-in obligatoire" },
  ],
  regulatedSectors: ["Santé", "Finance", "Alcool", "Jeux d'argent"],
  rollbackRules: ["Rollback auto si CPA x2 en 24 h", "Rollback manuel obligatoire pour budgets > $300/j"],
};
export function getGlobalPolicy(): GlobalPolicy {
  if (!isBrowser()) return DEFAULT_POLICY;
  const raw = localStorage.getItem(POLICY_KEY);
  if (!raw) return DEFAULT_POLICY;
  const parsed = JSON.parse(raw) as Partial<GlobalPolicy> & {
    maxDailyBudgetXOF?: number;
    monthlySpendCapXOF?: number;
  };
  return {
    ...DEFAULT_POLICY,
    ...parsed,
    maxDailyBudgetUsd: parsed.maxDailyBudgetUsd ?? parsed.maxDailyBudgetXOF ?? DEFAULT_POLICY.maxDailyBudgetUsd,
    monthlySpendCapUsd: parsed.monthlySpendCapUsd ?? parsed.monthlySpendCapXOF ?? DEFAULT_POLICY.monthlySpendCapUsd,
  };
}
export function saveGlobalPolicy(p: GlobalPolicy) { if (isBrowser()) localStorage.setItem(POLICY_KEY, JSON.stringify(p)); }

export function getMCPStatuses(): MCPStatus[] {
  const base: Omit<MCPStatus, "version" | "errorRate" | "calls24h" | "quota" | "updatedAt" | "lastErrors" | "tools" | "tenantAffected">[] = [
    { id: "meta_mcp", label: "Meta Ads MCP officiel", status: "ok", latency: 142, uptime: 99.98 },
    { id: "google_ads_mcp", label: "Google Ads MCP officiel", status: "ok", latency: 168, uptime: 99.95 },
    { id: "google_ads_write_mcp", label: "Google Ads Write MCP", status: "dégradé", latency: 412, uptime: 98.7 },
    { id: "tiktok_mcp", label: "TikTok Ads MCP officiel", status: "ok", latency: 220, uptime: 99.72 },
    { id: "ga4_mcp", label: "Google Analytics MCP", status: "ok", latency: 118, uptime: 99.99 },
    { id: "database", label: "Base de données", status: "ok", latency: 12, uptime: 99.999 },
    { id: "workers", label: "Workers agentiques", status: "ok", latency: 38, uptime: 99.94 },
    { id: "storage", label: "Outils créatifs", status: "ok", latency: 22, uptime: 99.98 },
    { id: "queues", label: "Files de tâches", status: "dégradé", latency: 780, uptime: 99.1 },
    { id: "notifications", label: "Services internes", status: "ok", latency: 65, uptime: 99.96 },
  ];
  const toolsMap: Record<string, string[]> = {
    meta_mcp: ["read_campaigns", "create_campaign", "update_budget", "pause", "creatives"],
    google_ads_mcp: ["read_campaigns", "read_keywords", "reports"],
    google_ads_write_mcp: ["create_campaign", "update_budget", "pause", "keywords_add"],
    tiktok_mcp: ["read_campaigns", "create_campaign", "pause", "creatives"],
    ga4_mcp: ["run_report", "list_properties"],
    database: ["query", "write"],
    workers: ["schedule", "invoke"],
    storage: ["render_image", "render_video"],
    queues: ["enqueue", "dequeue"],
    notifications: ["push", "email", "whatsapp"],
  };
  return base.map((b, i) => ({
    ...b,
    version: `${1 + (i % 3)}.${i}.${(i * 3) % 9}`,
    errorRate: b.status === "dégradé" ? 0.08 : 0.005 + (i % 4) / 500,
    calls24h: 4200 + (i * 837) % 42000,
    quota: `${20 + (i * 7) % 70}% utilisé`,
    updatedAt: daysAgo((i % 4) * 0.5),
    lastErrors: b.status === "dégradé" ? ["429 rate limit", "500 upstream"] : [],
    tenantAffected: b.status === "dégradé" ? "3 organisations" : undefined,
    tools: toolsMap[b.id] || [],
  }));
}

let _incidents: Incident[] | null = null;
export function getIncidents(): Incident[] {
  if (_incidents) return _incidents;
  if (_serverSynced) return [];
  _incidents = [
    { id: "inc_01", kind: "cap_dépassé", severity: "critique", message: "Velvet Studio — campagne « Ventes Éclair » a franchi le plafond quotidien de $380.", orgId: "org_0001", at: daysAgo(0.1) },
    { id: "inc_02", kind: "action_non_confirmée", severity: "warn", message: "Baobab Retail — 3 actions financières exécutées sans double confirmation.", orgId: "org_0002", at: daysAgo(0.3) },
    { id: "inc_03", kind: "mcp_erreurs", severity: "critique", message: "Google Ads Write MCP — taux d'erreur > 8 % sur les 15 dernières minutes.", at: daysAgo(0.05) },
    { id: "inc_04", kind: "org_suspecte", severity: "warn", message: "Sokhna Boutique — 12 comptes publicitaires ajoutés en 4 h.", orgId: "org_0021", at: daysAgo(0.8) },
    { id: "inc_05", kind: "coût_ia_anormal", severity: "warn", message: "Loop Media — coût IA x3 vs moyenne 7 j (128 USD aujourd'hui).", orgId: "org_0007", at: daysAgo(0.5) },
    { id: "inc_06", kind: "oauth_perdu", severity: "info", message: "Aya Cosmetics — token Meta expiré, reconnexion demandée au client.", orgId: "org_0017", at: daysAgo(1.2) },
  ];
  return _incidents;
}

export function getGlobalKPIs() {
  if (_serverKpis) return _serverKpis;
  if (_serverSynced) {
    return {
      activeOrgs: 0, activeUsers: 0, payingSubs: 0, mrr: 0, arr: 0,
      supervisedCampaigns: 0, adSpendOrchestrated: 0, agentActionsToday: 0,
      actionFailureRate: 0, connectionErrors: 0, aiCostTotal: 0,
      criticalIncidents: 0, pendingApprovals: 0, failedInvoices: 0,
    };
  }
  const orgs = getOrganizations();
  const users = getUsers();
  const invoices = getInvoices();
  const conns = getConnections();
  const paying = orgs.filter((o) => o.status === "active").length;
  const mrr = orgs.filter((o) => o.status === "active")
    .reduce((s, o) => s + (PLANS.find((p) => p.id === o.plan)?.priceMonthly ?? 0), 0);
  const failed = invoices.filter((i) => i.status === "échec").length;
  const errorConns = conns.filter((c) => c.status !== "active").length;
  const adSpend = orgs.reduce((s, o) => s + o.adSpend, 0);
  const aiSpend = orgs.reduce((s, o) => s + o.aiSpend, 0);
  return {
    activeOrgs: orgs.length,
    activeUsers: users.filter((u) => u.status === "actif").length,
    payingSubs: paying,
    mrr, arr: mrr * 12,
    supervisedCampaigns: 1284,
    adSpendOrchestrated: adSpend,
    agentActionsToday: 6482,
    actionFailureRate: 0.021,
    connectionErrors: errorConns,
    aiCostTotal: aiSpend,
    criticalIncidents: getIncidents().filter((i) => i.severity === "critique").length,
    pendingApprovals: 17,
    failedInvoices: failed,
  };
}

const AUDIT_KEY = "orkestria.admin.audit";
export type AdminAuditEntry = { id: string; at: string; actor: string; action: string; target: string; reason?: string; ticket?: string };
function isBrowser() { return typeof window !== "undefined"; }
export function getAudit(): AdminAuditEntry[] {
  if (!isBrowser()) return [];
  try { return JSON.parse(localStorage.getItem(AUDIT_KEY) || "[]"); } catch { return []; }
}
export function logAudit(entry: Omit<AdminAuditEntry, "id" | "at">) {
  if (!isBrowser()) return;
  const list = getAudit();
  list.unshift({ ...entry, id: `aud_${Date.now()}`, at: new Date().toISOString() });
  localStorage.setItem(AUDIT_KEY, JSON.stringify(list.slice(0, 200)));
}

const SUPER_ADMINS = ["admin@orkestria.io", "super@orkestria.io"];
const OVERRIDE_KEY = "orkestria.admin.override";
const ROLE_KEY = "orkestria.admin.role";
export type AdminRole = "super_admin" | "admin" | "support";
export const ADMIN_ROLES: { value: AdminRole; label: string; hint: string }[] = [
  { value: "super_admin", label: "Super Admin", hint: "Accès total, kill switch, policies" },
  { value: "admin", label: "Admin", hint: "Ops, clients, finance (lecture/écriture limitée)" },
  { value: "support", label: "Support", hint: "Tickets, incidents, lecture seule" },
];
export function getAdminRole(): AdminRole {
  if (!isBrowser()) return "super_admin";
  const v = localStorage.getItem(ROLE_KEY) as AdminRole | null;
  return v && ADMIN_ROLES.some((r) => r.value === v) ? v : "super_admin";
}
export function setAdminRole(role: AdminRole) {
  if (!isBrowser()) return;
  localStorage.setItem(ROLE_KEY, role);
  localStorage.setItem(OVERRIDE_KEY, "1");
  window.dispatchEvent(new CustomEvent("orkestria:role-change", { detail: role }));
}
export function isSuperAdmin(email?: string | null): boolean {
  if (!email) return false;
  if (SUPER_ADMINS.includes(email.toLowerCase())) return true;
  if (isBrowser() && localStorage.getItem(OVERRIDE_KEY) === "1") return true;
  return false;
}
export function grantDemoSuperAdmin() { if (isBrowser()) localStorage.setItem(OVERRIDE_KEY, "1"); }
export function revokeDemoSuperAdmin() { if (isBrowser()) localStorage.removeItem(OVERRIDE_KEY); }

export function fmtNum(v: number) { return v.toLocaleString("en-US"); }
export function fmtPct(v: number, digits = 1) { return `${(v * 100).toFixed(digits)} %`; }
export function fmtDateShort(iso: string) {
  return new Date(iso).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" });
}
export function fmtRelative(iso: string) {
  if (!iso) return "—";
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "—";
  const diff = (Date.now() - t) / 1000;
  if (diff < 60) return "à l'instant";
  if (diff < 3600) return `il y a ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `il y a ${Math.floor(diff / 3600)} h`;
  return `il y a ${Math.floor(diff / 86400)} j`;
}
export function planLabel(id: PlanId): string { return PLANS.find((p) => p.id === id)?.name ?? id; }
export function connectorLabel(id: ConnectorId): string { return CONNECTORS.find((c) => c.id === id)?.label ?? id; }

// ============= Plans, quotas & consommation =============
export type UsageMetricId =
  | "connected_accounts" | "agent_runs" | "mcp_calls" | "model_calls" | "tokens"
  | "storage_gb" | "media" | "poster_renders" | "video_renders" | "reports"
  | "whatsapp_notifs" | "active_users";
export type UsageMetric = {
  id: UsageMetricId; label: string; unit: string; used: number; quota: number;
};
export type OrgUsage = {
  orgId: string; metrics: UsageMetric[];
  monthlyCostUsd: number; planCostUsdCents: number; anomalies: string[];
};
const METRIC_DEFS: { id: UsageMetricId; label: string; unit: string }[] = [
  { id: "connected_accounts", label: "Comptes connectés", unit: "comptes" },
  { id: "agent_runs", label: "Runs agentiques", unit: "runs" },
  { id: "mcp_calls", label: "Appels MCP", unit: "appels" },
  { id: "model_calls", label: "Appels modèles", unit: "appels" },
  { id: "tokens", label: "Tokens consommés", unit: "tokens" },
  { id: "storage_gb", label: "Stockage", unit: "Go" },
  { id: "media", label: "Médias", unit: "fichiers" },
  { id: "poster_renders", label: "Rendus d'affiches", unit: "visuels" },
  { id: "video_renders", label: "Vidéos montées", unit: "vidéos" },
  { id: "reports", label: "Rapports", unit: "rapports" },
  { id: "whatsapp_notifs", label: "Notifications WhatsApp", unit: "messages" },
  { id: "active_users", label: "Utilisateurs actifs", unit: "utilisateurs" },
];
export function getMetricDefs() { return METRIC_DEFS; }

function buildUsage(): OrgUsage[] {
  const orgs = getOrganizations();
  return orgs.map((org, i) => {
    const plan = PLANS.find((p) => p.id === org.plan)!;
    const metrics: UsageMetric[] = METRIC_DEFS.map((m, k) => {
      const base = [12, 400, 5000, 3200, 1_200_000, 8, 240, 60, 12, 30, 400, 20][k];
      const quotaFactor = plan.audience === "enterprise" ? 20 : plan.audience === "agence" ? 6 : 1.5;
      const quota = Math.round(base * quotaFactor);
      const usedPct = ((i * 13 + k * 7) % 130) / 100; // 0..1.3 (peut dépasser)
      const used = Math.round(quota * usedPct);
      return { id: m.id, label: m.label, unit: m.unit, used, quota };
    });
    const anomalies: string[] = [];
    metrics.forEach((m) => {
      if (m.used > m.quota) anomalies.push(`Quota dépassé : ${m.label}`);
      else if (m.used > m.quota * 0.85) anomalies.push(`Proche de la limite : ${m.label}`);
    });
    if (i % 9 === 0) anomalies.push("Boucle agentique excessive détectée");
    if (i % 11 === 0) anomalies.push("Automatisation trop fréquente");
    const monthlyCostUsd = 1.2 + ((i * 0.4137) % 26);
    return { orgId: org.id, metrics, monthlyCostUsd, planCostUsdCents: plan.priceMonthly, anomalies };
  });
}
let _usage: OrgUsage[] | null = null;
export function getUsage(): OrgUsage[] { if (!_usage) _usage = buildUsage(); return _usage; }
export function getOrgUsage(id: string) { return getUsage().find((u) => u.orgId === id); }

const QUOTA_OVERRIDE_KEY = "orkestria.admin.quota.overrides";
export type QuotaOverride = { tempExtraPct?: number; workspaceLimited?: boolean; disabledFeatures?: string[]; modelRoute?: string; upsellSuggested?: boolean };
export function getQuotaOverrides(): Record<string, QuotaOverride> {
  if (!isBrowser()) return {};
  try { return JSON.parse(localStorage.getItem(QUOTA_OVERRIDE_KEY) || "{}"); } catch { return {}; }
}
export function patchQuotaOverride(orgId: string, patch: QuotaOverride) {
  if (!isBrowser()) return;
  const o = getQuotaOverrides();
  o[orgId] = { ...(o[orgId] || {}), ...patch };
  localStorage.setItem(QUOTA_OVERRIDE_KEY, JSON.stringify(o));
}

// ============= Coûts IA & fournisseurs =============
export type ProviderId =
  | "llm" | "vision" | "transcription" | "voice" | "storage_prov"
  | "email" | "whatsapp_prov" | "video_render" | "cdn";
export type ProviderCost = {
  id: ProviderId; label: string; costUSD: number; calls: number; errorRate: number; topModel: string;
};
export function getProviderCosts(): ProviderCost[] {
  return [
    { id: "llm", label: "Modèles de langage", costUSD: 1284.5, calls: 128_450, errorRate: 0.006, topModel: "gemini-2.5-flash" },
    { id: "vision", label: "Modèles vision", costUSD: 312.4, calls: 24_120, errorRate: 0.012, topModel: "gemini-2.5-pro-vision" },
    { id: "transcription", label: "Transcription", costUSD: 84.2, calls: 3_240, errorRate: 0.004, topModel: "whisper-large" },
    { id: "voice", label: "Voix", costUSD: 46.8, calls: 1_820, errorRate: 0.002, topModel: "tts-standard" },
    { id: "storage_prov", label: "Stockage", costUSD: 122.9, calls: 0, errorRate: 0, topModel: "object-storage" },
    { id: "email", label: "E-mails", costUSD: 38.4, calls: 12_540, errorRate: 0.001, topModel: "postmark" },
    { id: "whatsapp_prov", label: "WhatsApp", costUSD: 208.7, calls: 8_940, errorRate: 0.008, topModel: "cloud-api" },
    { id: "video_render", label: "Rendu vidéo", costUSD: 428.1, calls: 640, errorRate: 0.028, topModel: "render-farm-hd" },
    { id: "cdn", label: "CDN", costUSD: 74.3, calls: 0, errorRate: 0, topModel: "edge-cache" },
  ];
}
export type ModelRouteId =
  | "extraction_simple" | "analyse_complexe" | "rapport_hebdo" | "decision_financiere" | "analyse_image";
export type ModelRoute = { id: ModelRouteId; label: string; model: string; note: string };
const ROUTE_KEY = "orkestria.admin.model.routes";
const DEFAULT_ROUTES: ModelRoute[] = [
  { id: "extraction_simple", label: "Extraction simple", model: "économique", note: "Nettoyage, parsing, résumés courts." },
  { id: "analyse_complexe", label: "Analyse complexe", model: "avancé", note: "Raisonnement multi-étapes, plan média." },
  { id: "rapport_hebdo", label: "Rapport hebdomadaire", model: "économique", note: "Génération de rapports récurrents." },
  { id: "decision_financiere", label: "Décision financière sensible", model: "avancé + règles", note: "Approbation obligatoire au-delà d'un seuil." },
  { id: "analyse_image", label: "Analyse d'image", model: "multimodal", note: "Créations, conformité visuelle." },
];
export function getModelRoutes(): ModelRoute[] {
  if (!isBrowser()) return DEFAULT_ROUTES;
  const raw = localStorage.getItem(ROUTE_KEY);
  return raw ? JSON.parse(raw) : DEFAULT_ROUTES;
}
export function saveModelRoutes(r: ModelRoute[]) { if (isBrowser()) localStorage.setItem(ROUTE_KEY, JSON.stringify(r)); }

export type AiLimits = {
  dailyGlobalUSD: number; perOrgUSD: number; maxRunUSD: number; maxAgentIterations: number;
};
const AI_LIMITS_KEY = "orkestria.admin.ai.limits";
const DEFAULT_AI_LIMITS: AiLimits = { dailyGlobalUSD: 500, perOrgUSD: 25, maxRunUSD: 2, maxAgentIterations: 12 };
export function getAiLimits(): AiLimits {
  if (!isBrowser()) return DEFAULT_AI_LIMITS;
  const raw = localStorage.getItem(AI_LIMITS_KEY);
  return raw ? { ...DEFAULT_AI_LIMITS, ...JSON.parse(raw) } : DEFAULT_AI_LIMITS;
}
export function saveAiLimits(l: AiLimits) { if (isBrowser()) localStorage.setItem(AI_LIMITS_KEY, JSON.stringify(l)); }

// ============= Templates créatifs =============
export type TemplateCategory =
  | "restauration" | "immobilier" | "éducation" | "beauté" | "e-commerce"
  | "automobile" | "événementiel" | "santé" | "services_pro";
export type TemplateStatus = "brouillon" | "en_revue" | "publié" | "archivé";
export type TemplateVariable = "logo" | "produit" | "prix" | "titre" | "cta" | "téléphone" | "adresse" | "couleurs" | "promotion" | "date";
export type CreativeTemplate = {
  id: string; name: string; category: TemplateCategory; formats: string[]; language: string;
  variables: TemplateVariable[]; requiredElements: string[]; status: TemplateStatus;
  uses: number; approvalRate: number; ctrAvg: number; roasAvg: number;
  plans: PlanId[] | "tous"; region: string; brandReview: boolean; updatedAt: string;
};
const TEMPLATE_KEY = "orkestria.admin.templates";
const CAT_LABEL: Record<TemplateCategory, string> = {
  restauration: "Restauration", immobilier: "Immobilier", "éducation": "Éducation",
  "beauté": "Beauté", "e-commerce": "E-commerce", automobile: "Automobile",
  "événementiel": "Événementiel", "santé": "Santé", services_pro: "Services pro.",
};
export function templateCategoryLabel(c: TemplateCategory) { return CAT_LABEL[c]; }
function buildTemplates(): CreativeTemplate[] {
  const cats: TemplateCategory[] = ["restauration", "immobilier", "éducation", "beauté", "e-commerce", "automobile", "événementiel", "santé", "services_pro"];
  const statuses: TemplateStatus[] = ["publié", "publié", "publié", "en_revue", "brouillon", "archivé"];
  const regions = ["Afrique de l'Ouest", "Afrique centrale", "Maghreb", "Europe", "Global"];
  const names = [
    "Menu du jour", "Promo weekend", "Nouvelle collection", "Visite guidée", "Portes ouvertes",
    "Lancement produit", "Soldes flash", "Témoignage client", "Compte à rebours", "Livraison offerte",
    "Rentrée scolaire", "Rendez-vous santé", "Test drive", "Événement live", "Avant/Après",
    "Nouveau service", "Réservation", "Offre découverte",
  ];
  return names.map((n, i) => ({
    id: `tpl_${pad(i + 1, 4)}`, name: n,
    category: pick(cats, i),
    formats: i % 3 === 0 ? ["1:1", "9:16", "16:9"] : i % 3 === 1 ? ["1:1", "4:5"] : ["9:16", "16:9"],
    language: i % 5 === 0 ? "en" : "fr",
    variables: (["logo", "titre", "cta", "produit", "prix", "promotion", "date", "téléphone"] as TemplateVariable[]).slice(0, 3 + (i % 5)),
    requiredElements: ["Logo", "Titre principal", "CTA"],
    status: pick(statuses, i),
    uses: 12 + (i * 37) % 2400,
    approvalRate: 0.72 + ((i * 3) % 26) / 100,
    ctrAvg: 0.9 + ((i * 7) % 45) / 10,
    roasAvg: 1.4 + ((i * 5) % 45) / 10,
    plans: i % 4 === 0 ? ["growth", "autopilot", "agency_growth", "agency_scale", "enterprise"] : "tous",
    region: pick(regions, i),
    brandReview: i % 6 === 0,
    updatedAt: daysAgo((i * 1.7) % 30),
  }));
}
function loadTemplateOverrides(): Record<string, Partial<CreativeTemplate>> {
  if (!isBrowser()) return {};
  try { return JSON.parse(localStorage.getItem(TEMPLATE_KEY) || "{}"); } catch { return {}; }
}
let _templates: CreativeTemplate[] | null = null;
export function getTemplates(): CreativeTemplate[] {
  if (!_templates) _templates = buildTemplates();
  const ov = loadTemplateOverrides();
  return _templates.map((t) => ({ ...t, ...(ov[t.id] || {}) }));
}
export function patchTemplate(id: string, patch: Partial<CreativeTemplate>) {
  if (!isBrowser()) return;
  const ov = loadTemplateOverrides();
  ov[id] = { ...(ov[id] || {}), ...patch };
  localStorage.setItem(TEMPLATE_KEY, JSON.stringify(ov));
}
export function templateStatusLabel(s: TemplateStatus) {
  return { brouillon: "Brouillon", en_revue: "En revue", "publié": "Publié", "archivé": "Archivé" }[s];
}

// ============= Prompts & Skills =============
export type SkillId = "audit_compte" | "creation_campagne" | "analyse_budget" | "fatigue_creative" | "rapport_hebdo" | "analyse_leads" | "ads_guardian";
export type SkillVersion = { version: string; model: string; deployedPct: number; successRate: number; avgLatencyMs: number; createdAt: string; note: string; active: boolean };
export type Skill = {
  id: SkillId; name: string; description: string; enabled: boolean;
  systemPrompt: string; outputSchema: string; toolRules: string; examples: string[];
  allowedTools: string[]; safetyPolicy: string;
  versions: SkillVersion[]; tests: { name: string; status: "ok" | "ko" }[];
};
const SKILL_KEY = "orkestria.admin.skills";
const DEFAULT_SKILLS: Skill[] = [
  { id: "audit_compte", name: "Audit de compte", description: "Analyse historique 30-90 j et détecte les leviers.", enabled: true,
    systemPrompt: "Tu es l'auditeur Orkestria. Analyse les comptes publicitaires et propose 5 actions priorisées.",
    outputSchema: "{ actions: [{title, impact, effort}], score: number }",
    toolRules: "Lecture seule. Aucune mutation autorisée.",
    examples: ["Comparer 30 j vs 30 j précédents", "Détecter audiences saturées"],
    allowedTools: ["meta.read", "google.read", "ga4.report"],
    safetyPolicy: "Aucune écriture. Anonymiser identifiants clients.",
    versions: [
      { version: "v3.2", model: "économique", deployedPct: 100, successRate: 0.94, avgLatencyMs: 3200, createdAt: daysAgo(4), note: "Prompt affiné", active: true },
      { version: "v3.1", model: "économique", deployedPct: 0, successRate: 0.91, avgLatencyMs: 3400, createdAt: daysAgo(20), note: "", active: false },
    ],
    tests: [{ name: "audit standard USD", status: "ok" }, { name: "audit multi-comptes", status: "ok" }],
  },
  { id: "creation_campagne", name: "Création de campagne", description: "Prépare une campagne complète avec ciblage et créations.", enabled: true,
    systemPrompt: "Assistant média Orkestria. Prépare une campagne conforme aux policies actives.", outputSchema: "{ campaign, adsets:[], creatives:[] }",
    toolRules: "Écriture uniquement après approbation client.", examples: ["100 ventes ce mois-ci"],
    allowedTools: ["meta.create_campaign", "google.create_campaign", "tiktok.create_campaign"],
    safetyPolicy: "Créations en pause par défaut. Plafond quotidien obligatoire.",
    versions: [{ version: "v2.4", model: "avancé", deployedPct: 100, successRate: 0.88, avgLatencyMs: 8400, createdAt: daysAgo(6), note: "", active: true }],
    tests: [{ name: "création Meta advantage+", status: "ok" }, { name: "création TikTok", status: "ko" }] },
  { id: "analyse_budget", name: "Analyse du budget", description: "Recommande réallocation entre plateformes.", enabled: true,
    systemPrompt: "Analyste financier média. Optimise l'allocation multi-plateforme.", outputSchema: "{ reallocations:[] }",
    toolRules: "Propose, jamais exécute.", examples: [], allowedTools: ["meta.read", "google.read", "tiktok.read"],
    safetyPolicy: "Toute réallocation > 15 % nécessite validation.", versions: [{ version: "v1.7", model: "avancé", deployedPct: 100, successRate: 0.9, avgLatencyMs: 4200, createdAt: daysAgo(10), note: "", active: true }],
    tests: [{ name: "réallocation Meta→Google", status: "ok" }] },
  { id: "fatigue_creative", name: "Fatigue créative", description: "Détecte la baisse de performance des créations.", enabled: true,
    systemPrompt: "Détecte la fatigue créative et propose du renouvellement.", outputSchema: "{ tired:[], suggestions:[] }",
    toolRules: "Lecture, remplacements sur validation.", examples: [], allowedTools: ["meta.read", "tiktok.read", "storage.render_image"],
    safetyPolicy: "Remplacement soumis au brand review.", versions: [{ version: "v1.2", model: "multimodal", deployedPct: 100, successRate: 0.86, avgLatencyMs: 5200, createdAt: daysAgo(12), note: "", active: true }],
    tests: [{ name: "détection fatigue Meta", status: "ok" }] },
  { id: "rapport_hebdo", name: "Rapport hebdomadaire", description: "Génère un rapport client hebdomadaire.", enabled: true,
    systemPrompt: "Rédige un rapport pédagogique et bienveillant.", outputSchema: "{ summary, kpis, next_steps }",
    toolRules: "Lecture seule.", examples: [], allowedTools: ["meta.read", "google.read", "ga4.report"],
    safetyPolicy: "Ton conforme à la marque client.", versions: [{ version: "v4.0", model: "économique", deployedPct: 100, successRate: 0.97, avgLatencyMs: 2800, createdAt: daysAgo(3), note: "", active: true }],
    tests: [{ name: "rapport standard", status: "ok" }] },
  { id: "analyse_leads", name: "Analyse des leads", description: "Qualifie et priorise les leads entrants.", enabled: true,
    systemPrompt: "Qualifie les leads WhatsApp et formulaire.", outputSchema: "{ leads:[{score, next}] }",
    toolRules: "Lecture CRM + WhatsApp.", examples: [], allowedTools: ["crm.read", "whatsapp.read"],
    safetyPolicy: "Respect RGPD, aucune donnée sensible logguée.", versions: [{ version: "v1.4", model: "économique", deployedPct: 50, successRate: 0.83, avgLatencyMs: 2400, createdAt: daysAgo(2), note: "canary 50 %", active: true }],
    tests: [{ name: "scoring leads FR", status: "ok" }] },
  { id: "ads_guardian", name: "Ads Guardian", description: "Surveille dépenses et performances, alerte et coupe si besoin.", enabled: true,
    systemPrompt: "Guardian de sécurité budgétaire. Priorité absolue à la protection du budget.", outputSchema: "{ alerts:[], actions:[] }",
    toolRules: "Peut mettre en pause selon policy autopilot_prudent.", examples: [], allowedTools: ["meta.pause", "google.pause", "tiktok.pause"],
    safetyPolicy: "Ne coupe jamais > 30 % du budget sans approbation.", versions: [{ version: "v2.9", model: "avancé + règles", deployedPct: 100, successRate: 0.99, avgLatencyMs: 1200, createdAt: daysAgo(1), note: "", active: true }],
    tests: [{ name: "pause CPA x2", status: "ok" }, { name: "cap dépassé", status: "ok" }] },
];
export function getSkills(): Skill[] {
  if (!isBrowser()) return DEFAULT_SKILLS;
  const raw = localStorage.getItem(SKILL_KEY);
  return raw ? JSON.parse(raw) : DEFAULT_SKILLS;
}
export function saveSkills(s: Skill[]) { if (isBrowser()) localStorage.setItem(SKILL_KEY, JSON.stringify(s)); }

export type OrchestratorPrompt = { version: string; content: string; model: string; deployedPct: number; createdAt: string; active: boolean };
const ORCH_KEY = "orkestria.admin.orchestrator";
const DEFAULT_ORCH: OrchestratorPrompt[] = [
  { version: "v5.1", content: "Tu es l'orchestrateur Orkestria. Décompose l'objectif en plan, appelle les skills, respecte les policies.", model: "avancé", deployedPct: 100, createdAt: daysAgo(2), active: true },
  { version: "v5.0", content: "Version précédente de l'orchestrateur.", model: "avancé", deployedPct: 0, createdAt: daysAgo(30), active: false },
];
export function getOrchestratorPrompts(): OrchestratorPrompt[] {
  if (!isBrowser()) return DEFAULT_ORCH;
  const raw = localStorage.getItem(ORCH_KEY);
  return raw ? JSON.parse(raw) : DEFAULT_ORCH;
}
export function saveOrchestratorPrompts(p: OrchestratorPrompt[]) { if (isBrowser()) localStorage.setItem(ORCH_KEY, JSON.stringify(p)); }

// ============= Feature Flags =============
export type FlagTarget = { type: "all" | "country" | "plan" | "org" | "user" | "percent" | "env"; value?: string; percent?: number };
export type FeatureFlag = {
  id: string; name: string; description: string; enabled: boolean; rollout: number; // 0..100
  targets: FlagTarget[]; env: "prod" | "staging" | "test"; updatedAt: string;
};
const FLAG_KEY = "orkestria.admin.flags";
const DEFAULT_FLAGS: FeatureFlag[] = [
  { id: "tiktok_write", name: "TikTok write actions", description: "Autoriser les écritures TikTok Ads.", enabled: true, rollout: 20, targets: [{ type: "percent", percent: 20 }], env: "prod", updatedAt: daysAgo(2) },
  { id: "google_autopilot", name: "Autopilot Google", description: "Optimisation autonome Google Ads.", enabled: false, rollout: 0, targets: [{ type: "env", value: "staging" }], env: "staging", updatedAt: daysAgo(5) },
  { id: "video_generation", name: "Génération vidéo", description: "Rendu vidéo automatique.", enabled: true, rollout: 50, targets: [{ type: "plan", value: "growth" }, { type: "plan", value: "autopilot" }], env: "prod", updatedAt: daysAgo(3) },
  { id: "agency_portal", name: "Portail agence", description: "Portail multi-clients pour agences.", enabled: true, rollout: 100, targets: [{ type: "all" }], env: "prod", updatedAt: daysAgo(8) },
  { id: "mobile_money", name: "Mobile Money", description: "Paiement par Mobile Money.", enabled: true, rollout: 100, targets: [{ type: "country", value: "Sénégal" }, { type: "country", value: "Côte d'Ivoire" }], env: "prod", updatedAt: daysAgo(10) },
  { id: "budget_rules_v2", name: "Nouvelles règles budgétaires", description: "Règles anti-fuite v2.", enabled: false, rollout: 10, targets: [{ type: "percent", percent: 10 }], env: "prod", updatedAt: daysAgo(1) },
  { id: "new_ai_model", name: "Nouveau modèle IA", description: "Test A/B nouveau modèle avancé.", enabled: true, rollout: 15, targets: [{ type: "percent", percent: 15 }], env: "prod", updatedAt: daysAgo(1) },
  { id: "mcp_v3", name: "Nouvelle version du MCP", description: "MCP officiel v3.", enabled: false, rollout: 0, targets: [{ type: "env", value: "test" }], env: "test", updatedAt: daysAgo(4) },
];
export function getFlags(): FeatureFlag[] {
  if (!isBrowser()) return DEFAULT_FLAGS;
  const raw = localStorage.getItem(FLAG_KEY);
  return raw ? JSON.parse(raw) : DEFAULT_FLAGS;
}
export function saveFlags(f: FeatureFlag[]) { if (isBrowser()) localStorage.setItem(FLAG_KEY, JSON.stringify(f)); }

// ============= Support tickets =============
export type TicketType = "connexion" | "campagne_non_creee" | "budget" | "paiement" | "rapport" | "media_rejete" | "compte_suspendu" | "tracking" | "utilisation";
export type TicketPriority = "basse" | "normale" | "haute" | "critique";
export type TicketStatus = "ouvert" | "en_cours" | "en_attente_client" | "résolu" | "fermé";
export type SupportTicket = {
  id: string; orgId: string; userId: string; type: TicketType; subject: string;
  priority: TicketPriority; status: TicketStatus; assignedTo: string;
  slaHours: number; createdAt: string; updatedAt: string;
  history: { at: string; author: string; message: string }[];
  relatedRunId?: string; relatedActionId?: string; relatedConnectionId?: string;
};
const TYPE_LABEL: Record<TicketType, string> = {
  connexion: "Connexion impossible", campagne_non_creee: "Campagne non créée", budget: "Budget incorrect",
  paiement: "Paiement", rapport: "Problème de rapport", media_rejete: "Média rejeté",
  compte_suspendu: "Compte suspendu", tracking: "Erreur de tracking", utilisation: "Question d'utilisation",
};
export function ticketTypeLabel(t: TicketType) { return TYPE_LABEL[t]; }
function buildTickets(): SupportTicket[] {
  const orgs = getOrganizations();
  const users = getUsers();
  const types: TicketType[] = ["connexion", "campagne_non_creee", "budget", "paiement", "rapport", "media_rejete", "compte_suspendu", "tracking", "utilisation"];
  const prios: TicketPriority[] = ["basse", "normale", "haute", "critique"];
  const statuses: TicketStatus[] = ["ouvert", "en_cours", "en_attente_client", "résolu", "fermé"];
  const agents = ["Awa Diop", "Kader Ba", "Fatou Sy", "Ismaël N."];
  return Array.from({ length: 28 }, (_, i) => {
    const org = orgs[i % orgs.length];
    const usr = users.find((u) => u.orgId === org.id) || users[0];
    const type = pick(types, i);
    return {
      id: `tkt_${pad(i + 1, 4)}`, orgId: org.id, userId: usr.id, type,
      subject: TYPE_LABEL[type] + ` — ${org.name}`,
      priority: pick(prios, i), status: pick(statuses, i),
      assignedTo: pick(agents, i), slaHours: [4, 8, 24, 48][i % 4],
      createdAt: daysAgo((i * 0.4) % 6), updatedAt: daysAgo((i * 0.2) % 3),
      history: [
        { at: daysAgo((i * 0.4) % 6), author: usr.name, message: "Bonjour, j'ai rencontré un problème." },
        { at: daysAgo(Math.max(0, (i * 0.4) % 6 - 0.3)), author: pick(agents, i), message: "Je prends en charge, j'analyse les logs." },
      ],
      relatedRunId: i % 3 === 0 ? `run_${pad((i % 42) + 1, 5)}` : undefined,
      relatedActionId: i % 4 === 0 ? `act_${pad(i + 1, 5)}` : undefined,
      relatedConnectionId: i % 5 === 0 ? `cnx_${org.id}_meta` : undefined,
    };
  });
}
let _tickets: SupportTicket[] | null = null;
export function getTickets(): SupportTicket[] {
  if (_tickets) return _tickets;
  if (_serverSynced) return [];
  _tickets = buildTickets();
  return _tickets;
}
export function updateTicket(id: string, patch: Partial<SupportTicket>) {
  const list = getTickets();
  const i = list.findIndex((t) => t.id === id);
  if (i >= 0) list[i] = { ...list[i], ...patch, updatedAt: new Date().toISOString() };
}

// ============= Incidents platform =============
export type IncidentSev = "SEV-1" | "SEV-2" | "SEV-3" | "SEV-4";
export type IncidentStatus = "détecté" | "classifié" | "kill_switch" | "communiqué" | "en_correction" | "vérification" | "résolu";
export type PlatformIncident = {
  id: string; title: string; severity: IncidentSev; status: IncidentStatus;
  startedAt: string; resolvedAt?: string; services: string[]; orgIdsAffected: string[];
  actionsExecuted: number; potentialSpendUsd: number; cause: string; resolution: string;
  preventive: string[]; postMortem?: string;
};
const INC_KEY = "orkestria.admin.incidents";
const DEFAULT_INCIDENTS: PlatformIncident[] = [
  { id: "INC-2026-014", title: "Google Ads Write MCP dégradé", severity: "SEV-2", status: "en_correction",
    startedAt: daysAgo(0.1), services: ["google_ads_write_mcp"], orgIdsAffected: ["org_0001", "org_0002", "org_0007"],
    actionsExecuted: 42, potentialSpendUsd: 1_890, cause: "Timeout upstream Google API.", resolution: "Retry exponentiel activé.",
    preventive: ["Circuit breaker MCP", "Alertes P95 latence"] },
  { id: "INC-2026-013", title: "Charge anormale queues", severity: "SEV-3", status: "résolu",
    startedAt: daysAgo(2), resolvedAt: daysAgo(1.8), services: ["queues", "workers"], orgIdsAffected: ["org_0004"],
    actionsExecuted: 8, potentialSpendUsd: 0, cause: "Batch export mal dimensionné.", resolution: "Batch limité à 500 items.",
    preventive: ["Cap taille batch"], postMortem: "Rapport publié." },
  { id: "INC-2026-012", title: "Meta OAuth clients déconnectés", severity: "SEV-1", status: "résolu",
    startedAt: daysAgo(6), resolvedAt: daysAgo(5.7), services: ["meta_mcp"], orgIdsAffected: ["org_0003", "org_0009", "org_0010", "org_0017"],
    actionsExecuted: 0, potentialSpendUsd: 730, cause: "Rotation clé Meta.", resolution: "Reconnexions initiées.",
    preventive: ["Monitoring expiration tokens", "Reconnexion silencieuse"] , postMortem: "RCA publié." },
];
export function getPlatformIncidents(): PlatformIncident[] {
  if (!isBrowser()) return DEFAULT_INCIDENTS;
  const raw = localStorage.getItem(INC_KEY);
  return raw ? JSON.parse(raw) : DEFAULT_INCIDENTS;
}
export function savePlatformIncidents(p: PlatformIncident[]) { if (isBrowser()) localStorage.setItem(INC_KEY, JSON.stringify(p)); }

// ============= Sécurité =============
export type SecurityAlertKind = "connexion_suspecte" | "trop_de_tentatives" | "changement_inhabituel" | "nouveau_pays" | "token_anormal" | "extraction_massive" | "depassement_permissions";
export type SecurityAlert = { id: string; kind: SecurityAlertKind; severity: "info" | "warn" | "critique"; at: string; who: string; where: string; details: string; status: "ouverte" | "acquittée" | "fermée" };
const SEC_ALERTS: SecurityAlert[] = [
  { id: "sec_001", kind: "connexion_suspecte", severity: "warn", at: daysAgo(0.1), who: "awa.diop@velvetstudio.io", where: "Dakar → Lagos (2 min)", details: "Impossible géographiquement.", status: "ouverte" },
  { id: "sec_002", kind: "trop_de_tentatives", severity: "critique", at: daysAgo(0.3), who: "kader.ba@baobabretail.io", where: "IP 41.82.x.x", details: "12 tentatives en 3 min.", status: "acquittée" },
  { id: "sec_003", kind: "nouveau_pays", severity: "info", at: daysAgo(1.2), who: "lea.martin@loopmedia.io", where: "France (nouveau)", details: "Connexion depuis un nouveau pays.", status: "fermée" },
  { id: "sec_004", kind: "token_anormal", severity: "warn", at: daysAgo(0.5), who: "API key ORK-****42", where: "Backend", details: "Usage x8 vs moyenne.", status: "ouverte" },
  { id: "sec_005", kind: "extraction_massive", severity: "critique", at: daysAgo(0.05), who: "ismael.n@orkestria.io", where: "Admin", details: "Export 12 000 lignes.", status: "ouverte" },
  { id: "sec_006", kind: "depassement_permissions", severity: "warn", at: daysAgo(0.8), who: "moussa.sy@teranga.io", where: "Rôle analyst", details: "Tentative accès finance.", status: "acquittée" },
  { id: "sec_007", kind: "changement_inhabituel", severity: "warn", at: daysAgo(2), who: "fatou.sy@orkestria.io", where: "Compte interne", details: "Rôle changé 3x en 24 h.", status: "fermée" },
];
export function getSecurityAlerts(): SecurityAlert[] { return SEC_ALERTS; }

export type SessionInfo = { id: string; user: string; ip: string; device: string; country: string; startedAt: string; lastSeen: string };
export function getActiveSessions(): SessionInfo[] {
  return [
    { id: "sess_01", user: "admin@orkestria.io", ip: "196.207.x.x", device: "Chrome / macOS", country: "Sénégal", startedAt: daysAgo(0.2), lastSeen: daysAgo(0.01) },
    { id: "sess_02", user: "fatou.sy@orkestria.io", ip: "41.82.x.x", device: "Safari / iOS", country: "Côte d'Ivoire", startedAt: daysAgo(0.5), lastSeen: daysAgo(0.05) },
    { id: "sess_03", user: "ismael.n@orkestria.io", ip: "154.72.x.x", device: "Chrome / Windows", country: "Bénin", startedAt: daysAgo(1.1), lastSeen: daysAgo(0.4) },
    { id: "sess_04", user: "kader.ba@orkestria.io", ip: "197.149.x.x", device: "Firefox / Linux", country: "Sénégal", startedAt: daysAgo(2), lastSeen: daysAgo(0.8) },
  ];
}

export type SecretMeta = { id: string; name: string; provider: string; env: "prod" | "staging" | "test"; createdAt: string; lastRotatedAt: string; status: "actif" | "à_rotationner" | "révoqué"; owner: string };
export function getSecretMetas(): SecretMeta[] {
  return [
    { id: "sec_meta_01", name: "META_ADS_APP_SECRET", provider: "Meta", env: "prod", createdAt: daysAgo(180), lastRotatedAt: daysAgo(28), status: "actif", owner: "Kader Ba" },
    { id: "sec_meta_02", name: "GOOGLE_ADS_CLIENT_SECRET", provider: "Google", env: "prod", createdAt: daysAgo(240), lastRotatedAt: daysAgo(120), status: "à_rotationner", owner: "Awa Diop" },
    { id: "sec_meta_03", name: "TIKTOK_APP_SECRET", provider: "TikTok", env: "prod", createdAt: daysAgo(90), lastRotatedAt: daysAgo(30), status: "actif", owner: "Ismaël N." },
    { id: "sec_meta_04", name: "WHATSAPP_API_TOKEN", provider: "WhatsApp Cloud", env: "prod", createdAt: daysAgo(60), lastRotatedAt: daysAgo(10), status: "actif", owner: "Fatou Sy" },
    { id: "sec_meta_05", name: "STRIPE_SECRET_KEY", provider: "Stripe", env: "prod", createdAt: daysAgo(300), lastRotatedAt: daysAgo(60), status: "actif", owner: "Léa Martin" },
    { id: "sec_meta_06", name: "DEEPSEEK_API_KEY", provider: "DeepSeek", env: "staging", createdAt: daysAgo(20), lastRotatedAt: daysAgo(20), status: "actif", owner: "Yaya Kanté" },
  ];
}

export type StaffMember = { id: string; name: string; email: string; role: BackOfficeRole; twoFA: boolean; lastLogin: string; tempAccess?: string };
export type BackOfficeRole = "root_super_admin" | "operations_admin" | "support_agent" | "billing_admin" | "security_admin" | "product_admin" | "analyst";
export const BACKOFFICE_ROLES: { id: BackOfficeRole; name: string; description: string; scopes: string[] }[] = [
  { id: "root_super_admin", name: "Root Super Admin", description: "Accès total, kill switch, paramètres critiques, gestion des administrateurs.", scopes: ["*"] },
  { id: "operations_admin", name: "Operations Admin", description: "Organisations, connexions, runs, incidents, actions publicitaires.", scopes: ["orgs", "connections", "runs", "incidents", "ad_actions"] },
  { id: "support_agent", name: "Support Agent", description: "Tickets, lecture temporaire, reconnexions, quotas limités.", scopes: ["tickets", "temp_read", "reconnect", "quota_grant"] },
  { id: "billing_admin", name: "Billing Admin", description: "Plans, factures, paiements, remboursements, coupons.", scopes: ["plans", "invoices", "payments", "refunds", "coupons"] },
  { id: "security_admin", name: "Security Admin", description: "Alertes, sessions, audit, permissions, secrets.", scopes: ["alerts", "sessions", "audit", "permissions", "secrets"] },
  { id: "product_admin", name: "Product Admin", description: "Templates, feature flags, prompts, skills, tests.", scopes: ["templates", "flags", "prompts", "skills", "tests"] },
  { id: "analyst", name: "Analyst", description: "Lecture des métriques, aucune action sensible.", scopes: ["metrics_read"] },
];
const STAFF_KEY = "orkestria.admin.staff";
const DEFAULT_STAFF: StaffMember[] = [
  { id: "stf_01", name: "Ismaël N.", email: "admin@orkestria.io", role: "root_super_admin", twoFA: true, lastLogin: daysAgo(0.05) },
  { id: "stf_02", name: "Awa Diop", email: "awa@orkestria.io", role: "operations_admin", twoFA: true, lastLogin: daysAgo(0.2) },
  { id: "stf_03", name: "Fatou Sy", email: "fatou@orkestria.io", role: "security_admin", twoFA: true, lastLogin: daysAgo(0.4) },
  { id: "stf_04", name: "Kader Ba", email: "kader@orkestria.io", role: "billing_admin", twoFA: true, lastLogin: daysAgo(1.1) },
  { id: "stf_05", name: "Léa Martin", email: "lea@orkestria.io", role: "product_admin", twoFA: true, lastLogin: daysAgo(0.6) },
  { id: "stf_06", name: "Yaya Kanté", email: "yaya@orkestria.io", role: "support_agent", twoFA: false, lastLogin: daysAgo(0.3), tempAccess: "Lecture Velvet Studio jusqu'au " + new Date(Date.now() + 2 * 864e5).toLocaleDateString("fr-FR") },
  { id: "stf_07", name: "Nadia B.", email: "nadia@orkestria.io", role: "analyst", twoFA: true, lastLogin: daysAgo(3) },
];
export function getStaff(): StaffMember[] {
  if (!isBrowser()) return DEFAULT_STAFF;
  const raw = localStorage.getItem(STAFF_KEY);
  return raw ? JSON.parse(raw) : DEFAULT_STAFF;
}
export function saveStaff(s: StaffMember[]) { if (isBrowser()) localStorage.setItem(STAFF_KEY, JSON.stringify(s)); }

// ============= System settings =============
export type SystemSettings = {
  platformName: string; domains: string[]; supportEmail: string;
  timezone: string; currencies: string[]; languages: string[];
  termsUrl: string; privacyUrl: string;
  maxDailyBudgetUsd: number; maxIncreasePct: number; maxRunDurationMin: number;
  maxIterations: number; maxFileMB: number; maxVideoSec: number; maxAccountsPerPlan: number;
  maintenanceMode: boolean; banner: string; signupsDisabled: boolean;
  blockedCountries: string[]; writeActionsSuspended: boolean;
};
const SETTINGS_KEY = "orkestria.admin.settings";
const DEFAULT_SETTINGS: SystemSettings = {
  platformName: "Orkestria", domains: ["orkestria.io", "app.orkestria.io"], supportEmail: "support@orkestria.io",
  timezone: "Africa/Dakar", currencies: ["USD"], languages: ["fr", "en"],
  termsUrl: "/terms", privacyUrl: "/privacy",
  maxDailyBudgetUsd: 500, maxIncreasePct: 25, maxRunDurationMin: 15,
  maxIterations: 12, maxFileMB: 50, maxVideoSec: 90, maxAccountsPerPlan: 15,
  maintenanceMode: false, banner: "", signupsDisabled: false,
  blockedCountries: [], writeActionsSuspended: false,
};
export function getSystemSettings(): SystemSettings {
  if (!isBrowser()) return DEFAULT_SETTINGS;
  const raw = localStorage.getItem(SETTINGS_KEY);
  return raw ? { ...DEFAULT_SETTINGS, ...JSON.parse(raw) } : DEFAULT_SETTINGS;
}
export function saveSystemSettings(s: SystemSettings) { if (isBrowser()) localStorage.setItem(SETTINGS_KEY, JSON.stringify(s)); }

// ============= Product analytics =============
export function getProductFunnel() {
  const base = 1000;
  const steps = [
    { label: "Inscription", n: base },
    { label: "Entreprise créée", n: 812 },
    { label: "Compte connecté", n: 654 },
    { label: "Audit terminé", n: 520 },
    { label: "Campagne préparée", n: 402 },
    { label: "Campagne approuvée", n: 328 },
    { label: "1re optimisation", n: 274 },
    { label: "2e mois payé", n: 198 },
  ];
  return steps;
}
export function getProductKPIs() {
  return {
    activationRate: 0.52, timeToValueMin: 42, trialToPaid: 0.34,
    retentionM3: 0.71, churnMonthly: 0.048, upgradeRate: 0.18,
    autopilotUsage: 0.44, approvalRate: 0.87, avgAccounts: 3.2,
    topFeatures: ["Audit", "Création campagne", "Rapport hebdo", "Ads Guardian", "Rendu affiche"],
  };
}

// ============= Finance reports =============
export function getFinanceReport() {
  const orgs = getOrganizations();
  const mrr = orgs.filter((o) => o.status === "active").reduce((s, o) => s + (PLANS.find((p) => p.id === o.plan)?.priceMonthly ?? 0), 0);
  const arr = mrr * 12;
  const revenueByPlan = PLANS.map((p) => {
    const count = orgs.filter((o) => o.plan === p.id && o.status === "active").length;
    const revenue = count * p.priceMonthly;
    const costPerOrg = Math.round(p.priceMonthly * 0.12); // ~88% marge (DeepSeek)
    const totalCost = count * costPerOrg;
    const margin = revenue > 0 ? (revenue - totalCost) / revenue : 0;
    return { plan: p, count, revenue, avgRevenue: p.priceMonthly, avgCost: costPerOrg, margin };
  });
  const revenueByCountry = COUNTRIES.map((c) => ({
    country: c,
    revenue: orgs.filter((o) => o.country === c && o.status === "active").reduce((s, o) => s + (PLANS.find((p) => p.id === o.plan)?.priceMonthly ?? 0), 0),
  }));
  return {
    mrr, arr,
    revenueByPlan, revenueByCountry,
    grossMargin: 0.88, aiCostsUSD: 420, infraCostsUSD: 1420,
    refundsUsdCents: 34_000, unpaidUsdCents: 112_000,
    ltvUsdCents: 89_000, cacUsdCents: 22_100, churn: 0.048, arpuUsdCents: 8900,
  };
}

// ============= Compliance audit =============
export type ComplianceEvent = { id: string; at: string; actor: string; kind: string; target: string; risk: RiskLevel; platform?: string; orgId?: string };
export function getComplianceEvents(): ComplianceEvent[] {
  const orgs = getOrganizations();
  const kinds = ["connexion", "modification_rôle", "accès_support", "changement_abonnement", "action_publicitaire", "modification_policy", "suspension", "export", "suppression", "changement_prompt", "activation_flag"];
  const platforms = ["Meta", "Google", "TikTok", "Interne"];
  const actors = ["admin@orkestria.io", "awa@orkestria.io", "fatou@orkestria.io", "kader@orkestria.io", "Agent Orkestria"];
  return Array.from({ length: 60 }, (_, i) => ({
    id: `evt_${pad(i + 1, 5)}`, at: daysAgo((i * 0.4) % 30),
    actor: pick(actors, i), kind: pick(kinds, i),
    target: pick(orgs, i).name,
    risk: pick(["faible", "faible", "moyen", "élevé"] as RiskLevel[], i),
    platform: pick(platforms, i), orgId: pick(orgs, i).id,
  }));
}

// ============= Server sync (Neon PostgreSQL) =============

function asIso(v: unknown): string {
  if (!v) return "";
  if (v instanceof Date) return v.toISOString();
  if (typeof v === "string") return v;
  return String(v);
}

function mapConnector(raw: string): ConnectorId {
  if (raw === "meta_ads" || raw === "meta") return "meta";
  if (raw === "google_ads") return "google_ads";
  if (raw === "tiktok_ads" || raw === "tiktok") return "tiktok";
  if (raw === "ga4") return "ga4";
  if (raw.includes("google")) return "google_ads";
  return "meta";
}

function mapConnStatus(raw: string): Connection["status"] {
  const s = (raw || "").toLowerCase();
  if (s.includes("connect") && !s.includes("dé")) return "active";
  if (s === "active" || s === "connectée") return "active";
  if (s.includes("expir")) return "expirée";
  if (s.includes("erreur") || s.includes("error")) return "erreur";
  if (s.includes("permission")) return "permissions_manquantes";
  return "déconnectée";
}

export async function refreshAdminFromServer(): Promise<boolean> {
  try {
    const [orgs, users, invoices, connections, runs, actions, approvals, incidents, mcp, tickets, kpisRaw, aiLimitsRaw] =
      await Promise.all([
        fetchOrganizations(),
        fetchUsers(),
        fetchInvoices(),
        fetchConnections(),
        fetchRuns(),
        fetchAdActions(),
        fetchApprovals(),
        fetchIncidents(),
        fetchMCPStatuses(),
        fetchTickets(),
        fetchGlobalKPIs(),
        fetchAiLimits(),
      ]);

    _orgs = orgs.map((o) => ({
      ...o,
      type: (o.type as Organization["type"]) || "entreprise",
      plan: (o.plan as Organization["plan"]) || "solo",
      status: (o.status as Organization["status"]) || "active",
      risk: (o.risk as Organization["risk"]) || "faible",
      health: (o.health as Organization["health"]) || "ok",
      createdAt: asIso(o.createdAt),
      lastActive: asIso(o.lastActive),
    }));

    _users = users.map((u) => ({
      ...u,
      role: String(u.role || "member"),
      status: (u.status as PlatformUser["status"]) || "actif",
      lastLogin: asIso(u.lastLogin),
      phone: u.phone || "",
      device: u.device || "—",
      twoFA: Boolean(u.twoFA),
      consumption: Number(u.consumption ?? 0),
      incidents: Number(u.incidents ?? 0),
    }));

    _invoices = invoices.map((i) => ({
      ...i,
      status: i.status as Invoice["status"],
      method: (i.method as Invoice["method"]) || "carte",
      issuedAt: asIso(i.issuedAt),
    }));

    _connections = connections.map((c) => ({
      id: c.id,
      orgId: c.organizationId,
      connector: mapConnector(c.connector),
      status: mapConnStatus(c.status),
      lastSync: asIso(c.lastSync ?? c.updatedAt),
      calls24h: Number(c.calls24h ?? 0),
      errorRate: Number(c.errorRate ?? 0),
      scopes: Array.isArray(c.scopes) ? (c.scopes as string[]) : [],
    }));

    _runs = runs.map((r) => ({
      id: r.id,
      orgId: r.organizationId,
      org: _orgs?.find((o) => o.id === r.organizationId)?.name ?? "—",
      goal: r.goal ?? "—",
      state: (r.state as RunState) || "completed",
      model: "deepseek-v4-flash",
      costUsd: Number(r.costUsd ?? 0),
      startedAt: asIso(r.createdAt),
      durationSec: 0,
      steps: [],
      events: [],
      decisions: [],
      approvals: [],
      errors: [],
    })) as AgentRun[];

    _actions = actions as unknown as AdAction[];
    _approvals = approvals as unknown as Approval[];
    _incidents = incidents.map((i) => ({
      id: i.id,
      kind: (i.kind as Incident["kind"]) || "mcp_erreurs",
      severity: (i.severity as Incident["severity"]) || "info",
      message: i.message,
      orgId: i.organizationId ?? undefined,
      at: asIso(i.createdAt),
    }));
    void mcp;
    void tickets;

    _serverKpis = {
      activeOrgs: kpisRaw.orgs,
      activeUsers: kpisRaw.users,
      payingSubs: _orgs.filter((o) => o.status === "active").length,
      mrr: kpisRaw.mrr,
      arr: kpisRaw.mrr * 12,
      supervisedCampaigns: 0,
      adSpendOrchestrated: _orgs.reduce((s, o) => s + o.adSpend, 0),
      agentActionsToday: kpisRaw.runs,
      actionFailureRate: 0,
      connectionErrors: _connections.filter((c) => c.status !== "active").length,
      aiCostTotal: kpisRaw.aiCostTotal,
      criticalIncidents: incidents.filter((i) => i.severity === "critique").length,
      pendingApprovals: kpisRaw.pendingApprovals,
      failedInvoices: _invoices.filter((i) => i.status === "échec").length,
    };

    _serverSynced = true;

    if (typeof window !== "undefined") {
      localStorage.setItem(AI_LIMITS_KEY, JSON.stringify({
        dailyGlobalUSD: Number(aiLimitsRaw.dailyGlobalUsd ?? 500),
        perOrgUSD: Number(aiLimitsRaw.perOrgUsd ?? 50),
        alertThresholdPct: 80,
      }));
      window.dispatchEvent(new Event("admin:refreshed"));
    }
    return true;
  } catch (e) {
    console.error("refreshAdminFromServer failed", e);
    _serverSynced = true;
    _orgs = _orgs ?? [];
    _users = _users ?? [];
    _invoices = _invoices ?? [];
    _connections = _connections ?? [];
    _runs = _runs ?? [];
    _actions = _actions ?? [];
    _approvals = _approvals ?? [];
    _incidents = _incidents ?? [];
    _tickets = _tickets ?? [];
    if (typeof window !== "undefined") {
      window.dispatchEvent(new Event("admin:refreshed"));
    }
    return false;
  }
}

export async function checkSuperAdminSession(): Promise<boolean> {
  try {
    const { getSession } = await import("@/lib/auth.functions");
    const session = await getSession();
    if (!session) return false;
    const role = (session.user as { role?: string }).role ?? "user";
    return role === "super_admin" || role === "admin";
  } catch {
    return false;
  }
}
