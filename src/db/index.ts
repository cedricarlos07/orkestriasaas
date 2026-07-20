import { config } from "dotenv";
import { neon } from "@neondatabase/serverless";
import { drizzle as drizzleNeon } from "drizzle-orm/neon-http";
import { drizzle as drizzlePostgres } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema/index";

config({ path: ".env.local" });
config({ path: ".env" });

const url = process.env.DATABASE_URL;
if (!url) {
  throw new Error("DATABASE_URL is not set");
}

const isNeonServerless =
  url.includes("neon.tech") || url.includes(".neon.database");

export const db = isNeonServerless
  ? drizzleNeon(neon(url), { schema })
  : drizzlePostgres(postgres(url), { schema });
