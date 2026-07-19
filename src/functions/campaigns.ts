import { createServerFn } from "@tanstack/react-start";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { campaigns } from "@/db/schema/index";
import { ensureSession } from "@/lib/auth.functions";
import { getActiveOrgId } from "./context";
import { uid } from "./utils";

export const listCampaigns = createServerFn({ method: "GET" }).handler(async () => {
  const session = await ensureSession();
  const orgId = await getActiveOrgId(session);
  return db.select().from(campaigns).where(eq(campaigns.organizationId, orgId));
});

export const createCampaign = createServerFn({ method: "POST" })
  .inputValidator(
    (data: { name: string; channel: string; zone?: string; budget?: string }) => data,
  )
  .handler(async ({ data }) => {
    const session = await ensureSession();
    const orgId = await getActiveOrgId(session);
    const now = new Date();
    const row = {
      id: uid("c"),
      organizationId: orgId,
      name: data.name,
      channel: data.channel,
      status: "draft",
      spend: "0",
      conv: 0,
      roas: "—",
      zone: data.zone ?? null,
      budget: data.budget ?? null,
      createdAt: now,
      updatedAt: now,
    };
    await db.insert(campaigns).values(row);
    return row;
  });

export const updateCampaignStatus = createServerFn({ method: "POST" })
  .inputValidator((data: { id: string; status: string }) => data)
  .handler(async ({ data }) => {
    const session = await ensureSession();
    const orgId = await getActiveOrgId(session);
    await db
      .update(campaigns)
      .set({ status: data.status, updatedAt: new Date() })
      .where(eq(campaigns.id, data.id));
    const rows = await db
      .select()
      .from(campaigns)
      .where(eq(campaigns.id, data.id))
      .limit(1);
    if (!rows[0] || rows[0].organizationId !== orgId) throw new Error("Not found");
    return rows[0];
  });

export const duplicateCampaign = createServerFn({ method: "POST" })
  .inputValidator((data: { id: string }) => data)
  .handler(async ({ data }) => {
    const session = await ensureSession();
    const orgId = await getActiveOrgId(session);
    const rows = await db.select().from(campaigns).where(eq(campaigns.id, data.id)).limit(1);
    const src = rows[0];
    if (!src || src.organizationId !== orgId) throw new Error("Not found");
    const now = new Date();
    const copy = {
      ...src,
      id: uid("c"),
      name: `${src.name} (copie)`,
      status: "draft",
      createdAt: now,
      updatedAt: now,
    };
    await db.insert(campaigns).values(copy);
    return copy;
  });
