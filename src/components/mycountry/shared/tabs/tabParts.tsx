"use client";

import React from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "motion/react";
import { StatUp as TrendingUp, StatDown as TrendingDown } from "iconoir-react";
import { Button } from "~/components/ui/button";
import { Card, CardContent } from "~/components/ui/card";
import { Eyebrow } from "~/components/ui/eyebrow";
import { InlineHelpIcon } from "~/components/ui/help-icon";
import { Tooltip, TooltipTrigger, TooltipContent } from "~/components/ui/tooltip";
import { cn, createUrl } from "~/lib/utils";
import { MetricCardGrid, useCountryData } from "~/components/mycountry/shared/primitives";
import type {
  CountryWithEconomicData,
  MappedEconomyData,
} from "~/components/mycountry/shared/primitives/CountryDataProvider";
import type { CardImageType } from "~/lib/cards/image-presets";
import type { extractCountryImageData } from "~/lib/media";
import type { MetricType } from "~/hooks/useMetricDetailsModal";
import type { MyCountryMetricView } from "~/hooks/useMyCountryMetrics";

export interface DataTabProps {
  country: CountryWithEconomicData;
  economyData: MappedEconomyData;
  countryImageData: ReturnType<typeof extractCountryImageData>;
  setImageUploadModalAction: (state: { isOpen: boolean; cardType: CardImageType }) => void;
  openMetricModalAction: (metricType: MetricType, countryId: string) => void;
  metricView: MyCountryMetricView;
  setMetricViewAction: React.Dispatch<React.SetStateAction<MyCountryMetricView>>;
}

/** What a tab's metric tiles need: the country, its data, the toggle state and the modal opener. */
export type MetricProps = Pick<
  DataTabProps,
  "country" | "economyData" | "metricView" | "setMetricViewAction" | "openMetricModalAction"
> & { currency: string };

type MetricViewSetter = DataTabProps["setMetricViewAction"];

/** Flips one metric-view toggle between its two values. */
export function toggleView<K extends keyof MyCountryMetricView>(
  setView: MetricViewSetter,
  key: K,
  a: MyCountryMetricView[K],
  b: MyCountryMetricView[K]
): void {
  setView((v) => ({ ...v, [key]: v[key] === a ? b : a }));
}

/** One open accordion section at a time; `section(id)` yields the props for a section. */
export function useAccordion(initial: string) {
  const [expanded, setExpanded] = React.useState<string | null>(initial);
  return (id: string) => ({
    isExpanded: expanded === id,
    onToggle: () => setExpanded((current) => (current === id ? null : id)),
  });
}

interface TabShellProps extends Pick<
  DataTabProps,
  "country" | "countryImageData" | "setImageUploadModalAction"
> {
  cardType: CardImageType;
  title: string;
  help: string;
  subtitle: string;
  editorIcon: React.ComponentType<{ className?: string }>;
  metrics: React.ReactNode;
  children: React.ReactNode;
}

/** Card chrome shared by the Economy, Labor and Government tabs: image wash, header, metrics, sections. */
export function TabShell({
  country,
  countryImageData,
  setImageUploadModalAction,
  cardType,
  title,
  help,
  subtitle,
  editorIcon: EditorIcon,
  metrics,
  children,
}: TabShellProps) {
  const { isPublicReadOnly } = useCountryData();
  return (
    <Card className="rounded-card relative overflow-hidden">
      <MetricCardGrid
        metrics={[]}
        backgroundImage={{
          countryId: country.id,
          cardType,
          showEditButton: !isPublicReadOnly,
          onEditClick: () => setImageUploadModalAction({ isOpen: true, cardType }),
          autoFallback: true,
          countryImageData: countryImageData ?? undefined,
          countryName: country.name,
        }}
        className="pointer-events-none absolute inset-0 z-0"
      />

      <CardContent className="relative z-10 space-y-4 pt-4 pb-4">
        <div className="border-separator flex items-center justify-between border-b pb-3">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-label text-headline">{title}</h3>
              <InlineHelpIcon title={title} content={help} />
            </div>
            <p className="text-label-secondary text-footnote">{subtitle}</p>
          </div>
          {!isPublicReadOnly && (
            <Link href={createUrl("/mycountry/editor")}>
              <Button size="sm" variant="outline" className="text-footnote h-8 gap-2">
                <EditorIcon className="h-3.5 w-3.5" />
                <span>Open editor</span>
              </Button>
            </Link>
          )}
        </div>

        {metrics}

        <div className="border-separator space-y-3 border-t pt-3">{children}</div>
      </CardContent>
    </Card>
  );
}

type MetricVariant = "card" | "button";

const GRID_GAP: Record<MetricVariant, string> = { card: "gap-2", button: "gap-3" };

/** Three-up row of {@link ToggleMetric}s under one explanatory tooltip. */
export function MetricToggleGrid({
  variant = "card",
  hint = "Click metric value to view history, click headers to toggle views",
  children,
}: {
  variant?: MetricVariant;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className={cn("grid grid-cols-3", GRID_GAP[variant])}>{children}</div>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="text-footnote">
        {hint}
      </TooltipContent>
    </Tooltip>
  );
}

interface ToggleMetricProps {
  variant?: MetricVariant;
  label: string;
  /** Renders the label in sentence case rather than the uppercase stat style. */
  eyebrow?: boolean;
  /** Remounts (and so re-animates) the value when it changes. */
  valueKey: string;
  value: React.ReactNode;
  valueClassName?: string;
  animated?: boolean;
  /** Extra content beside the value, e.g. a growth badge. */
  aside?: React.ReactNode;
  detail?: React.ReactNode;
  detailClassName?: string;
  onToggle?: () => void;
  /** Makes the value itself a link to the metric's history modal. */
  onValueClick?: () => void;
}

/** A metric tile whose header toggles between two views and whose value opens its details. */
export function ToggleMetric({
  variant = "card",
  label,
  eyebrow,
  valueKey,
  value,
  valueClassName = "text-title-3",
  animated = true,
  aside,
  detail,
  detailClassName = "truncate",
  onToggle,
  onValueClick,
}: ToggleMetricProps) {
  const valueClass = cn("text-label", valueClassName, onValueClick && "hover:underline");
  const body = (
    <>
      {eyebrow ? (
        <Eyebrow className="block">{label}</Eyebrow>
      ) : (
        <span className="text-stat-label text-label-secondary block">{label}</span>
      )}
      <div
        className={cn("flex items-center gap-2", variant === "card" && "mt-0.5")}
        onClick={
          onValueClick &&
          ((e) => {
            e.stopPropagation();
            onValueClick();
          })
        }
      >
        {animated ? (
          <AnimatePresence mode="wait">
            <motion.p
              key={valueKey}
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 4 }}
              transition={{ type: "spring", bounce: 0, duration: 0.25 }}
              className={valueClass}
            >
              {value}
            </motion.p>
          </AnimatePresence>
        ) : (
          <p className={valueClass}>{value}</p>
        )}
        {aside}
      </div>
      <p
        className={cn(
          "text-label-secondary",
          variant === "card" ? "text-footnote mt-0.5" : "text-caption",
          detailClassName
        )}
      >
        {detail}
      </p>
    </>
  );

  return variant === "card" ? (
    <Card variant="well" padding="sm" className="text-left" onClick={onToggle} interactive>
      {body}
    </Card>
  ) : (
    <Button
      type="button"
      variant="outline"
      size="default"
      onClick={onToggle}
      className="h-auto flex-col justify-between gap-1 p-2 whitespace-normal"
    >
      {body}
    </Button>
  );
}

/** Signed growth percentage, coloured by direction. */
export function GrowthBadge({ value }: { value: number }) {
  if (value === 0) return <span className="text-label-secondary text-footnote">0.0%</span>;
  const Icon = value > 0 ? TrendingUp : TrendingDown;
  return (
    <span
      className={cn("flex items-center gap-0.5", value > 0 ? "text-green" : "text-destructive")}
    >
      <Icon className="inline-flex h-3.5 w-3.5" />
      <span className="text-caption font-semibold">
        {value > 0 ? "+" : ""}
        {value.toFixed(1)}%
      </span>
    </span>
  );
}

export interface StatCell {
  label: string;
  value: React.ReactNode;
  detail: string;
  /** Colour class for the value; defaults to `text-label`. */
  tone?: string;
}

const STAT_GRID_COLUMNS = {
  four: "grid-cols-2 md:grid-cols-4",
  three: "grid-cols-2 md:grid-cols-3",
  "three-fixed": "grid-cols-3",
} as const;

/** A panel of label / value / detail cells. */
export function StatGrid({
  stats,
  columns = "four",
  inset = false,
  eyebrow = false,
  valueClassName = "text-headline",
}: {
  stats: StatCell[];
  columns?: keyof typeof STAT_GRID_COLUMNS;
  /** Uses the inset card surface instead of the flat fill. */
  inset?: boolean;
  eyebrow?: boolean;
  valueClassName?: string;
}) {
  const className = cn("grid gap-4 p-3", STAT_GRID_COLUMNS[columns]);
  const cells = stats.map((stat) => (
    <div key={stat.label} className="min-w-0">
      {eyebrow ? (
        <Eyebrow className="block">{stat.label}</Eyebrow>
      ) : (
        <span className="text-stat-label text-label-secondary block">{stat.label}</span>
      )}
      <p className={cn(stat.tone ?? "text-label", valueClassName, "mt-0.5")}>{stat.value}</p>
      <p className="text-label-secondary text-footnote mt-0.5">{stat.detail}</p>
    </div>
  ));
  return inset ? (
    <Card variant="well" padding="none" className={className}>
      {cells}
    </Card>
  ) : (
    <div className={cn("bg-fill-3 rounded-row", className)}>{cells}</div>
  );
}
