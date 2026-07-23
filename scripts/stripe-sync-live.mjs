/**
 * Create Orkestria Stripe live Products + Prices + Webhook endpoint.
 *
 * Usage:
 *   STRIPE_SECRET_KEY=rk_live_... node scripts/stripe-sync-live.mjs
 *
 * Writes src/lib/stripe/catalog.generated.ts (price IDs — safe to commit).
 * Prints webhook signing secret once (store as STRIPE_WEBHOOK_SECRET).
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import Stripe from "stripe";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");
const key = process.env.STRIPE_SECRET_KEY?.trim();
if (!key) {
  console.error("Missing STRIPE_SECRET_KEY");
  process.exit(1);
}

const stripe = new Stripe(key, { apiVersion: "2025-02-24.acacia" });
const WEBHOOK_URL = process.env.STRIPE_WEBHOOK_URL ?? "https://orkestria.top/api/stripe/webhook";

const PLANS = [
  { id: "solo", name: "Orkestria Solo", monthly: 2900, yearly: 29000 },
  { id: "business", name: "Orkestria Business", monthly: 8900, yearly: 89000 },
  { id: "growth", name: "Orkestria Growth", monthly: 14900, yearly: 149000 },
  { id: "autopilot", name: "Orkestria Autopilot", monthly: 24900, yearly: 249000 },
  { id: "agency_start", name: "Orkestria Agency Start", monthly: 12900, yearly: 129000 },
  { id: "agency_growth", name: "Orkestria Agency Growth", monthly: 29900, yearly: 299000 },
  { id: "agency_scale", name: "Orkestria Agency Scale", monthly: 59900, yearly: 599000 },
  { id: "enterprise", name: "Orkestria Enterprise", monthly: 99900, yearly: 999000 },
];

async function findProductByPlanId(planId) {
  const list = await stripe.products.search({
    query: `metadata['orkestria_plan']:'${planId}' AND active:'true'`,
    limit: 1,
  });
  return list.data[0] ?? null;
}

async function ensureProduct(plan) {
  let product = await findProductByPlanId(plan.id);
  if (product) {
    product = await stripe.products.update(product.id, {
      name: plan.name,
      metadata: { orkestria_plan: plan.id },
    });
    console.log(`product update ${plan.id} → ${product.id}`);
  } else {
    product = await stripe.products.create({
      name: plan.name,
      metadata: { orkestria_plan: plan.id },
    });
    console.log(`product create ${plan.id} → ${product.id}`);
  }
  return product;
}

async function ensurePrice(productId, planId, interval, unitAmount) {
  const existing = await stripe.prices.list({ product: productId, active: true, limit: 100 });
  const match = existing.data.find(
    (p) =>
      p.recurring?.interval === interval &&
      p.unit_amount === unitAmount &&
      p.currency === "usd" &&
      p.metadata?.orkestria_plan === planId,
  );
  if (match) {
    console.log(`price reuse ${planId}/${interval} → ${match.id}`);
    return match;
  }
  // Deactivate old interval prices for this plan so checkout uses the new amount
  for (const p of existing.data) {
    if (p.recurring?.interval === interval && p.metadata?.orkestria_plan === planId) {
      await stripe.prices.update(p.id, { active: false });
    }
  }
  const created = await stripe.prices.create({
    product: productId,
    currency: "usd",
    unit_amount: unitAmount,
    recurring: { interval },
    metadata: { orkestria_plan: planId, interval },
  });
  console.log(`price create ${planId}/${interval} → ${created.id} ($${unitAmount / 100})`);
  return created;
}

async function ensureWebhook() {
  const events = [
    "checkout.session.completed",
    "customer.subscription.created",
    "customer.subscription.updated",
    "customer.subscription.deleted",
    "invoice.paid",
    "invoice.payment_failed",
  ];
  const existing = await stripe.webhookEndpoints.list({ limit: 100 });
  let endpoint = existing.data.find((w) => w.url === WEBHOOK_URL);
  if (endpoint) {
    endpoint = await stripe.webhookEndpoints.update(endpoint.id, {
      enabled_events: events,
      description: "Orkestria live billing",
    });
    console.log(`webhook update → ${endpoint.id} (${WEBHOOK_URL})`);
    console.log("NOTE: webhook secret only shown at creation. Keep existing STRIPE_WEBHOOK_SECRET or recreate endpoint.");
    return { endpoint, secret: null };
  }
  endpoint = await stripe.webhookEndpoints.create({
    url: WEBHOOK_URL,
    enabled_events: events,
    description: "Orkestria live billing",
  });
  console.log(`webhook create → ${endpoint.id}`);
  console.log(`STRIPE_WEBHOOK_SECRET=${endpoint.secret}`);
  return { endpoint, secret: endpoint.secret };
}

const catalog = {};
for (const plan of PLANS) {
  const product = await ensureProduct(plan);
  const monthly = await ensurePrice(product.id, plan.id, "month", plan.monthly);
  const yearly = await ensurePrice(product.id, plan.id, "year", plan.yearly);
  catalog[plan.id] = {
    productId: product.id,
    monthlyPriceId: monthly.id,
    yearlyPriceId: yearly.id,
    monthlyCents: plan.monthly,
    yearlyCents: plan.yearly,
  };
}

const { secret: webhookSecret } = await ensureWebhook();

const outPath = resolve(root, "src/lib/stripe/catalog.generated.ts");
mkdirSync(dirname(outPath), { recursive: true });
const body = `/* AUTO-GENERATED by scripts/stripe-sync-live.mjs — do not edit by hand */
export type StripeCatalogEntry = {
  productId: string;
  monthlyPriceId: string;
  yearlyPriceId: string;
  monthlyCents: number;
  yearlyCents: number;
};

export const STRIPE_CATALOG = ${JSON.stringify(catalog, null, 2)} as const satisfies Record<string, StripeCatalogEntry>;

export const STRIPE_PRICE_TO_PLAN: Record<string, { planId: string; interval: "month" | "year" }> = {
${Object.entries(catalog)
  .flatMap(([planId, c]) => [
    `  "${c.monthlyPriceId}": { planId: "${planId}", interval: "month" },`,
    `  "${c.yearlyPriceId}": { planId: "${planId}", interval: "year" },`,
  ])
  .join("\n")}
};
`;
writeFileSync(outPath, body, "utf8");
console.log(`wrote ${outPath}`);

if (webhookSecret) {
  writeFileSync(
    resolve(root, "scripts/.stripe-webhook-secret.tmp"),
    webhookSecret + "\n",
    "utf8",
  );
  console.log("wrote scripts/.stripe-webhook-secret.tmp (gitignored via *.tmp)");
}

console.log("DONE");
