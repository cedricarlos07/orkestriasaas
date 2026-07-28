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
  "Bonjour. Je peux auditer vos pubs, faire un rapport, préparer une campagne Meta en pause, joindre une image, ou sponsoriser un post de votre Page. Par quoi on commence ?";

const MAX_ATTACHMENT_CHARS = 3_500_000; // ~2.5MB binary as base64 data URL

export type ChatImageAttachment = {
  kind: "image";
  dataUrl?: string;
  url?: string;
  name?: string;
};

function threadTitle(text: string): string {
  const clean = text.trim().replace(/\s+/g, " ");
  if (!clean) return "Nouvelle conversation";
  return clean.length > 48 ? `${clean.slice(0, 48)}…` : clean;
}

function sanitizeAttachments(raw: ChatImageAttachment[] | undefined): ChatImageAttachment[] {
  if (!raw?.length) return [];
  return raw
    .filter((a) => a.kind === "image" && (a.dataUrl || a.url))
    .slice(0, 3)
    .map((a) => {
      if (a.dataUrl && a.dataUrl.length > MAX_ATTACHMENT_CHARS) {
        throw new Error("Image trop lourde (max ~2,5 Mo). Compressez-la ou envoyez une URL.");
      }
      if (a.dataUrl && !/^data:image\/(png|jpe?g|webp|gif);base64,/i.test(a.dataUrl)) {
        throw new Error("Format image non supporté (PNG, JPEG, WebP, GIF).");
      }
      return {
        kind: "image" as const,
        dataUrl: a.dataUrl,
        url: a.url?.startsWith("https://") ? a.url : undefined,
        name: a.name?.slice(0, 80),
      };
    });
}

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
  .inputValidator(
    (data: { threadId: string; text: string; attachments?: ChatImageAttachment[] }) => data,
  )
  .handler(async ({ data }) => {
    const session = await ensureSession();
    const orgId = await getActiveOrgId(session);
    const threads = await db.select().from(chatThreads).where(eq(chatThreads.id, data.threadId)).limit(1);
    if (!threads[0] || threads[0].organizationId !== orgId) throw new Error("Not found");

    const attachments = sanitizeAttachments(data.attachments);
    const previous = await db
      .select()
      .from(chatMessages)
      .where(eq(chatMessages.threadId, data.threadId))
      .orderBy(chatMessages.createdAt);
    const history = previous
      .filter((m) => m.text !== WELCOME)
      .slice(-10)
      .map((m) => ({ role: m.role === "user" ? ("user" as const) : ("agent" as const), text: m.text }));

    const now = new Date();
    const userText =
      attachments.length > 0
        ? `${data.text.trim() || "Voici une image pour la campagne."}\n\n[image jointe ×${attachments.length}]`
        : data.text;
    await db.insert(chatMessages).values({
      id: uid("msg"),
      threadId: data.threadId,
      role: "user",
      text: userText,
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
      history,
      threadId: data.threadId,
      attachments,
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
      tools: {
        calls: orchestrated.toolsUsed.map((name) => ({
          name,
          label: name.replace(/_/g, " "),
          status: "done" as const,
        })),
        suggestions: orchestrated.suggestions ?? [],
      },
      createdAt: new Date(now.getTime() + 500),
    });

    const isFirstUserMessage = !previous.some((m) => m.role === "user");
    const title =
      isFirstUserMessage || threads[0].title === "Nouvelle conversation"
        ? threadTitle(data.text || "Image campagne")
        : threads[0].title;
    await db
      .update(chatThreads)
      .set({ updatedAt: new Date(), title })
      .where(eq(chatThreads.id, data.threadId));
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
