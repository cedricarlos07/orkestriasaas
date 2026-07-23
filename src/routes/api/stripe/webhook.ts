import { createFileRoute } from "@tanstack/react-router";
import type Stripe from "stripe";
import { getStripe } from "@/lib/stripe/client";
import { applySubscriptionToOrg, markOrgCanceled } from "@/lib/stripe/billing";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { organizationMetadata } from "@/db/schema/index";

export const Route = createFileRoute("/api/stripe/webhook")({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        const secret = process.env.STRIPE_WEBHOOK_SECRET?.trim();
        if (!secret) {
          return json({ ok: false, error: "STRIPE_WEBHOOK_SECRET missing" }, 503);
        }

        const signature = request.headers.get("stripe-signature");
        if (!signature) return json({ ok: false, error: "missing signature" }, 400);

        const payload = await request.text();
        const stripe = getStripe();

        let event: Stripe.Event;
        try {
          event = stripe.webhooks.constructEvent(payload, signature, secret);
        } catch (err) {
          const msg = err instanceof Error ? err.message : "invalid signature";
          console.error("[stripe.webhook] signature", msg);
          return json({ ok: false, error: msg }, 400);
        }

        try {
          switch (event.type) {
            case "checkout.session.completed": {
              const session = event.data.object as Stripe.Checkout.Session;
              if (session.mode === "subscription" && session.subscription) {
                const subId =
                  typeof session.subscription === "string"
                    ? session.subscription
                    : session.subscription.id;
                const sub = await stripe.subscriptions.retrieve(subId);
                if (session.metadata?.organizationId && !sub.metadata?.organizationId) {
                  await stripe.subscriptions.update(subId, {
                    metadata: {
                      ...sub.metadata,
                      organizationId: session.metadata.organizationId,
                      planId: session.metadata.planId ?? "",
                      interval: session.metadata.interval ?? "month",
                    },
                  });
                }
                const fresh = await stripe.subscriptions.retrieve(subId);
                await applySubscriptionToOrg(fresh);
              }
              break;
            }
            case "customer.subscription.created":
            case "customer.subscription.updated": {
              await applySubscriptionToOrg(event.data.object as Stripe.Subscription);
              break;
            }
            case "customer.subscription.deleted": {
              const sub = event.data.object as Stripe.Subscription;
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
              if (orgId) await markOrgCanceled(orgId);
              break;
            }
            case "invoice.payment_failed": {
              const invoice = event.data.object as Stripe.Invoice;
              const customerId =
                typeof invoice.customer === "string" ? invoice.customer : invoice.customer?.id;
              if (customerId) {
                const rows = await db
                  .select()
                  .from(organizationMetadata)
                  .where(eq(organizationMetadata.stripeCustomerId, customerId))
                  .limit(1);
                if (rows[0]) {
                  await db
                    .update(organizationMetadata)
                    .set({ status: "impayée", writeBlocked: true, updatedAt: new Date() })
                    .where(eq(organizationMetadata.organizationId, rows[0].organizationId));
                }
              }
              break;
            }
            case "invoice.paid": {
              const invoice = event.data.object as Stripe.Invoice & {
                subscription?: string | { id: string } | null;
              };
              const subRef = invoice.subscription;
              if (subRef) {
                const subId = typeof subRef === "string" ? subRef : subRef.id;
                const sub = await stripe.subscriptions.retrieve(subId);
                await applySubscriptionToOrg(sub);
              }
              break;
            }
            default:
              break;
          }
        } catch (e) {
          console.error("[stripe.webhook] handler", e);
          return json(
            { ok: false, error: e instanceof Error ? e.message : "handler error" },
            500,
          );
        }

        return json({ ok: true, received: true });
      },
    },
  },
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
