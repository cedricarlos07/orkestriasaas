import { createServerFn } from "@tanstack/react-start";
import { desc } from "drizzle-orm";
import { db } from "@/db";
import { contactSubmissions } from "@/db/schema/index";
import { sendContactNotifyEmail } from "@/lib/email/smtp";
import { uid } from "./utils";

export const submitContact = createServerFn({ method: "POST" })
  .inputValidator(
    (data: {
      topic: string;
      name: string;
      email: string;
      message: string;
      context?: Record<string, unknown>;
    }) => data,
  )
  .handler(async ({ data }) => {
    const row = {
      id: uid("ct"),
      topic: data.topic,
      name: data.name,
      email: data.email,
      message: data.message,
      context: data.context ?? {},
      createdAt: new Date(),
    };
    await db.insert(contactSubmissions).values(row);
    // Best-effort notify — never fail the form if SMTP is down.
    void sendContactNotifyEmail({
      topic: data.topic,
      name: data.name,
      email: data.email,
      message: data.message,
    }).catch((err) => console.error("[contact] notify email failed:", err));
    return row;
  });

export const listContactSubmissions = createServerFn({ method: "GET" }).handler(async () => {
  return db.select().from(contactSubmissions).orderBy(desc(contactSubmissions.createdAt)).limit(200);
});
