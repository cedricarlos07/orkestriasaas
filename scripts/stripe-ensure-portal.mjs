import Stripe from "stripe";

const key = process.env.STRIPE_SECRET_KEY?.trim();
if (!key) {
  console.error("Missing STRIPE_SECRET_KEY");
  process.exit(1);
}

const stripe = new Stripe(key, { apiVersion: "2026-06-24.dahlia" });
const list = await stripe.billingPortal.configurations.list({ limit: 5 });
if (list.data.length) {
  console.log("portal configs:", list.data.map((c) => c.id).join(", "));
  process.exit(0);
}

const created = await stripe.billingPortal.configurations.create({
  business_profile: { headline: "Orkestria — Facturation" },
  features: {
    customer_update: { enabled: true, allowed_updates: ["email", "address"] },
    invoice_history: { enabled: true },
    payment_method_update: { enabled: true },
    subscription_cancel: { enabled: true, mode: "at_period_end" },
  },
});
console.log("created portal config", created.id);
