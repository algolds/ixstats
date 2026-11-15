"use client";

/**
 * PackHolographicCover: Procedural holographic pack cover
 *
 * Generates a foil cover for card packs using CSS artwork classes in card-art.css,
 * blend modes, and custom pack artworks, with optional fullscreen 3D pointer tilt
 * and reduced-motion stillness.
 */

import React, { useMemo, useRef } from "react";
import { cn } from "~/lib/utils";
import { useFacetReducedMotion } from "~/components/providers/FacetMotionConfig";
import { CardsLogomark } from "~/lib/navigation/icons/CardsLogomark";
import type { CardRarity } from "@prisma/client";
import { parseCardRarity } from "~/lib/cards/enums";
import {
  getFoilStampConfig,
  getEmbossedTextShadow,
  getHolofoilTextureGradient,
  getPrismaticWaveGradient,
  getRainbowHolographicGradient,
  getSparkleGridGradient,
} from "~/lib/themes";

interface PackHolographicCoverProps {
  packType: string;
  guaranteedRarity?: string | null;
  packName?: string;
  packArtwork?: string;
  className?: string;
  /** sm = store thumb (h-20), md = card, lg = pack-opening fullscreen */
  size?: "sm" | "md" | "lg";
  /** Enables 3D pointer tilt and specular glare; defaults to `size === "lg"` and disables under Reduce Motion. */
  interactive?: boolean;
}

type PackThemeKey = "BASIC" | "PREMIUM" | "ELITE" | "EVENT";

const PACK_HUE_ROTATE: Record<PackThemeKey, number> = {
  BASIC: 0,
  PREMIUM: 40,
  ELITE: 80,
  EVENT: 160,
};

function resolvePackThemeKey(packType: string): PackThemeKey {
  const upper = packType.toUpperCase();
  if (upper === "PREMIUM" || upper === "ELITE" || upper === "EVENT") return upper;
  return "BASIC";
}

const ACCENT_BORDER = "color-mix(in srgb, var(--pack-accent, var(--color-blue)) 45%, transparent)";
const ACCENT_SOFT = "color-mix(in srgb, var(--pack-accent, var(--color-blue)) 12%, transparent)";

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

const SIZE_CLASSES = { sm: "h-20", md: "h-40", lg: "h-full min-h-[320px]" } as const;
const LABEL_SIZES = { sm: "text-footnote", md: "text-footnote", lg: "text-body" } as const;
const STAMP_SIZES = {
  sm: "text-footnote h-5 w-5",
  md: "text-title-3 h-8 w-8",
  lg: "text-large-title h-14 w-14",
} as const;

export const PackHolographicCover = React.memo<PackHolographicCoverProps>(
  ({ packType, guaranteedRarity, packName, packArtwork, className, size = "sm", interactive }) => {
    const reduceMotion = useFacetReducedMotion();
    const resolvedThemeKey = resolvePackThemeKey(packType);
    const hueRotate = PACK_HUE_ROTATE[resolvedThemeKey];
    const rarity = parseCardRarity(guaranteedRarity) ?? "COMMON";
    const foilStamp = getFoilStampConfig(rarity);
    const sweepDuration = getSweepSpeed(rarity);
    const holoOpacity = getHoloOpacity(rarity);
    const holoGradient = useMemo(() => getHoloGradient(rarity), [rarity]);

    const showGeometry = rarity !== "COMMON";
    const showStamp = foilStamp.enabled && size !== "sm";
    const isInteractive = (interactive ?? size === "lg") && !reduceMotion;

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

    const containerStyle: React.CSSProperties = {
      "--m-x": "50%",
      "--m-y": "50%",
      "--r-x": "0deg",
      "--r-y": "0deg",
      "--bg-x": "50%",
      "--bg-y": "50%",
      "--opacity": "0",
      "--duration": "300ms",
      "--easing": "ease",
      "--pack-sweep-duration": `${sweepDuration}s`,
    } as React.CSSProperties;

    const staticTimingStyle: React.CSSProperties = {
      "--pack-sweep-duration": `${sweepDuration}s`,
    } as React.CSSProperties;

    return (
      <div
        ref={refElement}
        data-pack-theme={resolvedThemeKey}
        style={isInteractive ? containerStyle : staticTimingStyle}
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
            <div className="pack-cover-base absolute inset-0" />
          )}

          {/* Layer 2: Holographic foil sweep */}
          <div
            className={cn(
              "pointer-events-none absolute inset-0",
              !isInteractive && "pack-holo-drift"
            )}
            style={
              {
                "--pack-drift-duration": "8s",
                backgroundImage: holoGradient,
                backgroundSize: "400% 400%",
                mixBlendMode: "color-dodge",
                opacity: isInteractive ? "calc(var(--opacity) * 0.7 + 0.1)" : holoOpacity,
                filter: hueRotate ? `hue-rotate(${hueRotate}deg)` : undefined,
                backgroundPosition: isInteractive
                  ? "calc(var(--bg-x) * 1.5) calc(var(--bg-y) * 1.5)"
                  : undefined,
                transition: "opacity 0.3s ease",
              } as React.CSSProperties
            }
          />

          {/* Layer 7: PDS Custom Foil Overlay */}
          {packArtwork && packArtwork.endsWith(".svg") && (
            <div
              className={cn(
                "pointer-events-none absolute inset-0",
                !isInteractive && "pack-holo-drift"
              )}
              style={
                {
                  "--pack-drift-duration": "10s",
                  backgroundImage: `url(${packArtwork.replace(".svg", "_foil.svg")})`,
                  backgroundSize: "cover",
                  mixBlendMode: "color-dodge",
                  opacity: isInteractive ? "calc(var(--opacity) * 0.6 + 0.15)" : 0.25,
                  backgroundPosition: isInteractive
                    ? "calc(var(--bg-x) * 1.2) calc(var(--bg-y) * 1.2)"
                    : undefined,
                  transition: "opacity 0.3s ease",
                } as React.CSSProperties
              }
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
                  border: `1.5px solid ${ACCENT_BORDER}`,
                  clipPath: "polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)",
                }}
              />
              <div
                className="pack-geo-spin-reverse absolute"
                style={{
                  width: "45%",
                  height: "45%",
                  border: `1px solid ${ACCENT_SOFT}`,
                  background: ACCENT_SOFT,
                  clipPath: "polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)",
                }}
              />
              {(rarity === "EPIC" || rarity === "LEGENDARY") && (
                <div
                  className="pack-core-pulse absolute rounded-full"
                  style={{
                    width: "18%",
                    height: "18%",
                    border: `1px solid ${ACCENT_BORDER}`,
                    background: `radial-gradient(circle, ${ACCENT_SOFT} 0%, transparent 70%)`,
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
                background: `radial-gradient(farthest-corner circle at var(--m-x) var(--m-y), rgb(255 255 255 / 0.45) 0%, rgb(255 255 255 / 0.2) 25%, transparent 70%)`,
              }}
            />
          )}

          {/* Static sweep for non-interactive state */}
          {!isInteractive && (
            <div className="pointer-events-none absolute inset-0 overflow-hidden">
              <div
                className="pack-foil-sweep absolute top-0 h-full w-1/2"
                style={{
                  background:
                    "linear-gradient(105deg, transparent 30%, rgb(255 255 255 / 0.1) 45%, rgb(255 255 255 / 0.22) 50%, rgb(255 255 255 / 0.1) 55%, transparent 70%)",
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
                  "card-art-linear-br shadow-floating",
                  foilStamp.color,
                  STAMP_SIZES[size]
                )}
                style={{ textShadow: "0 0 8px rgb(255 255 255 / 0.8)" }}
              >
                {foilStamp.symbol}
              </div>
            )}

            <div className="card-face-scrim relative w-full px-2 pt-4 pb-2">
              {packName && size !== "sm" && (
                <p
                  className={cn(
                    "line-clamp-1 text-center leading-tight font-bold text-white/90",
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
              <p className="flex items-center justify-center gap-1 text-xs font-semibold text-white/40">
                <CardsLogomark />
                <span className={size === "sm" ? "sr-only" : undefined}>Cards</span>
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }
);

PackHolographicCover.displayName = "PackHolographicCover";
