"use client";

import React, { useState } from "react";
import { Lock, LockSlash as Unlock } from "iconoir-react";
import { Slider } from "~/components/ui/slider";
import { CurrencyFlow, PercentageFlow } from "~/components/ui/number-flow";
import { cn } from "~/lib/utils";
import { FacetCard } from "~/components/ui/facet-container";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { Eyebrow } from "~/components/ui/eyebrow";
import { type TaxChannel, ACCENT_BG } from "./taxChannels";

interface TaxRateCardProps {
  channel: TaxChannel;
  /** The saved or edited rate; null when the nation hasn't set this tax. */
  rate: number | null;
  /** True when the rate comes from builder brackets — shown read-only (top rate). */
  bracketed: boolean;
  yieldValue: number | null;
  totalYield: number | null;
  onChange: (value: number) => void;
  onCommit: (value: number) => void;
}

function TaxRateCardComponent({
  channel,
  rate,
  bracketed,
  yieldValue,
  totalYield,
  onChange,
  onCommit,
}: TaxRateCardProps) {
  const [isLocked, setIsLocked] = useState(true);
  const contributionPct =
    yieldValue != null && totalYield != null && totalYield > 0
      ? (yieldValue / totalYield) * 100
      : 0;
  // Unset taxes start the slider at the channel default so there's somewhere to begin.
  const sliderValue = rate ?? channel.defaultRate;

  const handleToggleLock = () => {
    if (bracketed) return;
    if (!isLocked) {
      if (rate != null) onCommit(rate);
      setIsLocked(true);
    } else {
      setIsLocked(false);
    }
  };

  return (
    <FacetCard
      surface="solid"
      className={cn("space-y-2.5 rounded-xl p-3", !isLocked && "ring-1 ring-amber-500/50")}
    >
      {/* Header: lock toggle + label + rate */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={handleToggleLock}
            disabled={bracketed}
            aria-pressed={!isLocked}
            aria-label={
              bracketed
                ? `${channel.label} is set by tax brackets`
                : isLocked
                  ? `Edit ${channel.label} rate`
                  : `Save and lock ${channel.label} rate`
            }
            title={
              bracketed
                ? "Set by tax brackets in the Country Editor"
                : isLocked
                  ? "Locked — click to edit rate"
                  : "Editing — click to save & lock rate"
            }
            className={cn(
              "h-11 w-11 shrink-0 sm:h-7 sm:w-7",
              isLocked ? "text-muted-foreground" : "text-(--facet-mycountry)"
            )}
          >
            {isLocked ? <Lock aria-hidden="true" /> : <Unlock aria-hidden="true" />}
          </Button>
          <span
            aria-hidden="true"
            className={cn("h-2 w-2 shrink-0 rounded-full", ACCENT_BG[channel.accent])}
          />
          <span className="text-foreground truncate text-xs font-medium">{channel.label}</span>
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          {!isLocked && <Eyebrow className="text-(--facet-mycountry)">Editing</Eyebrow>}
          {rate != null ? (
            <span className="text-foreground font-mono text-base font-semibold tabular-nums">
              {bracketed && <span className="text-muted-foreground mr-1 text-xs">Top</span>}
              <PercentageFlow value={rate} decimalPlaces={1} />
            </span>
          ) : (
            <Badge variant="outline" className="text-orange-600">
              Not set
            </Badge>
          )}
        </div>
      </div>

      {/* Rate slider */}
      <div className={cn("transition-opacity duration-200", isLocked && "opacity-50")}>
        <Slider
          min={channel.min}
          max={channel.max}
          step={channel.step}
          value={[sliderValue]}
          disabled={isLocked}
          onValueChange={([v]) => v !== undefined && onChange(v)}
          onValueCommit={([v]) => v !== undefined && onCommit(v)}
          aria-label={`${channel.label} rate`}
          className="w-full"
        />
      </div>

      {/* Share of total revenue (keyed to the revenue composition chart colour) */}
      <div className="bg-muted h-1 w-full overflow-hidden rounded-full">
        <div
          className={cn("h-full rounded-full", ACCENT_BG[channel.accent])}
          style={{ width: `${Math.min(contributionPct, 100)}%` }}
        />
      </div>

      {/* Yield preview */}
      <div className="flex items-center justify-between gap-2 text-xs">
        <span className="text-muted-foreground">
          {bracketed ? "Set by brackets in the Country Editor" : "Yield contribution"}
        </span>
        <span className="text-foreground font-mono font-semibold tabular-nums">
          {yieldValue != null ? <CurrencyFlow value={yieldValue} decimalPlaces={1} /> : "—"}
        </span>
      </div>
    </FacetCard>
  );
}

export const TaxRateCard = React.memo(TaxRateCardComponent);
