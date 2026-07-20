import { eq } from "drizzle-orm";
import { db } from "@/db";
import { organizationMetadata } from "@/db/schema/index";
import { resolveAdkitProjectId } from "@/lib/mcp/clients/adkit";

/** DB marker: connection linked via AdKit MCP (no native OAuth tokens). */
export const ADKIT_LINK_MARKER = "adkit:linked";

export async function getOrgAdkitProjectId(orgId: string): Promise<string | null> {
  const rows = await db
    .select()
    .from(organizationMetadata)
    .where(eq(organizationMetadata.organizationId, orgId))
    .limit(1);
  return rows[0]?.adkitProjectId ?? null;
}

export async function requireOrgAdkitProjectId(orgId: string): Promise<string> {
  return resolveAdkitProjectId(await getOrgAdkitProjectId(orgId));
}
