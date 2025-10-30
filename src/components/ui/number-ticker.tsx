"use client";
import React from "react";
import { NumberFlowDisplay } from "./number-flow";
import { cn } from "~/lib/utils";

interface NumberTickerProps {
  value: number;
  className?: string;
  prefix?: string;
  suffix?: string;
  decimalPlaces?: number;
  duration?: number;
  format?: "default" | "currency" | "population" | "percentage";
  trend?: "up" | "down" | "stable";
}

/**
 * NumberTicker component - now uses NumberFlow under the hood
 * @deprecated Use NumberFlowDisplay directly for new components
 */
export function NumberTicker({
  value,
  className,
  prefix = "",
  suffix = "",
  decimalPlaces = 0,
  duration = 1000,
  format = "default",
  trend,
}: NumberTickerProps) {
  return (
    <NumberFlowDisplay
      value={value}
      className={cn("font-variant-numeric tabular-nums", className)}
      prefix={prefix}
      suffix={suffix}
      decimalPlaces={decimalPlaces}
      duration={duration}
      format={format}
      trend={trend}
    />
  );
}
