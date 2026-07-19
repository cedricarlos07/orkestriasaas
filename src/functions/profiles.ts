import { createServerFn } from "@tanstack/react-start";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { userProfiles } from "@/db/schema/index";
import { ensureSession } from "@/lib/auth.functions";
import { getUserProfile } from "./context";

export const getProfile = createServerFn({ method: "GET" }).handler(async () => {
  const session = await ensureSession();
  return getUserProfile(session.user.id);
});

export const saveUserProfile = createServerFn({ method: "POST" })
  .inputValidator((data: { appRole: string; company: string; sector?: string; size?: string; country?: string }) => data)
  .handler(async ({ data }) => {
    const session = await ensureSession();
    const existing = await getUserProfile(session.user.id);
    const row = {
      userId: session.user.id,
      appRole: data.appRole,
      company: data.company,
      sector: data.sector ?? null,
      size: data.size ?? null,
      country: data.country ?? null,
      language: "fr",
      currency: "XOF",
      updatedAt: new Date(),
    };
    if (existing) {
      await db.update(userProfiles).set(row).where(eq(userProfiles.userId, session.user.id));
    } else {
      await db.insert(userProfiles).values({ ...row, createdAt: new Date() });
    }
    return { ok: true };
  });
