import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { commissionInvoices, organizationMetadata, subscriptions } from "@/db/schema/index";
import { STRIPE_CATALOG, STRIPE_PRICE_TO_PLAN } from "@/lib/stripe/catalog.generated";
import { appBaseUrl, getStripe } from "@/lib/stripe/client";
import type { PlanId } from "@/lib/pricing/plans";
import { ORKESTRIA_PLANS } from "@/lib/pricing/plans";
import {
  COMMISSION_CEILING_USD,
  COMMISSION_FLOOR_USD,
  COMMISSION_GRACE_SPEND_USD,
  COMMISSION_RATE,
  currentPeriod,
  getCommissionForOrg,
  previousPeriod,
} from "@/lib/billing/commission";
import { uid } from "@/functions/utils";
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

export async function listCommissionInvoices(orgId: string) {
  const rows = await db
    .select()
    .from(commissionInvoices)
    .where(eq(commissionInvoices.organizationId, orgId));
  return rows
    .sort((a, b) => b.period.localeCompare(a.period))
    .map((r) => ({
      id: r.id,
      period: r.period,
      spendUsd: Number(r.spendUsd),
      commissionUsd: Number(r.commissionUsd),
      status: r.status,
      stripeInvoiceId: r.stripeInvoiceId,
      hostedUrl: r.stripeHostedUrl,
    }));
}

export async function getCommissionBillingStatus(orgId: string) {
  const period = currentPeriod();
  const [commission, invoices, meta] = await Promise.all([
    getCommissionForOrg(orgId, period),
    listCommissionInvoices(orgId),
    db
      .select()
      .from(organizationMetadata)
      .where(eq(organizationMetadata.organizationId, orgId))
      .limit(1),
  ]);
  const openInvoice = invoices.find((i) => i.period === period && (i.status === "open" || i.status === "draft"));
  return {
    rate: COMMISSION_RATE,
    floorUsd: COMMISSION_FLOOR_USD,
    ceilingUsd: COMMISSION_CEILING_USD,
    graceSpendUsd: COMMISSION_GRACE_SPEND_USD,
    ...commission,
    period,
    openInvoice: openInvoice ?? null,
    invoices,
    writeBlocked: meta[0]?.writeBlocked ?? false,
    status: meta[0]?.status ?? "essai",
    configured: Boolean(process.env.STRIPE_SECRET_KEY?.trim()),
  };
}

/**
 * Create (or reuse) a Stripe Invoice for commission on a period.
 * Defaults to current month estimate; cron uses previousPeriod after month end.
 */
export async function createCommissionInvoice(opts: {
  orgId: string;
  email: string;
  name?: string;
  period?: string;
}): Promise<{ invoiceId: string; url: string | null; commissionUsd: number }> {
  const period = opts.period ?? currentPeriod();
  const commission = await getCommissionForOrg(opts.orgId, period);
  if (commission.commissionUsd <= 0) {
    throw new Error("Aucune commission à facturer pour cette période.");
  }

  const existing = await db
    .select()
    .from(commissionInvoices)
    .where(
      and(eq(commissionInvoices.organizationId, opts.orgId), eq(commissionInvoices.period, period)),
    )
    .limit(1);

  if (existing[0]?.stripeInvoiceId && existing[0].status === "paid") {
    throw new Error("Cette période est déjà payée.");
  }
  if (existing[0]?.stripeHostedUrl && existing[0].status === "open") {
    return {
      invoiceId: existing[0].stripeInvoiceId!,
      url: existing[0].stripeHostedUrl,
      commissionUsd: Number(existing[0].commissionUsd),
    };
  }

  const stripe = getStripe();
  const customerId = await ensureStripeCustomer({
    orgId: opts.orgId,
    email: opts.email,
    name: opts.name,
  });

  const amountCents = Math.round(commission.commissionUsd * 100);
  await stripe.invoiceItems.create({
    customer: customerId,
    amount: amountCents,
    currency: "usd",
    description: `Commission Orkestria ${Math.round(COMMISSION_RATE * 100)}% · ${period} (spend $${commission.monthSpendUsd.toFixed(2)})`,
    metadata: {
      organizationId: opts.orgId,
      kind: "commission",
      period,
    },
  });

  const invoice = await stripe.invoices.create({
    customer: customerId,
    auto_advance: true,
    collection_method: "send_invoice",
    days_until_due: 7,
    metadata: {
      organizationId: opts.orgId,
      kind: "commission",
      period,
    },
  });

  const finalized = await stripe.invoices.finalizeInvoice(invoice.id);
  const hostedUrl = finalized.hosted_invoice_url ?? null;

  const rowId = existing[0]?.id ?? uid("cominv");
  if (existing[0]) {
    await db
      .update(commissionInvoices)
      .set({
        spendUsd: String(commission.monthSpendUsd),
        commissionUsd: String(commission.commissionUsd),
        stripeInvoiceId: finalized.id,
        stripeHostedUrl: hostedUrl,
        status: finalized.status === "paid" ? "paid" : "open",
        updatedAt: new Date(),
      })
      .where(eq(commissionInvoices.id, existing[0].id));
  } else {
    await db.insert(commissionInvoices).values({
      id: rowId,
      organizationId: opts.orgId,
      period,
      spendUsd: String(commission.monthSpendUsd),
      commissionUsd: String(commission.commissionUsd),
      stripeInvoiceId: finalized.id,
      stripeHostedUrl: hostedUrl,
      status: finalized.status === "paid" ? "paid" : "open",
      updatedAt: new Date(),
    });
  }

  return {
    invoiceId: finalized.id,
    url: hostedUrl,
    commissionUsd: commission.commissionUsd,
  };
}

export async function applyCommissionInvoicePaid(invoice: Stripe.Invoice) {
  if (invoice.metadata?.kind !== "commission") return;
  const orgId = invoice.metadata.organizationId;
  const period = invoice.metadata.period;
  if (!orgId || !period) return;

  await db
    .update(commissionInvoices)
    .set({
      status: "paid",
      stripeInvoiceId: invoice.id,
      stripeHostedUrl: invoice.hosted_invoice_url ?? null,
      updatedAt: new Date(),
    })
    .where(
      and(eq(commissionInvoices.organizationId, orgId), eq(commissionInvoices.period, period)),
    );

  await db
    .update(organizationMetadata)
    .set({ status: "active", writeBlocked: false, updatedAt: new Date() })
    .where(eq(organizationMetadata.organizationId, orgId));
}

export async function applyCommissionInvoiceFailed(invoice: Stripe.Invoice) {
  if (invoice.metadata?.kind !== "commission") {
    // Legacy: any failed invoice without subscription still blocks (handled by caller for non-commission)
    return false;
  }
  const orgId = invoice.metadata.organizationId;
  if (!orgId) return true;

  const period = invoice.metadata.period;
  if (period) {
    await db
      .update(commissionInvoices)
      .set({ status: "open", updatedAt: new Date() })
      .where(
        and(eq(commissionInvoices.organizationId, orgId), eq(commissionInvoices.period, period)),
      );
  }

  await db
    .update(organizationMetadata)
    .set({ status: "impayée", writeBlocked: true, updatedAt: new Date() })
    .where(eq(organizationMetadata.organizationId, orgId));
  return true;
}

/** Bill previous calendar month for all orgs with commission > 0. */
export async function billAllOrgsPreviousMonth() {
  const period = previousPeriod();
  const orgs = await db.select({ organizationId: organizationMetadata.organizationId }).from(organizationMetadata);
  const results: { orgId: string; ok: boolean; error?: string; commissionUsd?: number }[] = [];

  for (const { organizationId: orgId } of orgs) {
    try {
      const commission = await getCommissionForOrg(orgId, period);
      if (commission.commissionUsd <= 0) {
        results.push({ orgId, ok: true, commissionUsd: 0 });
        continue;
      }
      const existing = await db
        .select()
        .from(commissionInvoices)
        .where(and(eq(commissionInvoices.organizationId, orgId), eq(commissionInvoices.period, period)))
        .limit(1);
      if (existing[0]?.status === "paid" || existing[0]?.status === "open") {
        results.push({ orgId, ok: true, commissionUsd: Number(existing[0].commissionUsd) });
        continue;
      }
      // Need an email — use Stripe customer or skip
      const meta = await db
        .select()
        .from(organizationMetadata)
        .where(eq(organizationMetadata.organizationId, orgId))
        .limit(1);
      const customerId = meta[0]?.stripeCustomerId;
      if (!customerId) {
        results.push({ orgId, ok: false, error: "no_stripe_customer" });
        continue;
      }
      const stripe = getStripe();
      const customer = await stripe.customers.retrieve(customerId);
      if (customer.deleted || !("email" in customer) || !customer.email) {
        results.push({ orgId, ok: false, error: "no_customer_email" });
        continue;
      }
      const created = await createCommissionInvoice({
        orgId,
        email: customer.email,
        name: customer.name ?? undefined,
        period,
      });
      results.push({ orgId, ok: true, commissionUsd: created.commissionUsd });
    } catch (e) {
      results.push({ orgId, ok: false, error: e instanceof Error ? e.message : String(e) });
    }
  }
  return { period, results };
}
