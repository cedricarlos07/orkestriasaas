import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { organization, admin } from "better-auth/plugins";
import { tanstackStartCookies } from "better-auth/tanstack-start";
import { db } from "@/db";
import * as schema from "@/db/schema/index";
import { ac, adminRoles, orgAc, orgRoles } from "@/lib/auth/permissions";
import { sendPasswordResetEmail } from "@/lib/email/smtp";

const baseURL = process.env.BETTER_AUTH_URL ?? "http://localhost:8080";

const extraOrigins = (process.env.BETTER_AUTH_TRUSTED_ORIGINS ?? "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg",
    schema,
  }),
  emailAndPassword: {
    enabled: true,
    sendResetPassword: async ({ user, url }) => {
      const result = await sendPasswordResetEmail({
        to: user.email,
        name: user.name,
        url,
      });
      if (!result.ok) {
        console.error("[auth] reset password email failed:", result.reason);
        throw new Error("Impossible d'envoyer l'e-mail de réinitialisation.");
      }
    },
  },
  user: {
    additionalFields: {
      activeOrganizationId: {
        type: "string",
        required: false,
      },
    },
  },
  session: {
    // Keep users signed in across landing ↔ app navigation.
    expiresIn: 60 * 60 * 24 * 30, // 30 days
    updateAge: 60 * 60 * 12, // refresh expiry every 12h of activity
    cookieCache: {
      enabled: true,
      maxAge: 5 * 60, // 5 min client cache — fewer DB hits, no false logouts
    },
  },
  advanced: {
    useSecureCookies: baseURL.startsWith("https"),
    defaultCookieAttributes: {
      sameSite: "lax",
      path: "/",
      httpOnly: true,
      secure: baseURL.startsWith("https"),
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
  trustedOrigins: [
    baseURL,
    "https://orkestria.top",
    "https://www.orkestria.top",
    ...extraOrigins,
  ],
  secret: process.env.BETTER_AUTH_SECRET,
  baseURL,
});

export type Session = typeof auth.$Infer.Session;
