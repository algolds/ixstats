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
  Globe,
  Component as Layers,
  Ruler,
  MapPin,
  Keyframe as Keyboard,
  NavArrowRight as ChevronRight,
  NavArrowLeft as ChevronLeft,
  Compass,
  Navigator as Navigation,
} from "iconoir-react";
import { Tooltip } from "~/components/ui/tooltip-card";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { FacetCard } from "~/components/ui/facet-container";
import { IxTime } from "~/lib/ixtime";
import { IXWORLD_VERSION } from "~/lib/buildVersion";
import { DEFAULT_MEDIAWIKI_URL } from "~/lib/wiki-os/config";

const STORAGE_KEY = "ixworld-welcome-seen";

interface MapWelcomeModalProps {
  /** Only show after the map is ready */
  isMapReady: boolean;
  onStartTour?: () => void;
  isOpen?: boolean;
  onClose?: () => void;
}

const TIPS = [
  {
    icon: Globe,
    title: "Select a Nation",
    description:
      "Click any country to view its profile — territory, provinces, neighbors, and demographics. Each nation links to its full wiki entry.",
  },
  {
    icon: Layers,
    title: "Examine the Geography",
    description:
      "Use the layer panel to switch between political borders, climate zones, elevation, and river systems.",
  },
  {
    icon: MapPin,
    title: "Inspect Any Location",
    description:
      "Activate the pin tool and drop it anywhere. Get a full readout — elevation, climate, controlling nation, and nearby points of interest.",
  },
  {
    icon: Ruler,
    title: "Measure the World",
    description:
      "Use the ruler to calculate distance between any two points. Plan supply lines, estimate travel time, or size up a rival's borders.",
  },
];

const SHORTCUTS = [
  { keys: ["Ctrl", "K"], action: "Open search" },
  { keys: ["+", "−"], action: "Zoom in / out" },
  { keys: ["R"], action: "Reset view" },
  { keys: ["G"], action: "Toggle globe/flat" },
  { keys: ["Esc"], action: "Close panels" },
];

export function MapWelcomeModal({
  isMapReady,
  onStartTour,
  isOpen,
  onClose,
}: MapWelcomeModalProps) {
  const [show, setShow] = useState(false);

  // Sync parent isOpen control
  useEffect(() => {
    if (isOpen !== undefined) {
      // oxlint-disable-next-line
      setShow(isOpen);
    }
  }, [isOpen]);

  // Current IxTime for the tooltip
  const currentIxTime = useMemo(() => {
    try {
      const ixTs = IxTime.getCurrentIxTime();
      return IxTime.formatIxTime(ixTs, true);
    } catch {
      return "—";
    }
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
    return;
  }, [isMapReady]);

  const handleClose = useCallback(() => {
    setShow(false);
    onClose?.();
    try {
      localStorage.setItem(STORAGE_KEY, IXWORLD_VERSION);
    } catch {
      // storage unavailable (private mode) — preference is not persisted
    }
  }, [onClose]);

  const totalPages = 2; // Tips page + Shortcuts page

  if (!show) return null;

  return (
    <Dialog open={show} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="facet-modal gap-0 overflow-hidden rounded-2xl p-0 sm:max-w-lg">
        {/* Header */}
        <DialogHeader className="flex-row items-center justify-between gap-3 px-6 pt-6 pr-12 pb-4 text-left">
          <div className="flex items-center gap-3">
            <Globe className="h-6 w-6 shrink-0 text-blue-500" aria-hidden />
            <div>
              <DialogTitle>Welcome to IxMaps</DialogTitle>
              <DialogDescription className="text-xs">
                Explore an interactive & collaborative worldbuilding map
              </DialogDescription>
            </div>
          </div>
          <Badge variant="secondary" className="font-mono">
            v{IXWORLD_VERSION}
          </Badge>
        </DialogHeader>

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
                    <FacetCard key={tip.title} surface="solid" className="rounded-xl p-3">
                      <div className="mb-1.5 flex items-center gap-2">
                        <Icon className="h-4 w-4 text-blue-500" aria-hidden />
                        <h3 className="text-foreground text-sm font-semibold">{tip.title}</h3>
                      </div>
                      <p className="text-muted-foreground text-xs leading-relaxed">
                        {tip.description}
                      </p>
                    </FacetCard>
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
                <h3 className="text-foreground mb-3 flex items-center gap-1.5 text-sm font-semibold">
                  <Keyboard className="text-muted-foreground h-4 w-4" aria-hidden />
                  Keyboard shortcuts
                </h3>
                <div>
                  {SHORTCUTS.map((s) => (
                    <div
                      key={s.action}
                      className="border-border flex items-center justify-between border-b px-1 py-2 last:border-b-0"
                    >
                      <span className="text-muted-foreground text-xs">{s.action}</span>
                      <div className="flex items-center gap-1">
                        {s.keys.map((k) => (
                          <kbd
                            key={k}
                            className="bg-muted text-foreground border-border inline-flex h-5 min-w-[22px] items-center justify-center rounded border px-1.5 font-mono text-xs"
                          >
                            {k}
                          </kbd>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>

                <FacetCard surface="solid" className="mt-4 rounded-xl p-3">
                  <div className="mb-1 flex items-center gap-2">
                    <Compass className="h-4 w-4 text-blue-500" aria-hidden />
                    <h4 className="text-foreground text-sm font-semibold">Tip</h4>
                  </div>
                  <p className="text-muted-foreground text-xs">
                    Everything on this map connects to a living wiki. Hover any country or place
                    name for an instant preview, or click through to read the full article.
                  </p>
                </FacetCard>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* World notes */}
        <div className="px-6 pb-2">
          <div className="text-muted-foreground space-y-1.5 text-xs leading-relaxed">
            <div>
              IxWorld runs on{" "}
              <Tooltip
                content={
                  <div className="space-y-1.5 text-xs">
                    <p className="font-semibold">Current IxTime</p>
                    <p className="font-mono text-blue-500">{currentIxTime}</p>
                    <p className="text-muted-foreground">
                      The in-world clock runs at 2x real time. One real day = two in-game days. All
                      economic cycles, elections, and events follow this clock.
                    </p>
                  </div>
                }
              >
                <strong className="text-muted-foreground cursor-help underline decoration-dotted">
                  IxTime
                </strong>
              </Tooltip>{" "}
              — the in-world clock moves at 2x real time.
            </div>
            <div>
              The world uses a{" "}
              <Tooltip
                content={
                  <div className="space-y-1.5 text-xs">
                    <p className="font-semibold">Trewartha Climate System</p>
                    <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-xs">
                      <span>
                        <span className="mr-1 inline-block h-2 w-2 rounded-full bg-red-700" />
                        Tropical Wet (Ar)
                      </span>
                      <span>
                        <span className="mr-1 inline-block h-2 w-2 rounded-full bg-amber-500" />
                        Steppe (Bs)
                      </span>
                      <span>
                        <span className="mr-1 inline-block h-2 w-2 rounded-full bg-emerald-400" />
                        Temperate Oceanic (Do)
                      </span>
                      <span>
                        <span className="mr-1 inline-block h-2 w-2 rounded-full bg-cyan-500" />
                        Continental (Dc)
                      </span>
                      <span>
                        <span className="mr-1 inline-block h-2 w-2 rounded-full bg-stone-400" />
                        Highland (H)
                      </span>
                      <span>
                        <span className="mr-1 inline-block h-2 w-2 rounded-full bg-blue-600" />
                        Boreal (E)
                      </span>
                    </div>
                    <p className="text-muted-foreground">
                      12 climate zones and 9 elevation bands. Climate affects agriculture, GDP
                      modifiers, crisis risk, and NPC behavior.
                    </p>
                  </div>
                }
              >
                <strong className="text-muted-foreground cursor-help underline decoration-dotted">
                  Trewartha climate system
                </strong>
              </Tooltip>{" "}
              with 12 zones and 9 elevation bands.
            </div>
            <div>
              All lore originates from{" "}
              <Tooltip
                content={
                  <div className="space-y-1.5 text-xs">
                    <p className="font-semibold">IxWiki</p>
                    <p className="text-muted-foreground">
                      The collaborative wiki is the canonical source of truth. Country articles,
                      infoboxes, and coordinates feed directly into the map and stats engine. Edits
                      on the wiki are reflected here automatically.
                    </p>
                  </div>
                }
              >
                <a
                  href={DEFAULT_MEDIAWIKI_URL}
                  target="_blank"
                  rel="noopener"
                  className="text-muted-foreground hover:text-foreground cursor-help underline decoration-dotted"
                >
                  IxWiki
                </a>
              </Tooltip>{" "}
              — the canonical source of truth.
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="border-border flex items-center justify-between border-t px-6 py-4">
          <div className="flex items-center gap-1.5">
            {Array.from({ length: totalPages }).map((_, i) => (
              <button
                key={i}
                type="button"
                aria-label={`Page ${i + 1} of ${totalPages}`}
                aria-current={i === currentPage ? "step" : undefined}
                onClick={() => setCurrentPage(i)}
                className={`h-1.5 rounded-full transition-[background-color,opacity] ${
                  i === currentPage
                    ? "w-5 bg-blue-500"
                    : "bg-muted-foreground/20 hover:bg-muted-foreground/40 w-1.5"
                }`}
              />
            ))}
          </div>

          <div className="flex items-center gap-2">
            {currentPage > 0 && (
              <Button variant="ghost" size="sm" onClick={() => setCurrentPage((p) => p - 1)}>
                <ChevronLeft aria-hidden />
                Back
              </Button>
            )}
            {currentPage < totalPages - 1 ? (
              <Button variant="secondary" size="sm" onClick={() => setCurrentPage((p) => p + 1)}>
                Next
                <ChevronRight aria-hidden />
              </Button>
            ) : (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    handleClose();
                    onStartTour?.();
                  }}
                >
                  <Compass aria-hidden />
                  Take a tour
                </Button>
                <Button
                  size="sm"
                  onClick={handleClose}
                  className="bg-blue-600 text-white hover:bg-blue-600/90"
                >
                  Start exploring
                  <Navigation aria-hidden />
                </Button>
              </>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
