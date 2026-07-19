import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { organization, admin } from "better-auth/plugins";
import { tanstackStartCookies } from "better-auth/tanstack-start";
import { db } from "@/db";
import * as schema from "@/db/schema/index";
import { ac, adminRoles, orgAc, orgRoles } from "@/lib/auth/permissions";

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg",
    schema,
  }),
  emailAndPassword: {
    enabled: true,
  },
  user: {
    additionalFields: {
      activeOrganizationId: {
        type: "string",
        required: false,
      },
    },
  },
  plugins: [
    organization({
      ac: orgAc,
      roles: orgRoles,
      allowUserToCreateOrganization: true,
    }),
    admin({
      ac,
      roles: adminRoles,
    }),
    tanstackStartCookies(),
  ],
  trustedOrigins: [process.env.BETTER_AUTH_URL ?? "http://localhost:8080"],
  secret: process.env.BETTER_AUTH_SECRET,
  baseURL: process.env.BETTER_AUTH_URL ?? "http://localhost:8080",
});

export type Session = typeof auth.$Infer.Session;
