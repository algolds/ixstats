"use client";

import { useRef, useState } from "react";
import { Progress } from "~/components/ui/progress";
import { RingGrid, type HeroRing } from "~/components/shared/country-hero/HeroSnapshotPanels";
import { cn } from "~/lib/utils/cn";
import {
  standingHighlights,
  type ConditionPillar,
  type DnaAxis,
  type NationalFact,
} from "./derive";
import { rankLabel } from "./labels";

/**
 * StandingBand — Country DNA, the hero's footer row: the vitality rings (each opens the vitality
 * breakdown), the strongest and weakest World Census ranks as chips, and the 0–100 condition
 * readings as meters with the national facts (geography and symbols) in a swipe strip under them.
 * Renders nothing with no rings, ranks, facts or readings.
 */
export function StandingBand({
  axes,
  facts,
  pillars,
  rings,
  onOpenRings,
}: {
  axes: readonly DnaAxis[];
  facts: readonly NationalFact[];
  pillars: readonly ConditionPillar[];
  rings: readonly HeroRing[];
  onOpenRings: () => void;
}) {
  if (axes.length + facts.length + pillars.length + rings.length === 0) return null;
  const { strengths, weaknesses } = standingHighlights(axes);

  return (
    <section
      aria-label="Country DNA"
      className="bg-surface-secondary rounded-row shadow-card flex flex-wrap items-start gap-x-7 gap-y-5 p-4"
    >
      {rings.length > 0 && (
        <RingGrid rings={rings} onOpen={onOpenRings} className="min-w-0 flex-[1_1_16rem]" />
      )}
      {axes.length > 0 && (
        <ul className="flex min-w-0 flex-[1_1_16rem] flex-wrap gap-1.5">
          {strengths.map((a) => (
            <li
              key={a.key}
              className="bg-tint-fill text-footnote text-label rounded-full px-2.5 py-1 tabular-nums"
            >
              <span className="font-semibold">#{a.rank}</span> {a.label}
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
      {(pillars.length > 0 || facts.length > 0) && (
        <div className="flex min-w-0 flex-[1_1_16rem] flex-col gap-3">
          {pillars.length > 0 && (
            <dl className="flex flex-col gap-2">
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
          {facts.length > 0 && <FactsStrip facts={facts} />}
        </div>
      )}
    </section>
  );
}

/** Facts per page: the strip shows a fresh pair on each page, never one carried over. */
const PER_PAGE = 2;

/**
 * The national facts as pages of two tiles that swipe on touch and scroll sideways on a trackpad,
 * snapping a whole page at a time (native scroll-snap: nothing moves on its own, so Reduce Motion
 * has nothing to stop). The strip is focusable, so arrow keys scroll it. The dots show the page and
 * jump to one; they are a pointer convenience, so they stay out of the tab order.
 */
function FactsStrip({ facts }: { facts: readonly NationalFact[] }) {
  const strip = useRef<HTMLUListElement>(null);
  const [page, setPage] = useState(0);
  const pages = Array.from({ length: Math.ceil(facts.length / PER_PAGE) }, (_, i) =>
    facts.slice(i * PER_PAGE, (i + 1) * PER_PAGE)
  );

  const onScroll = () => {
    const el = strip.current;
    if (el?.clientWidth) setPage(Math.round(el.scrollLeft / el.clientWidth));
  };

  const jumpTo = (index: number) => {
    const el = strip.current;
    const target = el?.children[index] as HTMLElement | undefined;
    if (el && target) el.scrollTo({ left: target.offsetLeft });
  };

  return (
    <div className="flex flex-col gap-2">
      <ul
        ref={strip}
        // Focusable so the keyboard can scroll it; the label names it for screen readers.
        tabIndex={0}
        aria-label="National facts"
        onScroll={onScroll}
        className="focus-visible:outline-tint rounded-row relative flex snap-x snap-mandatory [scrollbar-width:none] overflow-x-auto scroll-smooth focus-visible:outline-2 motion-reduce:scroll-auto"
      >
        {pages.map((pair) => (
          <li key={pair[0]?.key} className="w-full shrink-0 snap-start">
            <dl className="grid grid-cols-2 gap-2">
              {pair.map((f) => (
                <div
                  key={f.key}
                  className="bg-fill-4 rounded-row flex min-w-0 flex-col gap-0.5 px-3 py-2"
                >
                  <dt className="text-caption text-label-secondary">{f.label}</dt>
                  <dd className="text-footnote text-label line-clamp-2" title={f.value}>
                    {f.value}
                  </dd>
                </div>
              ))}
            </dl>
          </li>
        ))}
      </ul>
      {pages.length > 1 && (
        <div aria-hidden className="flex justify-center gap-1.5">
          {pages.map((pair, i) => (
            <button
              key={pair[0]?.key}
              type="button"
              tabIndex={-1}
              onClick={() => jumpTo(i)}
              className={cn(
                "size-1.5 cursor-pointer rounded-full transition-colors",
                i === page ? "bg-label" : "bg-fill-2 hover:bg-label-tertiary"
              )}
            />
          ))}
        </div>
      )}
    </div>
  );
}
