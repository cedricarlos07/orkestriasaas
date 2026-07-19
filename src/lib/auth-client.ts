import { createAuthClient } from "better-auth/react";
import { organizationClient, adminClient } from "better-auth/client/plugins";
import { orgAc, orgRoles, ac, adminRoles } from "@/lib/auth/permissions";

export const authClient = createAuthClient({
  baseURL: typeof window !== "undefined" ? window.location.origin : (import.meta.env.VITE_BETTER_AUTH_URL ?? "http://localhost:8080"),
  plugins: [
    organizationClient({ ac: orgAc, roles: orgRoles }),
    adminClient({ ac, roles: adminRoles }),
  ],
});

export type AuthClient = typeof authClient;
