export interface LLMConfig {
  provider?: string;
  apiKey?: string;
  apiUrl?: string;
  modelName?: string;
  temperature?: number;
  reasoning?: boolean; // off by default — reasoning/thinking mode is the main latency source
}

const PROVIDER_DEFAULTS: Record<string, { url: string; model: string }> = {
  nvidia: {
    url: "https://integrate.api.nvidia.com/v1/chat/completions",
    // Fast non-reasoning default; switch to a deepseek model + reasoning flag for quality.
    model: "meta/llama-3.1-70b-instruct",
  },
  openrouter: {
    url: "https://openrouter.ai/api/v1/chat/completions",
    model: "meta-llama/llama-3.1-70b-instruct",
  },
  openai: { url: "https://api.openai.com/v1/chat/completions", model: "gpt-4o-mini" },
};

/** Provider defaults for any blank URL/model; a bare base URL gets the chat-completions path appended. */
export function resolveLlmEndpoint(provider: string, apiUrl: string, modelName: string) {
  const defaults = PROVIDER_DEFAULTS[provider] ?? PROVIDER_DEFAULTS.openai!;
  let url = apiUrl || defaults.url;
  if (!url.endsWith("/chat/completions")) url = url.replace(/\/$/, "") + "/chat/completions";
  return { provider, apiUrl: url, modelName: modelName || defaults.model };
}

/** One chat-completions round trip; resolves to the reply text ("" when empty), throws on a non-2xx status. */
export async function chatCompletion(opts: {
  provider: string;
  apiUrl: string;
  modelName: string;
  apiKey: string;
  systemPrompt: string;
  userPrompt: string;
  temperature: number;
  reasoning: boolean;
  jsonMode: boolean;
  timeoutMs: number;
}): Promise<string> {
  const { provider, reasoning } = opts;
  const response = await fetch(opts.apiUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${opts.apiKey}` },
    body: JSON.stringify({
      model: opts.modelName,
      messages: [
        { role: "system", content: opts.systemPrompt },
        { role: "user", content: opts.userPrompt },
      ],
      temperature: opts.temperature,
      max_tokens: reasoning ? 16384 : opts.jsonMode ? 2048 : 1024,
      ...(opts.jsonMode && provider !== "nvidia" && { response_format: { type: "json_object" } }),
      ...(reasoning &&
        provider === "nvidia" && {
          top_p: 0.95,
          chat_template_kwargs: { thinking: true, reasoning_effort: "high" },
        }),
    }),
    signal: AbortSignal.timeout(opts.timeoutMs),
  });
  if (!response.ok) throw new Error(`API response error status ${response.status}`);

  const data = await response.json();
  return data.choices?.[0]?.message?.content || "";
}
