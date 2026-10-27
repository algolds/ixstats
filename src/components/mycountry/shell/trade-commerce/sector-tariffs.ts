/**
 * Saved per-sector tariffs for the Trade tab planner. They live beside the overall import tariff
 * in `FiscalSystem.exciseTaxRates`, keyed by sector (`sectorTariff:<sector key>`): as an object
 * key when the field is an object, or as a typed `{ type, rate }` entry when the builder stored
 * an excise list. Writes merge, so the tariff, capital gains and builder excise rates are kept.
 */

const PREFIX = "sectorTariff:";

function parseJson(raw: string | null | undefined): unknown {
  if (raw == null || raw === "") return undefined;
  try {
    return JSON.parse(raw);
  } catch {
    return undefined;
  }
}

const finite = (value: unknown): number | null =>
  typeof value === "number" && Number.isFinite(value) ? value : null;

/** The saved sector tariffs, by sector key. Sectors without a saved rate are absent. */
export function readSectorTariffs(raw: string | null | undefined): Record<string, number> {
  const parsed = parseJson(raw);
  const out: Record<string, number> = {};
  if (Array.isArray(parsed)) {
    for (const entry of parsed) {
      if (!entry || typeof entry !== "object") continue;
      const { type, rate } = entry as Record<string, unknown>;
      const value = finite(rate);
      if (typeof type === "string" && type.startsWith(PREFIX) && value != null) {
        out[type.slice(PREFIX.length)] = value;
      }
    }
  } else if (parsed && typeof parsed === "object") {
    for (const [key, rate] of Object.entries(parsed as Record<string, unknown>)) {
      const value = finite(rate);
      if (key.startsWith(PREFIX) && value != null) out[key.slice(PREFIX.length)] = value;
    }
  }
  return out;
}

/**
 * The new `exciseTaxRates` JSON with one sector's tariff set, or removed when `rate` is null
 * (the sector goes back to the overall tariff).
 */
export function exciseWithSectorTariff(
  raw: string | null | undefined,
  sectorKey: string,
  rate: number | null
): string {
  const name = `${PREFIX}${sectorKey}`;
  const parsed = parseJson(raw);
  if (Array.isArray(parsed)) {
    const others = parsed.filter(
      (e) => !(e && typeof e === "object" && (e as Record<string, unknown>).type === name)
    );
    return JSON.stringify(rate == null ? others : [...others, { type: name, rate }]);
  }
  const base =
    parsed && typeof parsed === "object" ? { ...(parsed as Record<string, unknown>) } : {};
  if (rate == null) delete base[name];
  else base[name] = rate;
  return JSON.stringify(base);
}
