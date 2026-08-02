/**
 * Platform registry — loads Advertising Hub PLATFORM.yaml (+ Orkestria TikTok stub).
 * Source: https://github.com/itallstartedwithaidea/advertising-hub (MIT)
 */

import fs from "node:fs";
import path from "node:path";

export type PlatformSlug = "meta-ads" | "google-ads" | "tiktok-ads" | "linkedin-ads" | string;

export type PlatformCapabilities = {
  campaign_management?: boolean;
  audience_targeting?: boolean;
  conversion_tracking?: boolean;
  reporting_api?: boolean;
  bulk_operations?: boolean;
  creative_upload?: boolean;
  offline_conversions?: boolean;
  conversions_api?: boolean;
  catalog_ads?: boolean;
  advantage_plus?: boolean;
  enhanced_conversions?: boolean;
  customer_match?: boolean;
  [key: string]: boolean | undefined;
};

export type PlatformConfig = {
  name: string;
  slug: string;
  category?: string;
  status?: string;
  api?: {
    base_url?: string;
    current_version?: string;
    auth_type?: string;
    scopes?: string[];
    documentation?: string;
  };
  agents?: string[];
  capabilities?: PlatformCapabilities;
  our_tools?: Array<{ name?: string; status?: string; repo?: string }>;
};

const PRIORITY_V1: PlatformSlug[] = ["meta-ads", "google-ads", "tiktok-ads"];

function registryDir(): string {
  return path.join(process.cwd(), "src", "lib", "ads-core", "registry");
}

/** Minimal YAML subset parser for Hub PLATFORM.yaml. */
export function parseSimpleYaml(raw: string): Record<string, unknown> {
  const root: Record<string, unknown> = {};
  const stack: Array<{ indent: number; obj: Record<string, unknown> }> = [{ indent: -1, obj: root }];
  let listKey: string | null = null;
  let listIndent = -1;
  const OBJECT_KEYS = new Set(["api", "login", "capabilities", "rate_limits", "documentation"]);

  for (const line of raw.split(/\r?\n/)) {
    if (!line.trim() || line.trim().startsWith("#")) continue;
    const indent = line.match(/^ */)?.[0].length ?? 0;
    const trimmed = line.trim();

    while (stack.length > 1 && indent <= stack[stack.length - 1]!.indent) {
      stack.pop();
    }
    if (listKey && indent <= listIndent) {
      listKey = null;
      listIndent = -1;
    }
    const parent = stack[stack.length - 1]!.obj;

    if (trimmed.startsWith("- ")) {
      const item = trimmed.slice(2).trim();
      const key = listKey;
      if (!key) continue;
      const existing = parent[key];
      const arr = Array.isArray(existing) ? existing : [];
      if (!Array.isArray(existing)) parent[key] = arr;
      if (item.includes(":") && !/^https?:/.test(item)) {
        const [k, ...rest] = item.split(":");
        arr.push({ [k!.trim()]: rest.join(":").trim().replace(/^["']|["']$/g, "") });
      } else {
        arr.push(item.replace(/^["']|["']$/g, ""));
      }
      continue;
    }

    const colon = trimmed.indexOf(":");
    if (colon < 0) continue;
    const key = trimmed.slice(0, colon).trim();
    let value: unknown = trimmed.slice(colon + 1).trim();

    if (value === "") {
      if (OBJECT_KEYS.has(key)) {
        listKey = null;
        const child: Record<string, unknown> = {};
        parent[key] = child;
        stack.push({ indent, obj: child });
      } else {
        parent[key] = [];
        listKey = key;
        listIndent = indent;
      }
      continue;
    }

    listKey = null;
    if (value === "true") value = true;
    else if (value === "false") value = false;
    else if (value === "[]") value = [];
    else if (typeof value === "string" && /^".*"$/.test(value)) value = value.slice(1, -1);
    else if (typeof value === "string" && /^\[.*\]$/.test(value)) {
      value = value
        .slice(1, -1)
        .split(",")
        .map((s) => s.trim().replace(/^["']|["']$/g, ""))
        .filter(Boolean);
    } else if (typeof value === "string" && /^\d+(\.\d+)?$/.test(value)) {
      value = Number(value);
    }
    parent[key] = value;
  }
  return root;
}

export function loadPlatformConfig(slug: PlatformSlug): PlatformConfig | null {
  const file = path.join(registryDir(), `${slug}.yaml`);
  if (!fs.existsSync(file)) return null;
  const raw = fs.readFileSync(file, "utf-8");
  const data = parseSimpleYaml(raw) as PlatformConfig;
  if (!data.slug) data.slug = String(slug);
  return data;
}

export function listRegisteredPlatforms(): PlatformConfig[] {
  const dir = registryDir();
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".yaml") && !f.startsWith("mcp-"))
    .map((f) => loadPlatformConfig(f.replace(/\.yaml$/, "")))
    .filter((p): p is PlatformConfig => Boolean(p?.slug));
}

export function listV1Platforms(): PlatformConfig[] {
  return PRIORITY_V1.map((s) => loadPlatformConfig(s)).filter((p): p is PlatformConfig => Boolean(p));
}

export function platformHasCapability(slug: PlatformSlug, capability: string): boolean {
  const cfg = loadPlatformConfig(slug);
  return Boolean(cfg?.capabilities?.[capability]);
}

/** Map Orkestria connector id → Hub platform slug */
export function connectorToHubSlug(
  connector: string,
): "meta-ads" | "google-ads" | "tiktok-ads" | "linkedin-ads" | null {
  const map: Record<string, "meta-ads" | "google-ads" | "tiktok-ads" | "linkedin-ads"> = {
    meta_ads: "meta-ads",
    google_ads: "google-ads",
    tiktok_ads: "tiktok-ads",
    linkedin_ads: "linkedin-ads",
  };
  return map[connector] ?? null;
}
