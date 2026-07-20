import { createServerFn } from "@tanstack/react-start";
import { CONNECTORS, hasOAuthCredentials, type ConnectorId } from "@/lib/oauth/connectors";
import { oauthCallbackUrl } from "@/lib/oauth/connectors";

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
    openAiConfigured: Boolean(process.env.OPENAI_API_KEY?.trim()),
    googleLoginConfigured: Boolean(
      process.env.GOOGLE_CLIENT_ID?.trim() && process.env.GOOGLE_CLIENT_SECRET?.trim(),
    ),
    writeEnabled: process.env.MCP_WRITE_ENABLED === "true",
    adkitConfigured: Boolean(process.env.ADKIT_API_KEY?.trim()),
    baseUrl: process.env.BETTER_AUTH_URL ?? "http://localhost:8080",
  };
});
