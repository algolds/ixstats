import { Progress } from "~/components/ui/progress";
import { RingGrid, type HeroRing } from "~/components/shared/country-hero/HeroSnapshotPanels";
import { standingHighlights, type ConditionPillar, type DnaAxis } from "./derive";
import { rankLabel } from "./labels";

/**
 * StandingBand — Country DNA, the hero's footer row: the vitality rings (each opens the vitality
 * breakdown), the strongest and weakest World Census ranks as chips, and the 0–100 condition
 * readings as meters. Renders nothing with no rings, ranks or readings.
 */
export function StandingBand({
  axes,
  pillars,
  rings,
  onOpenRings,
}: {
  axes: readonly DnaAxis[];
  pillars: readonly ConditionPillar[];
  rings: readonly HeroRing[];
  onOpenRings: () => void;
}) {
  if (axes.length === 0 && pillars.length === 0 && rings.length === 0) return null;
  const { strengths, weaknesses } = standingHighlights(axes);

  return (
    <section
      aria-label="Country DNA"
      className="bg-surface-secondary rounded-row shadow-card flex flex-wrap items-center gap-x-7 gap-y-5 p-4"
    >
      {rings.length > 0 && (
        <RingGrid rings={rings} onOpen={onOpenRings} className="min-w-0 flex-[1_1_16rem]" />
      )}
      <div className="flex min-w-0 flex-[1_1_16rem] flex-col gap-3">
        {axes.length > 0 && (
          <ul className="flex flex-wrap gap-1.5">
            {strengths.map((a) => (
              <li
                key={a.key}
                className="bg-tint-fill text-footnote text-label rounded-full px-2.5 py-1 tabular-nums"
              >
                <span className="text-tint font-semibold">#{a.rank}</span> {a.label}
              </li>
            ))}
            {weaknesses.map((a) => (
              <li
                key={a.key}
                className="bg-fill-4 text-footnote text-label-secondary rounded-full px-2.5 py-1 tabular-nums"
              >
                {rankLabel(a.rank, a.total)} {a.label}
              </li>
            ))}
          </ul>
        )}
      </div>
      {pillars.length > 0 && (
        <dl className="flex min-w-0 flex-[1_1_16rem] flex-col gap-2">
          {pillars.map((p) => (
            <div
              key={p.key}
              className="text-footnote grid grid-cols-[7rem_minmax(0,1fr)_3.5rem] items-center gap-3"
            >
              <dt className="text-label-secondary">{p.label}</dt>
              <dd>
                <Progress value={p.value} aria-hidden className="h-1.5" />
              </dd>
              <dd className="text-label text-right font-semibold tabular-nums">{p.display}</dd>
            </div>
          ))}
        </dl>
      )}
    </section>
  );
}
