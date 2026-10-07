/**
 * The wizard's region → nation mapping: which regions are named, ignored (sea, background) or left out, and the
 * mapping an apply job takes. Several regions may name one nation (two colours, an island drawn apart): they are
 * merged into one border. Pure, client-safe.
 */
import type { ImportRegion } from "./options";

export interface RegionMappingPlan {
  /** Region key → nation; ignored and unnamed regions are left out. */
  mapping: Record<string, string>;
  mapped: number;
  ignored: number;
  /** Regions neither named nor ignored: not imported. */
  unmapped: number;
  /** Distinct nations named. */
  nations: number;
  /** Nations named by more than one region (merged into one border). */
  merged: string[];
}

export function planRegionMapping(
  regions: readonly ImportRegion[],
  assignments: Readonly<Record<string, string>>,
  ignored: ReadonlySet<string>
): RegionMappingPlan {
  const mapping: Record<string, string> = {};
  const count = new Map<string, number>();
  let ignoredCount = 0;
  for (const region of regions) {
    if (ignored.has(region.key)) {
      ignoredCount++;
      continue;
    }
    const nation = assignments[region.key]?.trim();
    if (!nation) continue;
    mapping[region.key] = nation;
    count.set(nation, (count.get(nation) ?? 0) + 1);
  }
  const mapped = Object.keys(mapping).length;
  return {
    mapping,
    mapped,
    ignored: ignoredCount,
    unmapped: regions.length - mapped - ignoredCount,
    nations: count.size,
    merged: [...count].filter(([, n]) => n > 1).map(([nation]) => nation),
  };
}

/** The mapper's starting point: the analysis's suggestions, with water and empty regions ignored. */
export function initialMapping(
  regions: readonly ImportRegion[],
  suggested: Readonly<Record<string, string | null>>
): { assignments: Record<string, string>; ignored: Set<string> } {
  const assignments: Record<string, string> = {};
  const ignored = new Set<string>();
  for (const region of regions) {
    if (region.water || region.pixels === 0) ignored.add(region.key);
    const nation = suggested[region.key];
    if (nation) assignments[region.key] = nation;
  }
  return { assignments, ignored };
}
