"use client";

import * as React from "react";
import * as ProgressPrimitive from "@radix-ui/react-progress";
import { cn } from "~/lib/utils";

type ProgressVariant = "critical" | "warning" | "moderate" | "secure" | "default";
type ProgressTheme = "default" | "defense";

interface ColoredProgressProps extends React.ComponentProps<typeof ProgressPrimitive.Root> {
  value?: number;
  variant?: ProgressVariant;
  showPulse?: boolean;
  animate?: boolean;
  theme?: ProgressTheme;
}

function getDefenseThemeStyles(value: number, showPulse: boolean) {
  // Defense theme always uses red/orange gradients with varying intensities
  if (value >= 75) {
    return {
      bg: "bg-orange-50 dark:bg-orange-950/20",
      indicator: "bg-gradient-to-r from-orange-500 to-amber-500",
      glow: "",
      pulse: "",
    };
  } else if (value >= 50) {
    return {
      bg: "bg-orange-100 dark:bg-orange-950/30",
      indicator: "bg-gradient-to-r from-orange-600 to-orange-500",
      glow: "",
      pulse: "",
    };
  } else if (value >= 25) {
    return {
      bg: "bg-red-100 dark:bg-red-950/30",
      indicator: "bg-gradient-to-r from-red-500 to-orange-500",
      glow: "",
      pulse: "",
    };
  } else {
    return {
      bg: "bg-red-100 dark:bg-red-950/30",
      indicator: "bg-gradient-to-r from-red-600 to-red-500",
      glow: showPulse ? "shadow-[0_0_10px_rgba(239,68,68,0.5)]" : "",
      pulse: showPulse ? "animate-pulse" : "",
    };
  }
}

function getVariantStyles(variant: ProgressVariant, showPulse: boolean) {
  const styles = {
    critical: {
      bg: "bg-red-100 dark:bg-red-950/30",
      indicator: "bg-gradient-to-r from-red-600 to-red-500",
      glow: showPulse ? "shadow-[0_0_10px_rgba(239,68,68,0.5)]" : "",
      pulse: showPulse ? "animate-pulse" : "",
    },
    warning: {
      bg: "bg-orange-100 dark:bg-orange-950/30",
      indicator: "bg-gradient-to-r from-orange-600 to-orange-500",
      glow: "",
      pulse: "",
    },
    moderate: {
      bg: "bg-blue-100 dark:bg-blue-950/30",
      indicator: "bg-gradient-to-r from-blue-500 to-cyan-500",
      glow: "",
      pulse: "",
    },
    secure: {
      bg: "bg-emerald-100 dark:bg-emerald-950/30",
      indicator: "bg-gradient-to-r from-emerald-500 to-green-500",
      glow: "",
      pulse: "",
    },
    default: {
      bg: "bg-primary/20",
      indicator: "bg-gradient-to-r from-red-500 to-orange-500",
      glow: "",
      pulse: "",
    },
  };

  return styles[variant];
}

function getVariantFromValue(value: number): ProgressVariant {
  if (value >= 75) return "secure";
  if (value >= 50) return "moderate";
  if (value >= 25) return "warning";
  return "critical";
}

export function ColoredProgress({
  className,
  value = 0,
  variant,
  showPulse = false,
  animate = true,
  theme = "default",
  ...props
}: ColoredProgressProps) {
  const [displayValue, setDisplayValue] = React.useState(animate ? 0 : value);

  // Use defense theme or standard variant-based styles
  const styles = theme === "defense"
    ? getDefenseThemeStyles(value, showPulse && value < 25)
    : getVariantStyles(variant || getVariantFromValue(value), showPulse && value < 25);

  // Animate value on mount
  React.useEffect(() => {
    if (animate) {
      const timer = setTimeout(() => {
        setDisplayValue(value);
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [value, animate]);

  const finalValue = animate ? displayValue : value;

  return (
    <ProgressPrimitive.Root
      data-slot="progress"
      className={cn(
        "relative h-2 w-full overflow-hidden rounded-full",
        styles.bg,
        className
      )}
      {...props}
    >
      <ProgressPrimitive.Indicator
        data-slot="progress-indicator"
        className={cn(
          "h-full w-full flex-1 transition-all duration-1200 ease-out",
          styles.indicator,
          styles.glow,
          styles.pulse
        )}
        style={{ transform: `translateX(-${100 - (finalValue || 0)}%)` }}
      />
    </ProgressPrimitive.Root>
  );
}
