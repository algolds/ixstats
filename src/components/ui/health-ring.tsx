"use client";

import React, { useId, useState } from "react";
import { motion, useSpring, useTransform } from "motion/react";
import { NumberFlowDisplay } from "./number-flow";
import { Tooltip, TooltipTrigger, TooltipContent } from "./tooltip";

/**
 * A translucent tint of the ring colour. `color-mix()` with `transparent` in sRGB yields exactly
 * `rgba(r, g, b, alpha)` for a hex input, and also accepts any CSS colour (`var(--color-*)`,
 * `oklch()`, named colours), so callers can pass design tokens instead of hex literals.
 */
const tint = (alpha: number) =>
  `color-mix(in srgb, var(--health-ring-color) ${Math.round(alpha * 100)}%, transparent)`;

interface HealthRingProps {
  value: number; // 0-100
  size?: number; // px
  /** Any CSS colour: a token such as `var(--color-emerald-500)`, or hex/rgb/oklch. */
  color?: string;
  label?: string;
  target?: number; // target threshold value (default 100)
  tooltip?: string;
  className?: string;
  onClick?: () => void;
  isClickable?: boolean;
  hideValue?: boolean;
}

export const HealthRing: React.FC<HealthRingProps> = ({
  value,
  size = 110,
  color = "var(--color-cyan-400)",
  label,
  target = 100,
  tooltip = "",
  className = "",
  onClick,
  isClickable = false,
  hideValue = false,
}) => {
  // Ensure size is a valid number
  const validSize = typeof size === "number" && !isNaN(size) && size > 0 ? size : 110;
  const stroke = 8;
  const radius = Math.max(1, (validSize - stroke * 2) / 2); // Ensure radius is at least 1
  const circumference = 2 * Math.PI * radius;
  const safeTarget = Math.max(1, target || 100); // Ensure target is at least 1
  const safeValue = typeof value === "number" && !isNaN(value) ? value : 0;
  const progress = Math.max(0, Math.min(safeTarget, safeValue));
  const progressRatio = safeTarget > 0 ? progress / safeTarget : 0;
  const offset = isNaN(circumference - progressRatio * circumference)
    ? circumference
    : circumference - progressRatio * circumference;
  const [hovered, setHovered] = useState(false);
  // Unique, selector-safe ids for the SVG gradients (labels may contain spaces or repeat).
  const gradientId = `health-ring-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;

  // Framer Motion physics springs with safe values
  const springProgress = useSpring(progress, { stiffness: 100, damping: 15 });
  const springScale = useSpring(hovered ? 1.05 : 1, { stiffness: 400, damping: 25 });
  const springGlow = useSpring(hovered ? 1 : 0.8, { stiffness: 300, damping: 20 });

  // Transform values for dynamic effects with safe calculations
  const _animatedOffset = useTransform(springProgress, [0, safeTarget], [circumference, 0]);

  const ringContent = (
    <motion.div
      className={`group/healthring relative flex items-center justify-center ${
        isClickable ? "cursor-pointer" : ""
      } ${className}`}
      style={
        {
          width: validSize,
          height: validSize,
          scale: springScale,
          "--health-ring-color": color,
        } as React.ComponentProps<typeof motion.div>["style"]
      }
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={onClick}
      tabIndex={isClickable ? 0 : -1}
      onFocus={() => setHovered(true)}
      onBlur={() => setHovered(false)}
      role={isClickable ? "button" : undefined}
      aria-label={isClickable ? `View details for ${label}` : undefined}
      whileHover={{ scale: isClickable ? 1.08 : 1.02 }}
      whileTap={{ scale: isClickable ? 0.95 : 1 }}
      transition={{ type: "spring", stiffness: 400, damping: 25 }}
    >
      {/* Enhanced glass border with motion physics */}
      <motion.div
        className="pointer-events-none absolute inset-0 z-10 rounded-full"
        style={{
          background: hideValue
            ? "transparent"
            : `linear-gradient(135deg, ${tint(0.15)}, ${tint(0.05)})`,
          boxShadow: hideValue
            ? `0 0 0 1.5px ${tint(0.5)},
               0 0 10px 2px ${tint(0.2)}`
            : `0 0 0 2px ${tint(0.6)},
               0 0 20px 4px ${tint(0.3)},
               0 0 40px 8px ${tint(0.15)},
               inset 0 1px 0 hsl(var(--accent) / 0.6)`,
          backdropFilter: hideValue ? "none" : "blur(12px) saturate(1.8)",
          WebkitBackdropFilter: hideValue ? "none" : "blur(12px) saturate(1.8)",
          opacity: springGlow,
        }}
        animate={{
          boxShadow: hovered
            ? hideValue
              ? `0 0 0 2px ${tint(0.7)},
                 0 0 15px 3px ${tint(0.3)}`
              : `0 0 0 3px ${tint(0.8)},
                 0 0 30px 6px ${tint(0.4)},
                 0 0 60px 12px ${tint(0.2)}`
            : hideValue
              ? `0 0 0 1.5px ${tint(0.5)},
                 0 0 10px 2px ${tint(0.2)}`
              : `0 0 0 2px ${tint(0.6)},
                 0 0 20px 4px ${tint(0.3)},
                 0 0 40px 8px ${tint(0.15)}`,
        }}
        transition={{ type: "spring", stiffness: 300, damping: 20 }}
      />
      {/* Inner glow layer */}
      {!hideValue && (
        <div
          className="pointer-events-none absolute inset-1 z-5 rounded-full"
          style={{
            background: `radial-gradient(circle at 30% 30%, ${tint(0.2)}, transparent 70%)`,
            opacity: hovered ? 0.8 : 0.4,
            transition: "opacity 0.3s",
          }}
        />
      )}
      <svg width={validSize} height={validSize} className="z-20 -rotate-90 transform">
        {/* Background circle */}
        <circle
          cx={validSize / 2}
          cy={validSize / 2}
          r={radius}
          fill="none"
          style={{ stroke: "color-mix(in srgb, var(--muted-foreground) 20%, transparent)" }}
          strokeWidth={stroke}
        />
        {/* Animated liquid-like gradient progress circle */}
        <defs>
          <linearGradient id={`${gradientId}-stroke`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" style={{ stopColor: color }} stopOpacity="1">
              <animate
                attributeName="stop-opacity"
                values="1;0.7;1"
                dur="2s"
                repeatCount="indefinite"
              />
              <animate
                attributeName="offset"
                values="0%;15%;0%"
                dur="4s"
                repeatCount="indefinite"
              />
            </stop>
            <stop
              offset="30%"
              style={{ stopColor: tint(0.9) }}
              stopOpacity="0.9"
            >
              <animate
                attributeName="stop-opacity"
                values="0.9;0.6;0.9"
                dur="2.5s"
                repeatCount="indefinite"
              />
              <animate
                attributeName="offset"
                values="30%;45%;30%"
                dur="4s"
                repeatCount="indefinite"
              />
            </stop>
            <stop
              offset="70%"
              style={{ stopColor: tint(0.7) }}
              stopOpacity="0.7"
            >
              <animate
                attributeName="stop-opacity"
                values="0.7;0.4;0.7"
                dur="3s"
                repeatCount="indefinite"
              />
              <animate
                attributeName="offset"
                values="70%;85%;70%"
                dur="4s"
                repeatCount="indefinite"
              />
            </stop>
            <stop
              offset="100%"
              style={{ stopColor: tint(0.5) }}
              stopOpacity="0.5"
            >
              <animate
                attributeName="stop-opacity"
                values="0.5;0.3;0.5"
                dur="3.5s"
                repeatCount="indefinite"
              />
              <animate
                attributeName="offset"
                values="100%;85%;100%"
                dur="4s"
                repeatCount="indefinite"
              />
            </stop>
          </linearGradient>

          {/* Additional liquid wave effect */}
          <radialGradient id={`${gradientId}-wave`} cx="50%" cy="50%" r="50%">
            <stop offset="0%" style={{ stopColor: tint(0.3) }}>
              <animate
                attributeName="stop-opacity"
                values="0.3;0.6;0.3"
                dur="2s"
                repeatCount="indefinite"
              />
            </stop>
            <stop offset="100%" style={{ stopColor: tint(0.1) }}>
              <animate
                attributeName="stop-opacity"
                values="0.1;0.3;0.1"
                dur="2s"
                repeatCount="indefinite"
              />
            </stop>
          </radialGradient>
        </defs>
        {/* Pulsing background circle for liquid effect */}
        {!hideValue && (
          <circle
            cx={validSize / 2}
            cy={validSize / 2}
            r={radius - 2}
            fill={`url(#${gradientId}-wave)`}
            opacity="0.4"
          >
            <animate
              attributeName="r"
              values={`${radius - 2};${radius + 1};${radius - 2}`}
              dur="3s"
              repeatCount="indefinite"
            />
            <animate
              attributeName="opacity"
              values="0.4;0.1;0.4"
              dur="3s"
              repeatCount="indefinite"
            />
          </circle>
        )}

        {/* Main animated progress circle with liquid movement */}
        <motion.circle
          cx={validSize / 2}
          cy={validSize / 2}
          r={radius}
          fill="none"
          stroke={`url(#${gradientId}-stroke)`}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={_animatedOffset}
          style={{
            filter: hovered
              ? `drop-shadow(0 0 16px ${color}) drop-shadow(0 0 32px ${tint(0.5)})`
              : `drop-shadow(0 0 8px ${color})`,
            transition: "filter 0.3s",
          }}
        >
          <animate
            attributeName="stroke-width"
            values={`${stroke};${stroke + 1};${stroke}`}
            dur="2s"
            repeatCount="indefinite"
          />
        </motion.circle>

        {/* Additional shimmer effect */}
        <circle
          cx={validSize / 2}
          cy={validSize / 2}
          r={radius}
          fill="none"
          style={{ stroke: tint(0.3) }}
          strokeWidth="2"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          opacity="0"
        >
          <animate
            attributeName="opacity"
            values="0;0.7;0"
            dur="1.5s"
            begin="0.5s"
            repeatCount="indefinite"
          />
          <animate
            attributeName="stroke-width"
            values="2;1;2"
            dur="1.5s"
            begin="0.5s"
            repeatCount="indefinite"
          />
        </circle>
      </svg>
      {/* Center content */}
      {!hideValue && (
        <div className="absolute inset-0 z-30 flex flex-col items-center justify-center">
          <span className="text-foreground text-2xl font-bold">
            <NumberFlowDisplay value={progress} decimalPlaces={0} />
          </span>
          {safeTarget !== 100 && (
            <span className="text-muted-foreground text-xs">of {safeTarget}</span>
          )}
        </div>
      )}
    </motion.div>
  );

  if (tooltip) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>{ringContent}</TooltipTrigger>
        <TooltipContent side="top" sideOffset={8}>
          <div className="text-foreground font-medium">{label}</div>
          <div className="text-muted-foreground mt-1 text-xs">{tooltip}</div>
        </TooltipContent>
      </Tooltip>
    );
  }

  return ringContent;
};

export default HealthRing;
