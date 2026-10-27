"use client";

/**
 * A resolved battle (realm time D3): the outcome band, how long it lasted, the side's losses, and the seed it was
 * rolled from (fixed when the orders were committed, shown once resolved so anyone can see it was never rerolled).
 */
import { BAND_LABELS, OUTCOME_BANDS, type OutcomeBand } from "~/lib/military/combat";

const isBand = (value: string | null | undefined): value is OutcomeBand =>
  OUTCOME_BANDS.some((b) => b === value);

export interface CombatResultProps {
  band: string | null | undefined;
  days: number | null | undefined;
  casualties: number | null | undefined;
  seed: string | null | undefined;
  /** The viewer attacked (bands read from the attacker's side). */
  attacker: boolean;
}

export function CombatResult({ band, days, casualties, seed, attacker }: CombatResultProps) {
  if (!isBand(band)) return null;
  const outcome = attacker ? BAND_LABELS[band] : `Attacker: ${BAND_LABELS[band].toLowerCase()}`;
  const parts = [
    outcome,
    days ? `${days} ${days === 1 ? "day" : "days"}` : null,
    casualties !== null && casualties !== undefined
      ? `${casualties.toLocaleString("en-US")} casualties`
      : null,
  ].filter(Boolean);
  return (
    <div className="text-label-secondary text-footnote space-y-0.5">
      <p>{parts.join(" · ")}</p>
      {seed && (
        <p className="truncate" title={seed}>
          Seed <span className="font-mono">{seed.slice(0, 16)}</span>
        </p>
      )}
    </div>
  );
}
