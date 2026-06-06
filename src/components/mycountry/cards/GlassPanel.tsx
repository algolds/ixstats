"use client";

import React, { useState } from "react";
import { motion, useMotionTemplate, useMotionValue } from "motion/react";
import { cn } from "~/lib/utils";
import { TextureOverlay, type TextureType } from "~/components/ui/texture-overlay";
import { ACCENT_CLASSES, type MyCountryAccent } from "./accents";

interface GlassPanelProps {
  /** Section accent applied to the border, tint and hover spotlight. */
  accent?: MyCountryAccent;
  /** Enables the cursor spotlight + hover elevation (also on when onClick is set). */
  interactive?: boolean;
  texture?: TextureType;
  textureOpacity?: number;
  className?: string;
  onClick?: () => void;
  children: React.ReactNode;
}

/**
 * GlassPanel — theme-compliant frosted surface with the Builder's "glass" feel
 * (backdrop blur + accent tint + optional cursor spotlight), but built on theme
 * tokens (`bg-card/70`) instead of white-based layers so it reads in light + dark.
 */
export function GlassPanel({
  accent = "neutral",
  interactive = false,
  texture = "dots",
  textureOpacity = 0.03,
  className,
  onClick,
  children,
}: GlassPanelProps) {
  const a = ACCENT_CLASSES[accent];
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);
  const [hovering, setHovering] = useState(false);
  const clickable = interactive || Boolean(onClick);

  const spotlight = useMotionTemplate`radial-gradient(300px circle at ${mouseX}px ${mouseY}px, ${a.spotlight}, transparent 80%)`;

  function handleMove(e: React.MouseEvent<HTMLDivElement>) {
    if (!clickable) return;
    const rect = e.currentTarget.getBoundingClientRect();
    mouseX.set(e.clientX - rect.left);
    mouseY.set(e.clientY - rect.top);
  }

  return (
    <div
      onClick={onClick}
      onMouseMove={handleMove}
      onMouseEnter={() => clickable && setHovering(true)}
      onMouseLeave={() => clickable && setHovering(false)}
      className={cn(
        "bg-card/70 text-card-foreground relative overflow-hidden rounded-xl border backdrop-blur-md",
        a.border,
        clickable && "cursor-pointer transition-shadow duration-300 hover:shadow-lg",
        clickable && a.glow,
        className
      )}
    >
      <div
        aria-hidden="true"
        className={cn("pointer-events-none absolute inset-0 bg-gradient-to-br", a.tint)}
      />
      {clickable && (
        <motion.div
          aria-hidden="true"
          className="pointer-events-none absolute -inset-px z-0 rounded-xl"
          style={{ background: spotlight }}
          animate={{ opacity: hovering ? 1 : 0 }}
          transition={{ duration: 0.3 }}
        />
      )}
      {texture && texture !== "none" && (
        <TextureOverlay texture={texture} opacity={textureOpacity} />
      )}
      <div className="relative z-10">{children}</div>
    </div>
  );
}
