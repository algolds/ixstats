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
  rate: number;
  yieldValue: number;
  totalYield: number;
  onChange: (value: number) => void;
  onCommit: (value: number) => void;
}

function TaxRateCardComponent({
  channel,
  rate,
  yieldValue,
  totalYield,
  onChange,
  onCommit,
}: TaxRateCardProps) {
  const [isLocked, setIsLocked] = useState(true);
  const contributionPct = totalYield > 0 ? (yieldValue / totalYield) * 100 : 0;

  const handleToggleLock = () => {
    if (!isLocked) {
      onCommit(rate);
      setIsLocked(true);
    } else {
      setIsLocked(false);
    }
  };

  return (
    <div
      className={cn(
        "bg-muted/10 relative space-y-2.5 rounded-xl border p-3 shadow-sm backdrop-blur-md transition-all duration-200",
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
            title={
              isLocked
                ? "Locked (Saved) — click to edit rate"
                : "Editing — click to save & lock rate"
            }
            className={cn(
              "flex h-6 w-6 cursor-pointer items-center justify-center rounded-md border transition-all duration-200 select-none active:scale-95",
              isLocked
                ? "border-border/40 bg-muted/30 text-muted-foreground/70 hover:border-border/70 hover:text-foreground"
                : "animate-pulse border-amber-500/50 bg-amber-500/20 text-amber-400 shadow-xs shadow-amber-500/30"
            )}
          >
            {isLocked ? <Lock className="h-3 w-3" /> : <Unlock className="h-3 w-3" />}
          </button>
          <span className="text-muted-foreground text-[11px] font-semibold">{channel.label}</span>
        </div>

        <div className="flex items-center gap-1.5">
          {!isLocked && (
            <span className="animate-pulse text-[9px] font-semibold tracking-wider text-amber-400 uppercase">
              Editing
            </span>
          )}
          <span className={cn("font-mono text-base font-bold tabular-nums", channel.accentClass)}>
            <PercentageFlow value={rate} decimalPlaces={1} />
          </span>
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
          value={[rate]}
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
          className={cn("h-full transition-all duration-500 ease-out", ACCENT_BG[channel.accent])}
          style={{ width: `${Math.min(contributionPct, 100)}%` }}
        />
      </div>

      {/* Yield preview */}
      <div className="flex items-center justify-between text-[10px]">
        <span className="text-muted-foreground font-medium">Yield Contribution</span>
        <span className={cn("font-mono font-bold", channel.accentClass)}>
          <CurrencyFlow value={yieldValue} decimalPlaces={1} className={channel.accentClass} />
        </span>
      </div>
    </div>
  );
}

export const TaxRateCard = React.memo(TaxRateCardComponent);
