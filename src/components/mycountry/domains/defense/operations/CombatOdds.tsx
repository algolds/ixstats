"use client";

/**
 * The odds screen (realm time D3): the factor breakdown from raw strength through each multiplier to the effective
 * ratio, the chance of taking ground and each outcome band as ranges under intelligence uncertainty, and the
 * campaign preview's distributions. Everything about the enemy is an estimate; the server never sends true values.
 */
import { BAND_LABELS, OUTCOME_BANDS, TERRAIN_LABELS, type FactorKey } from "~/lib/military/combat";
import { formatCompactNumber } from "~/lib/utils/format-utils";
import type { RouterOutputs } from "~/trpc/react";

export type CombatOddsData = RouterOutputs["security"]["getCombatOdds"];

interface RangeValue {
  low: number;
  estimate: number;
  high: number;
}

const FACTOR_LABELS: Record<FactorKey, string> = {
  reach: "Reach",
  surprise: "Surprise",
  air: "Air",
  supply: "Supply",
  doctrine: "Doctrine",
  posture: "Posture",
  terrain: "Terrain",
  fortification: "Fortification",
};

const SOURCE_LABELS = {
  map: "from the realm map",
  declared: "the defender's declared terrain",
  default: "typical terrain (no map data)",
} as const;

const pct = (value: number) => `${Math.round(value * 100)}%`;
const ratio = (value: number) => `${value.toFixed(2)}:1`;
const times = (value: number) => `×${value.toFixed(2)}`;

/** "62% to 71%", or one figure when the range is narrower than the rounding. */
export function formatRange(range: RangeValue, format: (value: number) => string): string {
  const low = format(range.low);
  const high = format(range.high);
  return low === high ? low : `${low} to ${high}`;
}

function Row({ label, value, muted }: { label: string; value: string; muted?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className={muted ? "text-label-secondary" : "text-label"}>{label}</dt>
      <dd className="font-medium tabular-nums">{value}</dd>
    </div>
  );
}

function Breakdown({ data }: { data: CombatOddsData }) {
  const { odds } = data;
  return (
    <dl className="text-footnote space-y-1">
      <Row label="Your committed strength" value={formatCompactNumber(odds.attackerStrength)} />
      {odds.attackerFactors.map((f) => (
        <Row
          key={`a-${f.key}`}
          label={f.key === "air" ? `${FACTOR_LABELS[f.key]} (estimated)` : FACTOR_LABELS[f.key]}
          value={times(f.value)}
          muted
        />
      ))}
      {odds.attackerCapped && (
        <p className="text-label-secondary">Your multipliers are capped at ×4.</p>
      )}
      <Row
        label="Enemy strength (estimate)"
        value={formatRange(odds.defenderStrength, (v) => formatCompactNumber(v))}
      />
      {odds.defenderFactors.map((f) => (
        <Row
          key={`d-${f.key}`}
          label={f.estimated ? `${FACTOR_LABELS[f.key]} (estimated)` : FACTOR_LABELS[f.key]}
          value={times(f.value)}
          muted
        />
      ))}
      <Row label="Raw ratio" value={formatRange(odds.rawRatio, ratio)} />
      <Row label="Effective ratio" value={formatRange(odds.effectiveRatio, ratio)} />
    </dl>
  );
}

function Preview({ data }: { data: CombatOddsData }) {
  const { preview } = data;
  const spread = (p: { p10: number; p50: number; p90: number }, format: (v: number) => string) =>
    `${format(p.p50)} (${format(p.p10)} to ${format(p.p90)})`;
  const count = (v: number) => formatCompactNumber(Math.round(v));
  return (
    <dl className="text-footnote space-y-1">
      <Row label="Took ground" value={pct(preview.objective)} />
      <Row label="Your casualties" value={spread(preview.attackerCasualties, count)} />
      <Row label="Enemy casualties" value={spread(preview.defenderCasualties, count)} />
      <Row label="Days of fighting" value={spread(preview.days, (v) => String(Math.round(v)))} />
    </dl>
  );
}

export function CombatOdds({ data }: { data: CombatOddsData }) {
  const { odds, theatre } = data;
  const where = theatre.neighbours
    ? `${Math.round(theatre.borderKm).toLocaleString("en-US")} km shared border`
    : `${Math.round(theatre.distanceKm).toLocaleString("en-US")} km away`;
  return (
    <div className="space-y-3" aria-label="Odds">
      <p className="text-label-secondary text-footnote">
        {TERRAIN_LABELS[theatre.terrainClass]}
        {theatre.riverLine ? " behind a river line" : ""}, {SOURCE_LABELS[theatre.source]}; {where}.
      </p>
      <div>
        <p className="text-body">
          Chance of taking ground:{" "}
          <span className="font-semibold tabular-nums">{formatRange(odds.success, pct)}</span>
        </p>
        <p className="text-label-secondary text-footnote">
          Your intelligence puts the enemy within ×{Math.exp(odds.sigma).toFixed(1)} of its estimate. Better
          relations, R&amp;D and a reconnaissance operation narrow it.
        </p>
      </div>
      <dl className="text-footnote space-y-1">
        {[...OUTCOME_BANDS].reverse().map((band) => (
          <Row key={band} label={BAND_LABELS[band]} value={formatRange(odds.bands[band], pct)} />
        ))}
      </dl>
      <details className="text-footnote">
        <summary className="text-label cursor-pointer">How the odds are built</summary>
        <div className="mt-2">
          <Breakdown data={data} />
        </div>
      </details>
      <div>
        <p className="text-label text-footnote mb-1 font-medium">
          In {data.preview.runs.toLocaleString("en-US")} simulations
        </p>
        <Preview data={data} />
      </div>
    </div>
  );
}
