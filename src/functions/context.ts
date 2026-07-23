import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { member, userProfiles } from "@/db/schema/index";
import type { Session } from "@/lib/auth";

export async function getActiveOrgId(session: Session): Promise<string> {
  const claimed =
    session.session.activeOrganizationId ??
    (session.user as { activeOrganizationId?: string }).activeOrganizationId;

  if (claimed) {
    await requireOrgAccess(session, claimed);
    return claimed;
  }

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
    .where(and(eq(member.userId, session.user.id), eq(member.organizationId, orgId)))
    .limit(1);
  if (!rows[0]) {
    throw new Error("Forbidden");
  }
  return rows[0];
}

/** Better Auth org roles that may manage API keys / write policy. */
const ORG_ADMIN_ROLES = new Set(["owner", "admin"]);

export async function requireOrgAdmin(session: Session, orgId: string) {
  const row = await requireOrgAccess(session, orgId);
  const role = (row.role ?? "member").toLowerCase();
  if (!ORG_ADMIN_ROLES.has(role)) {
    throw new Error("Réservé aux administrateurs de l'organisation");
  }
  return row;
}
