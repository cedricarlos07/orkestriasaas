import {
  addMem0Memory,
  isMem0Configured,
  probeMem0Health,
  searchMem0Memories,
  type Mem0Message,
} from "@/lib/mcp/clients/mem0";

export { isMem0Configured, probeMem0Health };

/** Semantic memories for prompt injection (never throws). */
export async function searchOrgMemories(orgId: string, query: string, limit = 5): Promise<string[]> {
  const hits = await searchMem0Memories(orgId, query, limit);
  return hits
    .map((h) => h.memory?.trim())
    .filter((m): m is string => Boolean(m));
}

/** Persist a chat turn without blocking the response path. */
export function persistChatTurn(
  orgId: string,
  userText: string,
  agentText: string,
  meta?: Record<string, unknown>,
): void {
  if (!isMem0Configured()) return;
  const messages: Mem0Message[] = [
    { role: "user", content: userText },
    { role: "assistant", content: agentText },
  ];
  void addMem0Memory(orgId, messages, meta);
}
