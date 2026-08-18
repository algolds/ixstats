import { queryLLM } from "./client";
import { externalApiCache } from "~/lib/cache";
import { buildCanonContext, formatCanonContext, canonContextHash } from "./canon-context";
import type { PrismaClient } from "@prisma/client";
import { DEFAULT_FLAVOR_SYSTEM_PROMPT } from "./constants";

export interface FlavorizeParams {
  id: string;
  type: "issue" | "policy" | "decision";
  title: string;
  description: string;
  countryId?: string;
  db: PrismaClient;
}

export async function getFlavorText(params: FlavorizeParams): Promise<string> {
  // 1. Resolve the country this event belongs to (issues carry their own countryId).
  let countryId = params.countryId;
  if (!countryId && params.type === "issue") {
    try {
      const issue = await params.db.nationalIssue.findUnique({
        where: { id: params.id },
        select: { countryId: true },
      });
      countryId = issue?.countryId ?? undefined;
    } catch (e) {
      console.error("[flavorization] Failed to resolve issue countryId:", e);
    }
  }

  // 2. Assemble the canon context — the only facts the narrator may use.
  let canon = null;
  try {
    if (countryId) canon = await buildCanonContext(params.db, countryId);
  } catch (e) {
    console.error("[flavorization] Failed to build canon context:", e);
  }
  const canonContext = canon ? formatCanonContext(canon) : "";

  // 3. Cache key includes a hash of the canon, so a card self-invalidates when
  //    the underlying lore changes instead of going stale for 14 days.
  const contextHash = canon ? canonContextHash(canon) : "nocontext";
  const cacheKey = `flavor:${params.type}:${params.id}:${contextHash}`;

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

  const userPrompt = `
${canonContext}

[Event Details]
Event Type: ${params.type.toUpperCase()}
Title: ${params.title}
Details: ${params.description}

Rewrite this event into an immersive Paradox Interactive-style narrative introduction. Adapt the mood and tone to the canon facts above (tense or chaotic if stability or approval is low; prosperous or grand if stability is high and the economy is strong). Where it fits naturally, reference the nation's real recent history or relationships from the Canon Context for continuity.
Reference ONLY facts from the [Canon Context]. Do not invent leaders, places, wars, or lore. Limit the narrative to 2-3 immersive sentences (approx. 50-70 words).
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
