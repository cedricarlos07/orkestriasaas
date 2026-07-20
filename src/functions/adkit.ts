import { createServerFn } from "@tanstack/react-start";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { connections, organizationMetadata } from "@/db/schema/index";
import { ensureSession } from "@/lib/auth.functions";
import {
  adkitStatus,
  isAdkitEnabled,
  listAdkitProjects,
} from "@/lib/mcp/clients/adkit";
import { ADKIT_LINK_MARKER } from "@/lib/mcp/adkit-org";
import { getActiveOrgId } from "./context";
import { uid } from "./utils";

export type AdsPlatformStatus = {
  id: "meta_ads" | "google_ads" | "tiktok_ads";
  label: string;
  linked: boolean;
  accountName: string | null;
};

type RawStatus = {
  connected?: boolean;
  project?: { id?: string; name?: string };
  platforms?: {
    meta?: { connected?: boolean; accounts?: { name?: string; id?: string }[] };
    google?: { connected?: boolean; accounts?: { name?: string; id?: string }[] };
    tiktok?: { connected?: boolean; accounts?: { name?: string; id?: string }[] };
  };
  permissions?: { canPublish?: boolean };
};

async function ensureOrgMeta(orgId: string) {
  const rows = await db
    .select()
    .from(organizationMetadata)
    .where(eq(organizationMetadata.organizationId, orgId))
    .limit(1);
  if (rows[0]) return rows[0];
  await db.insert(organizationMetadata).values({ organizationId: orgId });
  const created = await db
    .select()
    .from(organizationMetadata)
    .where(eq(organizationMetadata.organizationId, orgId))
    .limit(1);
  return created[0]!;
}

async function resolveProjectId(orgId: string): Promise<string | null> {
  const meta = await ensureOrgMeta(orgId);
  if (meta.adkitProjectId?.trim()) return meta.adkitProjectId.trim();
  const fromEnv = process.env.ADKIT_PROJECT_ID?.trim();
  if (fromEnv) {
    await db
      .update(organizationMetadata)
      .set({ adkitProjectId: fromEnv, updatedAt: new Date() })
      .where(eq(organizationMetadata.organizationId, orgId));
    return fromEnv;
  }
  const projects = await listAdkitProjects();
  const first = projects[0]?.projectId;
  if (first) {
    await db
      .update(organizationMetadata)
      .set({ adkitProjectId: first, updatedAt: new Date() })
      .where(eq(organizationMetadata.organizationId, orgId));
    return first;
  }
  return null;
}

function platformsFromStatus(raw: RawStatus): AdsPlatformStatus[] {
  const p = raw.platforms ?? {};
  return [
    {
      id: "meta_ads",
      label: "Meta Ads",
      linked: Boolean(p.meta?.connected),
      accountName: p.meta?.accounts?.[0]?.name ?? p.meta?.accounts?.[0]?.id ?? null,
    },
    {
      id: "google_ads",
      label: "Google Ads",
      linked: Boolean(p.google?.connected),
      accountName: p.google?.accounts?.[0]?.name ?? p.google?.accounts?.[0]?.id ?? null,
    },
    {
      id: "tiktok_ads",
      label: "TikTok Ads",
      linked: Boolean(p.tiktok?.connected),
      accountName: p.tiktok?.accounts?.[0]?.name ?? p.tiktok?.accounts?.[0]?.id ?? null,
    },
  ];
}

/** Upsert local connection rows from unified ads MCP status. */
async function upsertAdkitConnection(
  orgId: string,
  connector: AdsPlatformStatus["id"],
  linked: boolean,
  accountName: string | null,
) {
  const rows = await db.select().from(connections).where(eq(connections.organizationId, orgId));
  const existing = rows.find((r) => r.connector === connector);
  const now = new Date();

  if (linked) {
    const values = {
      status: "connectée",
      externalAccount: accountName ?? "Compte lié",
      encryptedTokens: ADKIT_LINK_MARKER,
      lastSync: now,
      updatedAt: now,
    };
    if (existing) {
      // Don't overwrite a real OAuth token connection
      if (existing.encryptedTokens && existing.encryptedTokens !== ADKIT_LINK_MARKER) {
        await db
          .update(connections)
          .set({ status: "connectée", externalAccount: accountName ?? existing.externalAccount, lastSync: now, updatedAt: now })
          .where(eq(connections.id, existing.id));
        return;
      }
      await db.update(connections).set(values).where(eq(connections.id, existing.id));
    } else {
      await db.insert(connections).values({
        id: uid("conn"),
        organizationId: orgId,
        connector,
        scopes: [],
        createdAt: now,
        ...values,
      });
    }
  } else if (existing?.encryptedTokens === ADKIT_LINK_MARKER) {
    await db
      .update(connections)
      .set({ status: "déconnectée", externalAccount: null, encryptedTokens: null, updatedAt: now })
      .where(eq(connections.id, existing.id));
  }
}

/**
 * User-facing ads connection status (powered by AdKit MCP when configured).
 * Does not expose AdKit branding in the payload labels used by the UI.
 */
export const getAdsLinkStatus = createServerFn({ method: "GET" }).handler(async () => {
  const session = await ensureSession();
  const orgId = await getActiveOrgId(session);
  const enabled = isAdkitEnabled();

  if (!enabled) {
    return {
      enabled: false as const,
      projectName: null as string | null,
      platforms: [] as AdsPlatformStatus[],
      error: null as string | null,
    };
  }

  try {
    const projectId = await resolveProjectId(orgId);
    if (!projectId) {
      return {
        enabled: true as const,
        projectName: null,
        platforms: platformsFromStatus({}),
        error: "Aucun espace publicitaire disponible. Contactez le support Orkestria.",
      };
    }
    const raw = (await adkitStatus(projectId)) as RawStatus;
    const platforms = platformsFromStatus(raw);
    for (const p of platforms) {
      await upsertAdkitConnection(orgId, p.id, p.linked, p.accountName);
    }
    return {
      enabled: true as const,
      projectName: raw.project?.name ?? null,
      platforms,
      error: null as string | null,
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Connexion indisponible";
    const retry = /429|Too many requests/i.test(msg)
      ? "Trop de requêtes — réessayez dans quelques secondes."
      : msg;
    return {
      enabled: true as const,
      projectName: null,
      platforms: [] as AdsPlatformStatus[],
      error: retry,
    };
  }
});

/** @deprecated Prefer getAdsLinkStatus — kept for admin/scripts. */
export const getAdkitConfig = getAdsLinkStatus;

export const setAdkitProject = createServerFn({ method: "POST" })
  .inputValidator((data: { projectId: string | null }) => data)
  .handler(async ({ data }) => {
    const session = await ensureSession();
    const orgId = await getActiveOrgId(session);
    await ensureOrgMeta(orgId);
    await db
      .update(organizationMetadata)
      .set({ adkitProjectId: data.projectId?.trim() || null, updatedAt: new Date() })
      .where(eq(organizationMetadata.organizationId, orgId));
    return { ok: true as const, adkitProjectId: data.projectId?.trim() || null };
  });

export const checkinAdkit = createServerFn({ method: "POST" }).handler(async () => {
  await ensureSession();
  return getAdsLinkStatus();
});

export { getOrgAdkitProjectId, requireOrgAdkitProjectId } from "@/lib/mcp/adkit-org";
