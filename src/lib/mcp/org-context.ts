import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { auditRuns, businessMemory, connections } from "@/db/schema/index";
import { CONNECTORS, type ConnectorId } from "@/lib/oauth/connectors";
import { resolveMetaPageId } from "@/lib/mcp/meta-org";
import type { AuditSummary } from "@/lib/unified-ad-schema";

/** Memory keys that hold plumbing — linked accounts are surfaced separately. */
const INTERNAL_KEYS = new Set(["linked_ad_accounts"]);

/** Platforms not yet productized when disconnected — never list ones already connected.
 * Pipeboard family (Meta, Google, TikTok, Snap, Reddit) is live — not listed here. */
const COMING_SOON_IF_DISCONNECTED: { connector?: ConnectorId; label: string }[] = [
  { connector: "linkedin_ads", label: "LinkedIn Ads" },
  { connector: "microsoft_ads", label: "Microsoft Ads" },
  { connector: "x_ads", label: "X Ads" },
  { connector: "amazon_ads", label: "Amazon Ads" },
  { connector: "pinterest_ads", label: "Pinterest Ads" },
  { connector: "ga4", label: "GA4" },
  { label: "WhatsApp Business" },
  { label: "Shopify" },
];

const LINKED_KEY = "linked_ad_accounts";

type LinkedAccount = {
  accountId: string;
  accountName?: string;
  connectionId?: string;
  connector?: string;
};

type LinkedStore = {
  accounts?: LinkedAccount[];
  activeAccountId?: string | null;
};

function compact(value: unknown, max = 240): string {
  const json = typeof value === "string" ? value : JSON.stringify(value);
  if (!json) return "";
  return json.length > max ? `${json.slice(0, max)}…` : json;
}

function sameActId(a: string, b: string): boolean {
  const na = a.replace(/^act_/i, "").replace(/\D/g, "");
  const nb = b.replace(/^act_/i, "").replace(/\D/g, "");
  return Boolean(na) && na === nb;
}

function labelAccount(name: string | undefined | null, id: string): string {
  const n = name?.trim();
  if (n && n !== id) return `« ${n} » (${id})`;
  return id;
}

async function readLinkedStore(orgId: string): Promise<LinkedStore> {
  const rows = await db
    .select()
    .from(businessMemory)
    .where(and(eq(businessMemory.organizationId, orgId), eq(businessMemory.key, LINKED_KEY)))
    .limit(1);
  return (rows[0]?.value ?? {}) as LinkedStore;
}

/**
 * Resolve Meta account + page with commercial names for the agent.
 * Best-effort: never throws — missing names fall back to ids.
 */
async function resolveMetaFacingIdentity(
  orgId: string,
  metaConn: typeof connections.$inferSelect | undefined,
  pageId: string | null,
): Promise<{ accountId: string | null; accountName: string | null; pageId: string | null; pageName: string | null }> {
  if (!metaConn?.encryptedTokens) {
    return { accountId: null, accountName: null, pageId, pageName: null };
  }

  let accountId: string | null = null;
  let accountName: string | null = null;
  let pageName: string | null = null;
  let accessToken: string | null = null;

  try {
    const { decryptTokens } = await import("@/lib/crypto/tokens");
    const tokens = decryptTokens(metaConn.encryptedTokens);
    accessToken = tokens.accessToken;
    accountId = tokens.accountId ?? metaConn.externalAccount ?? null;
    accountName = tokens.accountName?.trim() || null;
  } catch {
    accountId = metaConn.externalAccount ?? null;
  }

  try {
    const { resolveActiveAdAccountId } = await import("@/lib/mcp/resolve-ad-account");
    const active = await resolveActiveAdAccountId(orgId, "meta_ads");
    if (active) accountId = active;
  } catch {
    /* ignore */
  }

  const linked = await readLinkedStore(orgId);
  if (accountId) {
    const match = (linked.accounts ?? []).find(
      (a) =>
        (!a.connector || a.connector === "meta_ads") &&
        sameActId(a.accountId, accountId!),
    );
    if (match?.accountName?.trim()) accountName = match.accountName.trim();
  }

  if (accessToken && pageId) {
    try {
      const { getMetaPageName } = await import("@/lib/platforms/meta-api");
      pageName = (await getMetaPageName(accessToken, pageId)) ?? null;
    } catch {
      /* ignore */
    }
  }

  return { accountId, accountName, pageId, pageName };
}

/**
 * Compact French briefing of everything Orkestria already knows about the org.
 * Injected in the system prompt so the agent stops asking for accounts that are
 * already connected — and speaks with real account / page names.
 */
export async function buildOrgContext(orgId: string, _query?: string): Promise<string> {
  const [conns, memory, audits, pageId] = await Promise.all([
    db.select().from(connections).where(eq(connections.organizationId, orgId)),
    db.select().from(businessMemory).where(eq(businessMemory.organizationId, orgId)),
    db
      .select()
      .from(auditRuns)
      .where(eq(auditRuns.organizationId, orgId))
      .orderBy(desc(auditRuns.startedAt))
      .limit(1),
    resolveMetaPageId(orgId, null).catch(() => null),
  ]);

  const lines: string[] = [];

  const active = conns.filter((c) => c.status === "connectée");
  const activeConnectors = new Set(active.map((c) => c.connector));
  const metaConn = active.find((c) => c.connector === "meta_ads");

  const metaId = await resolveMetaFacingIdentity(orgId, metaConn, pageId);
  const linked = await readLinkedStore(orgId);

  // ——— Identité compte (source de vérité pour le ton perso) ———
  lines.push("--- Identité du client (à citer nommément) ---");
  if (metaId.accountId) {
    lines.push(
      `Compte Meta actif : ${labelAccount(metaId.accountName, metaId.accountId)}.`,
    );
  }
  if (metaId.pageId) {
    lines.push(
      metaId.pageName
        ? `Page Facebook choisie : « ${metaId.pageName} » (id ${metaId.pageId}).`
        : `Page Facebook choisie : id ${metaId.pageId} (nom non résolu).`,
    );
  } else if (activeConnectors.has("meta_ads")) {
    lines.push("Page Facebook non choisie — à sélectionner dans Connexions.");
  }

  const linkedAccounts = linked.accounts ?? [];
  if (linkedAccounts.length) {
    const activeId = linked.activeAccountId ?? metaId.accountId;
    const listed = linkedAccounts
      .map((a) => {
        const label = CONNECTORS[a.connector as ConnectorId]?.label ?? a.connector ?? "Ads";
        const mark =
          activeId && sameActId(a.accountId, activeId) ? " ← ACTIF" : "";
        return `  • ${label} ${labelAccount(a.accountName, a.accountId)}${mark}`;
      })
      .join("\n");
    lines.push(`Comptes pubs liés :\n${listed}`);
  }

  if (active.length) {
    const labels = active.map((c) => {
      const label = CONNECTORS[c.connector as ConnectorId]?.label ?? c.connector;
      if (c.connector === "meta_ads" && metaId.accountId) {
        return `${label} ${labelAccount(metaId.accountName, metaId.accountId)}`;
      }
      let name: string | null = null;
      try {
        if (c.encryptedTokens) {
          // lazy sync import avoided — name often in linked store
          const match = linkedAccounts.find(
            (a) => a.connectionId === c.id || a.connector === c.connector,
          );
          name = match?.accountName ?? null;
        }
      } catch {
        /* ignore */
      }
      return c.externalAccount
        ? `${label} ${labelAccount(name, c.externalAccount)}`
        : label;
    });
    lines.push(`Plateformes connectées : ${labels.join(", ")}.`);
  } else {
    lines.push("Aucune plateforme publicitaire connectée pour le moment.");
  }

  // Never list disconnected ad platforms — the agent must stay on what the client already connected.
  if (activeConnectors.has("google_ads")) {
    const g = linkedAccounts.find((a) => a.connector === "google_ads");
    const gid = g?.accountId ?? linked.activeAccountId;
    lines.push(
      gid
        ? `Google Ads : connecté — ${labelAccount(g?.accountName, gid)}.`
        : "Google Ads : connecté (création Search/PMax en pause possible).",
    );
  }
  for (const [id, label] of [
    ["tiktok_ads", "TikTok Ads"],
    ["snapchat_ads", "Snapchat Ads"],
    ["reddit_ads", "Reddit Ads"],
  ] as const) {
    if (activeConnectors.has(id)) {
      const a = linkedAccounts.find((x) => x.connector === id);
      lines.push(
        a
          ? `${label} : connecté — ${labelAccount(a.accountName, a.accountId)}.`
          : `${label} : connecté.`,
      );
    }
  }

  const adPlatforms = [...activeConnectors].filter((c) => c !== "ga4");
  if (adPlatforms.length === 1) {
    const only = CONNECTORS[adPlatforms[0] as ConnectorId]?.label ?? adPlatforms[0];
    lines.push(
      `Règle absolue : une seule régie connectée (${only}). Reste exclusivement sur ${only}. Ne recommande JAMAIS Google, TikTok, Snap, Reddit ni une autre régie.`,
    );
  } else if (adPlatforms.length > 1) {
    lines.push(
      "Règle : ne recommande que les régies déjà connectées ci-dessus. Ne propose pas d'en ajouter d'autres spontanément.",
    );
  }

  lines.push(
    "Style : cite toujours le nom commercial du compte + son id, et le nom de la Page. Langage simple, expert media buyer (argent, CPA, budget) — zéro jargon d'agence inutile.",
  );

  const comingSoon = COMING_SOON_IF_DISCONNECTED.filter(
    (p) => !p.connector || !activeConnectors.has(p.connector),
  ).map((p) => p.label);
  if (comingSoon.length) {
    lines.push(`Non disponibles dans le produit (répondre « bientôt ») : ${comingSoon.join(", ")}.`);
  }

  const audit = audits[0]?.summary as AuditSummary | null | undefined;
  if (audit?.accounts.length) {
    const t = audit.totals;
    lines.push(
      `Dernier audit (${audits[0]?.period ?? "30 derniers jours"}) : ${Math.round(t.spend)} ${t.currency} dépensés, ` +
        `${t.conversions} conversion(s), CPA ${t.cpa ? Math.round(t.cpa) : "n/d"}${t.roas ? `, ROAS ${t.roas.toFixed(2)}` : ""}.`,
    );
    for (const a of audit.accounts.slice(0, 4)) {
      lines.push(
        `  → ${a.platform} ${labelAccount(a.accountName, a.accountId)} : ${Math.round(a.spend)} ${a.currency}, ${a.campaigns.length} campagne(s).`,
      );
    }
    const topCamps = audit.accounts
      .flatMap((a) => a.campaigns.map((c) => ({ ...c, platform: a.platform })))
      .sort((a, b) => b.spend - a.spend)
      .slice(0, 5);
    if (topCamps.length) {
      lines.push(
        `Campagnes connues : ${topCamps
          .map(
            (c) =>
              `${c.name} (${c.platform}, ${Math.round(c.spend)} ${c.currency}, ${c.conversions} conv, ${c.status})`,
          )
          .join(" · ")}.`,
      );
    }
    if (audit.problems.length) lines.push(`Problèmes déjà identifiés : ${audit.problems.slice(0, 3).join(" ; ")}.`);
  }

  const facts = memory.filter((m) => !INTERNAL_KEYS.has(m.key) && m.value);
  if (facts.length) {
    lines.push(
      `Mémoire entreprise : ${facts
        .slice(0, 8)
        .map((m) => `${m.key}=${compact(m.value)}`)
        .join(" | ")}`,
    );
  }

  return lines.join("\n");
}
