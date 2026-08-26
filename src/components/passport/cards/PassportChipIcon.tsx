import React from "react";
import { cn } from "~/lib/utils";

interface PassportChipIconProps {
  className?: string;
  size?: "sm" | "md" | "lg";
}

export function PassportChipIcon({ className, size = "md" }: PassportChipIconProps) {
  const sizeClasses = {
    sm: "h-5 w-7",
    md: "h-6 w-9",
    lg: "h-8 w-12",
  }[size];

  return (
    <div
      className={cn(
        "relative rounded-sm border border-amber-500/40 bg-gradient-to-br from-amber-200 via-amber-400 to-yellow-600 p-0.5 shadow-xs select-none",
        sizeClasses,
        className
      )}
      title="Biometric Cryptographic Identity Chip (ICAO 9303 Compliant)"
    >
      {/* Micro-circuit pattern */}
      <svg
        viewBox="0 0 36 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="h-full w-full opacity-85"
      >
        {/* Outer chip outline */}
        <rect
          x="1"
          y="1"
          width="34"
          height="22"
          rx="2"
          stroke="#78350F"
          strokeWidth="0.8"
          fill="url(#chip-metallic)"
        />
        {/* Center contact ring */}
        <circle cx="18" cy="12" r="4.5" stroke="#78350F" strokeWidth="0.8" fill="url(#chip-center)" />
        {/* Trace lines */}
        <path
          d="M1 8 H13.5 M22.5 8 H35 M1 16 H13.5 M22.5 16 H35 M18 1 V7.5 M18 16.5 V23"
          stroke="#78350F"
          strokeWidth="0.75"
          strokeLinecap="round"
        />
        <defs>
          <linearGradient id="chip-metallic" x1="0" y1="0" x2="36" y2="24" gradientUnits="userSpaceOnUse">
            <stop stopColor="#FDE68A" />
            <stop offset="0.5" stopColor="#F59E0B" />
            <stop offset="1" stopColor="#D97706" />
          </linearGradient>
          <radialGradient id="chip-center" cx="50%" cy="50%" r="50%">
            <stop stopColor="#FEF3C7" />
            <stop offset="1" stopColor="#D97706" />
          </radialGradient>
        </defs>
      </svg>
    </div>
  );
}
