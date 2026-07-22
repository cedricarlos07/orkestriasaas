import { eq } from "drizzle-orm";
import { db } from "@/db";
import { connections } from "@/db/schema/index";
import { ensureFreshTokens } from "@/lib/platforms/token-refresh";
import type { TokenPayload } from "@/lib/crypto/tokens";

export async function getMetaConnection(orgId: string) {
  const rows = await db
    .select()
    .from(connections)
    .where(eq(connections.organizationId, orgId));

  const conn = rows.find((c) => c.connector === "meta_ads" && c.status === "connectée" && c.encryptedTokens);
  if (!conn) return null;

  const tokens = await ensureFreshTokens(conn.id, orgId, "meta_ads");
  if (!tokens.accountId) {
    throw new Error("Sélectionnez un compte publicitaire Meta dans Connexions.");
  }

  return { conn, tokens, via: "oauth" as const };
}

export async function isMetaLinked(orgId: string): Promise<boolean> {
  const direct = await getMetaConnection(orgId).catch(() => null);
  return Boolean(direct);
}

export function metaAdAccountId(tokens: TokenPayload): string {
  const id = tokens.accountId!;
  return id.startsWith("act_") ? id : `act_${id.replace(/\D/g, "")}`;
}
