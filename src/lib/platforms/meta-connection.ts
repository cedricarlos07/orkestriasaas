import { eq } from "drizzle-orm";
import { db } from "@/db";
import { connections } from "@/db/schema/index";
import { ensureFreshTokens } from "@/lib/platforms/token-refresh";
import type { TokenPayload } from "@/lib/crypto/tokens";
import { ADKIT_LINK_MARKER } from "@/lib/mcp/adkit-org";
import { isAdkitEnabled, adkitStatus } from "@/lib/mcp/clients/adkit";
import { requireOrgAdkitProjectId } from "@/lib/mcp/adkit-org";

export async function getMetaConnection(orgId: string) {
  const rows = await db
    .select()
    .from(connections)
    .where(eq(connections.organizationId, orgId));

  const conn = rows.find((c) => c.connector === "meta_ads" && c.status === "connectée" && c.encryptedTokens);
  if (!conn) return null;

  // Linked via unified ads MCP — no native Meta OAuth tokens on Orkestria
  if (conn.encryptedTokens === ADKIT_LINK_MARKER) {
    return {
      conn,
      tokens: {
        accessToken: ADKIT_LINK_MARKER,
        accountId: undefined as string | undefined,
        refreshToken: undefined,
        expiresAt: undefined,
      } satisfies TokenPayload,
      via: "adkit" as const,
    };
  }

  const tokens = await ensureFreshTokens(conn.id, orgId, "meta_ads");
  if (!tokens.accountId) {
    throw new Error("Sélectionnez un compte publicitaire Meta dans Connexions.");
  }

  return { conn, tokens, via: "oauth" as const };
}

/** True if Meta is usable (native OAuth or AdKit-linked). */
export async function isMetaLinked(orgId: string): Promise<boolean> {
  const direct = await getMetaConnection(orgId).catch(() => null);
  if (direct) return true;
  if (!isAdkitEnabled()) return false;
  try {
    const projectId = await requireOrgAdkitProjectId(orgId);
    const raw = (await adkitStatus(projectId)) as {
      platforms?: { meta?: { connected?: boolean } };
    };
    return Boolean(raw.platforms?.meta?.connected);
  } catch {
    return false;
  }
}

export function metaAdAccountId(tokens: TokenPayload): string {
  const id = tokens.accountId!;
  return id.startsWith("act_") ? id : `act_${id.replace(/\D/g, "")}`;
}
