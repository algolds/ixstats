"use client";

import React, { useState } from "react";
import { motion, useSpring, useTransform } from "framer-motion";
import { AnimatedNumber } from "./animated-number";
import { Tooltip, TooltipTrigger, TooltipContent } from "./tooltip";

function hexToRgb(hexInput?: string) {
  let hex = hexInput || '#10b981';
  hex = hex.replace(/^#/, "");
  if (hex.length === 3) {
    hex = hex.split('').map(x => x + x).join("");
  }
  const result = /^([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (result && result.length >= 4) {
    return {
      r: parseInt(result[1] ?? '0', 16),
      g: parseInt(result[2] ?? '0', 16),
      b: parseInt(result[3] ?? '0', 16),
    };
  }
  return { r: 16, g: 185, b: 129 }; // Default green
}

interface HealthRingProps {
  value: number; // 0-100
  size?: number; // px
  color?: string; // tailwind or hex
  label?: string;
  target?: number; // for SDI-style (default 100)
  tooltip?: string;
  className?: string;
  onClick?: () => void;
  isClickable?: boolean;
}

export const HealthRing: React.FC<HealthRingProps> = ({
  value,
  size = 110,
  color = "#22d3ee",
  label,
  target = 100,
  tooltip = '',
  className = '',
  onClick,
  isClickable = false,
}) => {
  // Ensure size is a valid number
  const validSize = typeof size === 'number' && !isNaN(size) && size > 0 ? size : 110;
  const stroke = 8;
  const radius = (validSize - stroke * 2) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = Math.max(0, Math.min(target, value));
  const offset = circumference - (progress / target) * circumference;
  const rgb = hexToRgb(color);
  const [hovered, setHovered] = useState(false);
  
  // Framer Motion physics springs
  const springProgress = useSpring(progress, { stiffness: 100, damping: 15 });
  const springScale = useSpring(hovered ? 1.05 : 1, { stiffness: 400, damping: 25 });
  const springGlow = useSpring(hovered ? 1 : 0.8, { stiffness: 300, damping: 20 });
  
  // Transform values for dynamic effects
  const animatedOffset = useTransform(springProgress, [0, target], [circumference, circumference - (target / target) * circumference]);
  
  // Glassy border color
  const borderColor = `rgba(${rgb.r},${rgb.g},${rgb.b},0.45)`;

  const ringContent = (
    <motion.div
      className={`relative flex items-center justify-center group/healthring ${
        isClickable ? 'cursor-pointer' : ''
      } ${className}`}
      style={{ 
        width: validSize, 
        height: validSize,
        scale: springScale,
      }}
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
        className="absolute inset-0 rounded-full pointer-events-none z-10"
        style={{
          background: `linear-gradient(135deg, rgba(${rgb.r},${rgb.g},${rgb.b},0.15), rgba(${rgb.r},${rgb.g},${rgb.b},0.05))`,
          boxShadow: `
            0 0 0 2px rgba(${rgb.r},${rgb.g},${rgb.b},0.6),
            0 0 20px 4px rgba(${rgb.r},${rgb.g},${rgb.b},0.3),
            0 0 40px 8px rgba(${rgb.r},${rgb.g},${rgb.b},0.15),
            inset 0 1px 0 hsl(var(--accent) / 0.6)
          `,
          backdropFilter: 'blur(12px) saturate(1.8)',
          WebkitBackdropFilter: 'blur(12px) saturate(1.8)',
          opacity: springGlow,
        }}
        animate={{
          boxShadow: hovered
            ? `0 0 0 3px rgba(${rgb.r},${rgb.g},${rgb.b},0.8),
               0 0 30px 6px rgba(${rgb.r},${rgb.g},${rgb.b},0.4),
               0 0 60px 12px rgba(${rgb.r},${rgb.g},${rgb.b},0.2)`
            : `0 0 0 2px rgba(${rgb.r},${rgb.g},${rgb.b},0.6),
               0 0 20px 4px rgba(${rgb.r},${rgb.g},${rgb.b},0.3),
               0 0 40px 8px rgba(${rgb.r},${rgb.g},${rgb.b},0.15)`
        }}
        transition={{ type: "spring", stiffness: 300, damping: 20 }}
      />
      {/* Inner glow layer */}
      <div
        className="absolute inset-1 rounded-full pointer-events-none z-5"
        style={{
          background: `radial-gradient(circle at 30% 30%, rgba(${rgb.r},${rgb.g},${rgb.b},0.2), transparent 70%)`,
          opacity: hovered ? 0.8 : 0.4,
          transition: 'opacity 0.3s',
        }}
      />
      <svg width={validSize} height={validSize} className="transform -rotate-90 z-20">
        {/* Background circle */}
        <circle
          cx={validSize / 2}
          cy={validSize / 2}
          r={radius}
          fill="none"
          stroke="hsl(var(--muted-foreground) / 0.2)"
          strokeWidth={stroke}
        />
        {/* Animated liquid-like gradient progress circle */}
        <defs>
          <linearGradient id={`gradient-${label}`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={color} stopOpacity="1">
              <animate attributeName="stop-opacity" values="1;0.7;1" dur="2s" repeatCount="indefinite" />
              <animate attributeName="offset" values="0%;15%;0%" dur="4s" repeatCount="indefinite" />
            </stop>
            <stop offset="30%" stopColor={`rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.9)`} stopOpacity="0.9">
              <animate attributeName="stop-opacity" values="0.9;0.6;0.9" dur="2.5s" repeatCount="indefinite" />
              <animate attributeName="offset" values="30%;45%;30%" dur="4s" repeatCount="indefinite" />
            </stop>
            <stop offset="70%" stopColor={`rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.7)`} stopOpacity="0.7">
              <animate attributeName="stop-opacity" values="0.7;0.4;0.7" dur="3s" repeatCount="indefinite" />
              <animate attributeName="offset" values="70%;85%;70%" dur="4s" repeatCount="indefinite" />
            </stop>
            <stop offset="100%" stopColor={`rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.5)`} stopOpacity="0.5">
              <animate attributeName="stop-opacity" values="0.5;0.3;0.5" dur="3.5s" repeatCount="indefinite" />
              <animate attributeName="offset" values="100%;85%;100%" dur="4s" repeatCount="indefinite" />
            </stop>
          </linearGradient>
          
          {/* Additional liquid wave effect */}
          <radialGradient id={`wave-${label}`} cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor={`rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.3)`}>
              <animate attributeName="stop-opacity" values="0.3;0.6;0.3" dur="2s" repeatCount="indefinite" />
            </stop>
            <stop offset="100%" stopColor={`rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.1)`}>
              <animate attributeName="stop-opacity" values="0.1;0.3;0.1" dur="2s" repeatCount="indefinite" />
            </stop>
          </radialGradient>
        </defs>
        {/* Pulsing background circle for liquid effect */}
        <circle
          cx={validSize / 2}
          cy={validSize / 2}
          r={radius - 2}
          fill={`url(#wave-${label})`}
          opacity="0.4"
        >
          <animate attributeName="r" values={`${radius-2};${radius+1};${radius-2}`} dur="3s" repeatCount="indefinite" />
          <animate attributeName="opacity" values="0.4;0.1;0.4" dur="3s" repeatCount="indefinite" />
        </circle>
        
        {/* Main animated progress circle with liquid movement */}
        <circle
          cx={validSize / 2}
          cy={validSize / 2}
          r={radius}
          fill="none"
          stroke={`url(#gradient-${label})`}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{
            filter: hovered
              ? `drop-shadow(0 0 16px ${color}) drop-shadow(0 0 32px rgba(${rgb.r},${rgb.g},${rgb.b},0.5))`
              : `drop-shadow(0 0 8px ${color})`,
            transition: 'stroke-dashoffset 1s ease-in-out, filter 0.3s',
          }}
        >
          <animate
            attributeName="stroke-dashoffset"
            from={circumference}
            to={offset}
            dur="1.5s"
            fill="freeze"
          />
          <animate
            attributeName="stroke-width"
            values={`${stroke};${stroke + 1};${stroke}`}
            dur="2s"
            repeatCount="indefinite"
          />
        </circle>
        
        {/* Additional shimmer effect */}
        <circle
          cx={validSize / 2}
          cy={validSize / 2}
          r={radius}
          fill="none"
          stroke={`rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.3)`}
          strokeWidth="2"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          opacity="0"
        >
          <animate attributeName="opacity" values="0;0.7;0" dur="1.5s" begin="0.5s" repeatCount="indefinite" />
          <animate attributeName="stroke-width" values="2;1;2" dur="1.5s" begin="0.5s" repeatCount="indefinite" />
        </circle>
      </svg>
      {/* Center content */}
      <div className="absolute inset-0 flex flex-col items-center justify-center z-30">
        <span className="text-2xl font-bold text-foreground">
          <AnimatedNumber value={progress} decimals={0} />
        </span>
        {target !== 100 && <span className="text-xs text-muted-foreground">of {target}</span>}
        {label && <span className="text-xs text-muted-foreground mt-1">{label}</span>}
      </div>
    </motion.div>
  );

  if (tooltip) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          {ringContent}
        </TooltipTrigger>
        <TooltipContent side="top" sideOffset={8}>
          <div className="font-medium text-foreground">{label}</div>
          <div className="text-muted-foreground text-xs mt-1">{tooltip}</div>
        </TooltipContent>
      </Tooltip>
    );
  }

  return ringContent;
};

export default HealthRing; 