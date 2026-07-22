import { eq } from "drizzle-orm";
import { db } from "@/db";
import { mcpStatusSnapshots } from "@/db/schema/index";
import { probeAdloopHealth } from "@/lib/mcp/clients/adloop";
import { probeAdkitMcp } from "@/lib/mcp/adkit-bridge";
import { adkitMcpCommand } from "@/lib/mcp/clients/adkit-mcp";
import { probeUseproxyHealth } from "@/lib/mcp/clients/useproxy";

export async function probeMcpHealth(): Promise<void> {
  const services = [
    {
      serviceId: "adloop_mcp",
      label: "AdLoop self-hosted (Google + GA4)",
      probe: () => probeAdloopHealth(),
      mode: "adloop_stdio",
      url: `${process.env.ADLOOP_MCP_COMMAND ?? "python3"} ${process.env.ADLOOP_MCP_ARGS ?? "-m adloop"}`,
    },
    {
      serviceId: "useproxy_mcp",
      label: "Proxy Ads Library (research)",
      probe: () => probeUseproxyHealth(),
      mode: "useproxy",
      url: process.env.USEPROXY_MCP_URL ?? "https://mcp.useproxy.dev/mcp",
    },
    {
      serviceId: "google_ads_native",
      label: "Google Ads (native OAuth)",
      probe: async () => ({
        ok: Boolean(process.env.GOOGLE_ADS_DEVELOPER_TOKEN?.trim()),
        latencyMs: 0,
        error: process.env.GOOGLE_ADS_DEVELOPER_TOKEN ? undefined : "GOOGLE_ADS_DEVELOPER_TOKEN unset",
      }),
      mode: "native_oauth",
      url: null,
    },
    {
      serviceId: "meta_native",
      label: "Meta Ads (native OAuth)",
      probe: async () => ({
        ok: Boolean(process.env.META_APP_ID?.trim()),
        latencyMs: 0,
        error: process.env.META_APP_ID ? undefined : "META_APP_ID unset",
      }),
      mode: "native_oauth",
      url: null,
    },
    {
      serviceId: "adkit_mcp",
      label: "adkit (Meta automation)",
      probe: async () => {
        const token = process.env.ADKIT_PROBE_TOKEN?.trim() || process.env.META_PROBE_ACCESS_TOKEN?.trim();
        const account = process.env.ADKIT_PROBE_ACCOUNT?.trim() || process.env.META_PROBE_AD_ACCOUNT_ID?.trim();
        if (!token || !account) {
          return {
            ok: false,
            latencyMs: 0,
            error: "ADKIT_PROBE_TOKEN + ADKIT_PROBE_ACCOUNT unset (optional health probe)",
          };
        }
        return probeAdkitMcp({
          META_ACCESS_TOKEN: token,
          META_AD_ACCOUNT_ID: account,
          ADKIT_ALLOW_SPEND: "0",
        });
      },
      mode: "adkit_stdio",
      url: adkitMcpCommand(),
    },
  ] as const;

  for (const s of services) {
    const probe = await s.probe();
    const status = probe.ok ? "ok" : "degradé";
    const row = {
      serviceId: s.serviceId,
      label: s.label,
      status,
      latency: probe.latencyMs,
      uptime: status === "ok" ? "99.9" : "95.0",
      errorRate: status === "degradé" ? "2.0" : "0",
      calls24h: 0,
      data: { url: s.url, mode: s.mode, error: probe.error ?? null },
      updatedAt: new Date(),
    };
    const existing = await db
      .select()
      .from(mcpStatusSnapshots)
      .where(eq(mcpStatusSnapshots.serviceId, s.serviceId))
      .limit(1);
    if (existing[0]) {
      await db.update(mcpStatusSnapshots).set(row).where(eq(mcpStatusSnapshots.serviceId, s.serviceId));
    } else {
      await db.insert(mcpStatusSnapshots).values({ id: `mcp_${s.serviceId}`, ...row });
    }
  }
}
