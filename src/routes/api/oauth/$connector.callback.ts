import { createFileRoute } from "@tanstack/react-router";
import { CONNECTORS, getBaseUrl, type ConnectorId } from "@/lib/oauth/connectors";
import {
  readReturnToCookie,
  returnToClearCookie,
  sanitizeReturnTo,
} from "@/lib/oauth/return-to";
import { handleOAuthCallback } from "@/lib/oauth/service";

const VALID = new Set(Object.keys(CONNECTORS));

function redirectWithClear(pathWithQuery: string) {
  const headers = new Headers();
  headers.set("Location", `${getBaseUrl()}${pathWithQuery}`);
  headers.append("Set-Cookie", returnToClearCookie());
  return new Response(null, { status: 302, headers });
}

export const Route = createFileRoute("/api/oauth/$connector/callback")({
  server: {
    handlers: {
      GET: async ({ request, params }: { request: Request; params: { connector: string } }) => {
        const connector = VALID.has(params.connector) ? (params.connector as ConnectorId) : null;
        if (!connector) return new Response("Unknown connector", { status: 404 });

        const destBase = sanitizeReturnTo(readReturnToCookie(request.headers.get("cookie")));
        const join = destBase.includes("?") ? "&" : "?";

        const url = new URL(request.url);
        const code = url.searchParams.get("code");
        const state = url.searchParams.get("state");
        const error = url.searchParams.get("error");

        if (error) {
          return redirectWithClear(`${destBase}${join}error=${encodeURIComponent(error)}`);
        }
        if (!code || !state) return new Response("Missing code or state", { status: 400 });

        try {
          await handleOAuthCallback(connector, code, state);
          return redirectWithClear(`${destBase}${join}connected=${connector}`);
        } catch (e) {
          const msg = e instanceof Error ? e.message : "OAuth failed";
          return redirectWithClear(`${destBase}${join}error=${encodeURIComponent(msg)}`);
        }
      },
    },
  },
});
