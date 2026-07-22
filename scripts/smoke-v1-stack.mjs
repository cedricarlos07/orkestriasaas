/**
 * Smoke checks for V1 stack configuration (no external network required for env checks).
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

const env = { ...process.env, ...loadEnvFile(resolve(root, ".env.local")), ...loadEnvFile(resolve(root, ".env.production.local")) };

ok("META_APP_ID", Boolean(env.META_APP_ID?.trim()), env.META_APP_ID ? "set" : "missing");
ok("USEPROXY_MCP_URL", (env.USEPROXY_MCP_URL ?? "https://mcp.useproxy.dev/mcp").includes("useproxy.dev"), env.USEPROXY_MCP_URL ?? "default useproxy.dev");
ok("USEPROXY_API_KEY", Boolean(env.USEPROXY_API_KEY?.trim()), env.USEPROXY_API_KEY ? "set" : "missing — research disabled until key received");
ok("ADKIT_MCP_COMMAND", Boolean((env.ADKIT_MCP_COMMAND ?? "adkit-mcp").trim()), env.ADKIT_MCP_COMMAND ?? "adkit-mcp (default)");
ok("Dockerfile has meta-adkit", readFileSync(resolve(root, "Dockerfile"), "utf8").includes("meta-adkit"), "pip install meta-adkit[mcp]");

const dockerOpenship = resolve(root, "Dockerfile.openship");
if (existsSync(dockerOpenship)) {
  ok("Dockerfile.openship has meta-adkit", readFileSync(dockerOpenship, "utf8").includes("meta-adkit"), "pip install meta-adkit[mcp]");
}

const failed = checks.filter((c) => !c.pass);
console.log("\n=== Orkestria V1 stack smoke ===\n");
for (const c of checks) {
  console.log(`${c.pass ? "✓" : "✗"} ${c.name}: ${c.detail}`);
}
console.log(`\n${checks.length - failed.length}/${checks.length} passed`);
if (failed.length) {
  console.error("\nFix missing items before prod deploy. Run: node scripts/sync-prod-env-to-openship.mjs after filling .env.production.local");
  process.exit(1);
}
