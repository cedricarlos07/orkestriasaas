import { eq } from "drizzle-orm";
import { db } from "@/db";
import { organizationMetadata } from "@/db/schema/index";

export async function getOrgMetaPageId(orgId: string): Promise<string | null> {
  const rows = await db
    .select({ pageId: organizationMetadata.metaPageId })
    .from(organizationMetadata)
    .where(eq(organizationMetadata.organizationId, orgId))
    .limit(1);
  const pageId = rows[0]?.pageId?.trim();
  if (pageId) return pageId;
  return process.env.META_PAGE_ID?.trim() || null;
}

export async function setOrgMetaPageId(orgId: string, pageId: string | null): Promise<void> {
  const value = pageId?.trim() || null;
  const existing = await db
    .select()
    .from(organizationMetadata)
    .where(eq(organizationMetadata.organizationId, orgId))
    .limit(1);
  if (existing[0]) {
    await db
      .update(organizationMetadata)
      .set({ metaPageId: value, updatedAt: new Date() })
      .where(eq(organizationMetadata.organizationId, orgId));
  } else {
    await db.insert(organizationMetadata).values({
      organizationId: orgId,
      metaPageId: value,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }
}

/** Resolve page ID: tool param → org metadata → server env. */
export async function resolveMetaPageId(orgId: string, pageId?: string | null): Promise<string | null> {
  if (pageId?.trim()) return pageId.trim();
  return getOrgMetaPageId(orgId);
}
