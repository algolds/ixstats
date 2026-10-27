/**
 * Read `EconomicProfile.sectorBreakdown` — the sector shares a nation recorded in the builder.
 *
 * The column has been written in two shapes over time:
 *  - an array of sectors (`[{ name, gdp, employment, ... }]`, the builder's save format), and
 *  - a flat record of shares (`{ services: 58, industry: 32, agriculture: 10 }`).
 *
 * Only entries with a name and a finite, positive share are returned; anything else (an
 * unparseable string, the builder's `structure` object, empty arrays) yields `[]` so callers can
 * show an empty state rather than a made-up split.
 */

export interface RecordedSector {
  name: string;
  /** Share of GDP, in percent (0–100). */
  share: number;
}

function toShare(value: unknown): number | null {
  const n = typeof value === "string" ? Number(value) : value;
  return typeof n === "number" && Number.isFinite(n) && n > 0 ? n : null;
}

export function parseSectorBreakdown(raw: unknown): RecordedSector[] {
  let parsed: unknown = raw;
  if (typeof raw === "string") {
    try {
      parsed = JSON.parse(raw);
    } catch {
      return [];
    }
  }
  if (!parsed || typeof parsed !== "object") return [];

  if (Array.isArray(parsed)) {
    const sectors: RecordedSector[] = [];
    for (const item of parsed) {
      if (!item || typeof item !== "object") continue;
      const obj = item as Record<string, unknown>;
      const name = obj.name ?? obj.label;
      const share = toShare(obj.gdp ?? obj.gdpContribution ?? obj.percentage ?? obj.share);
      if (typeof name === "string" && name.trim() && share != null) {
        sectors.push({ name: name.trim(), share });
      }
    }
    return sectors;
  }

  const sectors: RecordedSector[] = [];
  for (const [name, value] of Object.entries(parsed as Record<string, unknown>)) {
    const share = toShare(value);
    if (share != null) sectors.push({ name, share });
  }
  return sectors;
}
