import { eq } from "drizzle-orm";
import { db } from "@/db";
import { organizationMetadata } from "@/db/schema/index";
import { isWriteEnabled } from "@/lib/platforms/config";

export class WriteGateError extends Error {
  code: "write_env_off" | "org_blocked";
  constructor(message: string, code: WriteGateError["code"]) {
    super(message);
    this.name = "WriteGateError";
    this.code = code;
  }
}

async function loadOrgWriteMeta(orgId: string) {
  const rows = await db
    .select({
      writeBlocked: organizationMetadata.writeBlocked,
      status: organizationMetadata.status,
    })
    .from(organizationMetadata)
    .where(eq(organizationMetadata.organizationId, orgId))
    .limit(1);
  return rows[0] ?? null;
}

/** Billing / admin suspension — always blocks, including dry-run. */
export async function assertOrgNotWriteBlocked(orgId: string): Promise<void> {
  const meta = await loadOrgWriteMeta(orgId);
  if (meta?.writeBlocked || meta?.status === "impayée" || meta?.status === "suspendue") {
    throw new WriteGateError(
      "Écritures bloquées pour ce workspace (facturation ou suspension admin).",
      "org_blocked",
    );
  }
}

/**
 * Fail-closed for live/approval platform mutations.
 * MCP_WRITE_ENABLED must be explicitly "true".
 */
export async function assertAdWritesAllowed(orgId: string): Promise<void> {
  if (!isWriteEnabled()) {
    throw new WriteGateError(
      "Écritures publicitaires désactivées sur ce serveur (MCP_WRITE_ENABLED≠true).",
      "write_env_off",
    );
  }
  await assertOrgNotWriteBlocked(orgId);
}
