export type LlmMessage = { role: "system" | "user" | "assistant"; content: string };

export type LlmChatOptions = {
  messages: LlmMessage[];
  maxTokens?: number;
  jsonMode?: boolean;
  /** When true, enable DeepSeek thinking mode (slower / costlier). Default: disabled. */
  thinking?: boolean;
};

function llmBaseUrl(): string {
  return (process.env.LLM_BASE_URL ?? "https://api.deepseek.com").replace(/\/$/, "");
}

function llmModel(thinking?: boolean): string {
  if (thinking) return process.env.LLM_MODEL_THINKING ?? process.env.LLM_MODEL ?? "deepseek-v4-flash";
  return process.env.LLM_MODEL ?? "deepseek-v4-flash";
}

export function requireLlmApiKey(): string {
  const key = process.env.DEEPSEEK_API_KEY?.trim() ?? process.env.LLM_API_KEY?.trim();
  if (!key) {
    throw new Error("Variable d'environnement requise : DEEPSEEK_API_KEY");
  }
  return key;
}

export function isLlmConfigured(): boolean {
  return Boolean(process.env.DEEPSEEK_API_KEY?.trim() ?? process.env.LLM_API_KEY?.trim());
}

/** OpenAI-compatible chat completions (DeepSeek API). */
export async function llmChatCompletion(opts: LlmChatOptions): Promise<string> {
  const apiKey = requireLlmApiKey();
  const body: Record<string, unknown> = {
    model: llmModel(opts.thinking),
    messages: opts.messages,
    max_tokens: opts.maxTokens ?? 800,
    // DeepSeek V4 defaults thinking=enabled; disable for fast chat/créas unless requested.
    thinking: { type: opts.thinking ? "enabled" : "disabled" },
  };
  if (opts.jsonMode) body.response_format = { type: "json_object" };

  const res = await fetch(`${llmBaseUrl()}/v1/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    throw new Error(`LLM API error: ${await res.text()}`);
  }

  const data = (await res.json()) as {
    choices?: { message?: { content?: string; reasoning_content?: string } }[];
  };
  const msg = data.choices?.[0]?.message;
  const text = (msg?.content ?? msg?.reasoning_content ?? "").trim();
  if (!text) throw new Error("Réponse LLM vide");
  return text;
}
