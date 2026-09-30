/**
 * Intent resistance spawner (plan 002, Phase 2).
 *
 * An Intent's "resistance" is the National Issue that opposes it. When a player
 * commits a moderate/extreme intent in deterministic mode, we spawn a linked
 * issue immediately (deduped + cooldown-aware) so the player must resolve it
 * before the intent can be completed (Phase 3 gate).
 *
 * The category → template vocabulary fix: the intent engine classifies goals
 * as defense/fiscal/economy/social/infrastructure/security, but the template
 * corpus is keyed by domain/category (economic, political, social, military,
 * governance, security, infrastructure, …). This mapping bridges the two.
 */

import { IxTime } from "~/lib/ixtime";
import { NationalIssuesEngine } from "~/lib/national-issues";
import { getNationalIssuesConfig } from "~/lib/national-issues";
import type { Category } from "~/lib/intent/assemble";
import type { PrismaClient } from "@prisma/client";

const IX_TIME_DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Intent category → candidate template domain/category values. Each entry is
 * matched against BOTH template.domain and template.category (the corpus mixes
 * the two vocabularies; e.g. "military" is a domain, "security" a category).
 */
export const INTENT_CATEGORY_TO_TEMPLATE: Record<Category, string[]> = {
  defense: ["military", "security"],
  fiscal: ["economic"],
  economy: ["economic"],
  social: ["social"],
  infrastructure: ["infrastructure"],
  security: ["political", "governance"],
};

export interface SpawnIntentResistanceParams {
  db: PrismaClient;
  countryId: string;
  intent: {
    id: string;
    category: string;
    tier: string;
  };
}

export interface SpawnResistanceForIntentParams extends SpawnIntentResistanceParams {
  /** Explicit template domain/category tokens to match (cron passes its own policy mapping). */
  tokens: string[];
}

/**
 * Core spawner: pick the first eligible active template matching `tokens`, dedupe
 * (no open issue already linked to this intent + template), respect cooldownDays
 * + maxActivePerCountry, instantiate via NationalIssuesEngine.forceGenerate, then
 * link intentId. Returns the created issue id or null.
 *
 * No spawnMode check here — callers gate on their own mode.
 */
export async function spawnResistanceForIntent({
  db,
  countryId,
  intent,
  tokens,
}: SpawnResistanceForIntentParams): Promise<string | null> {
  if (!tokens || tokens.length === 0) return null;

  const validCategoryEnums = tokens.filter((t): t is any =>
    ["economic", "diplomatic", "social", "governance", "security", "infrastructure"].includes(t)
  );
  const orConditions: any[] = [{ domain: { in: tokens } }];
  if (validCategoryEnums.length > 0) {
    orConditions.push({ category: { in: validCategoryEnums } });
  }

  const templates = await db.nationalIssueTemplate.findMany({
    where: {
      isActive: true,
      OR: orConditions,
    },
    orderBy: { baseUrgency: "desc" },
  });
  if (templates.length === 0) return null;

  const now = IxTime.getCurrentIxTime();

  for (const template of templates) {
    const [linkedOpen, active, recent] = await Promise.all([
      db.nationalIssue.findFirst({
        where: {
          countryId,
          intentId: intent.id,
          templateId: template.id,
          status: { in: ["pending", "viewed"] },
        },
        select: { id: true },
      }),
      db.nationalIssue.count({
        where: {
          countryId,
          templateId: template.id,
          status: { in: ["pending", "viewed"] },
        },
      }),
      db.nationalIssue.findFirst({
        where: {
          countryId,
          templateId: template.id,
          createdIxTime: { gt: now - template.cooldownDays * IX_TIME_DAY_MS },
        },
        select: { id: true },
      }),
    ]);

    // Dedupe: an open issue for this intent+template already exists.
    if (linkedOpen) continue;
    // Max active per country for this template.
    if (active >= template.maxActivePerCountry) continue;
    // Cooldown: this template already spawned for this country recently.
    if (recent) continue;

    const issueId = await NationalIssuesEngine.forceGenerate(template.id, countryId, db);
    if (!issueId) continue;

    await db.nationalIssue.update({
      where: { id: issueId },
      data: {
        intentId: intent.id,
        triggerReason: `Resistance to intent ${intent.id}`,
      },
    });
    return issueId;
  }

  return null;
}

/**
 * Spawn a resistance issue for an intent (mode-aware wrapper).
 *
 * - `spawnMode === "deterministic"`: spawn immediately via spawnResistanceForIntent.
 * - `spawnMode === "probability"` / `"off"`: no direct spawn (probability-mode
 *   relies on the fixed boosted evaluation in the engine + the cron risk roll).
 *
 * Never throws — callers wrap it in try/catch (a spawn failure must never fail
 * the underlying commit). Returns the created issue id, or null.
 */
export async function spawnIntentResistance({
  db,
  countryId,
  intent,
}: SpawnIntentResistanceParams): Promise<string | null> {
  try {
    const config = getNationalIssuesConfig();
    if (config.spawnMode !== "deterministic") return null;

    const tokens = INTENT_CATEGORY_TO_TEMPLATE[intent.category as Category];
    return await spawnResistanceForIntent({ db, countryId, intent, tokens });
  } catch (err) {
    console.warn("[IntentResistance] Spawn failed (never blocks commit):", err);
    return null;
  }
}
