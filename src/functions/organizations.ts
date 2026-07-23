import { createServerFn } from "@tanstack/react-start";
import { and, desc, eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { getRequestHeaders } from "@tanstack/react-start/server";
import { db } from "@/db";
import {
  businessMemory,
  member,
  onboardingSessions,
  organization,
  organizationMetadata,
  userProfiles,
} from "@/db/schema/index";
import { ensureSession } from "@/lib/auth.functions";
import { uid } from "./utils";

export const createOrganizationForUser = createServerFn({ method: "POST" })
  .inputValidator((data: { name: string; slug?: string }) => data)
  .handler(async ({ data }) => {
    const session = await ensureSession();
    const headers = getRequestHeaders();
    const org = await auth.api.createOrganization({
      headers,
      body: { name: data.name, slug: data.slug ?? data.name.toLowerCase().replace(/\s+/g, "-") },
    });
    if (!org?.id) throw new Error("Failed to create organization");
    await db.insert(organizationMetadata).values({
      organizationId: org.id,
      type: "entreprise",
      planId: "solo",
      status: "active",
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    await auth.api.setActiveOrganization({
      headers,
      body: { organizationId: org.id },
    });
    return org;
  });

export const getOnboardingSession = createServerFn({ method: "GET" }).handler(async () => {
  const session = await ensureSession();
  const rows = await db
    .select()
    .from(onboardingSessions)
    .where(and(eq(onboardingSessions.userId, session.user.id), eq(onboardingSessions.completed, false)))
    .orderBy(desc(onboardingSessions.updatedAt))
    .limit(1);
  return rows[0] ?? null;
});

export const saveOnboardingSession = createServerFn({ method: "POST" })
  .inputValidator((data: { id?: string; data: Record<string, unknown>; step: number }) => data)
  .handler(async ({ data }) => {
    const session = await ensureSession();
    const id = data.id ?? uid("ob");
    const existing = data.id
      ? await db.select().from(onboardingSessions).where(eq(onboardingSessions.id, data.id)).limit(1)
      : [];
    const row = {
      id,
      userId: session.user.id,
      data: data.data,
      step: data.step,
      completed: false,
      updatedAt: new Date(),
    };
    if (existing[0]) {
      await db.update(onboardingSessions).set(row).where(eq(onboardingSessions.id, id));
    } else {
      await db.insert(onboardingSessions).values({ ...row, createdAt: new Date() });
    }
    return { id };
  });

export const completeOnboarding = createServerFn({ method: "POST" })
  .inputValidator((data: { sessionId: string; companyName: string }) => data)
  .handler(async ({ data }) => {
    const session = await ensureSession();
    const rows = await db
      .select()
      .from(onboardingSessions)
      .where(eq(onboardingSessions.id, data.sessionId))
      .limit(1);
    const ob = rows[0];
    if (!ob || ob.userId !== session.user.id) throw new Error("Not found");
    const obData = ob.data as Record<string, unknown>;
    const profile = await db
      .select()
      .from(userProfiles)
      .where(eq(userProfiles.userId, session.user.id))
      .limit(1);
    if (!profile[0]) {
      await db.insert(userProfiles).values({
        userId: session.user.id,
        appRole: "client",
        company: data.companyName,
        sector: (obData.sector as string) ?? null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }
    const headers = getRequestHeaders();
    const members = await db.select().from(member).where(eq(member.userId, session.user.id)).limit(1);
    if (!members[0]) {
      await auth.api.createOrganization({
        headers,
        body: {
          name: data.companyName,
          slug: data.companyName.toLowerCase().replace(/\s+/g, "-").slice(0, 40),
        },
      });
    }
    await db
      .update(onboardingSessions)
      .set({ completed: true, updatedAt: new Date() })
      .where(eq(onboardingSessions.id, data.sessionId));

    const orgMember = await db.select().from(member).where(eq(member.userId, session.user.id)).limit(1);
    const orgId = orgMember[0]?.organizationId;
    if (orgId) {
      const control = String((obData.control as string) ?? "assistant");
      const policyPatch =
        control === "advisor"
          ? { defaultMode: "dry_run" as const, autonomyEnabled: false }
          : control === "autopilot"
            ? { defaultMode: "live" as const, autonomyEnabled: true }
            : { defaultMode: "approval" as const, autonomyEnabled: false };
      const { updateOrgPolicy } = await import("@/lib/mcp/policy-engine");
      await updateOrgPolicy(orgId, policyPatch);

      const now = new Date();
      const entries: { key: string; value: Record<string, unknown> }[] = [
        { key: "pitch", value: { text: (obData.pitch as string) ?? "" } },
        { key: "sector", value: { name: (obData.sector as string) ?? profile[0]?.sector ?? "" } },
        {
          key: "commercial_goals",
          value: {
            budget: (obData.budget as string) ?? null,
            targetOrders: (obData.targetOrders as number) ?? null,
            city: (obData.city as string) ?? null,
          },
        },
        { key: "control_mode", value: { control, ...policyPatch } },
      ];
      for (const entry of entries) {
        const existing = await db
          .select()
          .from(businessMemory)
          .where(and(eq(businessMemory.organizationId, orgId), eq(businessMemory.key, entry.key)))
          .limit(1);
        if (existing[0]) {
          await db
            .update(businessMemory)
            .set({ value: entry.value, source: "onboarding", updatedAt: now })
            .where(eq(businessMemory.id, existing[0].id));
        } else {
          await db.insert(businessMemory).values({
            id: uid("bm"),
            organizationId: orgId,
            key: entry.key,
            value: entry.value,
            source: "onboarding",
            createdAt: now,
            updatedAt: now,
          });
        }
      }
    }

    return { ok: true };
  });

export const listUserOrganizations = createServerFn({ method: "GET" }).handler(async () => {
  const session = await ensureSession();
  const headers = getRequestHeaders();
  return auth.api.listOrganizations({ headers });
});
