import { createServerFn } from "@tanstack/react-start";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { chatMessages, chatThreads } from "@/db/schema/index";
import { ensureSession } from "@/lib/auth.functions";
import { getActiveOrgId } from "./context";
import { uid } from "./utils";

import { runOrchestrator } from "@/lib/mcp/orchestrator";
import { enforceQuotas, QuotaError, recordUsage } from "@/lib/quotas/enforce";

const WELCOME =
  "Bonjour 👋 Dites-moi ce que je peux faire pour vous aujourd'hui. Vous pouvez me demander un audit, un rapport, ou de lancer une campagne.";

export const listThreads = createServerFn({ method: "GET" }).handler(async () => {
  const session = await ensureSession();
  const orgId = await getActiveOrgId(session);
  const threads = await db
    .select()
    .from(chatThreads)
    .where(eq(chatThreads.organizationId, orgId))
    .orderBy(desc(chatThreads.updatedAt));
  const result = await Promise.all(
    threads.map(async (t) => {
      const messages = await db
        .select()
        .from(chatMessages)
        .where(eq(chatMessages.threadId, t.id))
        .orderBy(chatMessages.createdAt);
      return { ...t, messages };
    }),
  );
  return result;
});

export const createThread = createServerFn({ method: "POST" }).handler(async () => {
  const session = await ensureSession();
  const orgId = await getActiveOrgId(session);
  const now = new Date();
  const threadId = uid("th");
  const msgId = uid("msg");
  await db.insert(chatThreads).values({
    id: threadId,
    organizationId: orgId,
    userId: session.user.id,
    title: "Nouvelle conversation",
    createdAt: now,
    updatedAt: now,
  });
  await db.insert(chatMessages).values({
    id: msgId,
    threadId,
    role: "agent",
    text: WELCOME,
    createdAt: now,
  });
  return listThreads();
});

export const sendChatMessage = createServerFn({ method: "POST" })
  .inputValidator((data: { threadId: string; text: string }) => data)
  .handler(async ({ data }) => {
    const session = await ensureSession();
    const orgId = await getActiveOrgId(session);
    const threads = await db.select().from(chatThreads).where(eq(chatThreads.id, data.threadId)).limit(1);
    if (!threads[0] || threads[0].organizationId !== orgId) throw new Error("Not found");
    const now = new Date();
    await db.insert(chatMessages).values({
      id: uid("msg"),
      threadId: data.threadId,
      role: "user",
      text: data.text,
      createdAt: now,
    });

    try {
      await enforceQuotas({ orgId, kind: "llm_call", costUsd: 0.002 });
    } catch (e) {
      if (e instanceof QuotaError) throw e;
      throw e;
    }

    const orchestrated = await runOrchestrator({
      orgId,
      userId: session.user.id,
      message: data.text,
      skill: "analysis",
    });

    await recordUsage({
      orgId,
      kind: "llm_call",
      costUsd: 0.002,
      meta: { via: "chat", threadId: data.threadId },
    });

    await db.insert(chatMessages).values({
      id: uid("msg"),
      threadId: data.threadId,
      role: "agent",
      text: orchestrated.reply,
      tools: orchestrated.toolsUsed.map((name) => ({
        name,
        label: name.replace(/_/g, " "),
        status: "done" as const,
      })),
      createdAt: new Date(now.getTime() + 500),
    });
    await db.update(chatThreads).set({ updatedAt: new Date() }).where(eq(chatThreads.id, data.threadId));
    return listThreads();
  });

export const deleteThread = createServerFn({ method: "POST" })
  .inputValidator((data: { id: string }) => data)
  .handler(async ({ data }) => {
    const session = await ensureSession();
    const orgId = await getActiveOrgId(session);
    const threads = await db.select().from(chatThreads).where(eq(chatThreads.id, data.id)).limit(1);
    if (!threads[0] || threads[0].organizationId !== orgId) throw new Error("Not found");
    await db.delete(chatThreads).where(eq(chatThreads.id, data.id));
    return listThreads();
  });
