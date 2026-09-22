"use client";

import React, { useMemo } from "react";
import { motion } from "motion/react";
import { cn } from "~/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "~/components/ui/tooltip";

export interface CountryDNAScores {
  economy: number; // 0-100
  technology: number;
  wellbeing: number;
  governance: number;
  defense: number;
  diplomacy: number;
}

interface RadialCountryDNAProps {
  countryName: string;
  scores?: Partial<CountryDNAScores>;
  size?: number;
  className?: string;
  showLabels?: boolean;
}

const AXES = [
  { key: "economy", label: "Economy", defaultVal: 85, color: "#38bdf8" },
  { key: "technology", label: "Innovation", defaultVal: 88, color: "#818cf8" },
  { key: "wellbeing", label: "Wellbeing", defaultVal: 82, color: "#34d399" },
  { key: "governance", label: "Governance", defaultVal: 78, color: "#fbbf24" },
  { key: "defense", label: "Defense", defaultVal: 72, color: "#f87171" },
  { key: "diplomacy", label: "Diplomacy", defaultVal: 65, color: "#c084fc" },
] as const;

export function RadialCountryDNA({
  countryName,
  scores,
  size = 280,
  className,
  showLabels = true,
}: RadialCountryDNAProps) {
  const center = size / 2;
  const radius = size * 0.38;

  // Resolve values
  const values = useMemo(() => {
    return AXES.map((axis) => {
      const val = scores?.[axis.key] ?? axis.defaultVal;
      return Math.min(100, Math.max(10, val));
    });
  }, [scores]);

  // Compute polygon points
  const points = useMemo(() => {
    const count = AXES.length;
    return values
      .map((val, idx) => {
        const angle = (Math.PI * 2 * idx) / count - Math.PI / 2;
        const r = (val / 100) * radius;
        const x = center + r * Math.cos(angle);
        const y = center + r * Math.sin(angle);
        return `${x},${y}`;
      })
      .join(" ");
  }, [values, center, radius]);

  // Derive Archetype
  const archetype = useMemo(() => {
    const avg = values.reduce((a, b) => a + b, 0) / values.length;
    if (values[0] > 85 && values[1] > 85) return "Techno-Industrial Hegemon";
    if (values[0] > 80 && values[5] > 75) return "Mercantile Trade Empire";
    if (values[4] > 80) return "Martial Defense Sovereign";
    if (avg > 80) return "Advanced High-Capacity State";
    return "Balanced Sovereign Entity";
  }, [values]);

  return (
    <div
      className={cn(
        "facet-surface facet-refraction flex flex-col items-center justify-center rounded-2xl border border-white/10 p-5 shadow-lg backdrop-blur-xl",
        className
      )}
    >
      <div className="mb-2 flex w-full items-center justify-between">
        <div>
          <span className="text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground">
            Sovereign Archetype
          </span>
          <h4 className="text-sm font-bold tracking-tight text-foreground">{archetype}</h4>
        </div>
        <span className="rounded-md border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] font-bold text-[var(--flag-primary)]">
          DNA Fingerprint
        </span>
      </div>

      <div className="relative flex items-center justify-center">
        <svg width={size} height={size} className="overflow-visible">
          <defs>
            <linearGradient id="dnaGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="var(--flag-primary, #38bdf8)" stopOpacity="0.4" />
              <stop offset="100%" stopColor="#818cf8" stopOpacity="0.15" />
            </linearGradient>
            <radialGradient id="dnaCenterGlow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="var(--flag-primary, #38bdf8)" stopOpacity="0.3" />
              <stop offset="100%" stopColor="transparent" stopOpacity="0" />
            </radialGradient>
          </defs>

          {/* Background concentric reference rings */}
          {[0.25, 0.5, 0.75, 1.0].map((level, i) => (
            <polygon
              key={i}
              points={AXES.map((_, idx) => {
                const angle = (Math.PI * 2 * idx) / AXES.length - Math.PI / 2;
                const r = level * radius;
                return `${center + r * Math.cos(angle)},${center + r * Math.sin(angle)}`;
              }).join(" ")}
              fill="none"
              stroke="currentColor"
              className="text-white/10"
              strokeWidth={1}
            />
          ))}

          {/* Radial axis lines */}
          {AXES.map((_, idx) => {
            const angle = (Math.PI * 2 * idx) / AXES.length - Math.PI / 2;
            const x2 = center + radius * Math.cos(angle);
            const y2 = center + radius * Math.sin(angle);
            return (
              <line
                key={idx}
                x1={center}
                y1={center}
                x2={x2}
                y2={y2}
                stroke="currentColor"
                className="text-white/10"
                strokeWidth={1}
                strokeDasharray="2,2"
              />
            );
          })}

          {/* Center glow */}
          <circle cx={center} cy={center} r={radius * 0.4} fill="url(#dnaCenterGlow)" />

          {/* Filled radar polygon */}
          <motion.polygon
            points={points}
            fill="url(#dnaGradient)"
            stroke="var(--flag-primary, #38bdf8)"
            strokeWidth={2}
            className="filter drop-shadow-[0_0_8px_rgba(56,189,248,0.3)]"
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", bounce: 0, duration: 0.5 }}
          />

          {/* Vertex points */}
          {values.map((val, idx) => {
            const angle = (Math.PI * 2 * idx) / AXES.length - Math.PI / 2;
            const r = (val / 100) * radius;
            const x = center + r * Math.cos(angle);
            const y = center + r * Math.sin(angle);
            const axis = AXES[idx]!;

            return (
              <circle
                key={idx}
                cx={x}
                cy={y}
                r={4}
                fill={axis.color}
                stroke="#fff"
                strokeWidth={1.5}
                className="transition-transform duration-200 hover:scale-150"
              />
            );
          })}
        </svg>

        {/* Outer labels */}
        {showLabels && (
          <div className="pointer-events-none absolute inset-0">
            {AXES.map((axis, idx) => {
              const angle = (Math.PI * 2 * idx) / AXES.length - Math.PI / 2;
              const r = radius + 24;
              const x = center + r * Math.cos(angle);
              const y = center + r * Math.sin(angle);
              const val = values[idx];

              return (
                <div
                  key={idx}
                  style={{
                    left: `${x}px`,
                    top: `${y}px`,
                    transform: "translate(-50%, -50%)",
                  }}
                  className="absolute text-center"
                >
                  <span className="text-[10px] font-bold text-foreground">{axis.label}</span>
                  <span className="block text-[9px] font-extrabold text-muted-foreground">
                    {val}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
