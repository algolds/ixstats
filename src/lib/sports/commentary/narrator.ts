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
        temperature: config?.temperature ?? 0.7,
        max_tokens: 2048,
        response_format: { type: "json_object" },
        ...(provider === "nvidia" && {
          reasoning_budget: 16384,
          chat_template_kwargs: { enable_thinking: true },
          extra_body: {
            reasoning_budget: 16384,
            chat_template_kwargs: { enable_thinking: true },
          },
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
    modelName = modelName || "nvidia/nemotron-3-ultra-550b-a55b";
  } else if (provider === "openrouter") {
    apiUrl = apiUrl || "https://openrouter.ai/api/v1/chat/completions";
    modelName = modelName || "meta-llama/llama-3.1-70b-instruct";
  } else {
    apiUrl = apiUrl || "https://api.openai.com/v1/chat/completions";
    modelName = modelName || "gpt-4o-mini";
  }

  const controller = new AbortController();
  const timeoutMs = provider === "nvidia" ? 60000 : 12000;
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
        max_tokens: jsonMode ? 2048 : 4096,
        ...(jsonMode && { response_format: { type: "json_object" } }),
        ...(provider === "nvidia" && {
          reasoning_budget: 16384,
          chat_template_kwargs: { enable_thinking: true },
          extra_body: {
            reasoning_budget: 16384,
            chat_template_kwargs: { enable_thinking: true },
          },
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
