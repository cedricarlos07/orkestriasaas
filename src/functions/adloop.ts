import { createServerFn } from "@tanstack/react-start";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { organizationMetadata } from "@/db/schema/index";
import { ensureSession } from "@/lib/auth.functions";
import { getOrgAdloopApiKey, isAdloopLinked, setOrgAdloopApiKey } from "@/lib/mcp/adloop-org";
import { probeAdloopHealth } from "@/lib/mcp/clients/adloop";
import { getActiveOrgId } from "./context";

export const getAdloopLinkStatus = createServerFn({ method: "GET" }).handler(async () => {
  const session = await ensureSession();
  const orgId = await getActiveOrgId(session);
  const linked = await isAdloopLinked(orgId);
  const key = await getOrgAdloopApiKey(orgId);
  const masked = key ? `${key.slice(0, 7)}…${key.slice(-4)}` : null;
  let health: { ok: boolean; error?: string } = { ok: false };
  if (key) {
    const probe = await probeAdloopHealth(key);
    health = { ok: probe.ok, error: probe.error };
  }
  return { linked, maskedKey: masked, health };
});

export const saveAdloopApiKey = createServerFn({ method: "POST" })
  .inputValidator((data: { apiKey: string }) => data)
  .handler(async ({ data }) => {
    const session = await ensureSession();
    const orgId = await getActiveOrgId(session);
    const key = data.apiKey.trim();
    if (!key.startsWith("alc_") && key.length < 8) {
      throw new Error("Clé AdLoop invalide — attendu alc_… (depuis getadloop.com)");
    }
    await setOrgAdloopApiKey(orgId, key);
    const probe = await probeAdloopHealth(key);
    return { ok: true, health: probe };
  });

export const clearAdloopApiKey = createServerFn({ method: "POST" }).handler(async () => {
  const session = await ensureSession();
  const orgId = await getActiveOrgId(session);
  await setOrgAdloopApiKey(orgId, null);
  return { ok: true };
});

export const getOrgAdloopStatus = createServerFn({ method: "GET" }).handler(async () => {
  const session = await ensureSession();
  const orgId = await getActiveOrgId(session);
  const rows = await db
    .select()
    .from(organizationMetadata)
    .where(eq(organizationMetadata.organizationId, orgId))
    .limit(1);
  return {
    hasKey: Boolean(rows[0]?.adloopApiKeyEncrypted),
    linked: await isAdloopLinked(orgId),
  };
});
