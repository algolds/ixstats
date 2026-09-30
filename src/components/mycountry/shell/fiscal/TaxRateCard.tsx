"use client";

import React, { useState } from "react";
import { Lock, LockSlash as Unlock } from "iconoir-react";
import { Slider } from "~/components/ui/slider";
import { CurrencyFlow, PercentageFlow } from "~/components/ui/number-flow";
import { cn } from "~/lib/utils";
import {
  type TaxChannel,
  ACCENT_BORDER,
  ACCENT_BG,
  SLIDER_RANGE_COLOR,
  SLIDER_THUMB_COLOR,
} from "./taxChannels";

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
    <div
      className={cn(
        "bg-muted/10 relative space-y-2.5 rounded-xl border p-3 shadow-sm backdrop-blur-md transition-[color,background-color,border-color,box-shadow,opacity,transform] duration-200",
        isLocked
          ? (ACCENT_BORDER[channel.accent] ?? "border-border/30")
          : "border-amber-500/50 bg-amber-500/[0.03] ring-1 ring-amber-500/30"
      )}
    >
      {/* Header: lock toggle + label + rate */}
      <div className="flex items-center justify-between pt-0.5">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleToggleLock}
            disabled={bracketed}
            title={
              bracketed
                ? "Set by tax brackets in the Country Editor"
                : isLocked
                  ? "Locked — click to edit rate"
                  : "Editing — click to save & lock rate"
            }
            className={cn(
              "flex h-6 w-6 cursor-pointer items-center justify-center rounded-md border transition-[color,background-color,border-color,box-shadow,opacity,transform] duration-200 select-none active:scale-95",
              isLocked
                ? "border-border/40 bg-muted/30 text-muted-foreground/70 hover:border-border/70 hover:text-foreground"
                : "border-amber-500/50 bg-amber-500/20 text-amber-600 shadow-xs shadow-amber-500/30 dark:text-amber-400"
            )}
          >
            {isLocked ? <Lock className="h-3 w-3" /> : <Unlock className="h-3 w-3" />}
          </button>
          <span className="text-muted-foreground text-xs font-semibold">{channel.label}</span>
        </div>

        <div className="flex items-center gap-1.5">
          {!isLocked && (
            <span className="text-xs font-semibold tracking-wider text-amber-600 uppercase dark:text-amber-400">
              Editing
            </span>
          )}
          {rate != null ? (
            <span className={cn("font-mono text-base font-bold tabular-nums", channel.accentClass)}>
              {bracketed && <span className="text-muted-foreground mr-1 text-xs">Top</span>}
              <PercentageFlow value={rate} decimalPlaces={1} />
            </span>
          ) : (
            <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-xs font-medium text-amber-700 dark:text-amber-400">
              Not set
            </span>
          )}
        </div>
      </div>

      {/* Radix Slider */}
      <div
        className={cn(
          "relative transition-opacity duration-200",
          isLocked && "pointer-events-none opacity-50"
        )}
      >
        <Slider
          min={channel.min}
          max={channel.max}
          step={channel.step}
          value={[sliderValue]}
          disabled={isLocked}
          onValueChange={([v]) => v !== undefined && onChange(v)}
          onValueCommit={([v]) => v !== undefined && onCommit(v)}
          className={cn(
            "w-full",
            SLIDER_RANGE_COLOR[channel.accent],
            SLIDER_THUMB_COLOR[channel.accent]
          )}
        />
      </div>

      {/* Internal Weight Progress Bar */}
      <div className="bg-muted/20 h-1 w-full overflow-hidden rounded-full">
        <div
          className={cn(
            "h-full transition-[color,background-color,border-color,box-shadow,opacity,transform] duration-500 ease-out",
            ACCENT_BG[channel.accent]
          )}
          style={{ width: `${Math.min(contributionPct, 100)}%` }}
        />
      </div>

      {/* Yield preview */}
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground font-medium">
          {bracketed ? "Set by brackets in the Country Editor" : "Yield Contribution"}
        </span>
        <span className={cn("font-mono font-bold", channel.accentClass)}>
          {yieldValue != null ? (
            <CurrencyFlow value={yieldValue} decimalPlaces={1} className={channel.accentClass} />
          ) : (
            "—"
          )}
        </span>
      </div>
    </div>
  );
}

export const TaxRateCard = React.memo(TaxRateCardComponent);
