// src/app/labs/onoma/components/shared/OnomaBrandLogo.tsx
// Onoma Lab — Unified Brand Logo & App Icon Component
// Features: Apple Spring Hover Physics with Signature "Eye-Wink" Micro-Interaction

"use client";

import React, { useState } from "react";
import { cn } from "~/lib/utils";

export type OnomaLogoVariant = "symbol" | "wordmark" | "lockup" | "app-icon";
export type OnomaLogoTone = "default" | "monochrome" | "seal";

interface OnomaBrandLogoProps {
  variant?: OnomaLogoVariant;
  tone?: OnomaLogoTone;
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  className?: string;
  isHovered?: boolean;
  animated?: boolean;
}

const SIZE_MAP = {
  symbol: {
    xs: "h-4 w-4",
    sm: "h-6 w-6",
    md: "h-9 w-9",
    lg: "h-14 w-14",
    xl: "h-24 w-24",
  },
  wordmark: {
    xs: "h-4 w-auto",
    sm: "h-6 w-auto",
    md: "h-9 w-auto",
    lg: "h-14 w-auto",
    xl: "h-20 w-auto",
  },
  lockup: {
    xs: "h-4 w-auto",
    sm: "h-6 w-auto",
    md: "h-8 w-auto",
    lg: "h-12 w-auto",
    xl: "h-18 w-auto",
  },
  "app-icon": {
    xs: "h-8 w-8 rounded-[20%]",
    sm: "h-12 w-12 rounded-[22%]",
    md: "h-16 w-16 rounded-[22%]",
    lg: "h-24 w-24 rounded-[22%] sm:h-28 sm:w-28",
    xl: "h-32 w-32 rounded-[24%]",
  },
};

export function OnomaBrandLogo({
  variant = "symbol",
  tone = "default",
  size = "md",
  className,
  isHovered = false,
  animated = false,
}: OnomaBrandLogoProps) {
  const [isSelfHovered, setIsSelfHovered] = useState(false);
  const isWinking = isHovered || isSelfHovered;

  // --------------------------------------------------------------------------
  // Variant: Standalone Symbol (with Interactive Wink)
  // --------------------------------------------------------------------------
  if (variant === "symbol") {
    return (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 154.41 148.26"
        onMouseEnter={() => setIsSelfHovered(true)}
        onMouseLeave={() => setIsSelfHovered(false)}
        className={cn(
          "transition-all duration-300 ease-[cubic-bezier(0.23,1,0.32,1)] group/logo select-none",
          SIZE_MAP.symbol[size],
          tone === "monochrome" ? "fill-current text-foreground" : "fill-[#0091ff]",
          isWinking && "scale-105 -rotate-2",
          "group-hover/footer:scale-105 group-hover/footer:rotate-3",
          "group-hover/brand:scale-105 group-hover/brand:-rotate-2",
          "group-hover/logo:scale-105 group-hover/logo:-rotate-2",
          className
        )}
      >
        <g id="Logo">
          <path d="M122.5,121.6c4.2-3.79,7.64-10.09,8.84-15.63,4.16-19.19-7.45-31.88-15.97-47.33-.46-.84-4.55-9.55-5.03-9.23-21.25,37.03-54,66-90.3,87.88-3.6,2.17-8.95,7.1-12.5,3.2-1.37-1.51-5.25-8.26-6.27-10.33-1.13-2.3-2.2-3.92.1-6,42.11-22.48,76.52-54.36,99.4-96.45,4.33-7.97,7.69-17.45,12.06-24.99C113.69,1.21,114.46.02,116.5,0c1.42-.02,11.66,4.83,13.29,5.9,2.6,1.69,2.77,2.74,1.62,5.62-1.9,4.72-6.53,10.75-7.98,15.46-.13.41-.39.77-.24,1.25,9.18,30.35,38.58,48.96,29.52,84.2-10.31,40.1-66.21,48.17-90.47,15.95-1.35-1.8-3.46-4.14-2.34-6.58.29-.63,8.05-7.44,9.18-8.27,1.53-1.13,2.66-1.98,4.67-1.34,1.46.47,7.52,7.88,9.55,9.61,11.4,9.77,27.96,9.94,39.22-.2Z" />
          {/* Eye with Apple Spring Wink Physics (Scale Y compression & slight X expansion) */}
          <circle
            cx="25.02"
            cy="68.66"
            r="15.11"
            style={{ transformOrigin: "25.02px 68.66px" }}
            className={cn(
              "transition-transform duration-200 ease-[cubic-bezier(0.23,1,0.32,1)]",
              isWinking && "scale-y-[0.12] scale-x-[1.18]",
              "group-hover/logo:scale-y-[0.12] group-hover/logo:scale-x-[1.18]",
              "group-hover/footer:scale-y-[0.12] group-hover/footer:scale-x-[1.18]",
              "group-hover/brand:scale-y-[0.12] group-hover/brand:scale-x-[1.18]",
              animated && !isWinking && "animate-pulse"
            )}
          />
          <path d="M74.45,3.08c2.16-.47,12.25,3.89,13.09,5.89.98,2.32-.51,4.97-1.41,7.09-2.57,6.05-7.66,18.38-11.06,23.42-.94,1.39-1.84,2.38-3.69,2.29-1.09-.05-9.16-3.54-10.23-4.29-2.69-1.88-2.11-4.45-1.13-7.1,1.97-5.39,8.51-20.22,11.49-24.7.66-1,1.73-2.34,2.95-2.6Z" />
        </g>
      </svg>
    );
  }

  // --------------------------------------------------------------------------
  // Variant: Bracketed Wordmark (⟨ ONOMA ⟩)
  // --------------------------------------------------------------------------
  if (variant === "wordmark") {
    return (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="70 295 1665 295"
        className={cn(
          "fill-current text-foreground transition-colors duration-200 select-none",
          SIZE_MAP.wordmark[size],
          className
        )}
      >
        {/* Left Angle Bracket ⟨ */}
        <path d="M 190 305 L 225 305 L 125 443.5 L 225 582 L 190 582 L 80 443.5 Z" />

        {/* Letter O (1) */}
        <path fillRule="evenodd" d="M 333 317.5 C 402.59 317.5 459 373.91 459 443.5 C 459 513.09 402.59 569.5 333 569.5 C 263.41 569.5 207 513.09 207 443.5 C 207 373.91 263.41 317.5 333 317.5 Z M 333 371.5 C 372.76 371.5 405 403.74 405 443.5 C 405 483.26 372.76 515.5 333 515.5 C 293.24 515.5 261 483.26 261 443.5 C 261 403.74 293.24 371.5 333 371.5 Z" />

        {/* Letter N */}
        <path d="M 495 317.5 L 549 317.5 L 671 506 L 671 317.5 L 725 317.5 L 725 569.5 L 671 569.5 L 549 381 L 549 569.5 L 495 569.5 Z" />

        {/* Letter O (2) */}
        <path fillRule="evenodd" d="M 887 317.5 C 956.59 317.5 1013 373.91 1013 443.5 C 1013 513.09 956.59 569.5 887 569.5 C 817.41 569.5 761 513.09 761 443.5 C 761 373.91 817.41 317.5 887 317.5 Z M 887 371.5 C 926.76 371.5 959 403.74 959 443.5 C 959 483.26 926.76 515.5 887 515.5 C 847.24 515.5 815 483.26 815 443.5 C 815 403.74 847.24 371.5 887 371.5 Z" />

        {/* Letter M */}
        <path d="M 1049 317.5 L 1107 317.5 L 1179 474 L 1251 317.5 L 1309 317.5 L 1309 569.5 L 1257 569.5 L 1257 410 L 1198 538 L 1160 538 L 1101 410 L 1101 569.5 L 1049 569.5 Z" />

        {/* Letter A */}
        <path fillRule="evenodd" d="M 1435 317.5 L 1495 317.5 L 1585 569.5 L 1528 569.5 L 1506 507 L 1424 507 L 1402 569.5 L 1345 569.5 Z M 1465 396 L 1442 460 L 1488 460 Z" />

        {/* Right Angle Bracket ⟩ */}
        <path d="M 1584 305 L 1619 305 L 1729 443.5 L 1619 582 L 1584 582 L 1694 443.5 Z" />
      </svg>
    );
  }

  // --------------------------------------------------------------------------
  // Variant: Logomark Lockup (ONOMA + Signature Seal with Wink)
  // --------------------------------------------------------------------------
  if (variant === "lockup") {
    return (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 450 88.79"
        onMouseEnter={() => setIsSelfHovered(true)}
        onMouseLeave={() => setIsSelfHovered(false)}
        className={cn(
          "transition-all duration-300 ease-[cubic-bezier(0.23,1,0.32,1)] group/logo select-none",
          SIZE_MAP.lockup[size],
          className
        )}
      >
        <g id="Type" className="fill-current text-foreground">
          {/* Letter O (1) */}
          <path fillRule="evenodd" d="M 37 17.4 C 51.91 17.4 64 29.49 64 44.4 C 64 59.31 51.91 71.4 37 71.4 C 22.09 71.4 10 59.31 10 44.4 C 10 29.49 22.09 17.4 37 17.4 Z M 37 28.9 C 45.56 28.9 52.5 35.84 52.5 44.4 C 52.5 52.96 45.56 59.9 37 59.9 C 28.44 59.9 21.5 52.96 21.5 44.4 C 21.5 35.84 28.44 28.9 37 28.9 Z" />

          {/* Letter N */}
          <path d="M 72 17.4 L 83.5 17.4 L 109.5 57.5 L 109.5 17.4 L 121 17.4 L 121 71.4 L 109.5 71.4 L 83.5 31 L 83.5 71.4 L 72 71.4 Z" />

          {/* Letter O (2) */}
          <path fillRule="evenodd" d="M 155.5 17.4 C 170.41 17.4 182.5 29.49 182.5 44.4 C 182.5 59.31 170.41 71.4 155.5 71.4 C 140.59 71.4 128.5 59.31 128.5 44.4 C 128.5 29.49 140.59 17.4 155.5 17.4 Z M 155.5 28.9 C 164.06 28.9 171 35.84 171 44.4 C 171 52.96 164.06 59.9 155.5 59.9 C 146.94 59.9 140 52.96 140 44.4 C 140 35.84 146.94 28.9 155.5 28.9 Z" />

          {/* Letter M */}
          <path d="M 190.5 17.4 L 203 17.4 L 218.5 50.8 L 234 17.4 L 246.5 17.4 L 246.5 71.4 L 235.5 71.4 L 235.5 37.2 L 222.5 64.5 L 214.5 64.5 L 201.5 37.2 L 201.5 71.4 L 190.5 71.4 Z" />

          {/* Letter A */}
          <path fillRule="evenodd" d="M 273.5 17.4 L 286.5 17.4 L 305.5 71.4 L 293.5 71.4 L 288.5 57.8 L 271 57.8 L 266 71.4 L 254 71.4 Z M 280 34.2 L 275 48.2 L 284.5 48.2 Z" />
        </g>
        <g
          id="Logo"
          className={cn(
            "transition-all duration-300",
            tone === "monochrome" ? "fill-current text-foreground" : "fill-[#0091ff]"
          )}
        >
          <path d="M385.3,72.21c1.99-1.79,3.61-4.77,4.18-7.4,1.97-9.08-3.53-15.08-7.56-22.39-.22-.4-2.15-4.52-2.38-4.37-10.05,17.52-25.55,31.23-42.73,41.58-1.7,1.03-4.23,3.36-5.91,1.52-.65-.71-2.48-3.91-2.97-4.89-.54-1.09-1.04-1.85.05-2.84,19.92-10.64,36.2-25.72,47.03-45.64,2.05-3.77,3.64-8.26,5.71-11.82.41-.71.78-1.27,1.74-1.29.67,0,5.51,2.29,6.29,2.79,1.23.8,1.31,1.3.77,2.66-.9,2.23-3.09,5.09-3.78,7.32-.06.2-.19.37-.11.59,4.34,14.36,18.25,23.17,13.97,39.84-4.88,18.97-31.33,22.79-42.8,7.55-.64-.85-1.64-1.96-1.11-3.11.14-.3,3.81-3.52,4.34-3.91.72-.53,1.26-.94,2.21-.63.69.22,3.56,3.73,4.52,4.55,5.39,4.62,13.23,4.7,18.56-.1Z" />
          {/* Eye with Apple Spring Wink Physics */}
          <circle
            cx="339.18"
            cy="47.17"
            r="7.15"
            style={{ transformOrigin: "339.18px 47.17px" }}
            className={cn(
              "transition-transform duration-200 ease-[cubic-bezier(0.23,1,0.32,1)]",
              isWinking && "scale-y-[0.12] scale-x-[1.18]",
              "group-hover/logo:scale-y-[0.12] group-hover/logo:scale-x-[1.18]"
            )}
          />
          <path d="M362.57,16.14c1.02-.22,5.8,1.84,6.2,2.79.46,1.1-.24,2.35-.67,3.36-1.22,2.86-3.62,8.7-5.23,11.08-.44.66-.87,1.13-1.75,1.08-.52-.03-4.33-1.67-4.84-2.03-1.27-.89-1-2.1-.54-3.36.93-2.55,4.03-9.57,5.43-11.69.31-.47.82-1.11,1.39-1.23Z" />
        </g>
      </svg>
    );
  }

  // --------------------------------------------------------------------------
  // Variant: Glassmorphic App Icon
  // --------------------------------------------------------------------------
  return (
    <div
      className={cn(
        "relative flex items-center justify-center overflow-hidden border border-border/40 bg-card/60 shadow-sm backdrop-blur-md transition-all duration-300 hover:scale-105 hover:border-[#0091ff]/30 hover:shadow-md",
        SIZE_MAP["app-icon"][size],
        className
      )}
    >
      <OnomaBrandLogo
        variant="symbol"
        tone={tone}
        size={size === "xl" ? "lg" : size === "lg" ? "md" : "sm"}
        isHovered={isHovered}
        animated={animated}
        className="relative z-10"
      />
    </div>
  );
}

/**
 * Standard 16x16 / 4x4 nav icon adapter with interactive wink
 */
export function OnomaNavIcon(props: { className?: string }) {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 154.41 148.26"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={cn(
        "h-4 w-4 fill-current transition-all duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] group/logo select-none",
        props.className
      )}
    >
      <g id="Logo">
        <path d="M122.5,121.6c4.2-3.79,7.64-10.09,8.84-15.63,4.16-19.19-7.45-31.88-15.97-47.33-.46-.84-4.55-9.55-5.03-9.23-21.25,37.03-54,66-90.3,87.88-3.6,2.17-8.95,7.1-12.5,3.2-1.37-1.51-5.25-8.26-6.27-10.33-1.13-2.3-2.2-3.92.1-6,42.11-22.48,76.52-54.36,99.4-96.45,4.33-7.97,7.69-17.45,12.06-24.99C113.69,1.21,114.46.02,116.5,0c1.42-.02,11.66,4.83,13.29,5.9,2.6,1.69,2.77,2.74,1.62,5.62-1.9,4.72-6.53,10.75-7.98,15.46-.13.41-.39.77-.24,1.25,9.18,30.35,38.58,48.96,29.52,84.2-10.31,40.1-66.21,48.17-90.47,15.95-1.35-1.8-3.46-4.14-2.34-6.58.29-.63,8.05-7.44,9.18-8.27,1.53-1.13,2.66-1.98,4.67-1.34,1.46.47,7.52,7.88,9.55,9.61,11.4,9.77,27.96,9.94,39.22-.2Z" />
        <circle
          cx="25.02"
          cy="68.66"
          r="15.11"
          style={{ transformOrigin: "25.02px 68.66px" }}
          className={cn(
            "transition-transform duration-200 ease-[cubic-bezier(0.23,1,0.32,1)]",
            isHovered && "scale-y-[0.12] scale-x-[1.18]",
            "group-hover/logo:scale-y-[0.12] group-hover/logo:scale-x-[1.18]"
          )}
        />
        <path d="M74.45,3.08c2.16-.47,12.25,3.89,13.09,5.89.98,2.32-.51,4.97-1.41,7.09-2.57,6.05-7.66,18.38-11.06,23.42-.94,1.39-1.84,2.38-3.69,2.29-1.09-.05-9.16-3.54-10.23-4.29-2.69-1.88-2.11-4.45-1.13-7.1,1.97-5.39,8.51-20.22,11.49-24.7.66-1,1.73-2.34,2.95-2.6Z" />
      </g>
    </svg>
  );
}

export default OnomaBrandLogo;
