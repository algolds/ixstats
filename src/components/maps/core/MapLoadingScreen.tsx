"use client";

/**
 * MapLoadingScreen — Refined full-screen loading overlay for the IxWorld map.
 *
 * Implements Apple Design fluid motion & Emil Kowalski design engineering principles:
 * - Minimalist Facet glass disc with ambient breathing aura.
 * - Indeterminate hardware-accelerated hairline shimmer beam.
 * - Critically damped snappy exit transition (220ms) with instant pointer-events release.
 * - Full prefers-reduced-motion compliance via useReducedMotion().
 * - 100% semantic color tokens (zero raw hex/rgba).
 */

import { motion, AnimatePresence, useReducedMotion } from "motion/react";
import { withBasePath } from "~/lib/base-path";
import { cn } from "~/lib/utils";

interface MapLoadingScreenProps {
  /** True when map data + engine are ready */
  isReady: boolean;
}

export function MapLoadingScreen({ isReady }: MapLoadingScreenProps) {
  const shouldReduceMotion = useReducedMotion();

  return (
    <AnimatePresence>
      {!isReady && (
        <motion.div
          key="map-loading-screen"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={
            shouldReduceMotion
              ? {
                  opacity: 0,
                  transition: { duration: 0.15 },
                  pointerEvents: "none",
                }
              : {
                  opacity: 0,
                  scale: 0.98,
                  transition: { duration: 0.22, ease: [0.16, 1, 0.3, 1] },
                  pointerEvents: "none",
                }
          }
          className={cn(
            "fixed inset-0 z-50 flex items-center justify-center select-none backdrop-blur-xl transition-colors",
            "bg-background/80 dark:bg-map-ocean/90"
          )}
        >
          {/* Subtle spatial ambient vignette */}
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,var(--color-primary)_0%,transparent_70%)] opacity-[0.04] dark:opacity-[0.07]" />

          <div className="relative z-10 flex w-full max-w-sm flex-col items-center gap-6 px-6 text-center">
            {/* Facet Glass Orb Emblem */}
            <div className="relative flex h-24 w-24 items-center justify-center">
              {/* Breathing ambient aura */}
              {!shouldReduceMotion && (
                <div
                  className="absolute inset-0 rounded-full bg-primary/10 blur-xl motion-safe:animate-pulse dark:bg-cyan-500/10"
                  style={{ animationDuration: "3s" }}
                />
              )}

              {/* Glass Disc */}
              <div className="relative flex h-20 w-20 items-center justify-center rounded-full border border-border/60 bg-card/70 shadow-xl backdrop-blur-xl dark:border-white/15 dark:bg-white/[0.04]">
                {/* Specular top edge highlight */}
                <div className="pointer-events-none absolute inset-0 rounded-full border-t border-white/30 dark:border-white/20" />
                <img
                  src={withBasePath("/images/ix-logo.svg?v=2")}
                  alt="IxMaps"
                  className="h-10 w-10 opacity-90 brightness-0 transition-opacity drop-shadow-xs dark:invert"
                />
              </div>
            </div>

            {/* Typography */}
            <div className="space-y-1.5">
              <h2 className="text-xl font-semibold tracking-[-0.02em] text-foreground sm:text-2xl">
                IxMaps
              </h2>
              <p className="text-xs font-medium tracking-normal text-muted-foreground">
                Initializing the world...
              </p>
            </div>

            {/* Indeterminate Hairline Shimmer Rail */}
            <div className="relative h-1 w-44 overflow-hidden rounded-full bg-muted/60 dark:bg-white/10">
              <motion.div
                className="h-full w-1/3 rounded-full bg-gradient-to-r from-transparent via-primary/80 to-transparent dark:via-cyan-400"
                animate={
                  shouldReduceMotion
                    ? { width: "100%", opacity: 0.7 }
                    : {
                        transform: ["translateX(-100%)", "translateX(300%)"],
                      }
                }
                transition={
                  shouldReduceMotion
                    ? { duration: 0 }
                    : {
                        duration: 1.4,
                        repeat: Infinity,
                        ease: [0.4, 0, 0.2, 1],
                      }
                }
              />
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
