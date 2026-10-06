"use client";

import { useRef, useState } from "react";
import { Check } from "iconoir-react";
import { cn } from "~/lib/utils";
import { soundCues } from "~/lib/sound/cuelume";
import { Button } from "~/components/ui/button";

/** Resolve a Margin thread by holding the button (a click reopens a resolved one). */
export function HoldToResolveButton({
  isResolved,
  onResolveToggle,
  isPending,
}: {
  isResolved: boolean;
  onResolveToggle: (resolved: boolean) => void;
  isPending: boolean;
}) {
  const [holding, setHolding] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const startHold = () => {
    if (isPending) return;
    setHolding(true);
    timerRef.current = setTimeout(() => {
      soundCues?.success?.();
      onResolveToggle(!isResolved);
      setHolding(false);
    }, 900);
  };

  const cancelHold = () => {
    setHolding(false);
    if (timerRef.current) clearTimeout(timerRef.current);
  };

  if (isResolved) {
    return (
      <Button
        variant="secondary"
        size="sm"
        onClick={() => onResolveToggle(false)}
        className="bg-green/10 text-green hover:bg-green/20"
        title="Reopen discussion thread"
      >
        <Check className="size-3" />
        <span>Resolved (click to reopen)</span>
      </Button>
    );
  }

  return (
    <div className="relative inline-flex select-none">
      <Button
        variant="outline"
        size="sm"
        onMouseDown={startHold}
        onMouseUp={cancelHold}
        onMouseLeave={cancelHold}
        onTouchStart={startHold}
        onTouchEnd={cancelHold}
        disabled={isPending}
        className={cn(
          "overflow-hidden",
          holding
            ? "border-green/60 bg-green/20 text-green hover:bg-green/20 scale-95"
            : "text-label-secondary hover:text-label"
        )}
      >
        {holding && (
          <div
            className="bg-green/30 absolute inset-0 origin-left transition-[width] duration-900 ease-linear"
            style={{ width: "100%" }}
          />
        )}
        <span className="relative z-10 flex items-center gap-1">
          <Check className="text-green h-3 w-3" />
          <span>{holding ? "Keep holding..." : "Hold to resolve"}</span>
        </span>
      </Button>
    </div>
  );
}
