/**
 * Sync production secrets from .env.production.local to Openship project env.
 * Usage: fill .env.production.local then node scripts/sync-prod-env-to-openship.mjs
 *
 * Required keys for Meta-first prod:
 *   META_APP_ID, META_APP_SECRET, OPENAI_API_KEY
 * Optional: OPENAI_MODEL, MCP_WRITE_ENABLED
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");
const envPath = resolve(root, ".env.production.local");

const KEYS = [
  "META_APP_ID",
  "META_APP_SECRET",
  "META_PAGE_ID",
  "META_API_VERSION",
  "ADVERTISER_URL",
  "OPENAI_API_KEY",
  "OPENAI_MODEL",
  "MCP_WRITE_ENABLED",
  "USEPROXY_BEARER_TOKEN",
  "USEPROXY_API_KEY",
  "USEPROXY_MCP_URL",
  "ADKIT_MCP_COMMAND",
  "ADKIT_MCP_ARGS",
  "GEMINI_API_KEY",
  "ADLOOP_MCP_COMMAND",
  "ADLOOP_MCP_ARGS",
  "ADLOOP_CONFIG",
  "GOOGLE_ADS_CLIENT_ID",
  "GOOGLE_ADS_CLIENT_SECRET",
  "GOOGLE_ADS_DEVELOPER_TOKEN",
  "TIKTOK_APP_ID",
  "TIKTOK_APP_SECRET",
  "GOOGLE_ANALYTICS_CLIENT_ID",
  "GOOGLE_ANALYTICS_CLIENT_SECRET",
  "GOOGLE_CLIENT_ID",
  "GOOGLE_CLIENT_SECRET",
];

function parseEnv(content) {
  const out = {};
  for (const line of content.split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i === -1) continue;
    const k = t.slice(0, i).trim();
    let v = t.slice(i + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    out[k] = v;
  }
  return out;
}

if (!existsSync(envPath)) {
  console.error(`Missing ${envPath}`);
  console.error("Copy .env.example → .env.production.local and fill META_APP_* + OPENAI_API_KEY");
  process.exit(1);
}

const env = parseEnv(readFileSync(envPath, "utf8"));
const upserts = KEYS.filter((k) => env[k]?.trim()).map((k) => ({
  key: k,
  value: env[k].trim(),
  isSecret: /SECRET|KEY|TOKEN|PASSWORD|URL/i.test(k),
}));

if (!upserts.some((u) => u.key === "META_APP_ID")) {
  console.error("META_APP_ID required in .env.production.local");
  process.exit(1);
}

console.log(JSON.stringify({ projectId: "proj_B9pE6w3WyxEphAYA", upserts }, null, 2));
console.error("\nApply via Openship MCP: patch_projects_by_id_env with the upserts above.");
