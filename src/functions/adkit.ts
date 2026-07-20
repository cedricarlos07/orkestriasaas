import { createServerFn } from "@tanstack/react-start";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { organizationMetadata } from "@/db/schema/index";
import { ensureSession } from "@/lib/auth.functions";
import {
  adkitCheckin,
  adkitStatus,
  isAdkitEnabled,
  listAdkitProjects,
} from "@/lib/mcp/clients/adkit";
import { getActiveOrgId } from "./context";

type AdkitStatusView = {
  connected: boolean;
  projectId: string | null;
  projectName: string | null;
  metaConnected: boolean;
  metaAccountName: string | null;
  canPublish: boolean;
};

function toStatusView(raw: unknown, projectId: string): AdkitStatusView {
  const s = (raw ?? {}) as {
    connected?: boolean;
    project?: { id?: string; name?: string };
    platforms?: { meta?: { connected?: boolean; accounts?: { name?: string }[] } };
    permissions?: { canPublish?: boolean };
  };
  return {
    connected: Boolean(s.connected ?? true),
    projectId: s.project?.id ?? projectId,
    projectName: s.project?.name ?? null,
    metaConnected: Boolean(s.platforms?.meta?.connected),
    metaAccountName: s.platforms?.meta?.accounts?.[0]?.name ?? null,
    canPublish: Boolean(s.permissions?.canPublish),
  };
}

async function ensureOrgMeta(orgId: string) {
  const rows = await db
    .select()
    .from(organizationMetadata)
    .where(eq(organizationMetadata.organizationId, orgId))
    .limit(1);
  if (rows[0]) return rows[0];
  await db.insert(organizationMetadata).values({ organizationId: orgId });
  const created = await db
    .select()
    .from(organizationMetadata)
    .where(eq(organizationMetadata.organizationId, orgId))
    .limit(1);
  return created[0]!;
}

export const getAdkitConfig = createServerFn({ method: "GET" }).handler(async () => {
  const session = await ensureSession();
  const orgId = await getActiveOrgId(session);
  const meta = await ensureOrgMeta(orgId);
  const enabled = isAdkitEnabled();
  let projects: Awaited<ReturnType<typeof listAdkitProjects>> = [];
  let status: AdkitStatusView | null = null;
  let error: string | null = null;

  if (enabled) {
    try {
      projects = await listAdkitProjects();
      const projectId = meta.adkitProjectId ?? process.env.ADKIT_PROJECT_ID ?? projects[0]?.projectId ?? null;
      if (projectId) {
        status = toStatusView(await adkitStatus(projectId), projectId);
      }
    } catch (e) {
      error = e instanceof Error ? e.message : "AdKit indisponible";
    }
  }

  return {
    enabled,
    orgId,
    adkitProjectId: meta.adkitProjectId,
    defaultProjectId: process.env.ADKIT_PROJECT_ID?.trim() || null,
    projects,
    status,
    error,
    writeEnabled: process.env.MCP_WRITE_ENABLED === "true",
  };
});

export const setAdkitProject = createServerFn({ method: "POST" })
  .inputValidator((data: { projectId: string | null }) => data)
  .handler(async ({ data }) => {
    const session = await ensureSession();
    const orgId = await getActiveOrgId(session);
    await ensureOrgMeta(orgId);
    await db
      .update(organizationMetadata)
      .set({ adkitProjectId: data.projectId?.trim() || null, updatedAt: new Date() })
      .where(eq(organizationMetadata.organizationId, orgId));
    return { ok: true as const, adkitProjectId: data.projectId?.trim() || null };
  });

export const checkinAdkit = createServerFn({ method: "POST" }).handler(async () => {
  await ensureSession();
  if (!isAdkitEnabled()) throw new Error("ADKIT_API_KEY non configuré");
  const raw = (await adkitCheckin("orkestria")) as {
    connected?: boolean;
    checkedIn?: boolean;
    project?: { name?: string };
  };
  return {
    connected: Boolean(raw.connected),
    checkedIn: Boolean(raw.checkedIn),
    projectName: raw.project?.name ?? null,
  };
});

export { getOrgAdkitProjectId, requireOrgAdkitProjectId } from "@/lib/mcp/adkit-org";
