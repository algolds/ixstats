"use client";
import { useEffect, useState } from "react";
import { cn } from "../../lib/utils";

interface NumberTickerProps {
  value: number;
  className?: string;
  prefix?: string;
  suffix?: string;
  decimalPlaces?: number;
  duration?: number;
}

export function NumberTicker({ 
  value, 
  className, 
  prefix = '', 
  suffix = '', 
  decimalPlaces = 0,
  duration = 1000 
}: NumberTickerProps) {
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    let startTime: number;
    const startValue = displayValue;
    const difference = value - startValue;

    const animate = (currentTime: number) => {
      if (!startTime) startTime = currentTime;
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);

      // Easing function (ease-out)
      const easeOut = 1 - Math.pow(1 - progress, 3);
      
      setDisplayValue(startValue + (difference * easeOut));

      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };

    requestAnimationFrame(animate);
  }, [value, duration, displayValue]);

  return (
    <span className={cn("font-variant-numeric tabular-nums", className)}>
      {prefix}{displayValue.toFixed(decimalPlaces)}{suffix}
    </span>
  );
}