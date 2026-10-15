"use client";

import { useMemo } from "react";
import { motion } from "motion/react";
import { InfoCircle } from "iconoir-react";
import { Button } from "~/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "~/components/ui/popover";
import { Skeleton } from "~/components/ui/skeleton";
import { Stat } from "~/components/ui/stat";
import { springSnappy } from "~/lib/design/motion";
import { cn } from "~/lib/utils/cn";
import {
  NATION_FIGURES,
  figureOf,
  type Figure,
  type FoundingSummary,
  type NationFigureCopy,
} from "../lib/founding-format";

/**
 * A figure under the Figure rule: a skeleton while it loads, "–" when it is unavailable, never 0
 * or NaN. A new value springs in.
 */
export function FigureValue({ figure, text }: { figure: Figure; text?: string }) {
  if (figure === undefined) {
    return <Skeleton as="span" data-testid="figure-loading" className="h-7 w-20" />;
  }
  if (figure === null) return <span aria-label="Unavailable">–</span>;
  return (
    <motion.span
      key={text}
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={springSnappy}
      className="inline-block"
    >
      {text}
    </motion.span>
  );
}

function About({ copy }: { copy: NationFigureCopy }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button type="button" variant="ghost" size="icon-sm" aria-label={`About ${copy.label}`}>
          <InfoCircle aria-hidden />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="text-footnote text-label-secondary">{copy.about}</PopoverContent>
    </Popover>
  );
}

function valueText(copy: NationFigureCopy, value: number, summary: FoundingSummary): string {
  return copy.id === "budgetBalancePercentOfGdp" ? summary.budgetBalanceLabel : copy.format(value);
}

/** What the screen reader hears when the figures change. */
export function announceSummary(summary: FoundingSummary | null | undefined): string {
  if (!summary) return "";
  return NATION_FIGURES.map((copy) => {
    const value = figureOf(summary, copy.id);
    return typeof value === "number" ? `${copy.label} ${valueText(copy, value, summary)}` : null;
  })
    .filter(Boolean)
    .join(", ");
}

interface NationCardProps {
  summary: FoundingSummary | null | undefined;
  /** Earlier figures shown while newer ones load: dimmed. */
  stale: boolean;
  /** Review shows the figures larger, each with a sentence on what it means. */
  size?: "sm" | "md";
  /** Announce changes; off for a second copy of the card on the same page. */
  announce?: boolean;
}

/** The live nation card: the server's dry run of the founding, in plain figures. */
export function NationCard({ summary, stale, size = "sm", announce = true }: NationCardProps) {
  const announcement = useMemo(() => announceSummary(summary), [summary]);
  const withSentences = size === "md";
  return (
    <div className="flex flex-col gap-3">
      <div
        aria-busy={stale || undefined}
        data-stale={stale || undefined}
        className={cn(
          "ease-out-facet grid gap-4 transition-opacity duration-150",
          withSentences ? "sm:grid-cols-2" : "grid-cols-2",
          stale && "opacity-60"
        )}
      >
        {NATION_FIGURES.map((copy) => {
          const figure = figureOf(summary, copy.id);
          const text =
            typeof figure === "number" && summary ? valueText(copy, figure, summary) : undefined;
          const hint =
            typeof figure === "number" && summary
              ? withSentences
                ? copy.sentence(figure, summary)
                : copy.id === "budgetBalancePercentOfGdp"
                  ? copy.format(figure)
                  : undefined
              : undefined;
          return (
            <Stat
              key={copy.id}
              size={size}
              value={<FigureValue figure={figure} text={text} />}
              label={
                <span className="inline-flex items-center gap-0.5">
                  {copy.label}
                  <About copy={copy} />
                </span>
              }
              hint={hint}
            />
          );
        })}
      </div>
      {summary === null && (
        <p className="text-footnote text-label-secondary">
          The figures could not be worked out just now. They update with your next change.
        </p>
      )}
      {announce && (
        <p className="sr-only" aria-live="polite">
          {announcement}
        </p>
      )}
    </div>
  );
}
