import { config } from "dotenv";

config({ path: ".env.local" });
config({ path: ".env" });

export function uid(prefix = "") {
  const id = crypto.randomUUID();
  return prefix ? `${prefix}_${id}` : id;
}

export function shortId() {
  return Math.random().toString(36).slice(2, 10);
}
