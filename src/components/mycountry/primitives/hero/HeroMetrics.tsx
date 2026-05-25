"use client";

import React from "react";
import { motion } from "motion/react";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import NumberFlow from "@number-flow/react";

interface MetricItem {
  label: string;
  value: number;
  suffix?: string;
  prefix?: string;
  trend?: number;
  format?: "compact" | "standard" | "percent";
}

interface HeroMetricsProps {
  metrics: MetricItem[];
  className?: string;
}

export function HeroMetrics({ metrics, className = "" }: HeroMetricsProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.4, duration: 0.5 }}
      className={`flex items-center gap-6 ${className}`}
    >
      {metrics.map((metric, index) => (
        <motion.div
          key={metric.label}
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.5 + index * 0.1, duration: 0.4 }}
          className="flex flex-col items-center rounded-xl border border-white/10 bg-white/10 px-4 py-2 backdrop-blur-md"
        >
          <div className="flex items-baseline gap-1">
            {metric.prefix && (
              <span className="text-sm font-medium text-white/70">{metric.prefix}</span>
            )}
            <NumberFlow
              value={metric.value}
              format={
                metric.format === "percent"
                  ? { style: "percent", minimumFractionDigits: 1 }
                  : metric.format === "compact"
                    ? { notation: "compact", maximumFractionDigits: 1 }
                    : { maximumFractionDigits: 0 }
              }
              className="text-xl font-bold text-white tabular-nums"
              transformTiming={{ duration: 600, easing: "ease-out" }}
            />
            {metric.suffix && (
              <span className="text-sm font-medium text-white/70">{metric.suffix}</span>
            )}
          </div>

          <div className="mt-0.5 flex items-center gap-1">
            <span className="text-xs text-white/60">{metric.label}</span>
            {metric.trend !== undefined && <TrendIndicator value={metric.trend} />}
          </div>
        </motion.div>
      ))}
    </motion.div>
  );
}

function TrendIndicator({ value }: { value: number }) {
  if (value > 0) {
    return (
      <span className="flex items-center text-emerald-400">
        <TrendingUp className="h-3 w-3" />
      </span>
    );
  }
  if (value < 0) {
    return (
      <span className="flex items-center text-red-400">
        <TrendingDown className="h-3 w-3" />
      </span>
    );
  }
  return (
    <span className="flex items-center text-white/40">
      <Minus className="h-3 w-3" />
    </span>
  );
}

// Compact version for mobile
interface HeroMetricsCompactProps {
  gdp: number;
  population: number;
  growth: number;
  className?: string;
}

export function HeroMetricsCompact({
  gdp,
  population,
  growth,
  className = "",
}: HeroMetricsCompactProps) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: 0.4 }}
      className={`flex items-center gap-3 text-sm text-white/80 ${className}`}
    >
      <span className="flex items-center gap-1">
        <span className="text-white/50">GDP:</span>
        <NumberFlow
          value={gdp}
          format={{ notation: "compact", style: "currency", currency: "USD" }}
          className="font-medium"
        />
      </span>
      <span className="text-white/30">|</span>
      <span className="flex items-center gap-1">
        <span className="text-white/50">Pop:</span>
        <NumberFlow value={population} format={{ notation: "compact" }} className="font-medium" />
      </span>
      <span className="text-white/30">|</span>
      <span className="flex items-center gap-1">
        <span className={growth >= 0 ? "text-emerald-400" : "text-red-400"}>
          {growth >= 0 ? "+" : ""}
          {(growth * 100).toFixed(1)}%
        </span>
      </span>
    </motion.div>
  );
}
