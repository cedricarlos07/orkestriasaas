import fs from "node:fs";
import path from "node:path";

export type MediaBuyingSkill = {
  id: string;
  name: string;
  platform: string;
  category: string;
  description: string;
  whenToUse: string;
  /** Condensed SOP for LLM system prompt */
  promptExcerpt: string;
  /** Full markdown for run_skill */
  fullMarkdown: string;
};

let cache: MediaBuyingSkill[] | null = null;

function skillsRepoRoot(): string {
  const env = process.env.SKILLS_REPO_PATH?.trim();
  if (env && fs.existsSync(env)) return env;
  const candidates = [
    path.join(process.cwd(), "_vendor", "ai-media-buying-skills"),
    path.join(process.cwd(), "..", "_vendor", "ai-media-buying-skills"),
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  return candidates[0]!;
}

function walkSkillFiles(dir: string, acc: string[] = []): string[] {
  if (!fs.existsSync(dir)) return acc;
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) walkSkillFiles(full, acc);
    else if (ent.name === "SKILL.md") acc.push(full);
  }
  return acc;
}

function section(md: string, heading: string): string {
  const re = new RegExp(`## ${heading}[\\s\\S]*?(?=\\n## |$)`, "i");
  const m = md.match(re);
  return m ? m[0].replace(/^##[^\n]*\n?/, "").trim() : "";
}

function parseSkillFile(filePath: string, root: string): MediaBuyingSkill | null {
  const raw = fs.readFileSync(filePath, "utf-8");
  const rel = path.relative(root, path.dirname(filePath)).replace(/\\/g, "/");
  const id = `mb/${rel}`;
  const titleMatch = raw.match(/^#\s+(.+)$/m);
  const name = titleMatch?.[1]?.trim() ?? rel.split("/").pop() ?? id;
  const platform = raw.match(/\*\*Platform:\*\*\s*(.+)/i)?.[1]?.trim() ?? "Unknown";
  const category = raw.match(/\*\*Category:\*\*\s*(.+)/i)?.[1]?.trim() ?? "general";
  const purpose = section(raw, "Purpose");
  const whenToUse = section(raw, "When to Use");
  const workflow = section(raw, "Analysis Workflow");
  const guardrails = section(raw, "Guardrails");
  const promptExcerpt = [
    purpose && `Purpose: ${purpose.slice(0, 400)}`,
    workflow && `Workflow:\n${workflow.slice(0, 900)}`,
    guardrails && `Guardrails: ${guardrails.slice(0, 300)}`,
  ]
    .filter(Boolean)
    .join("\n\n")
    .slice(0, 1200);

  return {
    id,
    name,
    platform,
    category,
    description: purpose.slice(0, 200) || whenToUse.slice(0, 200) || name,
    whenToUse,
    promptExcerpt,
    fullMarkdown: raw,
  };
}

export function loadMediaBuyingSkills(): MediaBuyingSkill[] {
  if (cache) return cache;
  const root = skillsRepoRoot();
  const files = walkSkillFiles(root);
  cache = files
    .map((f) => parseSkillFile(f, root))
    .filter((s): s is MediaBuyingSkill => s !== null)
    .sort((a, b) => a.id.localeCompare(b.id));
  return cache;
}

export function getMediaBuyingSkill(id: string): MediaBuyingSkill | undefined {
  const normalized = id.startsWith("mb/") ? id : `mb/${id}`;
  return loadMediaBuyingSkills().find((s) => s.id === normalized || s.id.endsWith(`/${id}`));
}

export function listMediaBuyingSkills(): MediaBuyingSkill[] {
  return loadMediaBuyingSkills();
}

/** Invalidate cache after deploy (tests / hot reload). */
export function resetMediaBuyingSkillsCache(): void {
  cache = null;
}
