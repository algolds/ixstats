"use client";

import React, { useState, useRef, useCallback } from "react";
import Link from "next/link";
import { withBasePath } from "~/lib/base-path";
import { cn } from "~/lib/utils";
import { TextureOverlay } from "~/components/ui/texture-overlay";

export type RefractionMode = "ambient-underglow" | "facet-lens";

export interface RefractionConfig {
  id: RefractionMode;
  name: string;
  badge: string;
  desc: string;
}

export const REFRACTION_MODES: RefractionConfig[] = [
  {
    id: "ambient-underglow",
    name: "Harmonic Under-Glow",
    badge: "Concentric Halo",
    desc: "Clean frosted card with a harmoniously scaled, concentric chromatic backlight rim.",
  },
  {
    id: "facet-lens",
    name: "Facet Crystal Lens",
    badge: "Internal Refraction",
    desc: "100% contained internal optical color tint with precision chamfered rim under paper grain.",
  },
];

export const REFRACTION_STORAGE_KEY = "wikios:refractionMode";

export function getStoredRefractionMode(): RefractionMode {
  if (typeof window === "undefined") return "ambient-underglow";
  try {
    const saved = localStorage.getItem(REFRACTION_STORAGE_KEY) as string | null;
    if (saved && ["ambient-underglow", "facet-lens"].includes(saved)) {
      return saved as RefractionMode;
    }
    if (
      saved === "ambient-bloom" ||
      saved === "volumetric-radiance" ||
      saved === "underglow" ||
      saved === "volumetric-glow"
    ) {
      return "ambient-underglow";
    }
    if (
      saved === "specular-caustic" ||
      saved === "spatial-depth" ||
      saved === "facet-lens" ||
      saved === "bevel"
    ) {
      return "facet-lens";
    }
  } catch {
    // ignore
  }
  return "ambient-underglow";
}

interface FeaturedArticleRefractionCardProps {
  imgSrc: string | null;
  mode?: RefractionMode;
  className?: string;
  children: React.ReactNode;
}

/**
 * Harmonious Refraction Card Container
 * Built on Apple Design & Web Interface Guidelines:
 * - Concentric corner radii: R_outer = R_inner + Inset (24px + 6px = 30px)
 * - Proportional optical balance between thumbnail and content columns
 * - Multi-layer luminance falloff with paper grain texture overlay
 * - Strictly contained (zero layout shifting or scale distortion)
 */
export function FeaturedArticleRefractionCard({
  imgSrc,
  mode = "ambient-underglow",
  className,
  children,
}: FeaturedArticleRefractionCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [isHovered, setIsHovered] = useState(false);

  const handleMouseEnter = useCallback(() => {
    setIsHovered(true);
  }, []);

  const handleMouseLeave = useCallback(() => {
    setIsHovered(false);
  }, []);

  return (
    <div
      ref={cardRef}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className="relative w-full group select-none"
    >
      {/* ══════════════════════════════════════════════════════════════════════
          DIRECTION 1: HARMONIC UNDER-GLOW (CONCENTRIC BACKLIGHT HALO)
          Mathematically balanced corner radii (R_outer = 30px for R_inner = 24px)
         ══════════════════════════════════════════════════════════════════════ */}
      {mode === "ambient-underglow" && imgSrc && (
        <div
          aria-hidden="true"
          className={cn(
            "absolute -inset-1 sm:-inset-1.5 rounded-[20px] sm:rounded-[30px] overflow-hidden pointer-events-none z-0",
            "transition-opacity duration-300 ease-out",
            isHovered ? "opacity-90 dark:opacity-95" : "opacity-60 dark:opacity-75"
          )}
          style={{
            maskImage:
              "radial-gradient(ellipse 96% 92% at 50% 50%, rgba(0,0,0,1) 0%, rgba(0,0,0,1) 75%, rgba(0,0,0,0.5) 90%, transparent 100%)",
            WebkitMaskImage:
              "radial-gradient(ellipse 96% 92% at 50% 50%, rgba(0,0,0,1) 0%, rgba(0,0,0,1) 75%, rgba(0,0,0,0.5) 90%, transparent 100%)",
          }}
        >
          <img
            src={imgSrc}
            alt=""
            className="w-full h-full object-cover blur-xl sm:blur-2xl saturate-[1.85] contrast-[1.15] transform-gpu opacity-85 dark:opacity-95"
            loading="lazy"
          />
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          CORE GLASS CARD CONTAINER (HARMONIOUS 24PX CORNER RADIUS)
         ══════════════════════════════════════════════════════════════════════ */}
      <div
        className={cn(
          "relative overflow-hidden rounded-2xl sm:rounded-3xl",
          "border border-black/[0.08] dark:border-white/[0.12]",
          "bg-white/[0.84] dark:bg-zinc-900/[0.84] backdrop-blur-2xl",
          "p-4 sm:p-5 lg:p-6",
          "shadow-[inset_0_1px_1px_rgba(255,255,255,0.75),0_8px_24px_rgba(0,0,0,0.03)] dark:shadow-[inset_0_1px_1px_rgba(255,255,255,0.12),0_12px_32px_rgba(0,0,0,0.3)]",
          "transition-colors duration-200",
          className
        )}
      >
        {/* ──────────────────────────────────────────────────────────────────
            DIRECTION 2: FACET CRYSTAL LENS (INTERNAL OPTICAL REFRACTION)
            Internal color tint + precision chamfered rim + top specular hairline
           ────────────────────────────────────────────────────────────────── */}
        {mode === "facet-lens" && (
          <>
            {/* Internal Artwork Color Refraction (Masked for 100% text contrast) */}
            {imgSrc && (
              <div
                aria-hidden="true"
                className="absolute inset-0 overflow-hidden pointer-events-none z-0"
              >
                <img
                  src={imgSrc}
                  alt=""
                  className={cn(
                    "w-full h-full object-cover blur-3xl saturate-150 transform-gpu",
                    "transition-opacity duration-300 ease-out",
                    isHovered
                      ? "opacity-[0.24] dark:opacity-[0.32]"
                      : "opacity-[0.16] dark:opacity-[0.22]",
                    "mix-blend-luminosity dark:mix-blend-lighten"
                  )}
                  loading="lazy"
                />
                {/* Contrast Preservation Mask */}
                <div className="absolute inset-0 bg-gradient-to-r from-white/90 via-white/65 to-white/20 dark:from-zinc-950/90 dark:via-zinc-950/70 dark:to-zinc-950/20 backdrop-blur-[1px]" />
              </div>
            )}

            {/* Precision Facet Double-Rim Inverted Chamfer */}
            <div
              aria-hidden="true"
              className="absolute inset-0 pointer-events-none rounded-2xl sm:rounded-3xl shadow-[inset_0_1.5px_2px_rgba(255,255,255,0.85),inset_0_-1.5px_3px_rgba(0,0,0,0.4)] dark:shadow-[inset_0_1.5px_2px_rgba(255,255,255,0.35),inset_0_-1.5px_3px_rgba(0,0,0,0.8)] z-20"
            />

            {/* Top Razor-Sharp Specular Caustic Hairline */}
            <div
              aria-hidden="true"
              className={cn(
                "absolute inset-x-6 top-0 h-[1.5px] bg-gradient-to-r from-transparent via-white/90 dark:via-white/60 to-transparent pointer-events-none z-20",
                "transition-opacity duration-250 ease-out",
                isHovered ? "opacity-100" : "opacity-60"
              )}
            />
          </>
        )}

        {/* ══════════════════════════════════════════════════════════════════════
            PHYSICAL TACTILE TEXTURE OVERLAY (PAPER GRAIN OVER GLASS & GLOW)
           ══════════════════════════════════════════════════════════════════════ */}
        <TextureOverlay texture="paperGrain" opacity={0.06} className="pointer-events-none z-20" />

        {/* ══════════════════════════════════════════════════════════════════════
            STATIONARY SURFACE EDITORIAL CONTENT
           ══════════════════════════════════════════════════════════════════════ */}
        <div className="relative z-25">{children}</div>
      </div>
    </div>
  );
}

/**
 * Featured Thumbnail Artwork Frame with Golden Ratio Proportions
 */
export function FeaturedThumbnailFrame({
  imgSrc,
  title,
  slug,
}: {
  imgSrc: string;
  title: string;
  slug: string;
}) {
  return (
    <Link
      href={withBasePath(`/wiki/${slug}`)}
      data-cuelume-press="droplet"
      data-cuelume-hover="tick"
      className={cn(
        "group/img relative block w-full sm:w-[240px] md:w-[270px] lg:w-[290px] shrink-0",
        "aspect-[16/10] sm:aspect-[3/2] md:aspect-[16/10]",
        "rounded-xl sm:rounded-2xl overflow-hidden",
        "border border-black/[0.08] dark:border-white/[0.12]",
        "bg-black/5 dark:bg-white/5 shadow-2xs",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
      )}
    >
      <img
        src={imgSrc}
        alt={title}
        loading="lazy"
        className="w-full h-full object-cover group-hover/img:scale-105 transition-transform duration-300 ease-out transform-gpu"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black/25 via-transparent to-transparent pointer-events-none" />
    </Link>
  );
}
