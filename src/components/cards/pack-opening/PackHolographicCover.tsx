/**
 * PackHolographicCover — Procedural holographic pack cover
 *
 * Generates a Yu-Gi-Oh-inspired foil cover for card packs using
 * only CSS gradients, blend modes, and animations. Supports custom pack artworks
 * as the base layer, with overlaying interactive 3D tilt, specular glare highlight,
 * and procedural SVG noise filters.
 *
 * Layer stack (bottom → top):
 *  1. Base artwork (custom image or pack-type gradient)
 *  2. Holographic foil sweep (mix-blend-mode: color-dodge)
 *  3. Geometric accents (diamond outlines)
 *  4. Foil noise texture (SVG fractal noise)
 *  5. Specular glare (cursor tracking, mix-blend-mode: overlay)
 *  6. Text overlay (pack name + rarity stamp)
 */

"use client";

import React, { useMemo, useRef } from "react";
import { cn } from "~/lib/utils";
import type { CardRarity } from "@prisma/client";
import {
  getRainbowHolographicGradient,
  getSparkleGridGradient,
  getPrismaticWaveGradient,
  getHolofoilTextureGradient,
  getFoilStampConfig,
  getEmbossedTextShadow,
} from "~/lib/themes";

// ─── Types ──────────────────────────────────────────────────────

export interface PackHolographicCoverProps {
  packType: string;
  guaranteedRarity?: string | null;
  packName?: string;
  packArtwork?: string;
  className?: string;
  /** sm = store thumb (h-20), md = card, lg = pack-opening fullscreen */
  size?: "sm" | "md" | "lg";
}

// ─── Pack-type base themes ──────────────────────────────────────

interface PackTheme {
  base: string;
  accent: string;
  accentSoft: string;
  hueRotate: number;
}

const PACK_THEMES: Record<string, PackTheme> = {
  BASIC: {
    base: "from-blue-950 via-slate-900 to-blue-950",
    accent: "rgba(59,130,246,0.45)",
    accentSoft: "rgba(59,130,246,0.12)",
    hueRotate: 0,
  },
  PREMIUM: {
    base: "from-violet-950 via-indigo-900 to-violet-950",
    accent: "rgba(139,92,246,0.45)",
    accentSoft: "rgba(139,92,246,0.12)",
    hueRotate: 40,
  },
  ELITE: {
    base: "from-fuchsia-950 via-purple-900 to-fuchsia-950",
    accent: "rgba(236,72,153,0.45)",
    accentSoft: "rgba(236,72,153,0.12)",
    hueRotate: 80,
  },
  EVENT: {
    base: "from-amber-950 via-red-900 to-amber-950",
    accent: "rgba(234,179,8,0.45)",
    accentSoft: "rgba(234,179,8,0.12)",
    hueRotate: 160,
  },
  LIMITED: {
    base: "from-emerald-950 via-teal-900 to-emerald-950",
    accent: "rgba(16,185,129,0.45)",
    accentSoft: "rgba(16,185,129,0.12)",
    hueRotate: 120,
  },
};

// ─── Rarity helpers ─────────────────────────────────────────────

const VALID_RARITIES = new Set(["COMMON", "UNCOMMON", "RARE", "ULTRA_RARE", "EPIC", "LEGENDARY"]);

function getEffectiveRarity(rarity?: string | null): CardRarity {
  if (rarity && VALID_RARITIES.has(rarity)) return rarity as CardRarity;
  return "COMMON";
}

function getHoloGradient(rarity: CardRarity): string {
  switch (rarity) {
    case "LEGENDARY":
      return `${getSparkleGridGradient()}, ${getPrismaticWaveGradient()}`;
    case "EPIC":
      return getSparkleGridGradient();
    case "ULTRA_RARE":
      return getPrismaticWaveGradient();
    case "RARE":
      return getRainbowHolographicGradient(135);
    default:
      return getHolofoilTextureGradient();
  }
}

function getSweepSpeed(rarity: CardRarity): number {
  const speeds: Record<CardRarity, number> = {
    COMMON: 4,
    UNCOMMON: 3.5,
    RARE: 3,
    ULTRA_RARE: 2.5,
    EPIC: 2,
    LEGENDARY: 1.5,
  };
  return speeds[rarity] ?? 4;
}

function getHoloOpacity(rarity: CardRarity): number {
  const map: Record<CardRarity, number> = {
    COMMON: 0.15,
    UNCOMMON: 0.25,
    RARE: 0.35,
    ULTRA_RARE: 0.45,
    EPIC: 0.55,
    LEGENDARY: 0.7,
  };
  return map[rarity] ?? 0.15;
}

// ─── Size presets ───────────────────────────────────────────────

const SIZE_CLASSES = { sm: "h-20", md: "h-40", lg: "h-full min-h-[320px]" } as const;
const LABEL_SIZES = { sm: "text-[9px]", md: "text-xs", lg: "text-base" } as const;
const STAMP_SIZES = {
  sm: "text-xs h-5 w-5",
  md: "text-lg h-8 w-8",
  lg: "text-3xl h-14 w-14",
} as const;

// ─── Component ──────────────────────────────────────────────────

export const PackHolographicCover = React.memo<PackHolographicCoverProps>(
  ({ packType, guaranteedRarity, packName, packArtwork, className, size = "sm" }) => {
    const theme = PACK_THEMES[packType.toUpperCase()] ?? PACK_THEMES.BASIC!;
    const rarity = getEffectiveRarity(guaranteedRarity);
    const foilStamp = getFoilStampConfig(rarity);
    const sweepDuration = getSweepSpeed(rarity);
    const holoOpacity = getHoloOpacity(rarity);
    const holoGradient = useMemo(() => getHoloGradient(rarity), [rarity]);

    const showGeometry = rarity !== "COMMON";
    const showStamp = foilStamp.enabled && size !== "sm";
    const isInteractive = size === "md" || size === "lg";

    // Refs for cursor interactive glare and 3D tilt
    const refElement = useRef<HTMLDivElement>(null);
    const isPointerInside = useRef(false);
    const state = useRef({
      glare: { x: 50, y: 50 },
      background: { x: 50, y: 50 },
      rotate: { x: 0, y: 0 },
    });

    const updateStyles = () => {
      if (refElement.current) {
        const { background, rotate, glare } = state.current;
        refElement.current.style.setProperty("--m-x", `${glare.x}%`);
        refElement.current.style.setProperty("--m-y", `${glare.y}%`);
        refElement.current.style.setProperty("--r-x", `${rotate.x}deg`);
        refElement.current.style.setProperty("--r-y", `${rotate.y}deg`);
        refElement.current.style.setProperty("--bg-x", `${background.x}%`);
        refElement.current.style.setProperty("--bg-y", `${background.y}%`);
      }
    };

    const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
      const rotateFactor = size === "lg" ? 0.3 : 0.45;
      const rect = event.currentTarget.getBoundingClientRect();
      const position = {
        x: event.clientX - rect.left,
        y: event.clientY - rect.top,
      };
      const percentage = {
        x: (100 / rect.width) * position.x,
        y: (100 / rect.height) * position.y,
      };
      const delta = {
        x: percentage.x - 50,
        y: percentage.y - 50,
      };

      const { background, rotate, glare } = state.current;
      background.x = 50 + percentage.x / 4 - 12.5;
      background.y = 50 + percentage.y / 3 - 16.67;

      rotate.x = -(delta.x / 3.5) * rotateFactor;
      rotate.y = (delta.y / 2) * rotateFactor;

      glare.x = percentage.x;
      glare.y = percentage.y;

      updateStyles();
    };

    const handlePointerEnter = () => {
      isPointerInside.current = true;
      if (refElement.current) {
        refElement.current.style.setProperty("--duration", "0.08s");
        refElement.current.style.setProperty("--opacity", "0.65");
      }
    };

    const handlePointerLeave = () => {
      isPointerInside.current = false;
      if (refElement.current) {
        refElement.current.style.setProperty("--duration", "0.4s");
        refElement.current.style.setProperty("--opacity", "0");
        refElement.current.style.setProperty("--r-x", "0deg");
        refElement.current.style.setProperty("--r-y", "0deg");
        refElement.current.style.setProperty("--bg-x", "50%");
        refElement.current.style.setProperty("--bg-y", "50%");
      }
    };

    const containerStyle = {
      "--m-x": "50%",
      "--m-y": "50%",
      "--r-x": "0deg",
      "--r-y": "0deg",
      "--bg-x": "50%",
      "--bg-y": "50%",
      "--opacity": "0",
      "--duration": "300ms",
      "--easing": "ease",
    } as React.CSSProperties;

    return (
      <div
        ref={refElement}
        style={isInteractive ? containerStyle : undefined}
        onPointerMove={isInteractive ? handlePointerMove : undefined}
        onPointerEnter={isInteractive ? handlePointerEnter : undefined}
        onPointerLeave={isInteractive ? handlePointerLeave : undefined}
        className={cn(
          "relative w-full overflow-hidden select-none",
          SIZE_CLASSES[size],
          isInteractive && "[contain:layout_style] [perspective:800px]",
          className
        )}
      >
        <div
          className={cn(
            "relative h-full w-full origin-center transition-transform",
            isInteractive &&
              "[transform:rotateY(var(--r-x))_rotateX(var(--r-y))] duration-[var(--duration)] ease-[var(--easing)] will-change-transform"
          )}
        >
          {/* Layer 1: Base Artwork or Theme Gradient */}
          {packArtwork ? (
            <div
              className="absolute inset-0 bg-cover bg-center"
              style={{ backgroundImage: `url(${packArtwork})` }}
            />
          ) : (
            <div className={cn("absolute inset-0 bg-gradient-to-br", theme.base)} />
          )}

          {/* Layer 2: Holographic foil sweep */}
          <div
            className="pack-holo-drift pointer-events-none absolute inset-0"
            style={{
              backgroundImage: holoGradient,
              backgroundSize: "400% 400%",
              mixBlendMode: "color-dodge",
              opacity: isInteractive ? "calc(var(--opacity) * 0.7 + 0.1)" : holoOpacity,
              filter: theme.hueRotate ? `hue-rotate(${theme.hueRotate}deg)` : undefined,
              backgroundPosition: isInteractive
                ? "calc(var(--bg-x) * 1.5) calc(var(--bg-y) * 1.5)"
                : undefined,
              animation: isInteractive ? undefined : "holo-drift 8s ease-in-out infinite",
              transition: "opacity 0.3s ease",
            }}
          />


          {/* Layer 7: PDS Custom Foil Overlay */}
          {packArtwork && packArtwork.endsWith(".svg") && (
            <div
              className="pointer-events-none absolute inset-0"
              style={{
                backgroundImage: `url(${packArtwork.replace(".svg", "_foil.svg")})`,
                backgroundSize: "cover",
                mixBlendMode: "color-dodge",
                opacity: isInteractive ? "calc(var(--opacity) * 0.6 + 0.15)" : 0.25,
                backgroundPosition: isInteractive
                  ? "calc(var(--bg-x) * 1.2) calc(var(--bg-y) * 1.2)"
                  : undefined,
                animation: isInteractive ? undefined : "holo-drift 10s ease-in-out infinite",
                transition: "opacity 0.3s ease",
              }}
            />
          )}

          {/* Layer 3: Geometric accents */}
          {showGeometry && (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <div
                className="pack-geo-spin absolute"
                style={{
                  width: "70%",
                  height: "70%",
                  border: `1.5px solid ${theme.accent}`,
                  clipPath: "polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)",
                  animation: "geo-spin 20s linear infinite",
                }}
              />
              <div
                className="pack-geo-spin absolute"
                style={{
                  width: "45%",
                  height: "45%",
                  border: `1px solid ${theme.accentSoft}`,
                  background: theme.accentSoft,
                  clipPath: "polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)",
                  animation: "geo-spin 25s linear infinite reverse",
                }}
              />
              {(rarity === "EPIC" || rarity === "LEGENDARY") && (
                <div
                  className="absolute animate-pulse rounded-full"
                  style={{
                    width: "18%",
                    height: "18%",
                    border: `1px solid ${theme.accent}`,
                    background: `radial-gradient(circle, ${theme.accentSoft} 0%, transparent 70%)`,
                  }}
                />
              )}
            </div>
          )}

          {/* Layer 4: Procedural Foil Noise Overlay */}
          <div
            className="pointer-events-none absolute inset-0 opacity-[0.06] mix-blend-overlay"
            style={{
              backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
            }}
          />

          {/* Layer 8: PDS Custom Glow Overlay */}
          {packArtwork && packArtwork.endsWith(".svg") && (
            <div
              className="pointer-events-none absolute inset-0 transition-opacity duration-300"
              style={{
                backgroundImage: `url(${packArtwork.replace(".svg", "_glow.svg")})`,
                backgroundSize: "cover",
                mixBlendMode: "screen",
                opacity: isInteractive ? "calc(var(--opacity) * 0.85)" : 0.2,
              }}
            />
          )}

          {/* Layer 5: Specular Glare (Highlight) */}
          {isInteractive && (
            <div
              className="pointer-events-none absolute inset-0 opacity-[var(--opacity)] mix-blend-overlay transition-opacity duration-300"
              style={{
                background: `radial-gradient(farthest-corner circle at var(--m-x) var(--m-y), rgba(255, 255, 255, 0.45) 0%, rgba(255, 255, 255, 0.2) 25%, transparent 70%)`,
              }}
            />
          )}

          {/* Static sweep for non-interactive state */}
          {!isInteractive && (
            <div className="pointer-events-none absolute inset-0 overflow-hidden">
              <div
                className="pack-foil-sweep absolute h-full"
                style={{
                  width: "50%",
                  top: 0,
                  background:
                    "linear-gradient(105deg, transparent 30%, rgba(255,255,255,0.1) 45%, rgba(255,255,255,0.22) 50%, rgba(255,255,255,0.1) 55%, transparent 70%)",
                  animation: `foil-sweep ${sweepDuration}s ease-in-out infinite`,
                }}
              />
            </div>
          )}

          {/* Layer 6: Text & Stamp Overlay */}
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-end">
            {showStamp && (
              <div
                className={cn(
                  "mb-1 flex items-center justify-center rounded-full",
                  "bg-gradient-to-br shadow-lg backdrop-blur-sm",
                  foilStamp.color,
                  STAMP_SIZES[size]
                )}
                style={{ textShadow: "0 0 8px rgba(255,255,255,0.8)" }}
              >
                {foilStamp.symbol}
              </div>
            )}

            <div className="relative w-full bg-gradient-to-t from-black/70 via-black/30 to-transparent px-2 pt-4 pb-1.5">
              {packName && size !== "sm" && (
                <p
                  className={cn(
                    "line-clamp-1 text-center leading-tight font-black text-white/90",
                    LABEL_SIZES[size]
                  )}
                  style={{
                    textShadow: getEmbossedTextShadow(
                      rarity === "LEGENDARY" ? "gold" : rarity === "EPIC" ? "purple" : "silver"
                    ),
                  }}
                >
                  {packName}
                </p>
              )}
              <p
                className={cn(
                  "text-center font-semibold tracking-widest text-white/40 uppercase",
                  size === "sm" ? "text-[7px]" : "text-[9px]"
                )}
              >
                IxCards
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }
);

PackHolographicCover.displayName = "PackHolographicCover";
