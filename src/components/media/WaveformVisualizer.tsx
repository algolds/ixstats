"use client";

import React, { useRef } from "react";

interface WaveformVisualizerProps {
  peaks?: number[];
  currentTime: number;
  duration: number;
  onSeek?: (seconds: number) => void;
}

export function WaveformVisualizer({
  peaks = [],
  currentTime,
  duration,
  onSeek,
}: WaveformVisualizerProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const progress = duration > 0 ? currentTime / duration : 0;

  // Generate fallback peaks if none provided
  const displayPeaks =
    peaks && peaks.length > 0
      ? peaks
      : Array.from(
          { length: 60 },
          (_, i) => 10 + Math.abs(Math.sin(i * 0.15)) * 40 + (i % 3 === 0 ? 15 : 0)
        );

  const handleSeek = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!onSeek || !svgRef.current || duration <= 0) return;
    const rect = svgRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const percentage = Math.max(0, Math.min(1, clickX / rect.width));
    onSeek(percentage * duration);
  };

  const maxPeak = Math.max(...displayPeaks, 1);
  const width = 300;
  const height = 64;
  const barWidth = width / displayPeaks.length;

  return (
    <svg
      ref={svgRef}
      viewBox={`0 0 ${width} ${height}`}
      onClick={handleSeek}
      className="h-16 w-full cursor-pointer select-none"
    >
      {displayPeaks.map((peak, index) => {
        const barProgress = index / displayPeaks.length;
        const isPlayed = barProgress <= progress;
        // Scale peak height relative to svg container
        const barHeight = Math.max(4, (peak / maxPeak) * height);
        const x = index * barWidth;
        const y = (height - barHeight) / 2; // Center vertically

        return (
          <rect
            key={index}
            x={x + 0.5}
            y={y}
            width={barWidth - 1}
            height={barHeight}
            rx={1.5}
            ry={1.5}
            className="transition-all duration-150"
            fill={isPlayed ? "var(--color-primary, #f97316)" : "currentColor"}
            opacity={isPlayed ? 1 : 0.25}
          />
        );
      })}
    </svg>
  );
}
