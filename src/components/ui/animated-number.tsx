import React from "react";
import { NumberFlowDisplay } from "./number-flow";

interface AnimatedNumberProps {
  value: number;
  duration?: number;
  prefix?: string;
  suffix?: string;
  decimals?: number;
  format?: "default" | "currency" | "population" | "percentage";
  trend?: "up" | "down" | "stable";
  className?: string;
}

/**
 * Legacy AnimatedNumber component - now uses NumberFlow under the hood
 * @deprecated Use NumberFlowDisplay directly for new components
 */
export function AnimatedNumber({
  value,
  duration = 1000,
  prefix = "",
  suffix = "",
  decimals = 0,
  format = "default",
  trend,
  className,
}: AnimatedNumberProps) {
  return (
    <NumberFlowDisplay
      value={value}
      duration={duration}
      prefix={prefix}
      suffix={suffix}
      decimalPlaces={decimals}
      format={format}
      trend={trend}
      className={className}
    />
  );
}
