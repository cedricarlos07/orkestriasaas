import { createServerFn } from "@tanstack/react-start";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { notifications, user } from "@/db/schema/index";
import { ensureSession } from "@/lib/auth.functions";
import { sendNotificationEmail } from "@/lib/email/smtp";
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
    (data: { kind: string; title: string; body: string; userId?: string; sendEmail?: boolean }) => data,
  )
  .handler(async ({ data }) => {
    const session = await ensureSession();
    const orgId = await getActiveOrgId(session);
    const targetUserId = data.userId ?? session.user.id;
    const row = {
      id: uid("n"),
      organizationId: orgId,
      userId: targetUserId,
      kind: data.kind,
      title: data.title,
      body: data.body,
      read: false,
      emailSent: false,
      createdAt: new Date(),
    };
    await db.insert(notifications).values(row);

    const shouldEmail = data.sendEmail !== false;
    if (shouldEmail) {
      try {
        const [target] = await db.select({ email: user.email }).from(user).where(eq(user.id, targetUserId)).limit(1);
        const email = target?.email ?? (targetUserId === session.user.id ? session.user.email : null);
        if (email) {
          const sent = await sendNotificationEmail({
            to: email,
            title: data.title,
            body: data.body,
          });
          if (sent.ok) {
            await db.update(notifications).set({ emailSent: true }).where(eq(notifications.id, row.id));
            row.emailSent = true;
          }
        }
      } catch (err) {
        console.error("[notifications] email failed:", err);
      }
    }

    return row;
  });
