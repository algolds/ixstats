"use client";

// src/app/labs/onoma/components/glyphs/OnomaGlyph.tsx
// Core React component for rendering Onoma Linguistic Glyphs & Composed Notations
// Philosophy: Apple SF Symbols × IPA × Linguistic Notation × Scientific Precision

import React from "react";
import { motion, useReducedMotion } from "motion/react";
import { cn } from "~/lib/utils";
import { GlyphSvg, type OnomaGlyphName } from "./onoma-glyphs-catalog";

export type OnomaGlyphSize = "xs" | "sm" | "md" | "lg" | "xl" | "display";
export type OnomaGlyphState = "idle" | "active" | "generating" | "disabled";

interface OnomaGlyphProps extends React.HTMLAttributes<HTMLDivElement> {
  name?: OnomaGlyphName;
  variant?: "canonical" | "composed" | "framed";
  size?: OnomaGlyphSize;
  state?: OnomaGlyphState;
  accentColor?: string;
  strokeWidth?: number;
  from?: string;
  to?: string;
  label?: string;
  className?: string;
  title?: string;
}

const SIZE_MAP: Record<OnomaGlyphSize, { className: string; defaultStroke: number }> = {
  xs: { className: "w-3.5 h-3.5", defaultStroke: 1.5 },
  sm: { className: "w-4 h-4", defaultStroke: 1.6 },
  md: { className: "w-5 h-5", defaultStroke: 1.75 },
  lg: { className: "w-6 h-6", defaultStroke: 1.85 },
  xl: { className: "w-8 h-8", defaultStroke: 2.0 },
  display: { className: "w-12 h-12", defaultStroke: 2.0 },
};

const FRAMED_SIZE_CLASS: Record<OnomaGlyphSize, string> = {
  xs: "text-caption gap-0.5",
  sm: "text-caption gap-0.5",
  md: "text-footnote gap-1",
  lg: "text-body gap-1",
  xl: "text-body gap-2",
  display: "text-title-2 gap-2",
};

const COMPOSED_SIZE_CLASS: Record<OnomaGlyphSize, string> = {
  xs: "text-caption gap-1",
  sm: "text-caption gap-1",
  md: "text-footnote gap-2",
  lg: "text-body gap-2",
  xl: "text-body gap-2",
  display: "text-title-3 gap-3",
};

export function OnomaGlyph({
  name = "emerge-engine",
  variant = "canonical",
  size = "md",
  state = "idle",
  accentColor,
  strokeWidth,
  from,
  to,
  label,
  className,
  title,
  ...rest
}: OnomaGlyphProps) {
  const shouldReduceMotion = useReducedMotion();
  const sizeConfig = SIZE_MAP[size];
  const stroke = strokeWidth || sizeConfig.defaultStroke;
  const isActive = state === "active";
  const accentStyle = isActive && accentColor ? { color: accentColor } : undefined;
  const textTone = isActive ? "text-label font-semibold" : "text-label-secondary";

  if (variant === "framed" && label) {
    return (
      <span
        className={cn(
          "inline-flex items-center font-mono font-semibold transition-colors select-none",
          FRAMED_SIZE_CLASS[size],
          textTone,
          className
        )}
        style={accentStyle}
        title={title || `⟨${label}⟩`}
      >
        <span className="opacity-40">⟨</span>
        <span>{label}</span>
        <span className="opacity-40">⟩</span>
      </span>
    );
  }

  if (variant === "composed" && from && to) {
    return (
      <span
        className={cn(
          "inline-flex items-center font-mono transition-[color,background-color,border-color,box-shadow,opacity,transform] select-none",
          COMPOSED_SIZE_CLASS[size],
          textTone,
          className
        )}
        style={accentStyle}
        title={title || `${from} → ${to}`}
      >
        <span className="text-label font-semibold">{from}</span>
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeLinejoin="round"
          className={cn(sizeConfig.className, "shrink-0 opacity-70")}
        >
          <path d="M4 12h14m-5-5l5 5-5 5" />
        </svg>
        <span className="text-label font-semibold">{to}</span>
      </span>
    );
  }

  const content = (
    <div
      className={cn(
        "inline-flex shrink-0 items-center justify-center transition-transform duration-150 select-none",
        sizeConfig.className,
        state === "idle" && "text-label-secondary hover:text-label",
        isActive && "text-label font-semibold drop-shadow-xs",
        state === "disabled" && "text-label-tertiary pointer-events-none",
        className
      )}
      style={accentStyle}
      title={title || name}
      {...rest}
    >
      <GlyphSvg name={name} strokeWidth={stroke} />
    </div>
  );

  if (state !== "generating") return content;
  return (
    <motion.div
      animate={
        shouldReduceMotion ? { opacity: [0.6, 1, 0.6] } : { rotate: 360, scale: [1, 1.08, 1] }
      }
      transition={{ duration: 1.6, repeat: Infinity, ease: "linear" }}
      className="inline-flex items-center justify-center"
    >
      {content}
    </motion.div>
  );
}
