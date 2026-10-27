/**
 * Passport showcase: unlocked achievements and the ribbons derived from them.
 *
 * A ribbon is not a separate record: every `UserAchievement` row is one ribbon, styled by the
 * achievement's category (the stripe) and rarity (the device). `UserAchievement.userId` holds the
 * user's Clerk id. This module only reads; unlocking stays in `lib/achievements`.
 */
import { db } from "~/server/db";

/** Highest rarity first. Unknown rarities sort after Common. */
const RIBBON_RARITY_ORDER = ["Legendary", "Epic", "Rare", "Uncommon", "Common"] as const;

/** How many ribbons the country-page rack shows. */
export const COUNTRY_RACK_SIZE = 3;

export interface PassportRibbon {
  /** Achievement key, e.g. "econ-first-million". */
  key: string;
  title: string;
  description: string;
  category: string;
  rarity: string;
  iconUrl: string | null;
  points: number;
  unlockedAt: string;
  /** Pinned by the owner to the signature shelf. */
  pinned: boolean;
}

export interface PassportAchievementsShowcase {
  unlockedCount: number;
  /** Active achievements in the catalogue, or null when the count could not be read. */
  totalCount: number | null;
  points: number;
  /** Every ribbon: pinned first (in pin order), then by rarity, then newest. */
  ribbons: PassportRibbon[];
}

export interface UnlockRow {
  achievementId: string;
  title: string;
  description: string;
  category: string;
  rarity: string;
  iconUrl: string | null;
  unlockedAt: Date;
  achievement: { points: number } | null;
}

function rarityRank(rarity: string): number {
  const index = (RIBBON_RARITY_ORDER as readonly string[]).indexOf(rarity);
  return index === -1 ? RIBBON_RARITY_ORDER.length : index;
}

/** Order unlocks into ribbons: pinned first (in pin order), then rarest, then newest. Pure. */
export function toRibbons(
  unlocks: ReadonlyArray<UnlockRow>,
  pinnedKeys: ReadonlyArray<string>
): PassportRibbon[] {
  const pinIndex = (key: string) => {
    const index = pinnedKeys.indexOf(key);
    return index === -1 ? Number.POSITIVE_INFINITY : index;
  };
  return [...unlocks]
    .sort(
      (a, b) =>
        pinIndex(a.achievementId) - pinIndex(b.achievementId) ||
        rarityRank(a.rarity) - rarityRank(b.rarity) ||
        b.unlockedAt.getTime() - a.unlockedAt.getTime()
    )
    .map((u) => ({
      key: u.achievementId,
      title: u.title,
      description: u.description,
      category: u.category,
      rarity: u.rarity,
      iconUrl: u.iconUrl,
      points: u.achievement?.points ?? 0,
      unlockedAt: u.unlockedAt.toISOString(),
      pinned: pinnedKeys.includes(u.achievementId),
    }));
}

const UNLOCK_SELECT = {
  achievementId: true,
  title: true,
  description: true,
  category: true,
  rarity: true,
  iconUrl: true,
  unlockedAt: true,
  achievement: { select: { points: true } },
} as const;

/** Every achievement a user unlocked, keyed by their Clerk id. Empty on a read failure. */
export async function loadUnlocks(clerkUserId: string | null | undefined): Promise<UnlockRow[]> {
  if (!clerkUserId) return [];
  return db.userAchievement
    .findMany({ where: { userId: clerkUserId }, select: UNLOCK_SELECT })
    .catch((err: unknown) => {
      console.warn("[PassportShowcase] Failed to load achievements for", clerkUserId, err);
      return [];
    });
}

/** The achievements section of a passport. */
export async function loadAchievementsShowcase(
  clerkUserId: string | null | undefined,
  pinnedKeys: ReadonlyArray<string>
): Promise<PassportAchievementsShowcase> {
  const [unlocks, totalCount] = await Promise.all([
    loadUnlocks(clerkUserId),
    db.achievement.count({ where: { isActive: true } }).catch(() => null),
  ]);
  const ribbons = toRibbons(unlocks, pinnedKeys);
  return {
    unlockedCount: ribbons.length,
    totalCount,
    points: ribbons.reduce((sum, r) => sum + r.points, 0),
    ribbons,
  };
}

/** Keep only pin keys that name an achievement the user has unlocked, in order, without repeats. */
export function validPinnedKeys(
  requested: ReadonlyArray<string>,
  unlockedKeys: ReadonlyArray<string>,
  max: number
): string[] {
  const owned = new Set(unlockedKeys);
  return [...new Set(requested)].filter((key) => owned.has(key)).slice(0, max);
}
