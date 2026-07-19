import { createFileRoute } from "@tanstack/react-router";
import { CONNECTORS, getBaseUrl, type ConnectorId } from "@/lib/oauth/connectors";
import { handleOAuthCallback } from "@/lib/oauth/service";

const VALID = new Set(Object.keys(CONNECTORS));

export const Route = createFileRoute("/api/oauth/$connector/callback")({
  server: {
    handlers: {
      GET: async ({ request, params }: { request: Request; params: { connector: string } }) => {
        const connector = VALID.has(params.connector) ? (params.connector as ConnectorId) : null;
        if (!connector) return new Response("Unknown connector", { status: 404 });

        const url = new URL(request.url);
        const code = url.searchParams.get("code");
        const state = url.searchParams.get("state");
        const error = url.searchParams.get("error");

        if (error) {
          return Response.redirect(`${getBaseUrl()}/app/connections?error=${encodeURIComponent(error)}`);
        }
        if (!code || !state) return new Response("Missing code or state", { status: 400 });

        try {
          await handleOAuthCallback(connector, code, state);
          return Response.redirect(`${getBaseUrl()}/app/connections?connected=${connector}`);
        } catch (e) {
          const msg = e instanceof Error ? e.message : "OAuth failed";
          return Response.redirect(`${getBaseUrl()}/app/connections?error=${encodeURIComponent(msg)}`);
        }
      },
    },
  },
});
