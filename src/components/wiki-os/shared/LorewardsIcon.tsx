// src/components/wiki-os/shared/LorewardsIcon.tsx
// Simple, bold Lorewards sidebar icon — gold quill on shield.
// Designed for legibility at 14-18px.

"use client";

interface LorewardsIconProps {
  size?: number;
  className?: string;
}

export function LorewardsIcon({ size = 18, className }: LorewardsIconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      className={className}
    >
      {/* Shield outline */}
      <path
        d="M12 2L4 6v6c0 5.25 3.4 10.2 8 11.5C16.6 22.2 20 17.25 20 12V6l-8-4z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
        opacity="0.7"
      />
      {/* Quill / feather pen — bold, simple */}
      <path
        d="M12 7c-3 3-3 6-1.5 9l1.5 1 1.5-1c1.5-3 1.5-6-1.5-9z"
        fill="currentColor"
        opacity="0.85"
      />
      {/* Star dot at top of quill */}
      <circle cx="12" cy="7" r="1.2" fill="currentColor" opacity="0.6" />
    </svg>
  );
}
