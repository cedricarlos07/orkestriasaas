/**
 * Smoke checks for native Meta + Google stack (no Pipeboard / AdLoop / AdKit).
 * Usage: node scripts/smoke-v1-stack.mjs
 */
import { existsSync, readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

const checks = [];

function ok(name, pass, detail) {
  checks.push({ name, pass, detail });
}

function loadEnvFile(path) {
  if (!existsSync(path)) return {};
  const out = {};
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i === -1) continue;
    out[t.slice(0, i).trim()] = t.slice(i + 1).trim();
  }
  return out;
}

const env = {
  ...process.env,
  ...loadEnvFile(resolve(root, ".env")),
  ...loadEnvFile(resolve(root, ".env.local")),
  ...loadEnvFile(resolve(root, ".env.production.local")),
};

ok("META_APP_ID", Boolean(env.META_APP_ID?.trim()), env.META_APP_ID ? "set" : "missing");
ok("META_APP_SECRET", Boolean(env.META_APP_SECRET?.trim()), env.META_APP_SECRET ? "set" : "missing");
ok(
  "GOOGLE_ADS_DEVELOPER_TOKEN",
  Boolean(env.GOOGLE_ADS_DEVELOPER_TOKEN?.trim()),
  env.GOOGLE_ADS_DEVELOPER_TOKEN ? "set" : "missing (required for Google writes)",
);
ok("DEEPSEEK_API_KEY or LLM_API_KEY", Boolean((env.DEEPSEEK_API_KEY || env.LLM_API_KEY)?.trim()), "LLM key");
ok("DATABASE_URL", Boolean(env.DATABASE_URL?.trim()), env.DATABASE_URL ? "set" : "missing");
ok("MCP_WRITE_ENABLED", env.MCP_WRITE_ENABLED === "true" || env.MCP_WRITE_ENABLED === "false", env.MCP_WRITE_ENABLED ?? "unset");
ok("No PIPEBOARD_API_TOKEN", !env.PIPEBOARD_API_TOKEN?.trim(), "Pipeboard removed");
ok("No ADLOOP_MCP_COMMAND", !env.ADLOOP_MCP_COMMAND?.trim(), "AdLoop removed");
ok("No ADKIT_MCP_COMMAND", !env.ADKIT_MCP_COMMAND?.trim(), "AdKit removed");

ok("meta-api.ts", existsSync(resolve(root, "src/lib/platforms/meta-api.ts")), "native Meta");
ok("google-ads-api.ts", existsSync(resolve(root, "src/lib/platforms/google-ads-api.ts")), "native Google");
ok("No pipeboard-mcp.ts", !existsSync(resolve(root, "src/mastra/pipeboard-mcp.ts")), "removed");

const failed = checks.filter((c) => !c.pass);
console.log("\n=== Orkestria native stack smoke ===\n");
for (const c of checks) {
  console.log(`${c.pass ? "✓" : "✗"} ${c.name}: ${c.detail}`);
}
console.log(`\n${checks.length - failed.length}/${checks.length} passed`);
if (failed.length) {
  console.error("\nFix missing items before prod deploy.");
  process.exit(1);
}
