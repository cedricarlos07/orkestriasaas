import { eq } from "drizzle-orm";
import { db } from "@/db";
import { organizationMetadata } from "@/db/schema/index";
import { decryptTokens, encryptTokens } from "@/lib/crypto/tokens";

/** Encrypted AdLoop Cloud API key (alc_...) per org. */
export async function getOrgAdloopApiKey(orgId: string): Promise<string | null> {
  const rows = await db
    .select({ key: organizationMetadata.adloopApiKeyEncrypted })
    .from(organizationMetadata)
    .where(eq(organizationMetadata.organizationId, orgId))
    .limit(1);
  const blob = rows[0]?.key;
  if (!blob?.trim()) return process.env.ADLOOP_API_KEY?.trim() || null;
  try {
    const payload = decryptTokens(blob);
    return payload.accessToken || null;
  } catch {
    return null;
  }
}

export async function setOrgAdloopApiKey(orgId: string, apiKey: string | null): Promise<void> {
  const encrypted = apiKey?.trim()
    ? encryptTokens({ accessToken: apiKey.trim() })
    : null;
  const existing = await db
    .select()
    .from(organizationMetadata)
    .where(eq(organizationMetadata.organizationId, orgId))
    .limit(1);
  if (existing[0]) {
    await db
      .update(organizationMetadata)
      .set({ adloopApiKeyEncrypted: encrypted, updatedAt: new Date() })
      .where(eq(organizationMetadata.organizationId, orgId));
  } else {
    await db.insert(organizationMetadata).values({
      organizationId: orgId,
      adloopApiKeyEncrypted: encrypted,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }
}

export async function isAdloopLinked(orgId: string): Promise<boolean> {
  const key = await getOrgAdloopApiKey(orgId);
  return Boolean(key?.startsWith("alc_") || key);
}
