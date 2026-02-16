/**
 * Diplomatic News Auto-Generator (Phase 5)
 *
 * Template engine that creates ThinkPages posts when significant diplomatic,
 * military, or political events occur. Called from tRPC router mutations.
 *
 * Posts are created using a country's "government" or "media" ThinkPages account.
 */

import type { PrismaClient } from "@prisma/client";

// ============================================================
// Event types and templates
// ============================================================

type NewsEventType =
  | "embassy_established"
  | "embargo_imposed"
  | "sanction_imposed"
  | "free_trade_signed"
  | "military_alliance_signed"
  | "blockade_imposed"
  | "policy_lifted"
  | "alliance_formed"
  | "alliance_action_approved"
  | "military_deployed"
  | "operation_ended"
  | "election_result"
  | "pvp_conflict_proposed"
  | "pvp_conflict_accepted"
  | "pvnpc_conflict_resolved";

interface NewsContext {
  countryName?: string;
  targetName?: string;
  allianceName?: string;
  operationName?: string;
  partyName?: string;
  actionType?: string;
  severity?: string;
  seats?: number;
  percentage?: string;
  personnel?: number;
  winner?: string;
  reason?: string;
}

const NEWS_TEMPLATES: Record<NewsEventType, (ctx: NewsContext) => { content: string; hashtags: string[] }> = {
  embassy_established: (ctx) => ({
    content: `ICN Geo: ${ctx.countryName} and ${ctx.targetName} establish formal diplomatic relations. Embassy construction to begin immediately.`,
    hashtags: ["Diplomacy", "Embassy", "InternationalRelations"],
  }),
  embargo_imposed: (ctx) => ({
    content: `URGENT: ${ctx.countryName} imposes ${ctx.severity ?? "moderate"} trade embargo on ${ctx.targetName}. ${ctx.reason ? `Reason: "${ctx.reason}"` : "Markets expected to react."}`,
    hashtags: ["Embargo", "Trade", "ForeignPolicy"],
  }),
  sanction_imposed: (ctx) => ({
    content: `${ctx.countryName} announces ${ctx.severity ?? "moderate"} economic sanctions against ${ctx.targetName}. Sector restrictions take effect immediately.`,
    hashtags: ["Sanctions", "ForeignPolicy", "Economics"],
  }),
  free_trade_signed: (ctx) => ({
    content: `${ctx.countryName} and ${ctx.targetName} sign free trade agreement. Both economies expected to benefit from reduced trade barriers.`,
    hashtags: ["FreeTrade", "Economics", "Diplomacy"],
  }),
  military_alliance_signed: (ctx) => ({
    content: `BREAKING: ${ctx.countryName} and ${ctx.targetName} enter mutual defense pact. Military cooperation to deepen.`,
    hashtags: ["MilitaryAlliance", "Defense", "Security"],
  }),
  blockade_imposed: (ctx) => ({
    content: `ALERT: ${ctx.countryName} initiates naval blockade of ${ctx.targetName}. Shipping routes disrupted. International community urges restraint.`,
    hashtags: ["Blockade", "Military", "Crisis"],
  }),
  policy_lifted: (ctx) => ({
    content: `${ctx.countryName} lifts ${ctx.actionType ?? "foreign policy action"} against ${ctx.targetName}. Diplomatic recovery expected.`,
    hashtags: ["Diplomacy", "ForeignPolicy", "Deescalation"],
  }),
  alliance_formed: (ctx) => ({
    content: `New alliance formed: "${ctx.allianceName}" established by ${ctx.countryName}. Open for membership applications.`,
    hashtags: ["Alliance", "Diplomacy", "InternationalRelations"],
  }),
  alliance_action_approved: (ctx) => ({
    content: `${ctx.allianceName} approves collective action: ${ctx.actionType?.replace("_", " ")}. Member states to coordinate implementation.`,
    hashtags: ["Alliance", "CollectiveAction", "Diplomacy"],
  }),
  military_deployed: (ctx) => ({
    content: `Defense: ${ctx.countryName} deploys ${ctx.personnel?.toLocaleString() ?? "forces"} for ${ctx.operationName ?? "military operation"}. ${ctx.targetName ? `Area of operations: ${ctx.targetName}.` : ""}`,
    hashtags: ["Military", "Deployment", "Defense"],
  }),
  operation_ended: (ctx) => ({
    content: `${ctx.countryName} concludes military operation "${ctx.operationName}". Forces returning to base.`,
    hashtags: ["Military", "Defense", "Operations"],
  }),
  election_result: (ctx) => ({
    content: `Election: ${ctx.partyName} wins ${ctx.seats} seats (${ctx.percentage}%) in ${ctx.countryName} parliament. ${ctx.winner ? `${ctx.winner} leads new government.` : ""}`,
    hashtags: ["Election", "Politics", "Democracy"],
  }),
  pvp_conflict_proposed: (ctx) => ({
    content: `BREAKING: ${ctx.countryName} issues military challenge to ${ctx.targetName}. ${ctx.reason ? `Casus belli: "${ctx.reason}"` : "Awaiting response."}`,
    hashtags: ["Conflict", "Military", "Crisis"],
  }),
  pvp_conflict_accepted: (ctx) => ({
    content: `WAR: ${ctx.countryName} and ${ctx.targetName} enter military conflict. International community watches closely.`,
    hashtags: ["War", "Conflict", "Military", "Breaking"],
  }),
  pvnpc_conflict_resolved: (ctx) => ({
    content: `Military engagement between ${ctx.countryName} and ${ctx.targetName} concluded. ${ctx.winner ? `${ctx.winner} claims victory.` : "Outcome disputed."}`,
    hashtags: ["Military", "Conflict", "Resolution"],
  }),
};

// ============================================================
// Main generator function
// ============================================================

/**
 * Generate a diplomatic news post on ThinkPages.
 *
 * Finds the country's "government" or "media" ThinkPages account
 * and creates a post with the appropriate template.
 *
 * @returns The created post ID, or null if no suitable account found
 */
export async function generateDiplomaticNews(
  db: PrismaClient,
  countryId: string,
  eventType: NewsEventType,
  context: NewsContext
): Promise<string | null> {
  try {
    // Find the country's government or media ThinkPages account
    const account = await db.thinkpagesAccount.findFirst({
      where: {
        countryId,
        isActive: true,
        accountType: { in: ["government", "media"] },
      },
      orderBy: {
        // Prefer government account, then media
        accountType: "asc",
      },
    });

    if (!account) {
      // No suitable account — skip silently
      return null;
    }

    // Generate content from template
    const template = NEWS_TEMPLATES[eventType];
    if (!template) return null;

    const { content, hashtags } = template(context);

    // Truncate content to 280 chars (ThinkPages limit)
    const truncatedContent = content.length > 280 ? content.slice(0, 277) + "..." : content;

    // Create the post directly in database
    // hashtags stored as JSON string, ixTimeTimestamp required
    const post = await db.thinkpagesPost.create({
      data: {
        accountId: account.id,
        content: truncatedContent,
        hashtags: JSON.stringify(hashtags),
        postType: "original",
        visibility: "public",
        isAutoGenerated: true,
        ixTimeTimestamp: new Date(),
      },
    });

    return post.id;
  } catch (error) {
    // Auto-news failure should never break the main operation
    console.error(`[DiplomaticNews] Failed to generate news for ${eventType}:`, error);
    return null;
  }
}
