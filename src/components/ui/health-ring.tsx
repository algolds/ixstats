import React from "react";

interface HealthRingProps {
  value: number; // 0-100
  size?: number; // px
  color?: string; // tailwind or hex
  label?: string;
}

export const HealthRing: React.FC<HealthRingProps> = ({
  value,
  size = 72,
  color = "#22d3ee", // tailwind cyan-400
  label,
}) => {
  const stroke = 8;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = Math.max(0, Math.min(100, value));
  const offset = circumference - (progress / 100) * circumference;

  return (
    <div className="flex flex-col items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="block">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="#334155" // slate-800
          strokeWidth={stroke}
          fill="none"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={color}
          strokeWidth={stroke}
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          style={{
            filter: `drop-shadow(0 0 8px ${color})`,
            transition: "stroke-dashoffset 0.6s cubic-bezier(.4,1.7,.6,1)",
          }}
        />
      </svg>
      <div className="absolute flex flex-col items-center justify-center" style={{ width: size, height: size, top: 0, left: 0 }}>
        <span className="text-xl font-bold" style={{ color }}>{progress}%</span>
        {label && <span className="text-xs text-slate-400 mt-1">{label}</span>}
      </div>
    </div>
  );
};

export default HealthRing; 