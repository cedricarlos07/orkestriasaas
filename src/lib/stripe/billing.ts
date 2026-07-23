import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { organizationMetadata, subscriptions } from "@/db/schema/index";
import { STRIPE_CATALOG, STRIPE_PRICE_TO_PLAN } from "@/lib/stripe/catalog.generated";
import { appBaseUrl, getStripe } from "@/lib/stripe/client";
import type { PlanId } from "@/lib/pricing/plans";
import { ORKESTRIA_PLANS } from "@/lib/pricing/plans";
import type Stripe from "stripe";

export function resolvePriceId(planId: PlanId, interval: "month" | "year"): string {
  const entry = STRIPE_CATALOG[planId as keyof typeof STRIPE_CATALOG];
  if (!entry) throw new Error(`Plan Stripe inconnu : ${planId}`);
  return interval === "year" ? entry.yearlyPriceId : entry.monthlyPriceId;
}

export async function ensureStripeCustomer(opts: {
  orgId: string;
  email: string;
  name?: string;
}): Promise<string> {
  const stripe = getStripe();
  const meta = await db
    .select()
    .from(organizationMetadata)
    .where(eq(organizationMetadata.organizationId, opts.orgId))
    .limit(1);
  const existing = meta[0]?.stripeCustomerId;
  if (existing) return existing;

  const customer = await stripe.customers.create({
    email: opts.email,
    name: opts.name,
    metadata: { organizationId: opts.orgId },
  });

  if (meta[0]) {
    await db
      .update(organizationMetadata)
      .set({ stripeCustomerId: customer.id, updatedAt: new Date() })
      .where(eq(organizationMetadata.organizationId, opts.orgId));
  } else {
    await db.insert(organizationMetadata).values({
      organizationId: opts.orgId,
      stripeCustomerId: customer.id,
      planId: "solo",
      status: "essai",
      currency: "USD",
      updatedAt: new Date(),
    });
  }
  return customer.id;
}

export async function createCheckoutSession(opts: {
  orgId: string;
  email: string;
  name?: string;
  planId: PlanId;
  interval: "month" | "year";
}): Promise<string> {
  const stripe = getStripe();
  const priceId = resolvePriceId(opts.planId, opts.interval);
  const customerId = await ensureStripeCustomer({
    orgId: opts.orgId,
    email: opts.email,
    name: opts.name,
  });
  const base = appBaseUrl();
  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${base}/app/settings?billing=success`,
    cancel_url: `${base}/app/settings?billing=cancel`,
    allow_promotion_codes: true,
    client_reference_id: opts.orgId,
    metadata: {
      organizationId: opts.orgId,
      planId: opts.planId,
      interval: opts.interval,
    },
    subscription_data: {
      metadata: {
        organizationId: opts.orgId,
        planId: opts.planId,
        interval: opts.interval,
      },
    },
  });
  if (!session.url) throw new Error("Stripe Checkout sans URL");
  return session.url;
}

export async function createBillingPortalSession(orgId: string): Promise<string> {
  const stripe = getStripe();
  const meta = await db
    .select()
    .from(organizationMetadata)
    .where(eq(organizationMetadata.organizationId, orgId))
    .limit(1);
  const customerId = meta[0]?.stripeCustomerId;
  if (!customerId) throw new Error("Aucun client Stripe pour cette organisation");
  const session = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: `${appBaseUrl()}/app/settings?billing=portal`,
  });
  return session.url;
}

export async function getOrgBilling(orgId: string) {
  const meta = await db
    .select()
    .from(organizationMetadata)
    .where(eq(organizationMetadata.organizationId, orgId))
    .limit(1);
  const m = meta[0];
  const planId = (m?.planId ?? "solo") as PlanId;
  const plan = ORKESTRIA_PLANS.find((p) => p.id === planId);
  return {
    planId,
    planName: plan?.name ?? planId,
    status: m?.status ?? "essai",
    stripeCustomerId: m?.stripeCustomerId ?? null,
    stripeSubscriptionId: m?.stripeSubscriptionId ?? null,
    stripePriceId: m?.stripePriceId ?? null,
    billingInterval: (m?.billingInterval as "month" | "year" | null) ?? null,
    writeBlocked: m?.writeBlocked ?? false,
    configured: Boolean(process.env.STRIPE_SECRET_KEY?.trim()),
    publishableKey: process.env.STRIPE_PUBLISHABLE_KEY?.trim() ?? "",
    catalog: ORKESTRIA_PLANS.map((p) => ({
      id: p.id,
      name: p.name,
      audience: p.audience,
      priceMonthlyCents: p.priceMonthlyCents,
      priceYearlyCents: p.priceYearlyCents,
      stripe: STRIPE_CATALOG[p.id as keyof typeof STRIPE_CATALOG] ?? null,
    })),
  };
}

async function upsertSubscriptionRow(opts: {
  orgId: string;
  planId: PlanId;
  status: string;
  renewsAt?: Date | null;
  stripeCustomerId?: string | null;
  stripeSubscriptionId?: string | null;
  stripePriceId?: string | null;
  billingInterval?: string | null;
}) {
  const existing = await db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.organizationId, opts.orgId))
    .limit(1);
  if (existing[0]) {
    await db
      .update(subscriptions)
      .set({
        planId: opts.planId,
        status: opts.status,
        renewsAt: opts.renewsAt ?? null,
        stripeCustomerId: opts.stripeCustomerId ?? existing[0].stripeCustomerId,
        stripeSubscriptionId: opts.stripeSubscriptionId ?? existing[0].stripeSubscriptionId,
        stripePriceId: opts.stripePriceId ?? existing[0].stripePriceId,
        billingInterval: opts.billingInterval ?? existing[0].billingInterval,
      })
      .where(eq(subscriptions.id, existing[0].id));
  } else {
    await db.insert(subscriptions).values({
      id: `sub_${opts.orgId}`,
      organizationId: opts.orgId,
      planId: opts.planId,
      status: opts.status,
      renewsAt: opts.renewsAt ?? null,
      stripeCustomerId: opts.stripeCustomerId ?? null,
      stripeSubscriptionId: opts.stripeSubscriptionId ?? null,
      stripePriceId: opts.stripePriceId ?? null,
      billingInterval: opts.billingInterval ?? null,
    });
  }
}

export async function applySubscriptionToOrg(sub: Stripe.Subscription) {
  const orgId =
    sub.metadata?.organizationId ||
    (typeof sub.customer === "string"
      ? (
          await db
            .select()
            .from(organizationMetadata)
            .where(eq(organizationMetadata.stripeCustomerId, sub.customer))
            .limit(1)
        )[0]?.organizationId
      : undefined);
  if (!orgId) {
    console.warn("[stripe] subscription without organizationId", sub.id);
    return;
  }

  const priceId = sub.items.data[0]?.price?.id;
  const mapped = priceId ? STRIPE_PRICE_TO_PLAN[priceId] : null;
  const planId = (mapped?.planId ?? sub.metadata?.planId ?? "solo") as PlanId;
  const interval = mapped?.interval ?? (sub.metadata?.interval as "month" | "year" | undefined) ?? "month";
  const status = sub.status === "active" || sub.status === "trialing" ? "active" : sub.status;
  const writeBlocked = ["past_due", "unpaid", "canceled", "incomplete_expired"].includes(sub.status);
  const periodEnd =
    (sub as Stripe.Subscription & { current_period_end?: number }).current_period_end ??
    sub.items?.data?.[0]?.current_period_end;
  const renewsAt = periodEnd ? new Date(periodEnd * 1000) : null;
  const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer?.id;

  const meta = await db
    .select()
    .from(organizationMetadata)
    .where(eq(organizationMetadata.organizationId, orgId))
    .limit(1);

  const patch = {
    planId,
    status,
    stripeCustomerId: customerId ?? null,
    stripeSubscriptionId: sub.id,
    stripePriceId: priceId ?? null,
    billingInterval: interval,
    writeBlocked,
    autopilot: planId === "autopilot" || planId === "agency_scale" || planId === "enterprise",
    updatedAt: new Date(),
  };

  if (meta[0]) {
    await db.update(organizationMetadata).set(patch).where(eq(organizationMetadata.organizationId, orgId));
  } else {
    await db.insert(organizationMetadata).values({ organizationId: orgId, ...patch });
  }

  await upsertSubscriptionRow({
    orgId,
    planId,
    status,
    renewsAt,
    stripeCustomerId: customerId,
    stripeSubscriptionId: sub.id,
    stripePriceId: priceId,
    billingInterval: interval,
  });
}

export async function markOrgCanceled(orgId: string) {
  await db
    .update(organizationMetadata)
    .set({
      status: "suspendue",
      writeBlocked: true,
      stripeSubscriptionId: null,
      updatedAt: new Date(),
    })
    .where(eq(organizationMetadata.organizationId, orgId));
  await db
    .update(subscriptions)
    .set({ status: "canceled", renewsAt: null })
    .where(and(eq(subscriptions.organizationId, orgId)));
}
