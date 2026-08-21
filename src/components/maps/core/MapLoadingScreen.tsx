"use client";

/**
 * MapLoadingScreen - Full-screen loading overlay for IxWorld map.
 *
 * Shows an animated globe with subsystem progress indicators while
 * map data and engine initialize. Fades out smoothly when ready.
 *
 * Fully theme-compliant (Facet design system) and aligned with Apple Design
 * guidelines for fluid physics, translucent materials, and accessibility.
 */

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Map, BookOpen, Image as ImageIcon, Database } from "lucide-react";
import { withBasePath } from "~/lib/base-path";
import { cn } from "~/lib/utils";

interface MapLoadingScreenProps {
  /** True when map data + engine are ready */
  isReady: boolean;
}

const SUBSYSTEMS = [
  {
    icon: Map,
    color: "text-blue-500 dark:text-blue-400",
    bg: "from-blue-500 to-blue-600 dark:from-blue-400 dark:to-blue-600",
    badgeBorder: "border-blue-500/25 bg-blue-500/10",
    label: "Topography",
  },
  {
    icon: Database,
    color: "text-emerald-500 dark:text-emerald-400",
    bg: "from-emerald-500 to-emerald-600 dark:from-emerald-400 dark:to-emerald-600",
    badgeBorder: "border-emerald-500/25 bg-emerald-500/10",
    label: "Countries",
  },
  {
    icon: BookOpen,
    color: "text-amber-500 dark:text-amber-400",
    bg: "from-amber-500 to-amber-600 dark:from-amber-400 dark:to-amber-600",
    badgeBorder: "border-amber-500/25 bg-amber-500/10",
    label: "Wiki Data",
  },
  {
    icon: ImageIcon,
    color: "text-purple-500 dark:text-purple-400",
    bg: "from-purple-500 to-purple-600 dark:from-purple-400 dark:to-purple-600",
    badgeBorder: "border-purple-500/25 bg-purple-500/10",
    label: "Media",
  },
] as const;

export function MapLoadingScreen({ isReady }: MapLoadingScreenProps) {
  const [mounted, setMounted] = useState(!isReady);

  useEffect(() => {
    if (isReady) {
      setMounted(false);
    } else {
      setMounted(true);
    }
  }, [isReady]);

  return (
    <AnimatePresence>
      {mounted && (
        <motion.div
          key="map-loading-screen"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{
            opacity: 0,
            scale: 1.02,
            filter: "blur(12px)",
            transition: { duration: 0.45, ease: [0.16, 1, 0.3, 1] },
          }}
          className="fixed inset-0 z-50 flex select-none items-center justify-center bg-background/85 backdrop-blur-2xl transition-colors dark:bg-[#070b14]/90"
        >
          {/* Ambient spatial gradient lighting */}
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,_rgba(59,130,246,0.12)_0%,_transparent_70%)] dark:bg-[radial-gradient(ellipse_at_center,_rgba(56,189,248,0.1)_0%,_transparent_70%)]" />
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(99,102,241,0.06)_0%,_transparent_60%)]" />

          <div className="relative z-10 flex w-full max-w-md flex-col items-center gap-7 px-6 text-center">
            {/* Animated globe emblem */}
            <div className="relative flex h-36 w-36 items-center justify-center">
              {/* Pulsing ambient aura */}
              <div
                className="absolute inset-[-15%] rounded-full bg-cyan-500/15 blur-2xl motion-safe:animate-pulse dark:bg-cyan-400/10"
                style={{ animationDuration: "3s" }}
              />

              {/* Outer orbit ring */}
              <div
                className="absolute inset-0 rounded-full border border-cyan-500/25 motion-safe:animate-[spin_10s_linear_infinite] dark:border-cyan-400/20"
                style={{
                  backgroundImage:
                    "conic-gradient(from 0deg, rgba(6,182,212,0.4), transparent 45%, rgba(99,102,241,0.3) 65%, transparent)",
                  backgroundOrigin: "border-box",
                }}
              />

              {/* Middle dashed orbit ring - reverse spin */}
              <div className="absolute inset-3 rounded-full border-[1.5px] border-dashed border-sky-500/30 motion-safe:animate-[spin_8s_linear_infinite_reverse] dark:border-sky-400/20" />

              {/* Inner accent ring */}
              <div className="absolute inset-6 rounded-full border border-indigo-500/20 motion-safe:animate-[spin_6s_linear_infinite] dark:border-indigo-400/25" />

              {/* Center glass container orb */}
              <div className="border-border/60 bg-card/60 relative flex h-20 w-20 items-center justify-center overflow-hidden rounded-full border shadow-xl shadow-cyan-500/5 backdrop-blur-xl dark:border-white/15 dark:bg-white/[0.04]">
                <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-white/10 to-transparent dark:from-white/5" />
                <img
                  src={withBasePath("/images/ix-logo.svg?v=2")}
                  alt="Ixnay"
                  className="h-12 w-12 opacity-90 brightness-0 drop-shadow-[0_2px_12px_rgba(59,130,246,0.35)] transition-opacity duration-300 dark:invert"
                />
              </div>

              {/* Orbiting dot 1 */}
              <div className="absolute inset-0 motion-safe:animate-[spin_4s_linear_infinite]">
                <div className="absolute top-0 left-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1 rounded-full bg-cyan-500 shadow-[0_0_10px_rgba(6,182,212,0.8)] dark:bg-cyan-400" />
              </div>

              {/* Orbiting dot 2 */}
              <div className="absolute inset-0 motion-safe:animate-[spin_6s_linear_infinite_reverse]">
                <div className="absolute bottom-0 left-1/2 h-1.5 w-1.5 -translate-x-1/2 translate-y-1 rounded-full bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.7)] dark:bg-indigo-400" />
              </div>
            </div>

            {/* Title & Status Narrative */}
            <div className="space-y-1.5">
              <h2 className="bg-gradient-to-r from-cyan-600 via-blue-600 to-indigo-600 bg-clip-text text-2xl font-bold tracking-tight text-transparent dark:from-cyan-300 dark:via-blue-400 dark:to-indigo-300">
                IxMaps™
              </h2>
              <p className="text-muted-foreground text-xs font-medium tracking-normal">
                Initializing spatial foundation and world data...
              </p>
            </div>

            {/* Subsystem progress cards */}
            <div className="grid w-full grid-cols-2 gap-2.5">
              {SUBSYSTEMS.map((sys, i) => (
                <div
                  key={sys.label}
                  className="border-border/50 bg-card/50 shadow-xs flex items-center gap-2.5 rounded-xl border p-2.5 backdrop-blur-md transition-all dark:border-white/10 dark:bg-white/[0.03]"
                >
                  <div
                    className={cn(
                      "flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border",
                      sys.badgeBorder
                    )}
                  >
                    <sys.icon className={cn("h-3.5 w-3.5", sys.color)} />
                  </div>
                  <div className="min-w-0 flex-1 text-left">
                    <div className="text-foreground/80 dark:text-foreground/90 truncate text-[11px] font-medium tracking-tight">
                      {sys.label}
                    </div>
                    <div className="bg-muted/70 mt-1 h-1 w-full overflow-hidden rounded-full dark:bg-white/10">
                      <motion.div
                        className={cn("h-full rounded-full bg-gradient-to-r", sys.bg)}
                        initial={{ width: "0%" }}
                        animate={{ width: "100%" }}
                        transition={{
                          duration: 1.2 + i * 0.3,
                          ease: [0.16, 1, 0.3, 1],
                          delay: 0.15 + i * 0.1,
                        }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Subtle sync indicators */}
            <div className="flex items-center gap-1.5 pt-1">
              {[0, 1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  className="h-1.5 w-1.5 rounded-full bg-cyan-500/50 dark:bg-cyan-400/60"
                  style={{
                    animation: `dotPulse 1.6s ease-in-out ${i * 0.16}s infinite`,
                  }}
                />
              ))}
            </div>
          </div>

          <style jsx>{`
            @keyframes dotPulse {
              0%,
              100% {
                opacity: 0.3;
                transform: scale(0.85);
              }
              50% {
                opacity: 1;
                transform: scale(1.25);
              }
            }
            @media (prefers-reduced-motion: reduce) {
              * {
                animation-duration: 0.01ms !important;
                animation-iteration-count: 1 !important;
                transition-duration: 0.01ms !important;
              }
            }
          `}</style>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
