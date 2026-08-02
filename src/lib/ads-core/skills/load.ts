/**
 * Load Advertising Hub skill markdown from ads-core/skills.
 */

import fs from "node:fs";
import path from "node:path";

function skillsRoot(): string {
  return path.join(process.cwd(), "src", "lib", "ads-core", "skills");
}

export function loadHubSkill(relativePath: string): string | null {
  const file = path.join(skillsRoot(), relativePath.replace(/\\/g, "/"));
  if (!fs.existsSync(file)) return null;
  return fs.readFileSync(file, "utf-8");
}

/** Excerpt for LLM system prompt (cap size). */
export function hubSkillExcerpt(relativePath: string, maxChars = 3500): string | null {
  const raw = loadHubSkill(relativePath);
  if (!raw) return null;
  // Drop YAML frontmatter for prompt cleanliness
  const body = raw.replace(/^---[\s\S]*?---\s*/, "").trim();
  return body.slice(0, maxChars);
}

export function listHubSkillFiles(): string[] {
  const root = skillsRoot();
  if (!fs.existsSync(root)) return [];
  const out: string[] = [];
  const walk = (dir: string, prefix = "") => {
    for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
      const rel = prefix ? `${prefix}/${ent.name}` : ent.name;
      if (ent.isDirectory()) walk(path.join(dir, ent.name), rel);
      else if (ent.name.endsWith(".md")) out.push(rel.replace(/\\/g, "/"));
    }
  };
  walk(root);
  return out.sort();
}
