/**
 * Groups achievement unlock items in the feed by time so bursts of unlocks (from a single nation
 * or across nations during an evaluation sweep) fold into one entry instead of stacking back-to-back.
 */

export interface AchievementFeedLike {
  id?: string;
  source?: string;
  type?: string;
  category?: string;
  timestamp?: string | Date;
  user?: {
    id?: string;
    name?: string;
    countryName?: string | null;
    countryId?: string | null;
  } | null;
  content?: {
    title?: string;
    description?: string;
    metadata?: {
      category?: string;
      eventType?: string;
      achievementKey?: string;
      achievementName?: string;
    } | null;
  } | null;
  _grouped?: boolean;
  _isAchievementGroup?: boolean;
  _editCount?: number;
  _editors?: string[];
  _subEdits?: AchievementFeedLike[];
}

/** Unlocks within 2 hours fold into the newest unlock's slot even across intervening posts. */
const ACHIEVEMENT_BURST_WINDOW_MS = 2 * 60 * 60 * 1000;

/** Adjacent achievement entries with no other post between them merge within 24 hours. */
const ACHIEVEMENT_ADJACENT_WINDOW_MS = 24 * 60 * 60 * 1000;

const timeOf = (a: AchievementFeedLike): number =>
  a.timestamp ? new Date(a.timestamp).getTime() : Number.NaN;

const actorOf = (a: AchievementFeedLike): string =>
  a.user?.countryName || a.user?.name || "Unknown";

/** True when a feed item represents an achievement unlock (or an already-grouped achievement run). */
export function isAchievementItem(a: AchievementFeedLike): boolean {
  if (a._isAchievementGroup) return true;
  if ((a.source ?? "activity") !== "activity") return false;
  const meta = a.content?.metadata;
  if (
    a.type === "achievement" ||
    a.category === "achievement" ||
    meta?.category === "achievement" ||
    meta?.eventType === "achievement_unlocked" ||
    Boolean(meta?.achievementKey)
  ) {
    return true;
  }
  return /\bachievement\b/i.test(a.content?.title ?? "");
}

function membersOf<T extends AchievementFeedLike>(item: T): T[] {
  return item._isAchievementGroup && item._subEdits ? (item._subEdits as T[]) : [item];
}

function buildAchievementGroup<T extends AchievementFeedLike>(members: T[], index: number): T {
  if (members.length === 1) return members[0]!;
  const first = members[0]!;
  const editors = Array.from(new Set(members.map(actorOf).filter(Boolean)));
  return {
    ...first,
    id: `achievement-grouped-${first.id ?? index}-${members.length}`,
    type: "achievement",
    content: {
      ...first.content,
      title: `${members.length} achievements unlocked`,
    },
    _grouped: true,
    _isAchievementGroup: true,
    _editCount: members.length,
    _editors: editors,
    _subEdits: members,
  };
}

/** Pass 1: folds unlocks within `ACHIEVEMENT_BURST_WINDOW_MS` into the newest unlock's position. */
function foldBurstClusters<T extends AchievementFeedLike>(activities: T[]): T[] {
  const clusters: { anchorTime: number; items: T[] }[] = [];
  const ownerOf = new Map<T, { anchorTime: number; items: T[] }>();

  for (const item of activities) {
    if (!isAchievementItem(item)) continue;
    const t = timeOf(item);
    const prev = clusters[clusters.length - 1];
    if (prev && !Number.isNaN(t) && Math.abs(prev.anchorTime - t) <= ACHIEVEMENT_BURST_WINDOW_MS) {
      prev.items.push(item);
      ownerOf.set(item, prev);
    } else {
      const next = { anchorTime: t, items: [item] };
      clusters.push(next);
      ownerOf.set(item, next);
    }
  }

  return activities.flatMap((item, i) => {
    const cluster = ownerOf.get(item);
    if (!cluster) return [item];
    if (cluster.items[0] !== item) return [];
    const flattened = cluster.items.flatMap(membersOf);
    return [buildAchievementGroup(flattened, i)];
  });
}

/** Pass 2: collapses back-to-back achievement entries within `ACHIEVEMENT_ADJACENT_WINDOW_MS`. */
function mergeAdjacentAchievements<T extends AchievementFeedLike>(activities: T[]): T[] {
  const result: T[] = [];
  let i = 0;
  while (i < activities.length) {
    const current = activities[i]!;
    if (!isAchievementItem(current)) {
      result.push(current);
      i++;
      continue;
    }
    const run: T[] = [current];
    let end = i + 1;
    while (end < activities.length && isAchievementItem(activities[end]!)) {
      const prevTime = timeOf(activities[end - 1]!);
      const nextTime = timeOf(activities[end]!);
      if (
        Number.isNaN(prevTime) ||
        Number.isNaN(nextTime) ||
        Math.abs(prevTime - nextTime) > ACHIEVEMENT_ADJACENT_WINDOW_MS
      ) {
        break;
      }
      run.push(activities[end]!);
      end++;
    }
    result.push(buildAchievementGroup(run.flatMap(membersOf), i));
    i = end;
  }
  return result;
}

export function groupAchievements<T extends AchievementFeedLike>(activities: T[]): T[] {
  return mergeAdjacentAchievements(foldBurstClusters(activities));
}
