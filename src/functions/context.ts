import { eq } from "drizzle-orm";
import { db } from "@/db";
import { member, userProfiles } from "@/db/schema/index";
import type { Session } from "@/lib/auth";

export async function getActiveOrgId(session: Session): Promise<string> {
  const orgId =
    session.session.activeOrganizationId ??
    (session.user as { activeOrganizationId?: string }).activeOrganizationId;
  if (orgId) return orgId;

  const rows = await db
    .select({ organizationId: member.organizationId })
    .from(member)
    .where(eq(member.userId, session.user.id))
    .limit(1);
  if (!rows[0]) throw new Error("No organization");
  return rows[0].organizationId;
}

export async function getUserProfile(userId: string) {
  const rows = await db.select().from(userProfiles).where(eq(userProfiles.userId, userId)).limit(1);
  return rows[0] ?? null;
}

export async function requireOrgAccess(session: Session, orgId: string) {
  const rows = await db
    .select()
    .from(member)
    .where(eq(member.userId, session.user.id))
    .limit(50);
  if (!rows.some((m) => m.organizationId === orgId)) {
    throw new Error("Forbidden");
  }
}
