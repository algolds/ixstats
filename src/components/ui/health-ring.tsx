import React, { useState } from "react";
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
  // Glassy border color
  const borderColor = `rgba(${rgb.r},${rgb.g},${rgb.b},0.45)`;

  const ringContent = (
    <div
      className={`relative flex items-center justify-center transition-all duration-300 group/healthring ${
        isClickable ? 'cursor-pointer hover:scale-105 active:scale-95' : ''
      } ${className}`}
      style={{ width: validSize, height: validSize }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={onClick}
      tabIndex={isClickable ? 0 : -1}
      onFocus={() => setHovered(true)}
      onBlur={() => setHovered(false)}
      role={isClickable ? "button" : undefined}
      aria-label={isClickable ? `View details for ${label}` : undefined}
    >
      {/* Enhanced glass border with multiple layers */}
      <div
        className="absolute inset-0 rounded-full pointer-events-none z-10"
        style={{
          background: `linear-gradient(135deg, rgba(${rgb.r},${rgb.g},${rgb.b},0.15), rgba(${rgb.r},${rgb.g},${rgb.b},0.05))`,
          boxShadow: `
            0 0 0 2px rgba(${rgb.r},${rgb.g},${rgb.b},0.6),
            0 0 20px 4px rgba(${rgb.r},${rgb.g},${rgb.b},0.4),
            0 0 40px 8px rgba(${rgb.r},${rgb.g},${rgb.b},0.2),
            inset 0 1px 0 rgba(255,255,255,0.3)
          `,
          backdropFilter: 'blur(12px) saturate(1.8)',
          WebkitBackdropFilter: 'blur(12px) saturate(1.8)',
          opacity: hovered ? 1 : 0.8,
          transition: 'opacity 0.3s, transform 0.3s',
          transform: hovered ? 'scale(1.05)' : 'scale(1)',
        }}
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
          stroke="rgba(255,255,255,0.1)"
          strokeWidth={stroke}
        />
        {/* Animated gradient progress circle */}
        <defs>
          <linearGradient id={`gradient-${label}`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={color} stopOpacity="0.8">
              <animate attributeName="stop-opacity" values="0.8;1;0.8" dur="3s" repeatCount="indefinite" />
            </stop>
            <stop offset="50%" stopColor={`rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.6)`}>
              <animate attributeName="stop-opacity" values="0.6;0.9;0.6" dur="3s" repeatCount="indefinite" />
            </stop>
            <stop offset="100%" stopColor={`rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.4)`}>
              <animate attributeName="stop-opacity" values="0.4;0.7;0.4" dur="3s" repeatCount="indefinite" />
            </stop>
          </linearGradient>
        </defs>
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
        </circle>
      </svg>
      {/* Center content */}
      <div className="absolute inset-0 flex flex-col items-center justify-center z-30">
        <span className="text-2xl font-bold text-white">
          <AnimatedNumber value={progress} decimals={0} />
        </span>
        {target !== 100 && <span className="text-xs text-white/60">of {target}</span>}
        {label && <span className="text-xs text-white/40 mt-1">{label}</span>}
      </div>
    </div>
  );

  if (tooltip) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          {ringContent}
        </TooltipTrigger>
        <TooltipContent side="top" sideOffset={8}>
          <div className="font-medium">{label}</div>
          <div className="text-white/80 text-xs mt-1">{tooltip}</div>
        </TooltipContent>
      </Tooltip>
    );
  }

  return ringContent;
};

export default HealthRing; 