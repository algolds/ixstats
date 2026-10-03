"use client";

import React from "react";
import { cn } from "~/lib/utils/cn";
import { ArrowUpRight, ArrowDownRight } from "iconoir-react";
import { NumberFlowDisplay } from "~/components/ui/number-flow";
import { Skeleton } from "~/components/ui/skeleton";
import { Card, CardContent, CardHeader } from "~/components/ui/card";
import { Eyebrow } from "~/components/ui/eyebrow";

export type MetricThemeVariant = "economy" | "social" | "demographics" | "labor" | "default";

interface MetricModalLayoutProps {
  variant?: MetricThemeVariant;
  className?: string;
  children: React.ReactNode;
}

export function MetricModalLayout({
  // oxlint-disable-next-line eslint/no-unused-vars
  variant = "default",
  className,
  children,
}: MetricModalLayoutProps) {
  return (
    <div className={cn("mt-4 grid w-full grid-cols-1 gap-6 lg:grid-cols-3", className)}>
      {children}
    </div>
  );
}

const accent = (token: string) => ({
  chartColor: token,
  gradientStop: `color-mix(in srgb, ${token} 15%, transparent)`,
});

const NEUTRAL_THEME = { cardClass: "bg-fill-3", textHighlight: "text-label-secondary" } as const;

// Economy carries the MyCountry accent; the rest stay neutral so the chart series, not the
// chrome, carry colour.
const THEMES: Record<MetricThemeVariant, ReturnType<typeof accent> & typeof NEUTRAL_THEME> = {
  economy: { ...NEUTRAL_THEME, textHighlight: "text-yellow", ...accent("var(--color-amber-500)") },
  social: { ...NEUTRAL_THEME, ...accent("var(--chart-2)") },
  demographics: { ...NEUTRAL_THEME, ...accent("var(--chart-2)") },
  labor: { ...NEUTRAL_THEME, ...accent("var(--color-blue-500)") },
  default: { ...NEUTRAL_THEME, ...accent("var(--color-tint)") },
};

export function getThemeClasses(variant: MetricThemeVariant) {
  return THEMES[variant];
}

// 1. Main Area Component
MetricModalLayout.MainArea = function MetricModalMainArea({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("flex flex-col justify-between space-y-6 lg:col-span-2", className)}>
      {children}
    </div>
  );
};

// 2. Sidebar Component
MetricModalLayout.Sidebar = function MetricModalSidebar({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return <div className={cn("flex flex-col space-y-6 lg:col-span-1", className)}>{children}</div>;
};

// Loading skeleton: a main panel plus either `sidebarCards` stat cards or one full-height panel.
MetricModalLayout.Loading = function MetricModalLoading({
  variant,
  mainHeight,
  sidebarCards,
}: {
  variant: MetricThemeVariant;
  mainHeight: number;
  sidebarCards: number;
}) {
  return (
    <MetricModalLayout variant={variant}>
      <MetricModalLayout.MainArea>
        <Skeleton className="w-full" style={{ height: mainHeight }} />
      </MetricModalLayout.MainArea>
      <MetricModalLayout.Sidebar>
        {sidebarCards > 0 ? (
          Array.from({ length: sidebarCards }, (_, i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))
        ) : (
          <Skeleton className="h-full w-full" />
        )}
      </MetricModalLayout.Sidebar>
    </MetricModalLayout>
  );
};

// 3. Stat Card Component
interface StatCardProps {
  label: string;
  value: number;
  prefix?: string;
  suffix?: string;
  decimalPlaces?: number;
  trend?: number;
  icon: React.ComponentType<{ className?: string }>;
  variant?: MetricThemeVariant;
  className?: string;
}

MetricModalLayout.StatCard = function MetricModalStatCard({
  label,
  value,
  prefix = "",
  suffix = "",
  decimalPlaces = 0,
  trend,
  icon: Icon,
  variant = "default",
  className,
}: StatCardProps) {
  const theme = getThemeClasses(variant);
  const isPositive = trend !== undefined && trend >= 0;

  return (
    <div className={cn("rounded-row relative overflow-hidden p-4", theme.cardClass, className)}>
      <div className="flex items-center justify-between">
        <span className="text-stat-label text-label-secondary">{label}</span>
        <Icon className={cn("h-4 w-4", theme.textHighlight)} />
      </div>
      <div className="mt-2 flex items-baseline gap-2">
        <span className="text-label text-title-1 tabular-nums">
          {prefix}
          <NumberFlowDisplay value={value} decimalPlaces={decimalPlaces} className="inline" />
          {suffix}
        </span>
        {trend !== undefined && (
          <span
            className={cn(
              "rounded-control-sm text-caption inline-flex items-center gap-0.5 px-2 py-0.5 font-semibold",
              isPositive ? "bg-fill-3 text-green" : "bg-fill-3 text-destructive"
            )}
          >
            {isPositive ? (
              <ArrowUpRight className="h-3 w-3" />
            ) : (
              <ArrowDownRight className="h-3 w-3" />
            )}
            {Math.abs(trend).toFixed(1)}%
          </span>
        )}
      </div>
    </div>
  );
};

type IconType = React.ComponentType<{ className?: string }>;

// 4. Panels: the large main card and the narrower sidebar card.
MetricModalLayout.Panel = function MetricModalPanel({
  icon: Icon,
  title,
  titleExtra,
  subtitle,
  className = "flex flex-1 flex-col justify-between",
  contentClassName = "flex-1",
  children,
}: {
  icon?: IconType;
  title: string;
  titleExtra?: React.ReactNode;
  subtitle?: React.ReactNode;
  className?: string;
  contentClassName?: string;
  children: React.ReactNode;
}) {
  return (
    <Card className={cn("p-6", className)}>
      <CardHeader className="mb-4 p-0">
        <h3 className={cn("text-label text-title-3", Icon && "flex items-center gap-2")}>
          {Icon && <Icon className="text-label-secondary h-5 w-5" />}
          {title}
          {titleExtra}
        </h3>
        {subtitle && <p className="text-label-secondary text-body">{subtitle}</p>}
      </CardHeader>
      <CardContent className={cn("p-0", contentClassName)}>{children}</CardContent>
    </Card>
  );
};

MetricModalLayout.SidePanel = function MetricModalSidePanel({
  title,
  subtitle,
  className,
  contentClassName = "space-y-4",
  children,
}: {
  title: string;
  subtitle?: string;
  className?: string;
  contentClassName?: string;
  children: React.ReactNode;
}) {
  return (
    <Card className={cn("flex flex-1 flex-col justify-between p-4", className)}>
      <CardHeader className="mb-4 p-0">
        <h3 className="text-label text-title-3 text-headline">{title}</h3>
        {subtitle && <p className="text-label-secondary text-footnote">{subtitle}</p>}
      </CardHeader>
      <CardContent className={cn("p-0", contentClassName)}>{children}</CardContent>
    </Card>
  );
};

// 5. Centered figure tile, shown in a grid inside a main panel.
const TILE_LABEL = {
  stat: "text-stat-label text-label-secondary mt-1 block",
  footnote: "text-label-secondary text-footnote mt-1",
} as const;

MetricModalLayout.Tile = function MetricModalTile({
  value,
  label,
  tone = "text-label",
  valueClassName,
  labelStyle = "stat",
}: {
  value: React.ReactNode;
  label: string;
  tone?: string;
  valueClassName?: string;
  labelStyle?: keyof typeof TILE_LABEL | "eyebrow";
}) {
  return (
    <Card variant="inset" padding="none" className="p-4 text-center">
      <div className={cn("text-title-3", tone, valueClassName)}>{value}</div>
      {labelStyle === "eyebrow" ? (
        <Eyebrow className="mt-1 block">{label}</Eyebrow>
      ) : labelStyle === "stat" ? (
        <span className={TILE_LABEL.stat}>{label}</span>
      ) : (
        <div className={TILE_LABEL.footnote}>{label}</div>
      )}
    </Card>
  );
};

MetricModalLayout.TileGrid = function MetricModalTileGrid({
  columns = "grid-cols-2 md:grid-cols-4",
  children,
}: {
  columns?: string;
  children: React.ReactNode;
}) {
  return <div className={cn("grid gap-4", columns)}>{children}</div>;
};

// 6. Compact label/value row for sidebar panels.
MetricModalLayout.Metric = function MetricModalMetric({
  label,
  value,
  tone = "text-label",
}: {
  label: string;
  value: React.ReactNode;
  tone?: string;
}) {
  return (
    <Card variant="inset" padding="none" className="p-3">
      <span className="text-stat-label text-label-secondary">{label}</span>
      <div className={cn("text-title-3 mt-1", tone)}>{value}</div>
    </Card>
  );
};

// 7. Explanatory paragraph under a tile grid.
MetricModalLayout.Note = function MetricModalNote({
  icon: Icon,
  children,
}: {
  icon?: IconType;
  children: React.ReactNode;
}) {
  return (
    <Card
      variant="inset"
      padding="none"
      className={cn(
        "text-label-secondary text-footnote mt-6 p-4",
        Icon && "flex items-start gap-3"
      )}
    >
      {Icon && <Icon className="text-label-secondary mt-0.5 h-4 w-4 shrink-0" />}
      <p className="leading-relaxed">{children}</p>
    </Card>
  );
};

// 8. Sidebar card that names a computed classification (risk, health, tier) and what it means.
MetricModalLayout.Classification = function MetricModalClassification({
  label,
  value,
  tone,
  icon: Icon,
  description,
  bordered = true,
  children,
}: {
  label: React.ReactNode;
  value?: string;
  tone?: string;
  icon?: IconType;
  description: string;
  bordered?: boolean;
  /** Replaces the plain `value` text, e.g. with a badge. */
  children?: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "bg-fill-3 rounded-row relative flex min-h-[100px] flex-1 flex-col justify-between overflow-hidden p-4",
        bordered && "border-separator border"
      )}
    >
      <div>
        {typeof label === "string" ? (
          <span className="text-stat-label text-label-secondary block">{label}</span>
        ) : (
          label
        )}
        <div className="mt-2">
          {children ?? <span className={cn("text-title-3", tone)}>{value}</span>}
        </div>
      </div>
      <p
        className={cn(
          "text-label-secondary text-footnote mt-4 leading-relaxed",
          Icon && "flex items-center gap-2"
        )}
      >
        {Icon && <Icon className="h-3 w-3 shrink-0" />}
        {description}
      </p>
    </div>
  );
};

// A sidebar column of large highlighted figures.
MetricModalLayout.Highlights = function MetricModalHighlights({
  className = "flex flex-1 flex-col gap-4",
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return <div className={className}>{children}</div>;
};

MetricModalLayout.Highlight = function MetricModalHighlight({
  label,
  value,
  tone = "text-label",
  note,
}: {
  label: string;
  value: React.ReactNode;
  tone?: string;
  note?: string;
}) {
  return (
    <div className="bg-fill-3 rounded-row flex flex-1 flex-col justify-center p-4">
      <span className="text-stat-label text-label-secondary mb-1 block">{label}</span>
      <span className={cn("text-title-2", tone)}>{value}</span>
      {note && <span className="text-label-secondary text-footnote mt-1">{note}</span>}
    </div>
  );
};

// 9. Placeholder card for a tab with nothing to chart.
MetricModalLayout.Empty = function MetricModalEmpty({
  icon: Icon,
  message,
  hint,
}: {
  icon: IconType;
  message: string;
  hint?: string;
}) {
  return (
    <Card>
      <CardContent className="py-12 text-center">
        <Icon className="text-label-secondary mx-auto mb-4 h-12 w-12 opacity-50" />
        <p className="text-label-secondary">{message}</p>
        {hint && <p className="text-label-secondary text-body">{hint}</p>}
      </CardContent>
    </Card>
  );
};
