/**
 * AdKit remote MCP client (https://mcp.adkit.so).
 * Auth: Authorization Bearer ADKIT_API_KEY (server / unattended).
 */

export type AdkitJsonRpcResult = {
  ok: boolean;
  data?: unknown;
  error?: string;
  latencyMs: number;
};

export type AdkitProject = {
  projectId: string;
  name: string;
  website?: string;
  role?: string;
  platforms?: Record<string, number>;
};

export function isAdkitEnabled(): boolean {
  return Boolean(process.env.ADKIT_API_KEY?.trim());
}

export function adkitMcpUrl(): string {
  return (process.env.ADKIT_MCP_URL?.trim() || "https://mcp.adkit.so").replace(/\/$/, "");
}

export function parseAdkitTextPayload(data: unknown): unknown {
  if (typeof data === "object" && data !== null && "content" in data) {
    const content = (data as { content?: { type?: string; text?: string }[] }).content;
    const text = content?.find((c) => c.type === "text")?.text;
    if (text) {
      try {
        return JSON.parse(text) as unknown;
      } catch {
        return text;
      }
    }
  }
  return data;
}

export async function callAdkitTool(
  name: string,
  args: Record<string, unknown> = {},
): Promise<AdkitJsonRpcResult> {
  const key = process.env.ADKIT_API_KEY?.trim();
  if (!key) {
    return { ok: false, error: "ADKIT_API_KEY manquant", latencyMs: 0 };
  }

  const start = Date.now();
  try {
    const res = await fetch(`${adkitMcpUrl()}/`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json, text/event-stream",
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: Date.now(),
        method: "tools/call",
        params: { name, arguments: args },
      }),
      signal: AbortSignal.timeout(90_000),
    });

    if (!res.ok) {
      return {
        ok: false,
        error: `AdKit HTTP ${res.status}: ${await res.text()}`,
        latencyMs: Date.now() - start,
      };
    }

    const body = (await res.json()) as {
      error?: { message?: string };
      result?: unknown;
    };
    if (body.error) {
      return {
        ok: false,
        error: body.error.message ?? "AdKit tool call failed",
        latencyMs: Date.now() - start,
      };
    }

    return { ok: true, data: body.result, latencyMs: Date.now() - start };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "AdKit call failed",
      latencyMs: Date.now() - start,
    };
  }
}

export async function listAdkitProjects(query?: string): Promise<AdkitProject[]> {
  const res = await callAdkitTool("adkit_projects", {
    ...(query ? { query } : {}),
    limit: 50,
  });
  if (!res.ok) throw new Error(res.error ?? "adkit_projects failed");
  const payload = parseAdkitTextPayload(res.data) as { projects?: AdkitProject[] };
  return payload.projects ?? [];
}

export async function resolveAdkitProjectId(preferred?: string | null): Promise<string> {
  if (preferred?.trim()) return preferred.trim();
  const fromEnv = process.env.ADKIT_PROJECT_ID?.trim();
  if (fromEnv) return fromEnv;

  const projects = await listAdkitProjects();
  if (projects.length === 1) return projects[0]!.projectId;
  if (projects.length === 0) {
    throw new Error("Aucun projet AdKit. Créez-en un sur https://app.adkit.so");
  }
  throw new Error(
    `Plusieurs projets AdKit — liez-en un à l'organisation (ou ADKIT_PROJECT_ID). Disponibles : ${projects
      .map((p) => `${p.name} (${p.projectId})`)
      .join(", ")}`,
  );
}

export async function adkitCheckin(agentId = "orkestria"): Promise<unknown> {
  const res = await callAdkitTool("adkit_checkin", { agentId });
  if (!res.ok) throw new Error(res.error ?? "adkit_checkin failed");
  return parseAdkitTextPayload(res.data);
}

export async function adkitStatus(projectId: string): Promise<unknown> {
  const res = await callAdkitTool("adkit_status", { projectId });
  if (!res.ok) throw new Error(res.error ?? "adkit_status failed");
  return parseAdkitTextPayload(res.data);
}

export async function probeAdkitHealth(): Promise<{ ok: boolean; latencyMs: number; error?: string }> {
  if (!isAdkitEnabled()) return { ok: false, latencyMs: 0, error: "ADKIT_API_KEY unset" };
  const res = await callAdkitTool("adkit_projects", { limit: 1 });
  return { ok: res.ok, latencyMs: res.latencyMs, error: res.error };
}
