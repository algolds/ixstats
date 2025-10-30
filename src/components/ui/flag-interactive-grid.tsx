"use client";

import { cn } from "~/lib/utils";
import React, { useState, useEffect, useRef } from "react";
import { SimpleFlag } from "~/components/SimpleFlag";

interface CountryData {
  id: string;
  name: string;
  currentPopulation: number;
  currentGdpPerCapita: number;
  currentTotalGdp: number;
  economicTier: string;
}

interface FlagInteractiveGridProps extends React.HTMLProps<HTMLDivElement> {
  width?: number;
  height?: number;
  squares?: [number, number]; // [horizontal, vertical]
  className?: string;
  squaresClassName?: string;
  countries: CountryData[];
  maxOpacity?: number;
  strokeDasharray?: number;
  duration?: number;
  blurIntensity?: number;
  flagCoverage?: number;
}

export function FlagInteractiveGrid({
  width = 50,
  height = 50,
  squares = [25, 15],
  className,
  squaresClassName,
  countries,
  maxOpacity = 0.6,
  strokeDasharray = 0,
  duration = 4,
  blurIntensity = 4,
  flagCoverage = 0.25,
  ...props
}: FlagInteractiveGridProps) {
  const [horizontal, vertical] = squares;
  const [flagMapping, setFlagMapping] = useState<Record<number, CountryData>>({});

  // Initialize static flag mapping with controllable coverage
  useEffect(() => {
    if (countries.length === 0) return;

    const mapping: Record<number, CountryData> = {};
    const totalSquares = horizontal * vertical;

    // Fill squares based on flagCoverage parameter
    for (let i = 0; i < totalSquares; i++) {
      if (Math.random() < flagCoverage) {
        mapping[i] = countries[Math.floor(Math.random() * countries.length)];
      }
    }

    setFlagMapping(mapping);
  }, [countries, horizontal, vertical, flagCoverage]);

  return (
    <div
      className={cn("pointer-events-none absolute inset-0 h-full w-full", className)}
      style={{
        // Controllable blur for background depth effect
        filter: `blur(${blurIntensity}px) saturate(120%)`,
        // Reverse refraction - background is more heavily processed for lower depth perception
        backdropFilter: `blur(${blurIntensity * 1.5}px) contrast(0.85) brightness(0.9)`,
        WebkitBackdropFilter: `blur(${blurIntensity * 1.5}px) contrast(0.85) brightness(0.9)`,
      }}
      {...props}
    >
      <svg className="h-full w-full" width="100%" height="100%" style={{ pointerEvents: "none" }}>
        <defs>
          <pattern id="flagGrid" width={width} height={height} patternUnits="userSpaceOnUse">
            {/* Base grid lines */}
            <path
              d={`M ${width} 0 L 0 0 0 ${height}`}
              fill="none"
              stroke="currentColor"
              strokeWidth="1"
              className="text-gray-400/20 dark:text-gray-600/20"
              strokeDasharray={strokeDasharray}
            />
          </pattern>

          {/* Flag patterns for each mapped country */}
          {Object.entries(flagMapping).map(([index, country]) => {
            const squareIndex = parseInt(index);
            const row = Math.floor(squareIndex / horizontal);
            const col = squareIndex % horizontal;

            return (
              <pattern
                key={`flag-${squareIndex}`}
                id={`flag-pattern-${squareIndex}`}
                x={col * width}
                y={row * height}
                width={width}
                height={height}
                patternUnits="userSpaceOnUse"
              >
                <foreignObject width={width} height={height} className="opacity-60">
                  <div className="h-full w-full overflow-hidden rounded-sm">
                    <SimpleFlag
                      countryName={country.name}
                      className="h-full w-full object-cover"
                      showPlaceholder={true}
                    />
                    {/* Controllable refraction overlay for depth effect */}
                    <div
                      className="bg-background/50 absolute inset-0 mix-blend-overlay"
                      style={{
                        backdropFilter: `blur(${Math.max(2, blurIntensity / 2)}px) contrast(0.8)`,
                        WebkitBackdropFilter: `blur(${Math.max(2, blurIntensity / 2)}px) contrast(0.8)`,
                        background: `linear-gradient(135deg, 
                          rgba(255, 255, 255, 0.2) 0%, 
                          rgba(255, 255, 255, 0.1) 50%,
                          rgba(0, 0, 0, 0.15) 100%)`,
                      }}
                    />
                  </div>
                </foreignObject>
              </pattern>
            );
          })}
        </defs>

        {/* Base grid */}
        <rect width="100%" height="100%" fill="url(#flagGrid)" />

        {/* Static Flag squares with reverse refraction */}
        {Object.entries(flagMapping).map(([index, country]) => {
          const squareIndex = parseInt(index);
          const row = Math.floor(squareIndex / horizontal);
          const col = squareIndex % horizontal;
          const x = col * width;
          const y = row * height;

          return (
            <rect
              key={`flag-rect-${squareIndex}`}
              x={x}
              y={y}
              width={width}
              height={height}
              fill={`url(#flag-pattern-${squareIndex})`}
              className={cn(squaresClassName)}
              style={{
                opacity: maxOpacity * 0.6,
                // Controllable blur for individual flag squares
                filter: `blur(${Math.max(1, blurIntensity / 3)}px) contrast(0.8)`,
              }}
            />
          );
        })}
      </svg>
    </div>
  );
}

export default FlagInteractiveGrid;
