import { db } from "~/server/db";

export interface LLMConfig {
  provider?: string;
  apiKey?: string;
  apiUrl?: string;
  modelName?: string;
  temperature?: number;
  reasoning?: boolean; // off by default — reasoning/thinking mode is the main latency source
}

export async function getLLMConfig(): Promise<LLMConfig | null> {
  // Try loading from database first
  try {
    const configs = await db.systemConfig.findMany({
      where: {
        key: {
          in: [
            "sports:llm:provider",
            "sports:llm:apiKey",
            "sports:llm:apiUrl",
            "sports:llm:modelName",
            "sports:llm:temperature",
            "sports:llm:applyGlobally",
            "narrator:llm:provider",
            "narrator:llm:apiKey",
            "narrator:llm:apiUrl",
            "narrator:llm:modelName",
            "narrator:llm:temperature",
            "narrator:llm:reasoning",
          ],
        },
      },
    });

    // Check narrator-specific keys first, then fall back to sports keys
    const apiKey =
      configs.find((c) => c.key === "narrator:llm:apiKey")?.value ||
      configs.find((c) => c.key === "sports:llm:apiKey")?.value;

    if (apiKey) {
      const provider =
        configs.find((c) => c.key === "narrator:llm:provider")?.value ||
        configs.find((c) => c.key === "sports:llm:provider")?.value;
      const apiUrl =
        configs.find((c) => c.key === "narrator:llm:apiUrl")?.value ||
        configs.find((c) => c.key === "sports:llm:apiUrl")?.value;
      const modelName =
        configs.find((c) => c.key === "narrator:llm:modelName")?.value ||
        configs.find((c) => c.key === "sports:llm:modelName")?.value;
      const tempVal =
        configs.find((c) => c.key === "narrator:llm:temperature")?.value ||
        configs.find((c) => c.key === "sports:llm:temperature")?.value;

      return {
        provider: provider || undefined,
        apiKey: apiKey || undefined,
        apiUrl: apiUrl || undefined,
        modelName: modelName || undefined,
        temperature: tempVal ? parseFloat(tempVal) : undefined,
        reasoning:
          configs.find((c) => c.key === "narrator:llm:reasoning")?.value === "true",
      };
    }
  } catch (e) {
    console.error("[narrator-client] Failed to load LLM config from db:", e);
  }

  // Fallback to environment variables
  const apiKey =
    process.env.NARRATOR_LLM_API_KEY ||
    process.env.SPORTS_LLM_API_KEY;

  if (apiKey) {
    return {
      provider:
        process.env.NARRATOR_LLM_PROVIDER ||
        process.env.SPORTS_LLM_PROVIDER ||
        "nvidia",
      apiKey,
      apiUrl:
        process.env.NARRATOR_LLM_API_URL ||
        process.env.SPORTS_LLM_API_URL,
      modelName:
        process.env.NARRATOR_LLM_MODEL ||
        process.env.SPORTS_LLM_MODEL,
      reasoning: process.env.NARRATOR_LLM_REASONING === "true",
    };
  }

  return null;
}

export async function queryLLM(
  systemPrompt: string,
  userPrompt: string,
  options?: {
    jsonMode?: boolean;
    temperature?: number;
  }
): Promise<string> {
  const config = await getLLMConfig();
  if (!config || !config.apiKey) {
    console.warn("[narrator-client] LLM API key is not configured.");
    return "";
  }

  const provider = config.provider || "nvidia";
  const apiKey = config.apiKey;
  let apiUrl = config.apiUrl || "";
  let modelName = config.modelName || "";

  if (provider === "nvidia") {
    apiUrl = apiUrl || "https://integrate.api.nvidia.com/v1/chat/completions";
    // Fast non-reasoning default; switch to a deepseek model + reasoning flag for quality.
    modelName = modelName || "meta/llama-3.1-70b-instruct";
  } else if (provider === "openrouter") {
    apiUrl = apiUrl || "https://openrouter.ai/api/v1/chat/completions";
    modelName = modelName || "meta-llama/llama-3.1-70b-instruct";
  } else {
    apiUrl = apiUrl || "https://api.openai.com/v1/chat/completions";
    modelName = modelName || "gpt-4o-mini";
  }

  // Auto-append chat completions path if only the base URL was configured
  if (apiUrl && !apiUrl.endsWith("/chat/completions")) {
    apiUrl = apiUrl.replace(/\/$/, "") + "/chat/completions";
  }

  // Reasoning/thinking mode is the dominant latency cost — opt-in only.
  const reasoning = config.reasoning === true;

  const controller = new AbortController();
  // Long timeout only when actually reasoning; flavor text should return fast.
  const timeoutMs = reasoning ? 60000 : 15000;
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: modelName,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: options?.temperature ?? config.temperature ?? 0.7,
        // ponytail: flavor text is short; 16k tokens only made the slow path slower
        max_tokens: reasoning ? 16384 : options?.jsonMode ? 2048 : 1024,
        ...(options?.jsonMode && provider !== "nvidia" && { response_format: { type: "json_object" } }),
        ...(reasoning &&
          provider === "nvidia" && {
            top_p: 0.95,
            chat_template_kwargs: { thinking: true, reasoning_effort: "high" },
          }),
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`API response error status ${response.status}`);
    }

    const data = await response.json();
    let content = data.choices?.[0]?.message?.content || "";

    // Clean up DeepSeek/Nvidia reasoning thinking tags
    if (content && content.includes("</thinking>")) {
      content = content.split("</thinking>").pop()!.trim();
    }

    return content;
  } catch (err) {
    console.error(`[narrator-client] LLM query failed:`, err);
    return "";
  }
}
