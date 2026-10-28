"use client";

import React, { useState } from "react";
import { Lock, LockSlash as Unlock } from "iconoir-react";
import { Slider } from "~/components/ui/slider";
import { CurrencyFlow, PercentageFlow } from "~/components/ui/number-flow";
import { cn } from "~/lib/utils";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "~/components/ui/alert-dialog";
import { type TaxChannel, ACCENT_BG } from "~/lib/economy/tax-channels";
import { Card } from "~/components/ui/card";
import { RateInput } from "../RateInput";

interface TaxRateCardProps {
  channel: TaxChannel;
  /** The saved or edited rate; null when the nation hasn't set this tax. */
  rate: number | null;
  /** True when the rate comes from builder brackets: read-only (top rate) until flattened. */
  bracketed: boolean;
  yieldValue: number | null;
  totalYield: number | null;
  onChange: (value: number) => void;
  onCommit: (value: number) => void;
}

/** Replaces a bracket list with one flat rate (the top bracket's, within the slider's range). */
function FlattenBracketsButton({
  channel,
  topRate,
  onConfirm,
}: {
  channel: TaxChannel;
  topRate: number;
  onConfirm: (flatRate: number) => void;
}) {
  const flatRate = Math.min(Math.max(topRate, channel.min), channel.max);
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button type="button" variant="outline" size="sm" className="h-11 sm:h-7">
          Use one rate
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Replace the brackets with one rate?</AlertDialogTitle>
          <AlertDialogDescription>
            {channel.label} becomes a flat {flatRate}%
            {flatRate === topRate ? ", the top bracket rate" : `, the most this tax allows`}, which
            you can then change. The bracket list is replaced and cannot be restored here.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Keep brackets</AlertDialogCancel>
          <AlertDialogAction onClick={() => onConfirm(flatRate)}>Use one rate</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
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
  // Flattened in this session: editable at once, before the refetched record drops the brackets.
  const [flattened, setFlattened] = useState(false);
  const isBracketed = bracketed && !flattened;
  const contributionPct =
    yieldValue != null && totalYield != null && totalYield > 0
      ? (yieldValue / totalYield) * 100
      : 0;
  // An unset tax shows "Not set"; its slider starts at the channel minimum.
  const sliderValue = rate ?? channel.min;

  const handleToggleLock = () => {
    if (isBracketed) return;
    if (!isLocked) {
      if (rate != null) onCommit(rate);
      setIsLocked(true);
    } else {
      setIsLocked(false);
    }
  };

  return (
    <Card className={cn("rounded-row space-y-2 p-3", !isLocked && "ring-yellow/50 ring-1")}>
      {/* Header: lock toggle + label + rate */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={handleToggleLock}
            disabled={isBracketed}
            aria-pressed={!isLocked}
            aria-label={
              isBracketed
                ? `${channel.label} is set by tax brackets`
                : isLocked
                  ? `Edit ${channel.label} rate`
                  : `Save and lock ${channel.label} rate`
            }
            title={
              isBracketed
                ? "Set by tax brackets"
                : isLocked
                  ? "Locked. Click to edit the rate"
                  : "Editing. Click to save and lock the rate"
            }
            className={cn(
              "h-11 w-11 shrink-0 sm:h-7 sm:w-7",
              isLocked ? "text-label-secondary" : "text-tint"
            )}
          >
            {isLocked ? <Lock aria-hidden="true" /> : <Unlock aria-hidden="true" />}
          </Button>
          <span
            aria-hidden="true"
            className={cn("h-2 w-2 shrink-0 rounded-full", ACCENT_BG[channel.accent])}
          />
          <span className="text-label text-caption truncate">{channel.label}</span>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {!isLocked && <span className="text-tint text-footnote">Editing</span>}
          {rate != null ? (
            <span className="text-label text-title-3 tabular-nums">
              {isBracketed && <span className="text-label-secondary text-footnote mr-1">Top</span>}
              <PercentageFlow value={rate} decimalPlaces={1} />
            </span>
          ) : (
            <Badge variant="warning">Not set</Badge>
          )}
        </div>
      </div>

      {/* Rate slider */}
      <div
        className={cn(
          "flex items-center gap-3 transition-opacity duration-200",
          isLocked && "opacity-50"
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
          aria-label={`${channel.label} rate`}
          className="w-full"
        />
        <RateInput
          value={sliderValue}
          min={channel.min}
          max={channel.max}
          step={channel.step}
          disabled={isLocked}
          onCommit={onCommit}
          aria-label={`${channel.label} rate, percent`}
        />
      </div>

      {/* Share of total revenue (keyed to the revenue composition chart colour) */}
      <div className="bg-fill-3 h-1 w-full overflow-hidden rounded-full">
        <div
          className={cn("h-full rounded-full", ACCENT_BG[channel.accent])}
          style={{ width: `${Math.min(contributionPct, 100)}%` }}
        />
      </div>

      {isBracketed && rate != null && (
        <div className="text-footnote flex flex-wrap items-center justify-between gap-2">
          <span className="text-label-secondary">Set by tax brackets</span>
          <FlattenBracketsButton
            channel={channel}
            topRate={rate}
            onConfirm={(flatRate) => {
              setFlattened(true);
              setIsLocked(false);
              onCommit(flatRate);
            }}
          />
        </div>
      )}

      {/* Yield preview */}
      <div className="text-footnote flex items-center justify-between gap-2">
        <span className="text-label-secondary">Yield contribution</span>
        <span className="text-label font-semibold tabular-nums">
          {yieldValue != null ? <CurrencyFlow value={yieldValue} decimalPlaces={1} /> : "—"}
        </span>
      </div>
    </Card>
  );
}

export const TaxRateCard = React.memo(TaxRateCardComponent);
