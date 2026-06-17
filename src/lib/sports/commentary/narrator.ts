import type { EventTraceStep } from "../resolver";

/**
 * narrateEvents turns a list of match event steps into play-by-play commentary.
 * If the environment flag SPORTS_LLM_COMMENTARY is not set to "true", or if the
 * API call fails, it falls back to returning the original templated descriptions.
 */
export async function narrateEvents(
  events: EventTraceStep[],
  options: { sport: string }
): Promise<string[]> {
  const fallback = events.map((e) => e.description);
  
  const isEnabled = process.env.SPORTS_LLM_COMMENTARY === "true";
  if (!isEnabled || events.length === 0) {
    return fallback;
  }

  const provider = process.env.SPORTS_LLM_PROVIDER || "nvidia";
  const apiKey = process.env.SPORTS_LLM_API_KEY;
  
  if (!apiKey) {
    console.warn("[sports-narrator] SPORTS_LLM_API_KEY is not configured; falling back to templates.");
    return fallback;
  }

  let apiUrl = process.env.SPORTS_LLM_API_URL || "";
  let modelName = process.env.SPORTS_LLM_MODEL || "";

  if (provider === "nvidia") {
    apiUrl = apiUrl || "https://integrate.api.nvidia.com/v1/chat/completions";
    modelName = modelName || "nvidia/nemotron-3-ultra-550b-a55b";
  } else if (provider === "openrouter") {
    apiUrl = apiUrl || "https://openrouter.ai/api/v1/chat/completions";
    modelName = modelName || "meta-llama/llama-3.1-70b-instruct";
  } else {
    apiUrl = apiUrl || "https://api.openai.com/v1/chat/completions";
    modelName = modelName || "gpt-4o-mini";
  }

  try {
    const inputDescriptions = events.map((e) => e.description);
    const systemPrompt = `You are a professional sports commentator for a ${options.sport} match.
You will receive a JSON array of event descriptions. 
Your task is to rewrite each event to add realistic play-by-play color commentary, drama, and sport-specific vocabulary, while maintaining the same outcome and actor name.
You MUST return a JSON array of strings of the exact same length as the input array.
Do not wrap your output in markdown code blocks. Return ONLY the raw JSON string array under a "commentary" key in a JSON object.
Example Input: ["Match begins. Home team using neutral tactics.", "GOAL! John Smith scores!"]
Example Output: { "commentary": ["The referee blows the whistle and we are underway under the floodlights!", "GOAL! John Smith unleashes a thunderous volley into the top corner!"] }`;

    const controller = new AbortController();
    const timeoutMs = provider === "nvidia" ? 60000 : 8000;
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

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
          { role: "user", content: JSON.stringify(inputDescriptions) },
        ],
        temperature: 0.7,
        max_tokens: 2048,
        response_format: { type: "json_object" },
        ...(provider === "nvidia" && {
          reasoning_budget: 16384,
          chat_template_kwargs: { enable_thinking: true },
          extra_body: {
            reasoning_budget: 16384,
            chat_template_kwargs: { enable_thinking: true }
          }
        })
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`API response error status ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    if (!content) {
      throw new Error("Empty model response");
    }

    let results: any = null;
    try {
      const parsed = JSON.parse(content);
      if (Array.isArray(parsed)) {
        results = parsed;
      } else if (typeof parsed === "object" && parsed !== null) {
        const firstArrayKey = Object.keys(parsed).find((k) => Array.isArray(parsed[k]));
        if (firstArrayKey) {
          results = parsed[firstArrayKey];
        }
      }
    } catch {
      const match = content.match(/\[\s*"[\s\S]*"\s*\]/);
      if (match) {
        results = JSON.parse(match[0]);
      }
    }

    if (Array.isArray(results) && results.length === events.length) {
      return results.map((r) => String(r));
    } else {
      console.warn(
        `[sports-narrator] LLM returned array of size ${results?.length ?? "non-array"}, expected ${events.length}. Falling back.`
      );
      return fallback;
    }
  } catch (err) {
    console.error(`[sports-narrator] LLM narration failed:`, err);
    return fallback;
  }
}
