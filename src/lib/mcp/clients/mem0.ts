/** Self-hosted Mem0 REST client (server/main.py). */

export type Mem0Message = { role: "user" | "assistant"; content: string };

export type Mem0MemoryHit = {
  id?: string;
  memory?: string;
  score?: number;
};

function mem0BaseUrl(): string {
  return (process.env.MEM0_API_URL ?? "http://127.0.0.1:8888").replace(/\/$/, "");
}

function mem0ApiKey(): string | null {
  const key = process.env.MEM0_API_KEY?.trim();
  return key || null;
}

export function isMem0Configured(): boolean {
  if (process.env.MEM0_ENABLED === "false") return false;
  return Boolean(mem0ApiKey());
}

async function mem0Fetch(
  path: string,
  init: RequestInit & { timeoutMs?: number } = {},
): Promise<Response> {
  const key = mem0ApiKey();
  if (!key) throw new Error("MEM0_API_KEY unset");

  const { timeoutMs = 5000, ...rest } = init;
  const headers = new Headers(rest.headers);
  headers.set("X-API-Key", key);
  if (!headers.has("Content-Type") && rest.body) headers.set("Content-Type", "application/json");

  return fetch(`${mem0BaseUrl()}${path}`, {
    ...rest,
    headers,
    signal: AbortSignal.timeout(timeoutMs),
  });
}

export async function probeMem0Health(): Promise<{ ok: boolean; latencyMs: number; error?: string }> {
  const start = Date.now();
  if (!isMem0Configured()) {
    return { ok: false, latencyMs: 0, error: "MEM0_API_KEY unset or MEM0_ENABLED=false" };
  }
  try {
    const res = await mem0Fetch("/configure", { method: "GET", timeoutMs: 3000 });
    if (!res.ok) {
      return { ok: false, latencyMs: Date.now() - start, error: `HTTP ${res.status}` };
    }
    return { ok: true, latencyMs: Date.now() - start };
  } catch (e) {
    return {
      ok: false,
      latencyMs: Date.now() - start,
      error: e instanceof Error ? e.message : "Mem0 unreachable",
    };
  }
}

export async function searchMem0Memories(
  orgId: string,
  query: string,
  topK = 5,
): Promise<Mem0MemoryHit[]> {
  if (!isMem0Configured() || !query.trim()) return [];
  try {
    const res = await mem0Fetch("/search", {
      method: "POST",
      timeoutMs: 2000,
      body: JSON.stringify({
        query,
        filters: { user_id: orgId },
        top_k: topK,
      }),
    });
    if (!res.ok) return [];
    const data = (await res.json()) as { results?: Mem0MemoryHit[] } | Mem0MemoryHit[];
    if (Array.isArray(data)) return data;
    return data.results ?? [];
  } catch {
    return [];
  }
}

export async function addMem0Memory(
  orgId: string,
  messages: Mem0Message[],
  metadata?: Record<string, unknown>,
): Promise<void> {
  if (!isMem0Configured() || messages.length === 0) return;
  try {
    await mem0Fetch("/memories", {
      method: "POST",
      timeoutMs: 8000,
      body: JSON.stringify({
        messages,
        user_id: orgId,
        metadata: metadata ?? { source: "orkestria_chat" },
        infer: true,
      }),
    });
  } catch {
    /* fire-and-forget */
  }
}
