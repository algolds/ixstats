import { db } from "~/server/db";
import { isAllowedLlmApiUrl } from "./llm-url";
import { chatCompletion, resolveLlmEndpoint, type LLMConfig } from "./llm-chat";

export async function getLLMConfig(): Promise<LLMConfig | null> {
  // Try loading from database first
  try {
    const configs = await db.systemConfig.findMany({
      where: {
        key: {
          in: ["provider", "apiKey", "apiUrl", "modelName", "temperature", "reasoning"].map(
            (k) => `narrator:llm:${k}`
          ),
        },
      },
    });
    const get = (name: string) => configs.find((c) => c.key === `narrator:llm:${name}`)?.value;

    // Narrator keys only: the sports LLM key must never be used implicitly for narrator calls.
    const apiKey = get("apiKey");
    if (apiKey) {
      const temperature = get("temperature");
      return {
        provider: get("provider") || undefined,
        apiKey,
        apiUrl: get("apiUrl") || undefined,
        modelName: get("modelName") || undefined,
        temperature: temperature ? parseFloat(temperature) : undefined,
        reasoning: get("reasoning") === "true",
      };
    }
  } catch (e) {
    console.error("[narrator-client] Failed to load LLM config from db:", e);
  }

  // Fallback to environment variables
  const apiKey = process.env.NARRATOR_LLM_API_KEY;

  if (apiKey) {
    return {
      provider: process.env.NARRATOR_LLM_PROVIDER || "nvidia",
      apiKey,
      apiUrl: process.env.NARRATOR_LLM_API_URL,
      modelName: process.env.NARRATOR_LLM_MODEL,
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

  const { provider, apiUrl, modelName } = resolveLlmEndpoint(
    config.provider || "nvidia",
    config.apiUrl || "",
    config.modelName || ""
  );

  // Prevent SSRF / API key exfiltration to an arbitrary admin-set host.
  if (!isAllowedLlmApiUrl(apiUrl)) {
    console.warn("[narrator-client] LLM API URL is invalid or its host is not allowed.");
    return "";
  }

  // Reasoning/thinking mode is the dominant latency cost — opt-in only.
  const reasoning = config.reasoning === true;

  try {
    const content = await chatCompletion({
      provider,
      apiUrl,
      modelName,
      apiKey: config.apiKey,
      systemPrompt,
      userPrompt,
      temperature: options?.temperature ?? config.temperature ?? 0.7,
      reasoning,
      jsonMode: options?.jsonMode === true,
      // Long timeout only when actually reasoning; flavor text should return fast.
      timeoutMs: reasoning ? 60000 : 15000,
    });
    // Clean up DeepSeek/Nvidia reasoning thinking tags
    return content.includes("</thinking>") ? content.split("</thinking>").pop()!.trim() : content;
  } catch (err) {
    console.error(`[narrator-client] LLM query failed:`, err);
    return "";
  }
}
