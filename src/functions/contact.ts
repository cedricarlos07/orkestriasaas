import { createServerFn } from "@tanstack/react-start";
import { getRequestHeaders } from "@tanstack/react-start/server";
import { desc } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { contactSubmissions } from "@/db/schema/index";
import { sendContactNotifyEmail } from "@/lib/email/smtp";
import { ensureSuperAdmin } from "@/lib/auth.functions";
import { clientIpFromHeaders, enforceIpLimit } from "@/lib/security/rate-limit";
import { uid } from "./utils";

const contactSchema = z.object({
  topic: z.string().trim().min(1).max(120),
  name: z.string().trim().min(1).max(120),
  email: z.string().trim().email().max(200),
  message: z.string().trim().min(1).max(5000),
  context: z.record(z.string(), z.unknown()).optional(),
});

export const submitContact = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => contactSchema.parse(data))
  .handler(async ({ data }) => {
    const ip = clientIpFromHeaders(getRequestHeaders());
    await enforceIpLimit({ ip, action: "contact_submit", limit: 5, windowSec: 3600 });

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
  await ensureSuperAdmin();
  return db.select().from(contactSubmissions).orderBy(desc(contactSubmissions.createdAt)).limit(200);
});
