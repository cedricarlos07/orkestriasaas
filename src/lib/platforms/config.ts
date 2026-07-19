import type { ConnectorId } from "@/lib/oauth/connectors";
import { CONNECTORS, hasOAuthCredentials } from "@/lib/oauth/connectors";
import type { MCPServerId } from "@/lib/unified-ad-schema";
import { MCP_SERVER_ENV } from "@/lib/mcp/tool-registry";

export class PlatformConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PlatformConfigError";
  }
}

export function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v?.trim()) throw new PlatformConfigError(`Variable d'environnement requise : ${name}`);
  return v.trim();
}

export function requireOAuthCredentials(connector: ConnectorId): void {
  if (!hasOAuthCredentials(connector)) {
    const cfg = CONNECTORS[connector];
    throw new PlatformConfigError(
      `OAuth ${cfg.label} non configuré. Définissez ${cfg.oauth.clientIdEnv} et ${cfg.oauth.clientSecretEnv} dans .env.local`,
    );
  }
}

export function requireMcpOrDirectApi(server: MCPServerId): void {
  const envKey = MCP_SERVER_ENV[server];
  const mcpUrl = process.env[envKey];
  if (mcpUrl?.trim()) return;

  if (server === "google_ads_read" || server === "google_ads_write") {
    requireEnv("GOOGLE_ADS_DEVELOPER_TOKEN");
    return;
  }
  if (server === "meta_ads") return;
  if (server === "tiktok_ads") return;
  if (server === "ga4") return;

  throw new PlatformConfigError(`Aucune route API pour le serveur MCP ${server}`);
}

export function isWriteEnabled(): boolean {
  return process.env.MCP_WRITE_ENABLED === "true";
}

export function requireOpenAiKey(): string {
  return requireEnv("OPENAI_API_KEY");
}
