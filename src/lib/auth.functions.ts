import { createServerFn } from "@tanstack/react-start";
import { getRequestHeaders } from "@tanstack/react-start/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { member } from "@/db/schema/index";
import { auth } from "@/lib/auth";

export const getSession = createServerFn({ method: "GET" }).handler(async () => {
  const headers = getRequestHeaders();
  return auth.api.getSession({ headers });
});

export const ensureSession = createServerFn({ method: "GET" }).handler(async () => {
  const headers = getRequestHeaders();
  const session = await auth.api.getSession({ headers });
  if (!session) {
    throw new Error("Unauthorized");
  }
  return session;
});

export const ensureSuperAdmin = createServerFn({ method: "GET" }).handler(async () => {
  const headers = getRequestHeaders();
  const session = await auth.api.getSession({ headers });
  if (!session) {
    throw new Error("Unauthorized");
  }
  const role = (session.user as { role?: string }).role ?? "user";
  if (role !== "super_admin" && role !== "admin") {
    throw new Error("Forbidden");
  }
  return session;
});

export const ensureOrgMember = createServerFn({ method: "GET" })
  .inputValidator((data: { organizationId: string }) => data)
  .handler(async ({ data }) => {
    const headers = getRequestHeaders();
    const session = await auth.api.getSession({ headers });
    if (!session) throw new Error("Unauthorized");
    const rows = await db
      .select()
      .from(member)
      .where(eq(member.userId, session.user.id));
    if (!rows.some((m) => m.organizationId === data.organizationId)) {
      throw new Error("Forbidden");
    }
    return session;
  });
