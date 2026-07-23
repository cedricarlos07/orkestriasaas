import { createServerFn } from "@tanstack/react-start";
import { ensureSession } from "@/lib/auth.functions";
import { getActiveOrgId } from "@/functions/context";
import {
  createBillingPortalSession,
  createCheckoutSession,
  getOrgBilling,
} from "@/lib/stripe/billing";
import type { PlanId } from "@/lib/pricing/plans";
import { isStripeConfigured } from "@/lib/stripe/client";
import { getQuotaStatus } from "@/lib/quotas/enforce";

export const getBillingStatus = createServerFn({ method: "GET" }).handler(async () => {
  const session = await ensureSession();
  const orgId = await getActiveOrgId(session);
  const [billing, quotas] = await Promise.all([getOrgBilling(orgId), getQuotaStatus(orgId)]);
  return { ...billing, quotas };
});

export const getUsageQuotas = createServerFn({ method: "GET" }).handler(async () => {
  const session = await ensureSession();
  const orgId = await getActiveOrgId(session);
  return getQuotaStatus(orgId);
});

export const startCheckout = createServerFn({ method: "POST" })
  .inputValidator((data: { planId: PlanId; interval: "month" | "year" }) => data)
  .handler(async ({ data }) => {
    if (!isStripeConfigured()) throw new Error("Stripe non configuré");
    const session = await ensureSession();
    const orgId = await getActiveOrgId(session);
    const url = await createCheckoutSession({
      orgId,
      email: session.user.email,
      name: session.user.name ?? undefined,
      planId: data.planId,
      interval: data.interval,
    });
    return { url };
  });

export const openBillingPortal = createServerFn({ method: "POST" }).handler(async () => {
  if (!isStripeConfigured()) throw new Error("Stripe non configuré");
  const session = await ensureSession();
  const orgId = await getActiveOrgId(session);
  const url = await createBillingPortalSession(orgId);
  return { url };
});
