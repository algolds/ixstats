"use client";

// src/app/labs/onoma/components/glyphs/OnomaGlyph.tsx
// Core React component for rendering Onoma Linguistic Glyphs & Composed Notations
// Philosophy: Apple SF Symbols × IPA × Linguistic Notation × Scientific Precision

import React from "react";
import { motion, useReducedMotion } from "framer-motion";
import { cn } from "~/lib/utils";
import { GLYPH_CATALOG, type OnomaGlyphName } from "./onoma-glyphs-catalog";

export type OnomaGlyphSize = "xs" | "sm" | "md" | "lg" | "xl" | "display";
export type OnomaGlyphState = "idle" | "active" | "generating" | "disabled";

export interface OnomaGlyphProps extends React.HTMLAttributes<HTMLDivElement> {
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
  const sizeConfig = SIZE_MAP[size] || SIZE_MAP.md;
  const stroke = strokeWidth || sizeConfig.defaultStroke;

  // 1. Framed Linguistic Object: ⟨LABEL⟩
  if (variant === "framed" && label) {
    return (
      <span
        className={cn(
          "inline-flex items-center font-mono font-semibold tracking-tight transition-colors select-none",
          size === "xs" && "gap-0.5 text-[10px]",
          size === "sm" && "gap-0.5 text-[11px]",
          size === "md" && "gap-1 text-xs",
          size === "lg" && "gap-1 text-sm",
          size === "xl" && "gap-1.5 text-base",
          size === "display" && "gap-2 text-xl",
          state === "active" ? "text-foreground font-bold" : "text-muted-foreground",
          className
        )}
        style={state === "active" && accentColor ? { color: accentColor } : undefined}
        title={title || `⟨${label}⟩`}
      >
        <span className="opacity-40">⟨</span>
        <span>{label}</span>
        <span className="opacity-40">⟩</span>
      </span>
    );
  }

  // 2. Composed Transformation Expression: from → to
  if (variant === "composed" && from && to) {
    return (
      <span
        className={cn(
          "inline-flex items-center font-mono transition-all select-none",
          size === "xs" && "gap-1 text-[10px]",
          size === "sm" && "gap-1 text-[11px]",
          size === "md" && "gap-1.5 text-xs",
          size === "lg" && "gap-2 text-sm",
          size === "xl" && "gap-2.5 text-base",
          size === "display" && "gap-3 text-lg",
          state === "active" ? "text-foreground font-semibold" : "text-muted-foreground",
          className
        )}
        style={state === "active" && accentColor ? { color: accentColor } : undefined}
        title={title || `${from} → ${to}`}
      >
        <span className="text-foreground font-semibold">{from}</span>
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
        <span className="text-foreground font-semibold">{to}</span>
      </span>
    );
  }

  // 3. Canonical Glyph Vector Icon
  const GlyphRenderer = GLYPH_CATALOG[name] || GLYPH_CATALOG["emerge-engine"];

  const content = (
    <div
      className={cn(
        "inline-flex shrink-0 items-center justify-center transition-transform duration-150 select-none",
        sizeConfig.className,
        state === "idle" && "text-foreground/75 hover:text-foreground",
        state === "active" && "text-foreground font-bold drop-shadow-xs",
        state === "disabled" && "text-muted-foreground/30 pointer-events-none",
        className
      )}
      style={state === "active" && accentColor ? { color: accentColor } : undefined}
      title={title || name}
      {...rest}
    >
      {GlyphRenderer({ strokeWidth: stroke })}
    </div>
  );

  // Animated generating state
  if (state === "generating") {
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

  return content;
}
