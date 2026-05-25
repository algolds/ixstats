"use client";

/**
 * MapWelcomeModal — First-visit welcome screen for IxWorld.
 *
 * Shows on the first visit (localStorage key). Displays quick tips,
 * keyboard shortcuts, and feature highlights. Dismisses permanently
 * on close or "Don't show again".
 */

import { useState, useEffect, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  X, Globe, Layers,
  Ruler, MapPin, Keyboard, ChevronRight, ChevronLeft,
  Compass, Navigation,
} from "lucide-react";
import { Tooltip } from "~/components/ui/tooltip-card";
import { IxTime } from "~/lib/ixtime";

/** IxWorld version — bump this to re-show welcome on major updates */
const IXWORLD_VERSION = "2.1.7";
const STORAGE_KEY = "ixworld-welcome-seen";

interface MapWelcomeModalProps {
  /** Only show after the map is ready */
  isMapReady: boolean;
}

const TIPS = [
  {
    icon: Globe,
    color: "text-blue-400",
    bg: "bg-blue-500/10",
    title: "Select a Nation",
    description: "Click any country to view its profile — territory, provinces, neighbors, and demographics. Each nation links to its full wiki entry.",
  },
  {
    icon: Layers,
    color: "text-purple-400",
    bg: "bg-purple-500/10",
    title: "Examine the Geography",
    description: "Use the layer panel to switch between political borders, climate zones, elevation, and river systems.",
  },
  {
    icon: MapPin,
    color: "text-amber-400",
    bg: "bg-amber-500/10",
    title: "Inspect Any Location",
    description: "Activate the pin tool and drop it anywhere. Get a full readout — elevation, climate, controlling nation, and nearby points of interest.",
  },
  {
    icon: Ruler,
    color: "text-cyan-400",
    bg: "bg-cyan-500/10",
    title: "Measure the World",
    description: "Use the ruler to calculate distance between any two points. Plan supply lines, estimate travel time, or size up a rival's borders.",
  },
];

const SHORTCUTS = [
  { keys: ["Ctrl", "K"], action: "Open search" },
  { keys: ["+", "−"], action: "Zoom in / out" },
  { keys: ["R"], action: "Reset view" },
  { keys: ["G"], action: "Toggle globe/flat" },
  { keys: ["Esc"], action: "Close panels" },
];

export function MapWelcomeModal({ isMapReady }: MapWelcomeModalProps) {
  const [show, setShow] = useState(false);

  // Current IxTime for the tooltip
  const currentIxTime = useMemo(() => {
    try {
      const ixTs = IxTime.getCurrentIxTime();
      return IxTime.formatIxTime(ixTs, true);
    } catch { return "—"; }
  }, []);
  const [currentPage, setCurrentPage] = useState(0);

  useEffect(() => {
    if (!isMapReady) return;
    try {
      const seen = localStorage.getItem(STORAGE_KEY);
      // Re-show on new versions (user sees what's new)
      if (!seen || seen !== IXWORLD_VERSION) {
        const timer = setTimeout(() => setShow(true), 800);
        return () => clearTimeout(timer);
      }
    } catch {
      // localStorage unavailable
    }
  }, [isMapReady]);

  const handleClose = useCallback(() => {
    setShow(false);
    try { localStorage.setItem(STORAGE_KEY, IXWORLD_VERSION); } catch { }
  }, []);

  const totalPages = 2; // Tips page + Shortcuts page

  if (!show) return null;

  return (
    <AnimatePresence>
      {show && (
        <>
          {/* Backdrop */}
          <motion.div
            key="welcome-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="fixed inset-0 z-[9999] bg-black/40 dark:bg-black/60 backdrop-blur-sm"
            onClick={handleClose}
          />

          {/* Modal */}
          <motion.div
            key="welcome-modal"
            initial={{ opacity: 0, scale: 0.92, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
            className="fixed left-1/2 top-1/2 z-[10000] -translate-x-1/2 -translate-y-1/2 w-full max-w-lg"
          >
            <div className="relative overflow-hidden rounded-2xl border border-border/50 dark:border-white/10 bg-gradient-to-b from-background via-background to-muted/30 dark:from-slate-900 dark:via-slate-900 dark:to-slate-950 shadow-2xl">
              {/* Close button */}
              <button
                onClick={handleClose}
                className="absolute right-3 top-3 z-10 rounded-full p-1.5 text-muted-foreground/60 transition-colors hover:bg-muted hover:text-foreground dark:hover:bg-white/10"
              >
                <X className="h-4 w-4" />
              </button>

              {/* Header */}
              <div className="relative px-6 pt-6 pb-4">
                {/* Decorative gradient orbs */}
                <div className="pointer-events-none absolute -top-20 -left-20 h-40 w-40 rounded-full bg-blue-500/10 blur-3xl" />
                <div className="pointer-events-none absolute -top-10 -right-10 h-32 w-32 rounded-full bg-purple-500/10 blur-3xl" />

                <div className="relative flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-cyan-400 shadow-lg shadow-blue-500/20">
                      <Globe className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <h2 className="text-lg font-semibold text-foreground">Welcome to IxMaps</h2>
                      <p className="text-xs text-muted-foreground">Explore an interactive & collaborative worldbuilding map</p>
                    </div>
                  </div>
                  <span className="rounded-full bg-muted/60 dark:bg-white/5 px-2 py-0.5 text-[10px] font-mono text-muted-foreground">
                    v{IXWORLD_VERSION}
                  </span>
                </div>
              </div>

              {/* Content pages */}
              <div className="px-6 pb-2">
                <AnimatePresence mode="wait">
                  {currentPage === 0 && (
                    <motion.div
                      key="tips"
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 10 }}
                      transition={{ duration: 0.2 }}
                      className="grid grid-cols-2 gap-2.5"
                    >
                      {TIPS.map((tip) => {
                        const Icon = tip.icon;
                        return (
                          <div
                            key={tip.title}
                            className={`rounded-xl ${tip.bg} border border-border/30 dark:border-white/5 p-3 transition-colors hover:border-border/60 dark:hover:border-white/10`}
                          >
                            <div className="flex items-center gap-2 mb-1.5">
                              <Icon className={`h-3.5 w-3.5 ${tip.color}`} />
                              <span className="text-xs font-medium text-foreground/90">{tip.title}</span>
                            </div>
                            <p className="text-[11px] leading-relaxed text-muted-foreground">{tip.description}</p>
                          </div>
                        );
                      })}
                    </motion.div>
                  )}

                  {currentPage === 1 && (
                    <motion.div
                      key="shortcuts"
                      initial={{ opacity: 0, x: 10 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -10 }}
                      transition={{ duration: 0.2 }}
                    >
                      <h3 className="text-xs font-medium text-muted-foreground mb-3 flex items-center gap-1.5">
                        <Keyboard className="h-3.5 w-3.5" />
                        Keyboard Shortcuts
                      </h3>
                      <div className="space-y-2">
                        {SHORTCUTS.map((s) => (
                          <div key={s.action} className="flex items-center justify-between rounded-lg bg-muted/50 dark:bg-white/5 px-3 py-2">
                            <span className="text-xs text-muted-foreground">{s.action}</span>
                            <div className="flex items-center gap-1">
                              {s.keys.map((k) => (
                                <kbd
                                  key={k}
                                  className="inline-flex h-5 min-w-[22px] items-center justify-center rounded bg-muted dark:bg-white/10 px-1.5 text-[10px] font-mono text-foreground/80 border border-border/50 dark:border-white/10"
                                >
                                  {k}
                                </kbd>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>

                      <div className="mt-4 rounded-xl bg-gradient-to-r from-blue-500/10 to-purple-500/10 border border-border/30 dark:border-white/5 p-3">
                        <div className="flex items-center gap-2 mb-1">
                          <Compass className="h-3.5 w-3.5 text-blue-400" />
                          <span className="text-xs font-medium text-foreground/90">Tip</span>
                        </div>
                        <p className="text-[11px] text-muted-foreground">
                          Everything on this map connects to a living wiki. Hover any country or place name for an instant preview, or click through to read the full article.
                        </p>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* World notes */}
              <div className="px-6 pb-2">
                <div className="space-y-1.5 text-[10px] leading-relaxed text-muted-foreground/80">
                  <div>IxWorld runs on{" "}
                    <Tooltip content={
                      <div className="space-y-1.5 text-xs">
                        <p className="font-semibold">Current IxTime</p>
                        <p className="font-mono text-blue-400">{currentIxTime}</p>
                        <p className="text-muted-foreground">The in-world clock runs at 2x real time. One real day = two in-game days. All economic cycles, elections, and events follow this clock.</p>
                      </div>
                    }>
                      <strong className="text-muted-foreground underline decoration-dotted cursor-help">IxTime</strong>
                    </Tooltip>
                    {" "}— the in-world clock moves at 2x real time.
                  </div>
                  <div>The world uses a{" "}
                    <Tooltip content={
                      <div className="space-y-1.5 text-xs">
                        <p className="font-semibold">Trewartha Climate System</p>
                        <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-[11px]">
                          <span><span className="inline-block w-2 h-2 rounded-full bg-[#990000] mr-1" />Tropical Wet (Ar)</span>
                          <span><span className="inline-block w-2 h-2 rounded-full bg-[#FF9933] mr-1" />Steppe (Bs)</span>
                          <span><span className="inline-block w-2 h-2 rounded-full bg-[#00FF99] mr-1" />Temperate Oceanic (Do)</span>
                          <span><span className="inline-block w-2 h-2 rounded-full bg-[#0099FF] mr-1" />Continental (Dc)</span>
                          <span><span className="inline-block w-2 h-2 rounded-full bg-[#FFCCFF] mr-1" />Highland (H)</span>
                          <span><span className="inline-block w-2 h-2 rounded-full bg-[#0066CC] mr-1" />Boreal (E)</span>
                        </div>
                        <p className="text-muted-foreground">12 climate zones and 9 elevation bands. Climate affects agriculture, GDP modifiers, crisis risk, and NPC behavior.</p>
                      </div>
                    }>
                      <strong className="text-muted-foreground underline decoration-dotted cursor-help">Trewartha climate system</strong>
                    </Tooltip>
                    {" "}with 12 zones and 9 elevation bands.
                  </div>
                  <div>All lore originates from{" "}
                    <Tooltip content={
                      <div className="space-y-1.5 text-xs">
                        <p className="font-semibold">IxWiki</p>
                        <p className="text-muted-foreground">The collaborative wiki is the canonical source of truth. Country articles, infoboxes, and coordinates feed directly into the map and stats engine. Edits on the wiki are reflected here automatically.</p>
                      </div>
                    }>
                      <a href="https://ixwiki.com" target="_blank" rel="noopener" className="text-muted-foreground underline decoration-dotted cursor-help hover:text-foreground">IxWiki</a>
                    </Tooltip>
                    {" "}— the canonical source of truth.
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="flex items-center justify-between px-6 py-4 border-t border-border/30 dark:border-white/5">
                <div className="flex items-center gap-1.5">
                  {Array.from({ length: totalPages }).map((_, i) => (
                    <button
                      key={i}
                      onClick={() => setCurrentPage(i)}
                      className={`h-1.5 rounded-full transition-all ${i === currentPage ? "w-5 bg-blue-400" : "w-1.5 bg-muted-foreground/20 hover:bg-muted-foreground/40"
                        }`}
                    />
                  ))}
                </div>

                <div className="flex items-center gap-2">
                  {currentPage > 0 && (
                    <button
                      onClick={() => setCurrentPage((p) => p - 1)}
                      className="flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground dark:hover:bg-white/5"
                    >
                      <ChevronLeft className="h-3 w-3" />
                      Back
                    </button>
                  )}
                  {currentPage < totalPages - 1 ? (
                    <button
                      onClick={() => setCurrentPage((p) => p + 1)}
                      className="flex items-center gap-1 rounded-lg bg-blue-500/15 px-3 py-1.5 text-xs font-medium text-blue-600 dark:text-blue-300 transition-colors hover:bg-blue-500/25"
                    >
                      Next
                      <ChevronRight className="h-3 w-3" />
                    </button>
                  ) : (
                    <button
                      onClick={handleClose}
                      className="flex items-center gap-1 rounded-lg bg-blue-500 px-4 py-1.5 text-xs font-medium text-white transition-colors hover:bg-blue-600"
                    >
                      Start Exploring
                      <Navigation className="h-3 w-3" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
