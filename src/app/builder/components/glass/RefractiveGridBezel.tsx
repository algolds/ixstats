"use client";

import React, { useState, useRef, useEffect } from "react";
import { TextureOverlay } from "~/components/ui/texture-overlay";
import { DYNAMIC_ISLAND_STYLE, DynamicIslandEffects } from "./DynamicIslandEffects";

interface RefractiveGridBezelProps {
  countryCount?: number;
  children?: React.ReactNode;
}

export function RefractiveGridBezel({ countryCount, children }: RefractiveGridBezelProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

  useEffect(() => {
    if (!containerRef.current) return;
    const resizeObserver = new ResizeObserver((entries) => {
      // eslint-disable-next-line prefer-const
      for (let entry of entries) {
        const { inlineSize, blockSize } = entry.borderBoxSize?.[0] || {
          inlineSize: entry.contentRect.width,
          blockSize: entry.contentRect.height,
        };
        setDimensions({ width: inlineSize, height: blockSize });
      }
    });
    resizeObserver.observe(containerRef.current);
    return () => resizeObserver.disconnect();
  }, []);

  const { width, height } = dimensions;

  return (
    <div ref={containerRef} className="pointer-events-none absolute inset-0 z-30 h-full w-full">
      {width > 0 && height > 0 && (
        <>
          {/* Glass Fill - Left Segment */}
          <div
            className="pointer-events-none absolute top-0 bottom-0 left-0 w-[16px] overflow-hidden"
            style={DYNAMIC_ISLAND_STYLE}
          >
            <DynamicIslandEffects
              showShimmer={true}
              showGlow={true}
              glowOpacity={0.4}
              orientation="vertical"
            />
            <TextureOverlay texture="paperGrain" opacity={0.09} className="mix-blend-overlay" />
            <TextureOverlay texture="diagonal" opacity={0.06} className="mix-blend-overlay" />
          </div>

          {/* Glass Fill - Right Segment */}
          <div
            className="pointer-events-none absolute top-0 right-0 bottom-0 w-[16px] overflow-hidden"
            style={DYNAMIC_ISLAND_STYLE}
          >
            <DynamicIslandEffects
              showShimmer={true}
              showGlow={true}
              glowOpacity={0.4}
              orientation="vertical"
            />
            <TextureOverlay texture="paperGrain" opacity={0.09} className="mix-blend-overlay" />
            <TextureOverlay texture="diagonal" opacity={0.06} className="mix-blend-overlay" />
          </div>

          {/* Glass Fill - Bottom Segment */}
          <div
            className="pointer-events-none absolute right-[16px] bottom-0 left-[16px] flex h-8 items-center justify-center overflow-hidden"
            style={DYNAMIC_ISLAND_STYLE}
          >
            <DynamicIslandEffects showShimmer={true} showGlow={true} glowOpacity={0.4} />
            <TextureOverlay texture="paperGrain" opacity={0.09} className="mix-blend-overlay" />
            <TextureOverlay texture="diagonal" opacity={0.06} className="mix-blend-overlay" />

            {/* Centered Counter Text */}
            {countryCount !== undefined && countryCount > 0 && (
              <span className="relative z-10 text-[9px] font-extrabold tracking-widest text-white/50 uppercase select-none">
                {countryCount} countries
              </span>
            )}
            {children}
          </div>

          {/* Continuous SVG overlay for borders and light leaks */}
          <svg className="pointer-events-none absolute inset-0 z-10 h-full w-full overflow-visible">
            <defs>
              <filter id="white-light-leak">
                <feGaussianBlur stdDeviation="5" />
              </filter>
            </defs>

            {/* 1. Outer Soft White Light Leak Glow (projects slightly inward) */}
            <path
              d={`M 2 0 L 2 ${height - 14} Q 2 ${height - 2} 14 ${height - 2} L ${width - 14} ${height - 2} Q ${width - 2} ${height - 2} ${width - 2} ${height - 14} L ${width - 2} 0`}
              fill="none"
              stroke="rgba(255, 255, 255, 0.06)"
              strokeWidth="6"
              filter="url(#white-light-leak)"
            />

            {/* 2. Inner Soft White Light Leak Glow (projects slightly outward) */}
            <path
              d={`M 15 0 L 15 ${height - 39} Q 15 ${height - 31} 23 ${height - 31} L ${width - 23} ${height - 31} Q ${width - 15} ${height - 31} ${width - 15} ${height - 39} L ${width - 15} 0`}
              fill="none"
              stroke="rgba(255, 255, 255, 0.06)"
              strokeWidth="6"
              filter="url(#white-light-leak)"
            />

            {/* 3. Crisp Outer Border Line */}
            <path
              d={`M 1.5 0 L 1.5 ${height - 13.5} Q 1.5 ${height - 1.5} 13.5 ${height - 1.5} L ${width - 13.5} ${height - 1.5} Q ${width - 1.5} ${height - 1.5} ${width - 1.5} ${height - 13.5} L ${width - 1.5} 0`}
              fill="none"
              className="stroke-white/20 dark:stroke-white/10"
              strokeWidth="1"
            />

            {/* 4. Crisp Inner Border Line */}
            <path
              d={`M 16 0 L 16 ${height - 40} Q 16 ${height - 32} 24 ${height - 32} L ${width - 24} ${height - 32} Q ${width - 16} ${height - 32} ${width - 16} ${height - 40} L ${width - 16} 0`}
              fill="none"
              className="stroke-white/20 dark:stroke-white/10"
              strokeWidth="1"
            />
          </svg>
        </>
      )}
    </div>
  );
}
