import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { organization, admin, emailOTP } from "better-auth/plugins";
import { tanstackStartCookies } from "better-auth/tanstack-start";
import { db } from "@/db";
import * as schema from "@/db/schema/index";
import { ac, adminRoles, orgAc, orgRoles } from "@/lib/auth/permissions";
import {
  isMailConfigured,
  sendOtpEmail,
  sendPasswordResetEmail,
  sendVerificationLinkEmail,
} from "@/lib/email/smtp";

const baseURL = process.env.BETTER_AUTH_URL ?? "http://localhost:8080";

const extraOrigins = (process.env.BETTER_AUTH_TRUSTED_ORIGINS ?? "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

const googleClientId = process.env.GOOGLE_CLIENT_ID?.trim();
const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim();
const facebookClientId = process.env.FACEBOOK_CLIENT_ID?.trim();
const facebookClientSecret = process.env.FACEBOOK_CLIENT_SECRET?.trim();

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg",
    schema,
  }),
  socialProviders: {
    ...(googleClientId && googleClientSecret
      ? {
          google: {
            clientId: googleClientId,
            clientSecret: googleClientSecret,
          },
        }
      : {}),
    ...(facebookClientId && facebookClientSecret
      ? {
          facebook: {
            clientId: facebookClientId,
            clientSecret: facebookClientSecret,
          },
        }
      : {}),
  },
  emailAndPassword: {
    enabled: true,
    // Keep false so existing accounts stay usable; OTP is still sent on sign-up.
    requireEmailVerification: false,
    sendResetPassword: async ({ user, url }) => {
      if (!isMailConfigured()) {
        console.error("[auth] reset password skipped — Resend not configured");
        throw new Error(
          "La réinitialisation par e-mail n'est pas encore disponible. Contactez hello@orkestria.top.",
        );
      }
      const result = await sendPasswordResetEmail({
        to: user.email,
        name: user.name,
        url,
      });
      if (!result.ok) {
        console.error("[auth] reset password email failed:", result.reason);
        throw new Error("Impossible d'envoyer l'e-mail de réinitialisation. Réessayez plus tard ou contactez le support.");
      }
    },
  },
  emailVerification: {
    sendOnSignUp: true,
    autoSignInAfterVerification: true,
    // Fallback link mail if OTP override is off; with emailOTP override this becomes OTP.
    sendVerificationEmail: async ({ user, url }) => {
      if (!isMailConfigured()) {
        console.error("[auth] verification email skipped — Resend not configured");
        return;
      }
      const result = await sendVerificationLinkEmail({
        to: user.email,
        name: user.name,
        url,
      });
      if (!result.ok) {
        console.error("[auth] verification email failed:", result.reason);
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
  // Second layer behind the Postgres-backed IP limiter in routes/api/auth/$.ts.
  // `storage: "database"` keeps counters across restarts and workers.
  rateLimit: {
    enabled: true,
    storage: "database",
    window: 60,
    max: 100,
    customRules: {
      "/sign-in/email": { window: 300, max: 10 },
      "/sign-up/email": { window: 3600, max: 5 },
      "/forget-password": { window: 3600, max: 5 },
      "/reset-password": { window: 3600, max: 5 },
      "/email-otp/verify-email": { window: 600, max: 8 },
      "/email-otp/send-verification-otp": { window: 3600, max: 8 },
      "/sign-in/email-otp": { window: 600, max: 8 },
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
    // Caddy terminates TLS. Use its single-value X-Real-IP (not the spoofable XFF chain).
    ipAddress: {
      ipAddressHeaders: ["x-real-ip"],
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
    emailOTP({
      otpLength: 6,
      expiresIn: 600,
      sendVerificationOnSignUp: true,
      // Prefer OTP over magic link for email verification.
      overrideDefaultEmailVerification: true,
      sendVerificationOTP: async ({ email, otp, type }) => {
        if (!isMailConfigured()) {
          console.error("[auth] OTP skipped — Resend not configured");
          return;
        }
        const result = await sendOtpEmail({ to: email, otp, type });
        if (!result.ok) {
          console.error("[auth] OTP email failed:", result.reason);
          throw new Error("Impossible d'envoyer le code. Réessayez plus tard.");
        }
      },
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
