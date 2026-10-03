"use client";

import React from "react";
import { motion, useReducedMotion } from "motion/react";
import { cn } from "~/lib/utils/cn";
import { NumberFlowDisplay } from "./number-flow";
import { Tooltip, TooltipTrigger, TooltipContent } from "./tooltip";

interface HealthRingProps {
  value: number; // 0-target
  size?: number; // px
  /** Any CSS colour — prefer a role such as `var(--color-green)` or `var(--color-tint)`. */
  color?: string;
  label?: string;
  target?: number; // target threshold value (default 100)
  tooltip?: string;
  className?: string;
  onClick?: () => void;
  isClickable?: boolean;
  hideValue?: boolean;
}

/** Value text sized to the ring (nothing below 12px). */
function valueTextClass(size: number) {
  if (size >= 96) return "text-title-2";
  if (size >= 64) return "text-title-3";
  return "text-caption";
}

/**
 * Ring meter: a `fill-2` track and a solid indicator arc. No glow, blur or looping
 * animation; the arc eases to its value (instantly under Reduce Motion).
 */
export const HealthRing: React.FC<HealthRingProps> = ({
  value,
  size = 110,
  color = "var(--color-tint)",
  label,
  target = 100,
  tooltip = "",
  className,
  onClick,
  isClickable = false,
  hideValue = false,
}) => {
  const reduceMotion = useReducedMotion();
  const validSize = typeof size === "number" && Number.isFinite(size) && size > 0 ? size : 110;
  const stroke = Math.max(3, Math.round(validSize / 12));
  const radius = Math.max(1, (validSize - stroke) / 2);
  const circumference = 2 * Math.PI * radius;
  const safeTarget = Math.max(1, target || 100);
  const safeValue = typeof value === "number" && Number.isFinite(value) ? value : 0;
  const progress = Math.max(0, Math.min(safeTarget, safeValue));
  const offset = circumference - (progress / safeTarget) * circumference;
  // Small rings can't fit a legible number; the value stays in the accessible name.
  const showValue = !hideValue && validSize >= 40;
  const clickable = isClickable || Boolean(onClick);
  const accessibleName = `${label ? `${label}: ` : ""}${Math.round(progress)}${
    safeTarget === 100 ? "%" : ` of ${safeTarget}`
  }`;

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (!clickable || !onClick) return;
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onClick();
    }
  };

  const ringContent = (
    <div
      className={cn(
        "relative inline-flex shrink-0 items-center justify-center rounded-full",
        clickable &&
          "focus-visible:outline-tint duration-fast ease-out-facet cursor-pointer transition-[scale] focus-visible:outline-2 focus-visible:outline-offset-2 active:scale-[0.98] motion-reduce:active:scale-100",
        className
      )}
      style={{ width: validSize, height: validSize }}
      onClick={clickable ? onClick : undefined}
      onKeyDown={clickable ? handleKeyDown : undefined}
      tabIndex={clickable ? 0 : undefined}
      role={clickable ? "button" : "img"}
      aria-label={clickable ? `View details for ${accessibleName}` : accessibleName}
    >
      <svg width={validSize} height={validSize} className="-rotate-90" aria-hidden>
        <circle
          cx={validSize / 2}
          cy={validSize / 2}
          r={radius}
          fill="none"
          stroke="var(--color-fill-2)"
          strokeWidth={stroke}
        />
        <motion.circle
          cx={validSize / 2}
          cy={validSize / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={false}
          animate={{ strokeDashoffset: offset }}
          transition={
            reduceMotion ? { duration: 0 } : { type: "spring", stiffness: 180, damping: 24 }
          }
        />
      </svg>
      {showValue && (
        <div className="absolute inset-0 flex flex-col items-center justify-center" aria-hidden>
          <span className={cn("text-label tabular-nums", valueTextClass(validSize))}>
            <NumberFlowDisplay value={progress} decimalPlaces={0} />
          </span>
          {safeTarget !== 100 && validSize >= 64 && (
            <span className="text-footnote text-label-secondary tabular-nums">of {safeTarget}</span>
          )}
        </div>
      )}
    </div>
  );

  if (tooltip) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>{ringContent}</TooltipTrigger>
        <TooltipContent side="top" sideOffset={8}>
          {label && <div className="text-headline">{label}</div>}
          <div className="text-footnote text-label-secondary mt-1">{tooltip}</div>
        </TooltipContent>
      </Tooltip>
    );
  }

  return ringContent;
};

export default HealthRing;
