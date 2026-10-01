import React from "react";
import { Slider } from "~/components/ui/slider";
import { PercentageFlow } from "~/components/ui/number-flow";
import { Lock, LockSlash as Unlock, Undo as RotateCcw } from "iconoir-react";
import { cn } from "~/lib/utils";
import { FacetCard } from "~/components/ui/facet-container";
import { Button } from "~/components/ui/button";
import type { CustomSector } from "./trade-commerce-types";
import { ACCENT_BG } from "./trade-commerce-types";

interface TariffSectorSliderCardProps {
  sector: CustomSector;
  currentTariff: number;
  isLocked: boolean;
  onTariffChange: (val: number) => void;
  onToggleLock: () => void;
  onReset: () => void;
}

export const TariffSectorSliderCard = React.memo(function TariffSectorSliderCard({
  sector,
  currentTariff,
  isLocked,
  onTariffChange,
  onToggleLock,
  onReset,
}: TariffSectorSliderCardProps) {
  const isModified = Math.abs(currentTariff - sector.defaultTariff) > 0.01;

  return (
    <FacetCard className="rounded-card space-y-3 p-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <span
            aria-hidden="true"
            className={cn("h-2 w-2 shrink-0 rounded-full", ACCENT_BG[sector.accent] || "bg-tint")}
          />
          <span className="text-label text-caption truncate">{sector.label}</span>
        </div>

        <div className="flex shrink-0 items-center gap-0.5">
          {isModified && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={onReset}
              title="Reset to starting rate"
              aria-label={`Reset ${sector.label} to its starting rate`}
              className="text-label-secondary h-11 w-11 sm:h-7 sm:w-7"
            >
              <RotateCcw aria-hidden="true" />
            </Button>
          )}
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={onToggleLock}
            title={isLocked ? "Unlock sector" : "Lock sector"}
            aria-label={isLocked ? `Unlock ${sector.label}` : `Lock ${sector.label}`}
            aria-pressed={isLocked}
            className={cn(
              "h-11 w-11 sm:h-7 sm:w-7",
              isLocked ? "text-tint" : "text-label-secondary"
            )}
          >
            {isLocked ? <Lock aria-hidden="true" /> : <Unlock aria-hidden="true" />}
          </Button>
        </div>
      </div>

      <div className="flex items-baseline justify-between gap-2">
        <span className="text-label-secondary text-footnote">
          Share of GDP: {sector.defaultShare}%
        </span>
        <div className="text-label text-title-3 tabular-nums">
          <PercentageFlow value={currentTariff} />
        </div>
      </div>

      <Slider
        value={[currentTariff]}
        min={sector.min}
        max={sector.max}
        step={sector.step}
        disabled={isLocked}
        onValueChange={([val]) => onTariffChange(val || 0)}
        aria-label={`${sector.label} tariff`}
        className="py-1"
      />
    </FacetCard>
  );
});
