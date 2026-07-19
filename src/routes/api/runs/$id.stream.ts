import { createFileRoute } from "@tanstack/react-router";
import { eq, gt, and } from "drizzle-orm";
import { db } from "@/db";
import { agentRuns, runEvents, member } from "@/db/schema/index";
import { auth } from "@/lib/auth";

async function verifyRunAccess(request: Request, runId: string) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return null;
  const runs = await db.select().from(agentRuns).where(eq(agentRuns.id, runId)).limit(1);
  if (!runs[0]) return null;
  const members = await db.select().from(member).where(eq(member.userId, session.user.id));
  if (!members.some((m) => m.organizationId === runs[0].organizationId)) return null;
  return { session, run: runs[0] };
}

export const Route = createFileRoute("/api/runs/$id/stream")({
  server: {
    handlers: {
      GET: async ({ request, params }: { request: Request; params: { id: string } }) => {
        const access = await verifyRunAccess(request, params.id);
        if (!access) return new Response("Unauthorized", { status: 401 });

        const encoder = new TextEncoder();
        const stream = new ReadableStream({
          async start(controller) {
            let lastTs = new Date(0);
            const sendEvents = async (events: typeof runEvents.$inferSelect[]) => {
              for (const ev of events) {
                const payload = ev.payload as Record<string, unknown>;
                controller.enqueue(
                  encoder.encode(
                    `data: ${JSON.stringify({ type: ev.type, ...payload, ts: ev.createdAt.getTime() })}\n\n`,
                  ),
                );
                lastTs = ev.createdAt;
              }
            };

            const initial = await db
              .select()
              .from(runEvents)
              .where(eq(runEvents.runId, params.id))
              .orderBy(runEvents.createdAt);
            await sendEvents(initial);

            let polls = 0;
            const maxPolls = 120;
            while (polls < maxPolls) {
              await new Promise((r) => setTimeout(r, 500));
              polls += 1;
              const run = await db.select().from(agentRuns).where(eq(agentRuns.id, params.id)).limit(1);
              if (!run[0]) break;

              const newEvents = await db
                .select()
                .from(runEvents)
                .where(and(eq(runEvents.runId, params.id), gt(runEvents.createdAt, lastTs)))
                .orderBy(runEvents.createdAt);
              if (newEvents.length) await sendEvents(newEvents);

              if (run[0].state === "completed" || run[0].state === "failed" || run[0].state === "cancelled") {
                controller.enqueue(
                  encoder.encode(`data: ${JSON.stringify({ type: "run.completed", ts: Date.now() })}\n\n`),
                );
                break;
              }
            }
            controller.close();
          },
        });

        return new Response(stream, {
          headers: {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache",
            Connection: "keep-alive",
          },
        });
      },
    },
  },
});
