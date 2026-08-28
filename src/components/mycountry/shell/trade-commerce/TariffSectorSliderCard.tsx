import React from "react";
import { Slider } from "~/components/ui/slider";
import { PercentageFlow } from "~/components/ui/number-flow";
import { Lock, LockSlash as Unlock, Undo as RotateCcw } from "iconoir-react";
import { cn } from "~/lib/utils";
import type { CustomSector, AccentColor } from "./trade-commerce-types";
import { ACCENT_BORDER, ACCENT_TEXT, ACCENT_BG } from "./trade-commerce-types";

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
    <div
      className={cn(
        "bg-card/60 relative space-y-3 rounded-xl border p-4 backdrop-blur-md transition-all",
        ACCENT_BORDER[sector.accent] || "border-border/40"
      )}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div
            className={cn("h-2.5 w-2.5 rounded-full", ACCENT_BG[sector.accent] || "bg-primary")}
          />
          <span className="text-foreground text-xs font-semibold">{sector.label}</span>
        </div>

        <div className="flex items-center gap-1">
          {isModified && (
            <button
              type="button"
              onClick={onReset}
              title="Reset to default"
              className="text-muted-foreground hover:text-foreground p-1 transition-colors"
            >
              <RotateCcw className="h-3 w-3" />
            </button>
          )}
          <button
            type="button"
            onClick={onToggleLock}
            title={isLocked ? "Unlock sector" : "Lock sector"}
            className={cn(
              "rounded p-1 transition-colors",
              isLocked
                ? "bg-amber-500/10 text-amber-400"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {isLocked ? <Lock className="h-3.5 w-3.5" /> : <Unlock className="h-3.5 w-3.5" />}
          </button>
        </div>
      </div>

      <div className="flex items-baseline justify-between">
        <span className="text-muted-foreground text-xs">Export Share: {sector.defaultShare}%</span>
        <div className={cn("text-lg font-bold tracking-tight", ACCENT_TEXT[sector.accent])}>
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
        className="py-1"
      />
    </div>
  );
});
