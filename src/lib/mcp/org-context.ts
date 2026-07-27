import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { auditRuns, businessMemory, connections } from "@/db/schema/index";
import { CONNECTORS, type ConnectorId } from "@/lib/oauth/connectors";
import { resolveMetaPageId } from "@/lib/mcp/meta-org";
import type { AuditSummary } from "@/lib/unified-ad-schema";

/** Memory keys that hold plumbing, not business facts the agent should read. */
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

function compact(value: unknown, max = 240): string {
  const json = typeof value === "string" ? value : JSON.stringify(value);
  if (!json) return "";
  return json.length > max ? `${json.slice(0, max)}…` : json;
}

/**
 * Compact French briefing of everything Orkestria already knows about the org.
 * Injected in the system prompt so the agent stops asking for accounts that are
 * already connected.
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
  if (active.length) {
    const labels = active.map((c) => {
      const label = CONNECTORS[c.connector as ConnectorId]?.label ?? c.connector;
      return c.externalAccount ? `${label} (compte ${c.externalAccount})` : label;
    });
    lines.push(`Plateformes connectées : ${labels.join(", ")}.`);
  } else {
    lines.push("Aucune plateforme publicitaire connectée pour le moment.");
  }

  const metaActive = activeConnectors.has("meta_ads");
  if (metaActive) {
    lines.push(
      pageId
        ? `Page Facebook configurée : ${pageId}.`
        : "Page Facebook non choisie — à sélectionner dans Connexions.",
    );
  }

  // Never list disconnected ad platforms — the agent must stay on what the client already connected.
  if (activeConnectors.has("google_ads")) {
    lines.push("Google Ads : connecté (création Search/PMax en pause possible via Pipeboard).");
  }
  for (const [id, label] of [
    ["tiktok_ads", "TikTok Ads"],
    ["snapchat_ads", "Snapchat Ads"],
    ["reddit_ads", "Reddit Ads"],
  ] as const) {
    if (activeConnectors.has(id)) {
      lines.push(`${label} : connecté.`);
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

  // Surface the selected Meta act when it differs from the OAuth default.
  try {
    const { resolveActiveAdAccountId } = await import("@/lib/mcp/resolve-ad-account");
    const activeMeta = await resolveActiveAdAccountId(orgId, "meta_ads");
    if (metaActive && activeMeta) {
      lines.push(`Compte Meta actif pour lecture/création : ${activeMeta}.`);
    }
  } catch {
    /* ignore */
  }

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
