"use client";

import { SystemRestart as Loader2 } from "iconoir-react";
import { Button } from "~/components/ui/button";
import { NumberFlowDisplay } from "~/components/ui/number-flow";
import { OnomaGlyph } from "../glyphs/OnomaGlyph";

interface GenerateCountPillProps {
  isGenerating: boolean;
  /** Extra reason to block generation, e.g. no dictionary chosen. */
  generateDisabled?: boolean;
  onGenerate: () => void;
  batchCount: number;
  setBatchCount: (c: number | ((prev: number) => number)) => void;
}

const STEPPER_BUTTON_CLASS =
  "text-on-tint/80 hover:text-on-tint hover:bg-on-tint/15 w-7 justify-center";

/** Generate action with a batch-size stepper, shared by the quick generator and domain control bar. */
export function GenerateCountPill({
  isGenerating,
  generateDisabled = false,
  onGenerate,
  batchCount,
  setBatchCount,
}: GenerateCountPillProps) {
  return (
    <div className="bg-tint hover:bg-tint-hover active:bg-tint-hover group rounded-row border-separator shadow-card relative flex h-11 w-full items-center overflow-hidden border transition-[color,background-color,border-color,box-shadow,opacity,transform] select-none">
      <Button
        variant="ghost"
        onClick={onGenerate}
        disabled={isGenerating || generateDisabled}
        className="text-on-tint hover:text-on-tint h-full flex-1 gap-2 rounded-none pr-3 pl-4 hover:bg-transparent"
      >
        {isGenerating ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <OnomaGlyph
            name="emerge-synthesis"
            size="xs"
            className="text-on-tint transition-transform group-hover:scale-110"
          />
        )}
        <span className="text-body font-semibold">Generate</span>
      </Button>

      <div className="bg-fill-3 h-5 w-[1px] shrink-0" />

      <div className="text-on-tint flex h-full shrink-0 items-center pr-2 pl-1">
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={(e) => {
            e.stopPropagation();
            setBatchCount((c) =>
              c > 100 ? Math.max(100, c - 50) : c > 50 ? Math.max(50, c - 25) : Math.max(5, c - 5)
            );
          }}
          disabled={batchCount <= 5 || isGenerating}
          title="Decrease count"
          aria-label="Decrease count"
          className={STEPPER_BUTTON_CLASS}
        >
          -
        </Button>
        <div className="text-body text-on-tint flex min-w-[28px] items-center justify-center px-1 leading-none font-semibold">
          <NumberFlowDisplay value={batchCount} className="text-body text-on-tint font-semibold" />
        </div>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={(e) => {
            e.stopPropagation();
            setBatchCount((c) =>
              c >= 100 ? Math.min(500, c + 50) : c >= 50 ? Math.min(100, c + 25) : c + 5
            );
          }}
          disabled={batchCount >= 500 || isGenerating}
          title="Increase count"
          aria-label="Increase count"
          className={STEPPER_BUTTON_CLASS}
        >
          +
        </Button>
      </div>
    </div>
  );
}
