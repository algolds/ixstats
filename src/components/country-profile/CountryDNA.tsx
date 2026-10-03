"use client";

import { motion } from "motion/react";
import { FacetListSection, FacetRow } from "~/components/ui/facet-list";
import { springGentle } from "~/lib/design/motion";
import { cn } from "~/lib/utils/cn";
import { rankLabel } from "./labels";
import type { DnaAxis } from "./derive";

const SIZE = 320;
const CENTER = SIZE / 2;
const RADIUS = 128;
const MARKER = RADIUS + 18;
const RINGS = [0.25, 0.5, 0.75, 1] as const;
/** Keep a last-placed axis visible as a sliver rather than a point on the centre. */
const FLOOR = 4;

/** Each axis has its own hue so its dot ties to its numbered row in `DnaLegend`. */
const AXIS_COLORS = [
  "var(--color-blue)",
  "var(--color-indigo)",
  "var(--color-green)",
  "var(--color-yellow)",
  "var(--color-red)",
  "var(--color-purple)",
  "var(--color-teal)",
  "var(--color-orange)",
] as const;
const axisColor = (i: number) => AXIS_COLORS[i % AXIS_COLORS.length]!;

function point(index: number, count: number, r: number): [number, number] {
  const angle = (Math.PI * 2 * index) / count - Math.PI / 2;
  return [CENTER + r * Math.cos(angle), CENTER + r * Math.sin(angle)];
}

const polygon = (count: number, radiusAt: (i: number) => number) =>
  Array.from({ length: count }, (_, i) => point(i, count, radiusAt(i)).join(",")).join(" ");

const reach = (axis: DnaAxis) => (Math.max(axis.percentile, FLOOR) / 100) * RADIUS;

/** The number chip that ties an axis to its row in `DnaLegend`. */
function AxisNumber({
  n,
  className,
  style,
}: {
  n: number;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <span
      aria-hidden
      style={style}
      className={cn(
        "bg-surface-secondary border-separator text-caption text-label flex size-6 items-center justify-center rounded-full border tabular-nums",
        className
      )}
    >
      {n}
    </span>
  );
}

/**
 * CountryDNA — the radial country profile, drawn from the World Census:
 * each numbered axis is the nation's percentile in one ranked category (first place reaches the
 * outer ring). Needs three or more axes. The chart is a picture of `DnaLegend`, which carries the
 * same figures as text, so it is labelled by its caption and not read point by point.
 */
export function CountryDNA({
  axes,
  caption,
  className,
}: {
  axes: readonly DnaAxis[];
  caption: string;
  className?: string;
}) {
  if (axes.length < 3) return null;
  const count = axes.length;

  return (
    <figure className={cn("relative mx-auto aspect-square w-full max-w-72", className)}>
      <svg
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        className="absolute inset-0 size-full overflow-visible"
        aria-hidden
      >
        {RINGS.map((level) => (
          <polygon
            key={level}
            points={polygon(count, () => level * RADIUS)}
            className="stroke-separator fill-none"
            strokeWidth={1}
          />
        ))}
        {axes.map((axis, i) => {
          const [x, y] = point(i, count, RADIUS);
          return (
            <line
              key={axis.key}
              x1={CENTER}
              y1={CENTER}
              x2={x}
              y2={y}
              className="stroke-separator"
              strokeWidth={1}
              strokeDasharray="2 3"
            />
          );
        })}
        <motion.polygon
          points={polygon(count, (i) => reach(axes[i]!))}
          className="stroke-tint fill-tint/20"
          strokeWidth={2}
          strokeLinejoin="round"
          style={{ transformBox: "fill-box", transformOrigin: "center" }}
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={springGentle}
        />
        {axes.map((axis, i) => {
          const [x, y] = point(i, count, reach(axis));
          return (
            <circle
              key={axis.key}
              cx={x}
              cy={y}
              r={4.5}
              fill={axisColor(i)}
              className="stroke-surface"
              strokeWidth={1.5}
            />
          );
        })}
      </svg>
      {axes.map((axis, i) => {
        const [x, y] = point(i, count, MARKER);
        return (
          <AxisNumber
            key={axis.key}
            n={i + 1}
            className="absolute -translate-x-1/2 -translate-y-1/2"
            // Placed on the chart's own grid, so it tracks the SVG at any width.
            style={{
              left: `${(x / SIZE) * 100}%`,
              top: `${(y / SIZE) * 100}%`,
              borderColor: axisColor(i),
            }}
          />
        );
      })}
      <figcaption className="sr-only">{caption}</figcaption>
    </figure>
  );
}

/**
 * The DNA's figures as rows: category, the country's value, its rank within its realm and
 * percentile. Census ranks are realm ranks, so pass `realm` to label them ("#3 of 41 in Ixnay").
 */
export function DnaLegend({
  axes,
  realm,
  header = "World Census",
  className,
}: {
  axes: readonly DnaAxis[];
  /** The realm the census ranks the nation in. */
  realm?: string | null;
  header?: React.ReactNode;
  className?: string;
}) {
  if (axes.length === 0) return null;
  const numbered = axes.length >= 3;
  return (
    <FacetListSection header={header} className={className}>
      {axes.map((axis, i) => (
        <FacetRow
          key={axis.key}
          leading={
            numbered ? <AxisNumber n={i + 1} style={{ borderColor: axisColor(i) }} /> : undefined
          }
          title={axis.label}
          subtitle={axis.value}
          trailing={
            <span className="flex flex-col items-end tabular-nums">
              <span className="text-headline text-label">
                {rankLabel(axis.rank, axis.total, realm)}
              </span>
              <span className="text-footnote text-label-secondary">
                Percentile {axis.percentile}
              </span>
            </span>
          }
        />
      ))}
    </FacetListSection>
  );
}
