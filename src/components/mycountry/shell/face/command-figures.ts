import type { useCountryData } from "~/components/mycountry/shared/primitives";

/** Executive bandwidth state as served by `policies.getPolicyReconContext` (lib/government/exec-bandwidth.ts). */
export interface ExecBandwidthInput {
  capacity: number;
  used: number;
  available: number;
  overCapacity: boolean;
  breakdown?: {
    governmentStaff: number;
    recon: number;
    policies: number;
    directives: number;
    delegatedIssues: number;
  } | null;
}

/** The executive bandwidth reading: real executive bandwidth used/capacity, with the weekly directive slots in the tooltip. */
export function describeExecBandwidth(
  execBandwidth: ExecBandwidthInput | null | undefined,
  slots: { used: number; cap: number } | null | undefined
): { value: string; title: string } {
  const slotLine = slots
    ? `Directives this week: ${slots.used}/${slots.cap} slots used.`
    : "Directive slots unavailable.";
  if (
    !execBandwidth ||
    !Number.isFinite(execBandwidth.capacity) ||
    !Number.isFinite(execBandwidth.used)
  ) {
    return { value: "–", title: `Executive bandwidth unavailable. ${slotLine}` };
  }
  const b = execBandwidth.breakdown;
  const breakdown = b
    ? ` Staff ${b.governmentStaff}, policies ${b.policies}, directives ${b.directives}, recon ${b.recon}, delegated issues ${b.delegatedIssues}.`
    : "";
  const status = execBandwidth.overCapacity ? " Over capacity." : "";
  return {
    value: `${Math.round(execBandwidth.used)}/${Math.round(execBandwidth.capacity)}`,
    title:
      `Executive bandwidth: ${Math.round(execBandwidth.used)} used of ${Math.round(execBandwidth.capacity)} ` +
      `(${Math.round(execBandwidth.available)} available).${status}${breakdown} ${slotLine}`,
  };
}

/** Share of executive bandwidth in use, 0–100; null when the capacity is unknown. */
export function execBandwidthPercent(
  execBandwidth: ExecBandwidthInput | null | undefined
): number | null {
  if (!execBandwidth || !Number.isFinite(execBandwidth.capacity) || execBandwidth.capacity <= 0)
    return null;
  return Math.min(100, Math.max(0, (execBandwidth.used / execBandwidth.capacity) * 100));
}

/** Share of this week's directive slots in use, 0–100; null without a cap. */
export function slotPercent(
  slots: { used: number; cap: number } | null | undefined
): number | null {
  if (!slots || !Number.isFinite(slots.cap) || slots.cap <= 0) return null;
  return Math.min(100, Math.max(0, (slots.used / slots.cap) * 100));
}

type CommandCountry = ReturnType<typeof useCountryData>["country"];

function finiteScore(raw: number | null | undefined): number | null {
  return typeof raw === "number" && Number.isFinite(raw) ? Math.round(raw) : null;
}

const positiveOrNull = (value: number | null | undefined): number | null =>
  typeof value === "number" && Number.isFinite(value) && value > 0 ? value : null;

/**
 * Population, GDP and internal stability; null (shown as a dash) when the record has none.
 * Stability is the score Defense shows (`security.getInternalStability`, computed on read), with the
 * stored row as the fallback while that loads.
 */
export function deriveFigures(country: CommandCountry, computedStability?: number | null) {
  const population = positiveOrNull(country?.currentPopulation ?? country?.population);
  const gdpPerCapita = positiveOrNull(country?.currentGdpPerCapita);
  const totalGdp =
    positiveOrNull(country?.currentTotalGdp ?? country?.gdp) ??
    (population !== null && gdpPerCapita !== null ? population * gdpPerCapita : null);
  return {
    population,
    totalGdp,
    gdpPerCapita,
    // Internal stability (0-100): computed, else the stored InternalStabilityMetrics row
    stabilityPct:
      finiteScore(computedStability) ?? finiteScore(country?.stabilityMetrics?.stabilityScore),
  };
}
