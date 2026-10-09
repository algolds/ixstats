/** Owner decisions (phase 3 plan): points expire after 90 days; 5 active points = 7-day sitewide ban, 10 = 30 days. */
export const MODERATION_POLICY = {
  warningTtlDays: 90,
  /** Highest tier first. */
  autoBanTiers: [
    { points: 10, days: 30 },
    { points: 5, days: 7 },
  ],
  maxPointsPerWarning: { siteAdmin: 5, moderator: 2 },
} as const;

export type BanScope = "site" | "realm" | "category";
export const BAN_SCOPES: readonly BanScope[] = ["site", "realm", "category"];
export const DAY_MS = 24 * 60 * 60 * 1000;

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"] as const;

const SCOPE_PLACE: Record<BanScope, string> = {
  site: "the forum",
  realm: "this realm's forum",
  category: "this category",
};

/** Higher is stronger. */
const SCOPE_RANK: Record<BanScope, number> = { site: 3, realm: 2, category: 1 };

export function warningExpiry(createdAt: Date): Date {
  return new Date(createdAt.getTime() + MODERATION_POLICY.warningTtlDays * DAY_MS);
}

export function activePoints(
  warnings: ReadonlyArray<{ points: number; expiresAt: Date; revokedAt: Date | null }>,
  now: Date
): number {
  return warnings
    .filter((w) => w.revokedAt === null && w.expiresAt.getTime() > now.getTime())
    .reduce((sum, w) => sum + w.points, 0);
}

/** The highest tier reached, else null. */
export function autoBanTier(points: number): { points: number; days: number } | null {
  return MODERATION_POLICY.autoBanTiers.find((tier) => points >= tier.points) ?? null;
}

/** null days = permanent. */
export function banExpiry(days: number | null, from: Date): Date | null {
  return days === null ? null : new Date(from.getTime() + days * DAY_MS);
}

export function isBanActive(ban: { expiresAt: Date | null; liftedAt: Date | null }, now: Date): boolean {
  return ban.liftedAt === null && (ban.expiresAt === null || ban.expiresAt.getTime() > now.getTime());
}

function formatBanDate(date: Date): string {
  return `${date.getUTCDate()} ${MONTHS[date.getUTCMonth()]} ${date.getUTCFullYear()}`;
}

/** "You are banned from the forum until 12 Oct 2026: reason", or "...until a moderator lifts it" when permanent. */
export function banNotice(ban: { scope: BanScope; expiresAt: Date | null; reason: string }): string {
  const until = ban.expiresAt === null ? "a moderator lifts it" : formatBanDate(ban.expiresAt);
  const reason = ban.reason.trim();
  return `You are banned from ${SCOPE_PLACE[ban.scope]} until ${until}${reason ? `: ${reason}` : "."}`;
}

/** site > realm > category, then permanent > later expiry. */
export function strongestBan<T extends { scope: BanScope; expiresAt: Date | null }>(bans: readonly T[]): T | null {
  const end = (ban: T) => (ban.expiresAt === null ? Infinity : ban.expiresAt.getTime());
  return bans.reduce<T | null>((best, ban) => {
    if (best === null) return ban;
    const byScope = SCOPE_RANK[ban.scope] - SCOPE_RANK[best.scope];
    if (byScope !== 0) return byScope > 0 ? ban : best;
    return end(ban) > end(best) ? ban : best;
  }, null);
}
