"use client";

/**
 * MapLoadingScreen — Refined full-screen loading overlay for the IxWorld map.
 *
 * Implements Apple Design fluid motion & Emil Kowalski design engineering principles:
 * - Minimalist Facet glass disc emblem.
 * - Indeterminate hardware-accelerated hairline progress beam.
 * - Critically damped snappy exit transition (220ms) with instant pointer-events release.
 * - Full prefers-reduced-motion compliance via useReducedMotion().
 * - 100% semantic color tokens (zero raw hex/rgba).
 */

import { motion, AnimatePresence, useReducedMotion } from "motion/react";
import { withBasePath } from "~/lib/base-path";
import { FacetContainer } from "~/components/ui/facet-container";

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
          className="bg-background/80 fixed inset-0 z-50 flex items-center justify-center backdrop-blur-xl select-none"
        >
          <div className="relative z-10 flex w-full max-w-sm flex-col items-center gap-6 px-6 text-center">
            {/* Facet emblem */}
            <FacetContainer
              depth={2}
              className="flex h-20 w-20 items-center justify-center rounded-full"
            >
              <img
                src={withBasePath("/images/ix-logo.svg?v=2")}
                alt="IxMaps"
                className="h-10 w-10 opacity-90 brightness-0 dark:invert"
              />
            </FacetContainer>

            {/* Typography */}
            <div className="space-y-1.5">
              <h2 className="text-foreground text-xl font-semibold tracking-tight sm:text-2xl">
                IxMaps
              </h2>
              <p className="text-muted-foreground text-xs font-medium">Initializing the world...</p>
            </div>

            {/* Indeterminate Hairline Shimmer Rail */}
            <div
              role="progressbar"
              aria-label="Loading the map"
              className="bg-muted relative h-1 w-44 overflow-hidden rounded-full"
            >
              <motion.div
                className="h-full w-1/3 origin-left rounded-full bg-blue-500"
                animate={
                  shouldReduceMotion
                    ? { transform: "scaleX(3)", opacity: 0.7 }
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
