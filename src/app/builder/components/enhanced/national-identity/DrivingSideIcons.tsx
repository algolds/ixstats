import React from "react";

interface DrivingIconProps {
  className?: string;
}

/**
 * Apple-style dual-lane road icon representing Right-Hand Traffic (RHT).
 * Left lane has oncoming traffic (↓), right lane has forward driving traffic (↑).
 */
export function RightDriveIcon({ className }: DrivingIconProps) {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      {/* Outer road boundary curbs */}
      <line
        x1="2"
        y1="2"
        x2="2"
        y2="14"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
        className="opacity-30"
      />
      <line
        x1="14"
        y1="2"
        x2="14"
        y2="14"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
        className="opacity-30"
      />

      {/* Dashed center lane divider */}
      <line
        x1="8"
        y1="2.5"
        x2="8"
        y2="13.5"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeDasharray="2 2"
        strokeLinecap="round"
        className="opacity-40"
      />

      {/* Oncoming traffic in left lane (downward) */}
      <path
        d="M5 4.5v7m-1.75-2L5 11.5l1.75-2"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="opacity-35"
      />

      {/* Active driving traffic in right lane (forward/upward) */}
      <path
        d="M11 11.5v-7m-1.75 2L11 4.5l1.75 2"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/**
 * Apple-style dual-lane road icon representing Left-Hand Traffic (LHT).
 * Left lane has forward driving traffic (↑), right lane has oncoming traffic (↓).
 */
export function LeftDriveIcon({ className }: DrivingIconProps) {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      {/* Outer road boundary curbs */}
      <line
        x1="2"
        y1="2"
        x2="2"
        y2="14"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
        className="opacity-30"
      />
      <line
        x1="14"
        y1="2"
        x2="14"
        y2="14"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
        className="opacity-30"
      />

      {/* Dashed center lane divider */}
      <line
        x1="8"
        y1="2.5"
        x2="8"
        y2="13.5"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeDasharray="2 2"
        strokeLinecap="round"
        className="opacity-40"
      />

      {/* Active driving traffic in left lane (forward/upward) */}
      <path
        d="M5 11.5v-7m-1.75 2L5 4.5l1.75 2"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Oncoming traffic in right lane (downward) */}
      <path
        d="M11 4.5v7m-1.75-2L11 11.5l1.75-2"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="opacity-35"
      />
    </svg>
  );
}
