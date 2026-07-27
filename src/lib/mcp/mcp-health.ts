import { eq } from "drizzle-orm";
import { db } from "@/db";
import { mcpStatusSnapshots } from "@/db/schema/index";
import {
  isPipeboardConfigured,
  probePipeboardMcp,
  PIPEBOARD_URLS,
  type PipeboardServer,
} from "@/mastra/pipeboard-mcp";
import { probeMetaAdLibraryHealth } from "@/lib/platforms/meta-ad-library";
import { uid } from "@/functions/utils";

const PIPEBOARD_LABELS: Record<PipeboardServer, string> = {
  "meta-ads": "Meta Ads",
  "google-ads": "Google Ads",
  "tiktok-ads": "TikTok Ads",
  "snap-ads": "Snap Ads",
  "reddit-ads": "Reddit Ads",
};

export async function probeMcpHealth(): Promise<void> {
  const pipeboardProbe = isPipeboardConfigured()
    ? await probePipeboardMcp()
    : { ok: false, error: "PIPEBOARD_API_TOKEN unset", servers: undefined };

  const services: {
    serviceId: string;
    label: string;
    probe: () => Promise<{ ok: boolean; latencyMs: number; error?: string }>;
    mode: string;
    url: string | null;
  }[] = [
    ...(Object.keys(PIPEBOARD_URLS) as PipeboardServer[]).map((server) => ({
      serviceId: `pipeboard_${server.replace(/-/g, "_")}`,
      label: PIPEBOARD_LABELS[server],
      probe: async () => {
        if (!isPipeboardConfigured()) {
          return { ok: false, latencyMs: 0, error: "PIPEBOARD_API_TOKEN unset" };
        }
        const status = pipeboardProbe.servers?.[server] ?? pipeboardProbe.error ?? "unknown";
        return {
          ok: status.startsWith("ok"),
          latencyMs: 0,
          error: status.startsWith("ok") ? undefined : status,
        };
      },
      mode: "pipeboard_http",
      url: PIPEBOARD_URLS[server],
    })),
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
