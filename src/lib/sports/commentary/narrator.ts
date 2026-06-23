import type { EventTraceStep } from "../resolver";

/**
 * narrateEvents turns a list of match event steps into play-by-play commentary.
 * If the environment flag SPORTS_LLM_COMMENTARY is not set to "true", or if the
 * API call fails, it falls back to returning the original templated descriptions.
 */
export async function narrateEvents(
  events: EventTraceStep[],
  options: {
    sport: string;
    config?: {
      provider?: string;
      apiKey?: string;
      apiUrl?: string;
      modelName?: string;
      temperature?: number;
      reasoning?: boolean; // off by default — thinking mode is the main latency source
    };
  }
): Promise<string[]> {
  const fallback = events.map((e) => e.description);

  const config = options.config;
  const isEnabled = config?.apiKey ? true : process.env.SPORTS_LLM_COMMENTARY === "true";
  if (!isEnabled || events.length === 0) {
    return fallback;
  }

  const provider = config?.provider || process.env.SPORTS_LLM_PROVIDER || "nvidia";
  const apiKey = config?.apiKey || process.env.SPORTS_LLM_API_KEY;

  if (!apiKey) {
    console.warn(
      "[sports-narrator] SPORTS_LLM_API_KEY is not configured; falling back to templates."
    );
    return fallback;
  }

  let apiUrl = config?.apiUrl || process.env.SPORTS_LLM_API_URL || "";
  let modelName = config?.modelName || process.env.SPORTS_LLM_MODEL || "";

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
  const reasoning = config?.reasoning === true;

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
    // Long timeout only when actually reasoning.
    const timeoutMs = reasoning ? 60000 : 8000;
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
        temperature: config?.temperature ?? 0.7,
        max_tokens: reasoning ? 16384 : 2048,
        ...(provider !== "nvidia" && { response_format: { type: "json_object" } }),
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
    const content = data.choices?.[0]?.message?.content;
    if (!content) {
      throw new Error("Empty model response");
    }

    let results: any = null;
    try {
      let jsonText = content.trim();

      // Strip <thinking>...</thinking> tags if present
      if (jsonText.includes("</thinking>")) {
        jsonText = jsonText.split("</thinking>").pop()!.trim();
      }

      // Match and extract any ```json ... ``` or ``` ... ``` block
      const mdJsonMatch = jsonText.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
      if (mdJsonMatch && mdJsonMatch[1]) {
        jsonText = mdJsonMatch[1].trim();
      }

      // Find first occurrence of { or [ and last occurrence of } or ] to isolate the raw JSON block
      const firstBrace = jsonText.indexOf("{");
      const firstBracket = jsonText.indexOf("[");
      const lastBrace = jsonText.lastIndexOf("}");
      const lastBracket = jsonText.lastIndexOf("]");

      let candidate = jsonText;
      if (
        firstBrace !== -1 &&
        lastBrace !== -1 &&
        (firstBracket === -1 || firstBrace < firstBracket)
      ) {
        candidate = jsonText.substring(firstBrace, lastBrace + 1);
      } else if (firstBracket !== -1 && lastBracket !== -1) {
        candidate = jsonText.substring(firstBracket, lastBracket + 1);
      }

      const parsed = JSON.parse(candidate);
      if (Array.isArray(parsed)) {
        results = parsed;
      } else if (typeof parsed === "object" && parsed !== null) {
        const firstArrayKey = Object.keys(parsed).find((k) => Array.isArray(parsed[k]));
        if (firstArrayKey) {
          results = parsed[firstArrayKey];
        }
      }
    } catch (parseErr) {
      console.warn(
        "[sports-narrator] Standard JSON parse failed, attempting regex array matching...",
        parseErr
      );
      const match = content.match(/\[\s*"[\s\S]*"\s*\]/);
      if (match) {
        try {
          results = JSON.parse(match[0]);
        } catch (_) {}
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

/**
 * queryLLM is a generic helper to call the configured LLM API.
 */
async function queryLLM(
  systemPrompt: string,
  userPrompt: string,
  jsonMode = false,
  config?: {
    provider?: string;
    apiKey?: string;
    apiUrl?: string;
    modelName?: string;
    temperature?: number;
    reasoning?: boolean;
  }
): Promise<string> {
  const isEnabled = config?.apiKey ? true : process.env.SPORTS_LLM_COMMENTARY === "true";
  if (!isEnabled) {
    return "";
  }

  const provider = config?.provider || process.env.SPORTS_LLM_PROVIDER || "nvidia";
  const apiKey = config?.apiKey || process.env.SPORTS_LLM_API_KEY;

  if (!apiKey) {
    console.warn("[sports-narrator] SPORTS_LLM_API_KEY is not configured.");
    return "";
  }

  let apiUrl = config?.apiUrl || process.env.SPORTS_LLM_API_URL || "";
  let modelName = config?.modelName || process.env.SPORTS_LLM_MODEL || "";

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
  const reasoning = config?.reasoning === true;

  const controller = new AbortController();
  const timeoutMs = reasoning ? 60000 : 12000;
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
        temperature: config?.temperature ?? 0.7,
        max_tokens: reasoning ? 16384 : jsonMode ? 2048 : 1024,
        ...(jsonMode && provider !== "nvidia" && { response_format: { type: "json_object" } }),
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
    return data.choices?.[0]?.message?.content || "";
  } catch (err) {
    console.error(`[sports-narrator] LLM query failed:`, err);
    return "";
  }
}

/**
 * narrateBulletin summarizes a full match day's highlights in 2-3 sentences.
 */
export async function narrateBulletin(
  matches: Array<{ homeName: string; awayName: string; homeScore: number; awayScore: number }>,
  options: {
    sport: string;
    leagueName: string;
    matchDay: number;
    config?: {
      provider?: string;
      apiKey?: string;
      apiUrl?: string;
      modelName?: string;
      temperature?: number;
      reasoning?: boolean;
    };
  }
): Promise<string> {
  const matchesSummary = matches
    .map((m) => `${m.homeName} ${m.homeScore} - ${m.awayScore} ${m.awayName}`)
    .join(", ");

  const systemPrompt = `You are a sports news anchor. Write a concise, energetic 2-3 sentence highlights bulletin summarizing the results of Matchday ${options.matchDay} for the ${options.leagueName} ${options.sport} league. Highlight key results, big wins, or shocking upsets. Keep it strictly under 3 sentences.`;
  const userPrompt = `Matchday Results: ${matchesSummary}`;

  return queryLLM(systemPrompt, userPrompt, false, options.config);
}

/**
 * generateMatchReport writes a detailed newspaper-style report of a simulated match.
 */
export async function generateMatchReport(matchData: {
  homeTeamName: string;
  awayTeamName: string;
  homeScore: number;
  awayScore: number;
  sport: string;
  events: Array<{ t: number; type: string; description: string }>;
  playerStats: Array<{
    player: { firstName: string; lastName: string };
    goals?: number;
    assists?: number;
    [key: string]: any;
  }>;
  config?: {
    provider?: string;
    apiKey?: string;
    apiUrl?: string;
    modelName?: string;
    temperature?: number;
    reasoning?: boolean;
  };
}): Promise<string> {
  const eventsSummary = matchData.events.map((e) => `[${e.t}'] ${e.description}`).join("\n");
  const playerStatsSummary = matchData.playerStats
    .map((ps) => {
      const goals = ps.goals ?? ps.stats?.goals ?? 0;
      const assists = ps.assists ?? ps.stats?.assists ?? 0;
      return `${ps.player.firstName} ${ps.player.lastName}: Goals: ${goals}, Assists: ${assists}`;
    })
    .join(", ");

  const systemPrompt = `You are an elite sports journalist writing a match report for a ${matchData.sport} match. 
Write a highly detailed, 3-5 paragraph sports article reporting on this match. Include a catchy headline at the top. 
Incorporate the chronological events, key performers, final score, and tactical flow. Make it feel authentic, narrative, and engaging.`;

  const userPrompt = `Match: ${matchData.homeTeamName} vs ${matchData.awayTeamName}
Final Score: ${matchData.homeScore} - ${matchData.awayScore}
Chronological Events:
${eventsSummary}
Player Performance:
${playerStatsSummary}`;

  const result = await queryLLM(systemPrompt, userPrompt, false, matchData.config);
  if (result) return result;

  // Local fallback newspaper report
  const headline = `${matchData.homeTeamName} and ${matchData.awayTeamName} clash in a thrilling ${matchData.sport} contest!`;
  const paragraph1 = `In a hard-fought ${matchData.sport} match, ${matchData.homeTeamName} played host to ${matchData.awayTeamName}. Both sides demonstrated solid tactics throughout the match. The final score settled at a definitive ${matchData.homeScore} - ${matchData.awayScore}.`;

  const keyPerformers =
    matchData.playerStats.length > 0
      ? `Key performances include ${matchData.playerStats
          .slice(0, 3)
          .map((ps) => {
            const goals = ps.goals ?? ps.stats?.goals ?? 0;
            const assists = ps.assists ?? ps.stats?.assists ?? 0;
            return `${ps.player.firstName} ${ps.player.lastName} (${goals} Goals, ${assists} Assists)`;
          })
          .join(", ")}.`
      : `Both rosters played with great intensity, showcasing strong tactical coordination on the pitch.`;

  const chronologicalDetails =
    matchData.events.length > 0
      ? `The match sequence was highlighted by several crucial incidents: ${matchData.events
          .slice(0, 4)
          .map((e) => `at the ${e.t}' minute, ${e.description}`)
          .join("; ")}.`
      : `The defensive lines held firm for major parts of the game, keeping clear chances to a minimum.`;

  const report = `# ${headline}\n\n${paragraph1}\n\n${keyPerformers} ${chronologicalDetails}\n\nFans left the stadium reflecting on a match that displayed great sportsmanship and strategic depth.`;
  return report;
}

/**
 * generateMatchPreview predicts the outcome of an upcoming match based on standings.
 */
export async function generateMatchPreview(
  homeTeam: { name: string; position?: number },
  awayTeam: { name: string; position?: number },
  sport: string,
  standingsContext?: string,
  config?: {
    provider?: string;
    apiKey?: string;
    apiUrl?: string;
    modelName?: string;
    temperature?: number;
    reasoning?: boolean;
  }
): Promise<string> {
  const systemPrompt = `You are a sports analyst. Write a concise pre-match preview and prediction for an upcoming ${sport} match between ${homeTeam.name} and ${awayTeam.name}. Give a 1-2 paragraph preview highlighting who is favored based on their standing position and form, and finish with a bold scoreline prediction.`;
  const userPrompt = `Home Team: ${homeTeam.name} (Standings Rank: ${homeTeam.position ?? "N/A"})
Away Team: ${awayTeam.name} (Standings Rank: ${awayTeam.position ?? "N/A"})
Standings Overview:
${standingsContext ?? "No form history available."}`;

  return queryLLM(systemPrompt, userPrompt, false, config);
}

/**
 * generateSeasonSummary writes an ESPN-style end-of-season recap.
 */
export async function generateSeasonSummary(
  leagueName: string,
  championName: string,
  standings: Array<{ teamName: string; points: number; wins: number; losses: number }>,
  sport: string,
  config?: {
    provider?: string;
    apiKey?: string;
    apiUrl?: string;
    modelName?: string;
    temperature?: number;
    reasoning?: boolean;
  }
): Promise<string> {
  const standingsSummary = standings
    .map((s, idx) => `${idx + 1}. ${s.teamName} (Points: ${s.points}, W-L: ${s.wins}-${s.losses})`)
    .join("\n");

  const systemPrompt = `You are an ESPN sports columnist. Write a comprehensive, dramatic 3-4 paragraph recap summarizing the completed season of the ${leagueName} ${sport} league. Celebrate the champion ${championName}, highlight the heroic runs and heartbreaking demotions or failures. Include a headline at the top.`;
  const userPrompt = `Season Standings:
${standingsSummary}
Champion: ${championName}`;

  return queryLLM(systemPrompt, userPrompt, false, config);
}
