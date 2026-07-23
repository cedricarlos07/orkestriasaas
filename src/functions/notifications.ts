import { createServerFn } from "@tanstack/react-start";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { notifications } from "@/db/schema/index";
import { ensureSession } from "@/lib/auth.functions";
import { getActiveOrgId } from "./context";
import { uid } from "./utils";

export const listNotifications = createServerFn({ method: "GET" }).handler(async () => {
  const session = await ensureSession();
  const orgId = await getActiveOrgId(session);
  return db
    .select()
    .from(notifications)
    .where(eq(notifications.organizationId, orgId))
    .orderBy(desc(notifications.createdAt));
});

export const markNotificationRead = createServerFn({ method: "POST" })
  .inputValidator((data: { id: string }) => data)
  .handler(async ({ data }) => {
    const session = await ensureSession();
    const orgId = await getActiveOrgId(session);
    const updated = await db
      .update(notifications)
      .set({ read: true })
      .where(and(eq(notifications.id, data.id), eq(notifications.organizationId, orgId)))
      .returning();
    if (!updated[0]) throw new Error("Not found");
    return updated[0];
  });

export const markAllNotificationsRead = createServerFn({ method: "POST" }).handler(async () => {
  const session = await ensureSession();
  const orgId = await getActiveOrgId(session);
  await db.update(notifications).set({ read: true }).where(eq(notifications.organizationId, orgId));
  return { ok: true };
});

export const createNotification = createServerFn({ method: "POST" })
  .inputValidator(
    (data: { kind: string; title: string; body: string; userId?: string }) => data,
  )
  .handler(async ({ data }) => {
    const session = await ensureSession();
    const orgId = await getActiveOrgId(session);
    const row = {
      id: uid("n"),
      organizationId: orgId,
      userId: data.userId ?? session.user.id,
      kind: data.kind,
      title: data.title,
      body: data.body,
      read: false,
      emailSent: false,
      createdAt: new Date(),
    };
    await db.insert(notifications).values(row);
    return row;
  });
