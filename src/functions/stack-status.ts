import { createServerFn } from "@tanstack/react-start";
import { ensureSession } from "@/lib/auth.functions";
import { probeUseproxyHealth } from "@/lib/mcp/clients/useproxy";

export const getResearchStackStatus = createServerFn({ method: "GET" }).handler(async () => {
  await ensureSession();
  const configured = Boolean(process.env.USEPROXY_API_KEY?.trim());
  if (!configured) {
    return {
      configured: false,
      url: process.env.USEPROXY_MCP_URL ?? "https://mcp.useproxy.dev/mcp",
      health: { ok: false, error: "USEPROXY_API_KEY non configurée côté serveur" },
    };
  }
  const health = await probeUseproxyHealth();
  return {
    configured: true,
    url: process.env.USEPROXY_MCP_URL ?? "https://mcp.useproxy.dev/mcp",
    health,
  };
});
