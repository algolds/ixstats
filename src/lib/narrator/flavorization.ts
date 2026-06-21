import { queryLLM } from "./client";
import { externalApiCache } from "../external-api-cache";
import type { PrismaClient } from "@prisma/client";

export const DEFAULT_FLAVOR_SYSTEM_PROMPT = `You are a Paradox Interactive-style narrative designer.
You convert geopolitical simulation events into immersive but concise event cards.
Do not add new facts. Do not invent unrelated lore.
Keep tone: diplomatic, slightly dramatic, grounded.`;

export interface FlavorizeParams {
  id: string;
  type: "issue" | "policy" | "decision";
  title: string;
  description: string;
  countryId?: string;
  db: PrismaClient;
}

export async function getFlavorText(params: FlavorizeParams): Promise<string> {
  const cacheKey = `flavor:${params.type}:${params.id}`;

  // 1. Try Cache first
  try {
    const cached = await externalApiCache.get({
      service: "custom",
      type: "json",
      identifier: cacheKey,
    });

    if (cached && typeof cached.data === "string" && cached.data) {
      return cached.data;
    }
  } catch (e) {
    console.error("[flavorization] Cache read error:", e);
  }

  // 2. Resolve Country Metrics Context
  let metrics: any = null;

  try {
    // If it's an issue, check if it has a saved snapshot we can parse
    if (params.type === "issue") {
      const issue = await params.db.nationalIssue.findUnique({
        where: { id: params.id },
        select: { contextSnapshot: true, countryId: true },
      });
      if (issue) {
        if (issue.contextSnapshot) {
          try {
            metrics = JSON.parse(issue.contextSnapshot);
          } catch (_) {}
        }
        // Fallback to fetch country info if snapshot parsing failed
        if (!metrics && issue.countryId) {
          metrics = await fetchLiveCountryMetrics(issue.countryId, params.db);
        }
      }
    } else if (params.countryId) {
      metrics = await fetchLiveCountryMetrics(params.countryId, params.db);
    }
  } catch (e) {
    console.error("[flavorization] Error loading country context:", e);
  }

  // 3. Format Metrics Context for LLM
  let metricsContext = "";
  if (metrics) {
    const name = metrics.name || "the nation";
    const leader = metrics.leader || "the sovereign";
    const govType = metrics.governmentType || "government";
    const approval = metrics.approval ?? metrics.publicApproval ?? 50;
    const stability = metrics.stability ?? metrics.stabilityScore ?? metrics.politicalStability ?? 50;

    metricsContext = `
[Country Context]
Country Name: ${name}
Ruler/Leader: ${leader}
Government Form: ${govType}
Public Approval: ${approval}%
Political Stability: ${stability}%
`;
  }

  const userPrompt = `
${metricsContext}
[Event Details]
Event Type: ${params.type.toUpperCase()}
Title: ${params.title}
Details: ${params.description}

Rewrite this event into an immersive Paradox Interactive-style narrative introduction. Adapt the mood, tone, and description to match the country's metrics (e.g. tense or chaotic description if stability or approval is low, or prosperous/grand description if stability is high and economy is strong).
Do not add new facts or inject unrelated lore. Limit the narrative to 2-3 immersive sentences (approx. 50-70 words).
`;

  // 4. Query LLM
  let systemPrompt = DEFAULT_FLAVOR_SYSTEM_PROMPT;
  try {
    const config = await params.db.systemConfig.findUnique({
      where: { key: "narrator:llm:systemPrompt" },
    });
    if (config?.value) {
      systemPrompt = config.value;
    }
  } catch (e) {
    console.error("[flavorization] Failed to load custom system prompt:", e);
  }

  const generated = await queryLLM(systemPrompt, userPrompt);
  if (!generated) {
    return "";
  }

  // Clean any wrapping quotes or markdown blocks
  let cleaned = generated.trim();
  if (cleaned.startsWith('"') && cleaned.endsWith('"')) {
    cleaned = cleaned.substring(1, cleaned.length - 1).trim();
  }

  // 5. Save to Cache (TTL: 14 days)
  try {
    await externalApiCache.set(
      {
        service: "custom",
        type: "json",
        identifier: cacheKey,
        ttl: 14 * 24 * 60 * 60 * 1000, // 14 days
      },
      cleaned
    );
  } catch (e) {
    console.error("[flavorization] Cache write error:", e);
  }

  return cleaned;
}

export async function fetchLiveCountryMetrics(countryId: string, db: PrismaClient) {
  try {
    const country = await db.country.findUnique({
      where: { id: countryId },
      select: {
        name: true,
        leader: true,
        governmentType: true,
        publicApproval: true,
        governmentStructure: {
          select: {
            politicalStability: true,
          },
        },
        stabilityMetrics: {
          select: {
            stabilityScore: true,
          },
        },
      },
    });

    if (!country) return null;

    return {
      name: country.name,
      leader: country.leader,
      governmentType: country.governmentType,
      approval: country.publicApproval,
      stability: country.governmentStructure?.politicalStability ?? country.stabilityMetrics?.stabilityScore ?? 50,
    };
  } catch (e) {
    console.error("[flavorization] fetchLiveCountryMetrics failed:", e);
    return null;
  }
}
