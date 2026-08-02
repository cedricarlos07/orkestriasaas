import { eq } from "drizzle-orm";
import { db } from "@/db";
import { mcpStatusSnapshots } from "@/db/schema/index";
import { probeMetaAdLibraryHealth } from "@/lib/platforms/meta-ad-library";
import { uid } from "@/functions/utils";

export async function probeMcpHealth(): Promise<void> {
  const services: {
    serviceId: string;
    label: string;
    probe: () => Promise<{ ok: boolean; latencyMs: number; error?: string }>;
    mode: string;
    url: string | null;
  }[] = [
    {
      serviceId: "meta_ad_library",
      label: "Meta Ad Library (ads_archive)",
      probe: () => probeMetaAdLibraryHealth(),
      mode: "meta_graph",
      url: "graph.facebook.com/ads_archive",
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
      serviceId: "mastra_memory",
      label: "Mastra Memory (Postgres)",
      probe: async () => ({
        ok: Boolean(process.env.DATABASE_URL?.trim()),
        latencyMs: 0,
        error: process.env.DATABASE_URL ? undefined : "DATABASE_URL unset",
      }),
      mode: "mastra_pg",
      url: null,
    },
  ];

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
      await db.insert(mcpStatusSnapshots).values({ id: uid("mcp"), ...row });
    }
  }
}
