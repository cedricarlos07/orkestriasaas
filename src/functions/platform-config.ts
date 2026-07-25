import { createServerFn } from "@tanstack/react-start";
import { CONNECTORS, hasOAuthCredentials, type ConnectorId } from "@/lib/oauth/connectors";
import { oauthCallbackUrl } from "@/lib/oauth/connectors";
import { isLlmConfigured } from "@/lib/llm/client";
import { isMailConfigured } from "@/lib/email/smtp";

export type ConnectorAvailability = {
  id: ConnectorId;
  label: string;
  configured: boolean;
  callbackUrl: string;
};

export const getOAuthAvailability = createServerFn({ method: "GET" }).handler(async () => {
  const connectors: ConnectorAvailability[] = (Object.keys(CONNECTORS) as ConnectorId[]).map((id) => ({
    id,
    label: CONNECTORS[id].label,
    configured: hasOAuthCredentials(id),
    callbackUrl: oauthCallbackUrl(id),
  }));

  return {
    connectors,
    openAiConfigured: isLlmConfigured(),
    googleLoginConfigured: Boolean(
      process.env.GOOGLE_CLIENT_ID?.trim() && process.env.GOOGLE_CLIENT_SECRET?.trim(),
    ),
    facebookLoginConfigured: Boolean(
      process.env.FACEBOOK_CLIENT_ID?.trim() && process.env.FACEBOOK_CLIENT_SECRET?.trim(),
    ),
    writeEnabled: process.env.MCP_WRITE_ENABLED === "true",
    adloopConfigured: process.env.ADLOOP_ENABLED !== "false",
    passwordResetConfigured: isMailConfigured(),
    useproxyConfigured: Boolean(process.env.META_APP_ID?.trim() && process.env.META_APP_SECRET?.trim()),
    useproxyUrl: "graph.facebook.com/ads_archive",
    adsLibraryConfigured: Boolean(process.env.META_APP_ID?.trim() && process.env.META_APP_SECRET?.trim()),
    adsLibraryUpstream: "meta_ads_archive",
    adkitCommand: process.env.ADKIT_MCP_COMMAND ?? "adkit-mcp",
    baseUrl: process.env.BETTER_AUTH_URL ?? "http://localhost:8080",
  };
});
