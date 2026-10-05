import type { EventTraceStep } from "../resolver";
import { isAllowedLlmApiUrl } from "~/lib/narrator/llm-url";
import { chatCompletion, resolveLlmEndpoint, type LLMConfig } from "~/lib/narrator/llm-chat";

/**
 * A caller-supplied config is honoured only when it brings its own API key and,
 * if it names an endpoint, that endpoint is an allowlisted LLM host. Otherwise it
 * is dropped and the SPORTS_LLM_* environment applies, so the server's key is
 * never sent to a URL the caller chose (SSRF / key exfiltration).
 */
export function sanitizeLlmConfig(config?: LLMConfig): LLMConfig | undefined {
  if (!config?.apiKey) return undefined;
  if (config.apiUrl && !isAllowedLlmApiUrl(config.apiUrl)) {
    console.warn("[sports-narrator] Custom API URL is invalid or its host is not allowed.");
    return undefined;
  }
  return config;
}

const isLlmEnabled = (config?: LLMConfig) =>
  config?.apiKey ? true : process.env.SPORTS_LLM_COMMENTARY === "true";

/** Explicit config first, then the SPORTS_LLM_* environment. */
function resolveSportsLlm(config?: LLMConfig) {
  const endpoint = resolveLlmEndpoint(
    config?.provider || process.env.SPORTS_LLM_PROVIDER || "nvidia",
    config?.apiUrl || process.env.SPORTS_LLM_API_URL || "",
    config?.modelName || process.env.SPORTS_LLM_MODEL || ""
  );
  return {
    ...endpoint,
    apiKey: config?.apiKey || process.env.SPORTS_LLM_API_KEY,
    temperature: config?.temperature ?? 0.7,
    reasoning: config?.reasoning === true, // opt-in: thinking mode is the dominant latency cost
  };
}

const COMMENTARY_SYSTEM_PROMPT = (
  sport: string
) => `You are a professional sports commentator for a ${sport} match.
You will receive a JSON array of event descriptions. 
Your task is to rewrite each event to add realistic play-by-play color commentary, drama, and sport-specific vocabulary, while maintaining the same outcome and actor name.
You MUST return a JSON array of strings of the exact same length as the input array.
Do not wrap your output in markdown code blocks. Return ONLY the raw JSON string array under a "commentary" key in a JSON object.
Example Input: ["Match begins. Home team using neutral tactics.", "GOAL! John Smith scores!"]
Example Output: { "commentary": ["The referee blows the whistle and we are underway under the floodlights!", "GOAL! John Smith unleashes a thunderous volley into the top corner!"] }`;

/** Isolates the JSON payload from model output (thinking tags, markdown fences, surrounding prose). */
function extractJsonCandidate(content: string): string {
  let text = content.trim();
  if (text.includes("</thinking>")) text = text.split("</thinking>").pop()!.trim();

  const fenced = /```(?:json)?\s*([\s\S]*?)\s*```/.exec(text)?.[1];
  if (fenced) text = fenced.trim();

  const firstBrace = text.indexOf("{");
  const firstBracket = text.indexOf("[");
  const lastBrace = text.lastIndexOf("}");
  const lastBracket = text.lastIndexOf("]");
  if (firstBrace !== -1 && lastBrace !== -1 && (firstBracket === -1 || firstBrace < firstBracket)) {
    return text.substring(firstBrace, lastBrace + 1);
  }
  if (firstBracket !== -1 && lastBracket !== -1)
    return text.substring(firstBracket, lastBracket + 1);
  return text;
}

/** The commentary array from a model reply: a bare array, or the first array-valued key of an object. */
function parseCommentary(content: string): unknown[] | null {
  try {
    const parsed = JSON.parse(extractJsonCandidate(content));
    if (Array.isArray(parsed)) return parsed;
    if (typeof parsed === "object" && parsed !== null) {
      return (Object.values(parsed).find(Array.isArray) as unknown[] | undefined) ?? null;
    }
    return null;
  } catch (parseErr) {
    console.warn(
      "[sports-narrator] Standard JSON parse failed, attempting regex array matching...",
      parseErr
    );
  }
  const match = /\[\s*"[\s\S]*"\s*\]/.exec(content);
  if (!match) return null;
  try {
    return JSON.parse(match[0]);
  } catch (err) {
    console.warn("[sports-narrator] Regex fallback JSON parse failed:", err);
    return null;
  }
}

/**
 * narrateEvents turns a list of match event steps into play-by-play commentary.
 * If the environment flag SPORTS_LLM_COMMENTARY is not set to "true", or if the
 * API call fails, it falls back to returning the original templated descriptions.
 */
export async function narrateEvents(
  events: EventTraceStep[],
  options: { sport: string; config?: LLMConfig }
): Promise<string[]> {
  const fallback = events.map((e) => e.description);
  const config = sanitizeLlmConfig(options.config);
  if (!isLlmEnabled(config) || events.length === 0) return fallback;

  const llm = resolveSportsLlm(config);
  if (!llm.apiKey) {
    console.warn(
      "[sports-narrator] SPORTS_LLM_API_KEY is not configured; falling back to templates."
    );
    return fallback;
  }

  try {
    const content = await chatCompletion({
      ...llm,
      apiKey: llm.apiKey,
      systemPrompt: COMMENTARY_SYSTEM_PROMPT(options.sport),
      userPrompt: JSON.stringify(fallback),
      jsonMode: true,
      timeoutMs: llm.reasoning ? 60000 : 8000,
    });
    if (!content) throw new Error("Empty model response");

    const results = parseCommentary(content);
    if (results?.length === events.length) return results.map((r) => String(r));
    console.warn(
      `[sports-narrator] LLM returned array of size ${results?.length ?? "non-array"}, expected ${events.length}. Falling back.`
    );
    return fallback;
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
  rawConfig?: LLMConfig
): Promise<string> {
  const config = sanitizeLlmConfig(rawConfig);
  if (!isLlmEnabled(config)) return "";

  const llm = resolveSportsLlm(config);
  if (!llm.apiKey) {
    console.warn("[sports-narrator] SPORTS_LLM_API_KEY is not configured.");
    return "";
  }

  try {
    return await chatCompletion({
      ...llm,
      apiKey: llm.apiKey,
      systemPrompt,
      userPrompt,
      jsonMode,
      timeoutMs: llm.reasoning ? 60000 : 12000,
    });
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
    config?: LLMConfig;
  }
): Promise<string> {
  const matchesSummary = matches
    .map((m) => `${m.homeName} ${m.homeScore} - ${m.awayScore} ${m.awayName}`)
    .join(", ");

  const systemPrompt = `You are a sports news anchor. Write a concise, energetic 2-3 sentence highlights bulletin summarizing the results of Matchday ${options.matchDay} for the ${options.leagueName} ${options.sport} league. Highlight key results, big wins, or shocking upsets. Keep it strictly under 3 sentences.`;
  const userPrompt = `Matchday Results: ${matchesSummary}`;

  return queryLLM(systemPrompt, userPrompt, false, options.config);
}

const goalsAndAssists = (ps: { goals?: number; assists?: number; [key: string]: any }) => ({
  goals: ps.goals ?? ps.stats?.goals ?? 0,
  assists: ps.assists ?? ps.stats?.assists ?? 0,
});

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
  config?: LLMConfig;
}): Promise<string> {
  const eventsSummary = matchData.events.map((e) => `[${e.t}'] ${e.description}`).join("\n");
  const playerStatsSummary = matchData.playerStats
    .map((ps) => {
      const { goals, assists } = goalsAndAssists(ps);
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
            const { goals, assists } = goalsAndAssists(ps);
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

  return `# ${headline}\n\n${paragraph1}\n\n${keyPerformers} ${chronologicalDetails}\n\nFans left the stadium reflecting on a match that displayed great sportsmanship and strategic depth.`;
}

/**
 * generateMatchPreview predicts the outcome of an upcoming match based on standings.
 */
export async function generateMatchPreview(
  homeTeam: { name: string; position?: number },
  awayTeam: { name: string; position?: number },
  sport: string,
  standingsContext?: string,
  config?: LLMConfig
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
  config?: LLMConfig
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

/**
 * generateAudioBroadcast converts commentary text into speech.
 * Queries a Kokoro TTS Hugging Face Inference Endpoint or Space.
 * Falls back to null on failure.
 */
export async function generateAudioBroadcast(commentary: string[]): Promise<string | null> {
  // Server configuration only: the TTS key must never be sent to a caller-chosen URL.
  if (process.env.SPORTS_TTS_ENABLED !== "true" || commentary.length === 0) {
    return null;
  }

  const apiUrl = process.env.SPORTS_TTS_API_URL;
  const apiKey = process.env.SPORTS_TTS_API_KEY;

  if (!apiUrl) {
    console.warn("[sports-narrator] SPORTS_TTS_API_URL is not configured.");
    return null;
  }

  try {
    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(apiKey && { Authorization: `Bearer ${apiKey}` }),
      },
      body: JSON.stringify({ inputs: commentary.join(" ... ") }),
      signal: AbortSignal.timeout(15000), // 15s timeout for TTS
    });

    if (!response.ok) {
      throw new Error(`TTS API response error status ${response.status}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const base64Audio = Buffer.from(arrayBuffer).toString("base64");
    return `data:audio/wav;base64,${base64Audio}`;
  } catch (err) {
    console.error(`[sports-narrator] TTS generation failed:`, err);
    return null;
  }
}
