import { createServerFn } from "@tanstack/react-start";
import { ensureSession } from "@/lib/auth.functions";
import { getActiveOrgId } from "@/functions/context";
import {
  createBillingPortalSession,
  createCheckoutSession,
  createCommissionInvoice,
  getCommissionBillingStatus,
  getOrgBilling,
} from "@/lib/stripe/billing";
import type { PlanId } from "@/lib/pricing/plans";
import { isStripeConfigured } from "@/lib/stripe/client";
import { getQuotaStatus } from "@/lib/quotas/enforce";
import { syncOrgAdSpend } from "@/lib/billing/spend-sync";

export const getBillingStatus = createServerFn({ method: "GET" }).handler(async () => {
  const session = await ensureSession();
  const orgId = await getActiveOrgId(session);
  // Best-effort refresh so commission card is not empty.
  void syncOrgAdSpend(orgId).catch(() => undefined);
  const [billing, quotas, commission] = await Promise.all([
    getOrgBilling(orgId),
    getQuotaStatus(orgId),
    getCommissionBillingStatus(orgId),
  ]);
  return { ...billing, quotas, commission };
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

export const payCommission = createServerFn({ method: "POST" }).handler(async () => {
  if (!isStripeConfigured()) throw new Error("Stripe non configuré");
  const session = await ensureSession();
  const orgId = await getActiveOrgId(session);
  await syncOrgAdSpend(orgId).catch(() => undefined);
  const result = await createCommissionInvoice({
    orgId,
    email: session.user.email,
    name: session.user.name ?? undefined,
  });
  return result;
});
