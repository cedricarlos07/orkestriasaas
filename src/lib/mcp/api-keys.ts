import { createHash, randomBytes } from "node:crypto";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { apiKeys } from "@/db/schema/index";
import { uid } from "@/functions/utils";

export type ApiKeyScope = "read" | "write" | "admin";

export type ApiKeyContext = {
  keyId: string;
  organizationId: string;
  userId: string | null;
  name: string;
  scopes: ApiKeyScope[];
};

function hashKey(key: string): string {
  return createHash("sha256").update(key).digest("hex");
}

export function generateApiKey(): { key: string; prefix: string; keyHash: string } {
  const raw = randomBytes(24).toString("base64url");
  const key = `ork_${raw}`;
  return { key, prefix: `${key.slice(0, 12)}…`, keyHash: hashKey(key) };
}

export async function createApiKey(opts: {
  organizationId: string;
  userId: string;
  name: string;
  scopes: ApiKeyScope[];
}): Promise<{ id: string; key: string; prefix: string }> {
  const { key, prefix, keyHash } = generateApiKey();
  const id = uid("key");
  await db.insert(apiKeys).values({
    id,
    organizationId: opts.organizationId,
    userId: opts.userId,
    name: opts.name,
    prefix,
    keyHash,
    scopes: opts.scopes,
    createdAt: new Date(),
  });
  return { id, key, prefix };
}

export async function revokeApiKey(organizationId: string, keyId: string): Promise<void> {
  const rows = await db.select().from(apiKeys).where(eq(apiKeys.id, keyId)).limit(1);
  if (!rows[0] || rows[0].organizationId !== organizationId) throw new Error("Clé introuvable");
  await db.update(apiKeys).set({ revokedAt: new Date() }).where(eq(apiKeys.id, keyId));
}

export async function listApiKeys(organizationId: string) {
  return db.select().from(apiKeys).where(eq(apiKeys.organizationId, organizationId));
}

export async function authenticateApiKey(bearer: string | null): Promise<ApiKeyContext> {
  const key = bearer?.replace(/^Bearer\s+/i, "").trim();
  if (!key || !key.startsWith("ork_")) {
    throw new ApiAuthError("Clé API manquante ou invalide. En-tête attendu : Authorization: Bearer ork_...");
  }
  const rows = await db
    .select()
    .from(apiKeys)
    .where(and(eq(apiKeys.keyHash, hashKey(key)), isNull(apiKeys.revokedAt)))
    .limit(1);
  const row = rows[0];
  if (!row) throw new ApiAuthError("Clé API inconnue ou révoquée");

  void db.update(apiKeys).set({ lastUsedAt: new Date() }).where(eq(apiKeys.id, row.id)).catch(() => {});

  return {
    keyId: row.id,
    organizationId: row.organizationId,
    userId: row.userId,
    name: row.name,
    scopes: (row.scopes as ApiKeyScope[]) ?? ["read"],
  };
}

export class ApiAuthError extends Error {
  status = 401;
}

export function requireScope(ctx: ApiKeyContext, scope: ApiKeyScope): void {
  if (ctx.scopes.includes("admin")) return;
  if (!ctx.scopes.includes(scope)) {
    const err = new ApiAuthError(`Cette clé n'a pas le scope « ${scope} »`);
    err.status = 403;
    throw err;
  }
}
