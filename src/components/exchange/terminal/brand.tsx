"use client";

import type { ComponentProps, ReactNode } from "react";
import { Button, type ButtonProps } from "~/components/ui/button";
import { CardTitle } from "~/components/ui/card";
import { TextureOverlay } from "~/components/ui/texture-overlay";
import { cn } from "~/lib/utils";

/**
 * The Exchange brand (docs/systems/exchange-brand-guide.md): the wordmark, icon wells, figures, change labels and pills.
 * Built on the Facet primitives; the Exchange tint comes from its `data-app="exchange"` scope.
 */

const WELL_SIZES = {
  sm: "size-7 [&_svg]:size-3.5 text-caption font-bold",
  md: "size-9 [&_svg]:size-4 text-footnote font-bold",
  lg: "size-12 [&_svg]:size-6 text-title-3 font-bold",
} as const;

/** A tinted decorative icon or ticker tile on the Exchange tint fill with a subtle dots texture (matches Vault's IconWell). */
export function ExchangeIconWell({
  className,
  children,
  size = "sm",
  ...props
}: ComponentProps<"span"> & { size?: keyof typeof WELL_SIZES }) {
  return (
    <span
      aria-hidden
      className={cn(
        "bg-tint-fill text-tint rounded-row relative flex shrink-0 items-center justify-center overflow-hidden tabular-nums select-none",
        WELL_SIZES[size],
        className
      )}
      {...props}
    >
      <TextureOverlay texture="dots" className="[--facet-texture-color:var(--tint)]" />
      <span className="relative flex items-center justify-center">{children}</span>
    </span>
  );
}

const TICKER_SIZES = {
  sm: "h-7 min-w-9 px-1.5 text-caption",
  md: "h-9 min-w-11 px-2 text-footnote",
} as const;

/** Derives a short 2–4 character symbol when a company has no explicit public ticker. */
export function symbolOf(name: string, ticker?: string | null): string {
  if (ticker && ticker.trim().length > 0) return ticker.trim().slice(0, 4).toUpperCase();
  const words = name
    .trim()
    .split(/\s+/)
    .filter((w) => w.length > 0);
  if (words.length >= 2) {
    return words
      .slice(0, 3)
      .map((w) => w[0] ?? "")
      .join("")
      .toUpperCase();
  }
  return (words[0] ?? "EX").slice(0, 3).toUpperCase();
}

/** Recessed monospace symbol tile for equities, bond maturities and instrument codes. */
export function TickerTile({
  code,
  tone = "tint",
  size = "sm",
  className,
}: {
  code: string;
  tone?: "tint" | "gain" | "loss" | "neutral";
  size?: keyof typeof TICKER_SIZES;
  className?: string;
}) {
  const toneClass =
    tone === "gain"
      ? "bg-success/12 text-success border-success/25"
      : tone === "loss"
        ? "bg-destructive/12 text-destructive border-destructive/25"
        : tone === "neutral"
          ? "facet-recess text-label-secondary border-separator"
          : "bg-tint-fill text-tint border-tint/20";
  return (
    <span
      aria-hidden
      className={cn(
        "rounded-control relative inline-flex shrink-0 items-center justify-center border font-mono font-semibold tracking-tight tabular-nums select-none",
        TICKER_SIZES[size],
        toneClass,
        className
      )}
    >
      {code}
    </span>
  );
}

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

const PROPOSAL_TYPE_LABELS: Record<string, string> = {
  ISSUE_SHARES: "Issue new shares",
  DISSOLVE: "Dissolve company",
  ACQUIRE_OFFER: "Acquisition buyout",
};

export function proposalTypeLabel(type: string): string {
  return PROPOSAL_TYPE_LABELS[type] ?? type.replace(/_/g, " ").toLowerCase();
}

const DECISION_TYPE_LABELS: Record<string, string> = {
  EXPAND: "Plant expansion",
  ENTER_SECTOR: "Sector pivot",
  RND: "Research & development",
  LOBBY: "Policy lobbying",
  PRICE: "Pricing update",
  ACQUIRE: "Acquisition offer",
};

export function decisionTypeLabel(type: string): string {
  return DECISION_TYPE_LABELS[type] ?? type.replace(/_/g, " ").toLowerCase();
}

const BOND_STATUS_LABELS: Record<string, string> = {
  OPEN: "Open",
  MATURED: "Matured",
  DEFAULTED: "Defaulted",
};

export function bondStatusLabel(status: string): string {
  return BOND_STATUS_LABELS[status] ?? status.toLowerCase();
}

/** Interactive row link classes for data lists (36px desktop, 44px coarse pointer, fill-4 hover, fill-3 active). */
export const DATA_ROW_LINK =
  "text-callout facet-press facet-press-subtle hover:bg-fill-4 active:bg-fill-3 focus-visible:outline-tint rounded-control -mx-2 flex min-h-10 items-center justify-between gap-3 px-2.5 py-2 transition-colors duration-fast ease-out-facet focus-visible:outline-2 pointer-coarse:min-h-11";

/** Static or composite row classes inside a data list. */
export const DATA_ROW_ITEM =
  "text-callout flex min-h-10 items-center justify-between gap-3 py-2 pointer-coarse:min-h-11";
