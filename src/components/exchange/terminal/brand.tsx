"use client";

import type { ReactNode } from "react";
import { Button, type ButtonProps } from "~/components/ui/button";
import { CardTitle } from "~/components/ui/card";
import { cn } from "~/lib/utils";

/**
 * The Exchange brand (docs/systems/exchange-brand-guide.md): the wordmark, figures, change labels and pills. Built on
 * the Facet primitives; the Exchange tint comes from its `data-app="exchange"` scope.
 */

export function ExchangeWordmark({ className }: { className?: string }) {
  return (
    <span className={cn("text-title-2 text-tint font-bold tracking-tight", className)}>
      Exchange
    </span>
  );
}

type Tone = "gain" | "loss" | "flat";
const TONE_CLASS: Record<Tone, string> = {
  gain: "text-success",
  loss: "text-destructive",
  flat: "text-label",
};
export const toneOf = (pct: number | null | undefined): Tone =>
  pct === null || pct === undefined || Math.abs(pct) < 0.005 ? "flat" : pct > 0 ? "gain" : "loss";

/** A number in the Exchange's figure style: tabular, and large and heavy as a headline. */
export function Figure({
  value,
  size = "row",
  tone = "flat",
  className,
}: {
  value: string;
  size?: "hero" | "row";
  tone?: Tone;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "tabular-nums",
        size === "hero"
          ? "text-large-title sm:text-display font-bold tracking-tight"
          : "font-semibold",
        TONE_CLASS[tone],
        className
      )}
    >
      {value}
    </span>
  );
}

/** +1.2%, −0.7% (a true minus), or a dot when there is nothing to compare. */
export function formatChange(pct: number | null | undefined): string {
  if (pct === null || pct === undefined) return "·";
  const abs = Math.abs(pct).toFixed(1);
  if (toneOf(pct) === "flat") return "0.0%";
  return `${pct > 0 ? "+" : "−"}${abs}%`;
}

export function ChangeLabel({
  pct,
  className,
}: {
  pct: number | null | undefined;
  className?: string;
}) {
  return (
    <span className={cn("font-medium tabular-nums", TONE_CLASS[toneOf(pct)], className)}>
      {formatChange(pct)}
    </span>
  );
}

/** A pill: the Exchange's button shape, filled with its tint when it is the main action. */
export function Pill({
  className,
  tone = "tint",
  ...props
}: ButtonProps & { tone?: "tint" | "plain" }) {
  return (
    <Button
      size="sm"
      variant={tone === "tint" ? "default" : "secondary"}
      className={cn(
        "rounded-full",
        tone === "tint" && "bg-tint text-on-tint hover:bg-tint-hover",
        className
      )}
      {...props}
    />
  );
}

/** A section heading inside a card, exposed as a heading. */
export function SectionTitle({ children, icon }: { children: ReactNode; icon?: ReactNode }) {
  return (
    <CardTitle role="heading" aria-level={2} icon={icon}>
      {children}
    </CardTitle>
  );
}

/** ₷ with thousands separators and cents. */
export function formatSovereignFigure(n: number): string {
  return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** "12m", "3h", "2d": how long ago, for feed rows. */
export function ageLabel(date: Date | string, nowMs: number = Date.now()): string {
  const minutes = Math.max(0, Math.floor((nowMs - new Date(date).getTime()) / 60_000));
  if (minutes < 60) return `${minutes}m`;
  if (minutes < 60 * 24) return `${Math.floor(minutes / 60)}h`;
  return `${Math.floor(minutes / (60 * 24))}d`;
}
