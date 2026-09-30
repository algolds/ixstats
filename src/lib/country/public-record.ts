/**
 * Country public record — the one definition of what a visitor may see of a nation's
 * statecraft. Pure (no React, no Prisma): the server (`countries.getPublicRecord`,
 * `intent.getTree` for non-owners) filters with these constants and shapes rows with these
 * mappers, and the profile layer re-exports them (`src/app/countries/[slug]/_utils/profileLayer.ts`).
 *
 * - Directives: only enacted ones (`active` = in force, `completed`). Drafts (`proposed`, which
 *   also carry `tier: "proposed"`) and `abandoned` directives stay private, and so do the
 *   package line items (`changesJson`), CivCap and cooldowns.
 * - National issues: only resolved ones (`responded`, `auto_resolved`) with the decision label
 *   and the engine's outcome summary. Open, expired and dismissed issues stay private.
 */

// ─── Directives ─────────────────────────────────────────────────────────────

export type PublicDirectiveStatus = "active" | "completed";

/** Statuses a visitor may see: declared (in force) and completed. */
export const PUBLIC_DIRECTIVE_STATUSES: readonly PublicDirectiveStatus[] = ["active", "completed"];

/** The draft tier: a directive saved but never committed. */
export const DRAFT_DIRECTIVE_TIER = "proposed";

export function isPublicDirective(row: { status: string; tier?: string | null }): boolean {
  return (
    (PUBLIC_DIRECTIVE_STATUSES as readonly string[]).includes(row.status) &&
    row.tier !== DRAFT_DIRECTIVE_TIER
  );
}

export interface IntentLike {
  id: string;
  goal: string;
  tier: string;
  category: string;
  status: string;
  summary?: string | null;
  progress?: number | null;
  riskRating?: string | null;
  createdIxTime: number;
}

export interface PublicDirective {
  id: string;
  goal: string;
  summary: string | null;
  tier: string;
  category: string;
  status: PublicDirectiveStatus;
  progress: number;
  createdIxTime: number;
}

/** Enacted directives only, newest first. `changesJson`, CivCap and cooldowns are never copied. */
export function toPublicDirectives(
  intents: readonly IntentLike[] | null | undefined
): PublicDirective[] {
  return (intents ?? [])
    .filter((i): i is IntentLike & { status: PublicDirectiveStatus } => isPublicDirective(i))
    .map((i) => ({
      id: i.id,
      goal: i.goal,
      summary: i.summary?.trim() || null,
      tier: i.tier,
      category: i.category,
      status: i.status,
      progress: Math.max(
        0,
        Math.min(100, Math.round(i.progress ?? (i.status === "completed" ? 100 : 0)))
      ),
      createdIxTime: i.createdIxTime,
    }))
    .sort((a, b) => b.createdIxTime - a.createdIxTime);
}

// ─── National issues ────────────────────────────────────────────────────────

/** Issues that reached a public outcome. */
export const PUBLIC_ISSUE_STATUSES = ["responded", "auto_resolved"] as const;

export interface IssueLike {
  id: string;
  title: string;
  domain: string;
  status: string;
  severity?: string | null;
  chosenOptionLabel?: string | null;
  autoResolveLabel?: string | null;
  consequenceLog?: string | null;
  respondedIxTime?: number | null;
  createdIxTime?: number | null;
}

export interface PublicIssueOutcome {
  id: string;
  title: string;
  domain: string;
  /** The response the government chose (or the default that applied when it lapsed). */
  decision: string | null;
  /** The engine's plain-language summary of what happened. */
  outcome: string | null;
  resolvedBy: "government" | "default";
  /** When it was resolved (IxTime ms); the creation time for legacy rows without one. */
  ixTime: number | null;
}

export function toPublicIssueOutcomes(
  issues: readonly IssueLike[] | null | undefined
): PublicIssueOutcome[] {
  return (issues ?? [])
    .filter((i) => (PUBLIC_ISSUE_STATUSES as readonly string[]).includes(i.status))
    .map((i) => ({
      id: i.id,
      title: i.title,
      domain: i.domain,
      decision:
        (i.status === "responded" ? i.chosenOptionLabel : i.autoResolveLabel)?.trim() ||
        i.chosenOptionLabel?.trim() ||
        null,
      outcome: i.consequenceLog?.trim() || null,
      resolvedBy: i.status === "responded" ? ("government" as const) : ("default" as const),
      ixTime: i.respondedIxTime ?? i.createdIxTime ?? null,
    }))
    .sort((a, b) => (b.ixTime ?? 0) - (a.ixTime ?? 0));
}
