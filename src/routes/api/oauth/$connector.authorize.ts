import { createFileRoute } from "@tanstack/react-router";
import { CONNECTORS, getBaseUrl, type ConnectorId } from "@/lib/oauth/connectors";
import { getAuthorizeRedirectAsync } from "@/lib/oauth/service";
import { returnToSetCookie, sanitizeReturnTo } from "@/lib/oauth/return-to";
import { auth } from "@/lib/auth";
import { getActiveOrgId } from "@/functions/context";

const VALID = new Set(Object.keys(CONNECTORS));

export const Route = createFileRoute("/api/oauth/$connector/authorize")({
  server: {
    handlers: {
      GET: async ({ request, params }: { request: Request; params: { connector: string } }) => {
        const connector = VALID.has(params.connector) ? (params.connector as ConnectorId) : null;
        if (!connector) return new Response("Unknown connector", { status: 404 });

        const session = await auth.api.getSession({ headers: request.headers });
        if (!session) {
          return Response.redirect(`${getBaseUrl()}/auth?redirect=${encodeURIComponent(request.url)}`);
        }

        const reqUrl = new URL(request.url);
        const returnTo = sanitizeReturnTo(reqUrl.searchParams.get("returnTo"));

        const orgId = await getActiveOrgId(session);
        const url = await getAuthorizeRedirectAsync(connector, orgId, session.user.id);

        const headers = new Headers();
        headers.set("Location", url);
        headers.append("Set-Cookie", returnToSetCookie(returnTo));
        return new Response(null, { status: 302, headers });
      },
    },
  },
});
