"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { AnimatePresence } from "motion/react";
import {
  Globe,
  Component as Layers,
  Ruler,
  MapPin,
  Keyframe as Keyboard,
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
import { IxTime } from "~/lib/ixtime";
import { IXWORLD_VERSION } from "~/lib/buildVersion";
import { DEFAULT_MEDIAWIKI_URL } from "~/lib/wiki-os/config";
import { Card } from "~/components/ui/card";
import { SlidePage, TipCard, WelcomeFooter } from "~/components/maps/shared/WelcomeDialogParts";

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
      "Click any country to view its profile: territory, provinces, neighbors and demographics. Each nation links to its full wiki entry.",
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
      "Activate the pin tool and drop it anywhere. Get a full readout: elevation, climate, controlling nation and nearby points of interest.",
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

const TOTAL_PAGES = 2; // Tips page + Shortcuts page

/** Shortcuts page. */
function ShortcutsPage() {
  return (
    <SlidePage from="right">
      <h3 className="text-label text-headline mb-3 flex items-center gap-2">
        <Keyboard className="text-label-secondary h-4 w-4" aria-hidden />
        Keyboard shortcuts
      </h3>
      <div>
        {SHORTCUTS.map((s) => (
          <div
            key={s.action}
            className="border-separator flex items-center justify-between border-b px-1 py-2 last:border-b-0"
          >
            <span className="text-label-secondary text-footnote">{s.action}</span>
            <div className="flex items-center gap-1">
              {s.keys.map((k) => (
                <kbd
                  key={k}
                  className="bg-fill-3 text-label border-separator text-footnote rounded-control-sm inline-flex h-5 min-w-[22px] items-center justify-center border px-2 tabular-nums"
                >
                  {k}
                </kbd>
              ))}
            </div>
          </div>
        ))}
      </div>

      <Card variant="well" className="mt-4 p-3">
        <div className="mb-1 flex items-center gap-2">
          <Compass className="text-blue h-4 w-4" aria-hidden />
          <h4 className="text-label text-headline">Tip</h4>
        </div>
        <p className="text-label-secondary text-footnote">
          Everything on this map connects to a living wiki. Hover any country or place name for an
          instant preview, or click through to read the full article.
        </p>
      </Card>
    </SlidePage>
  );
}

const TERM_CLASS = "text-label-secondary cursor-help underline decoration-dotted";

const CLIMATE_SWATCHES = [
  ["bg-red", "Tropical Wet (Ar)"],
  ["bg-yellow", "Steppe (Bs)"],
  ["bg-green/70", "Temperate Oceanic (Do)"],
  ["bg-cyan", "Continental (Dc)"],
  ["bg-fill", "Highland (H)"],
  ["bg-blue", "Boreal (E)"],
];

function WorldNotes({ currentIxTime }: { currentIxTime: string }) {
  return (
    <div className="text-label-secondary text-footnote space-y-2 leading-relaxed">
      <div>
        IxWorld runs on{" "}
        <Tooltip
          content={
            <div className="text-footnote space-y-2">
              <p className="font-semibold">Current IxTime</p>
              <p className="text-blue tabular-nums">{currentIxTime}</p>
              <p className="text-label-secondary">
                The in-world clock runs at 2x real time. One real day = two in-game days. All
                economic cycles, elections, and events follow this clock.
              </p>
            </div>
          }
        >
          <strong className={TERM_CLASS}>IxTime</strong>
        </Tooltip>{" "}
        is the in-world clock, which moves at 2x real time.
      </div>
      <div>
        The world uses a{" "}
        <Tooltip
          content={
            <div className="text-footnote space-y-2">
              <p className="font-semibold">Trewartha climate system</p>
              <div className="text-footnote grid grid-cols-2 gap-x-3 gap-y-0.5">
                {CLIMATE_SWATCHES.map(([color, label]) => (
                  <span key={label}>
                    <span className={`${color} mr-1 inline-block h-2 w-2 rounded-full`} />
                    {label}
                  </span>
                ))}
              </div>
              <p className="text-label-secondary">
                12 climate zones and 9 elevation bands. Climate affects agriculture, GDP modifiers,
                crisis risk, and NPC behavior.
              </p>
            </div>
          }
        >
          <strong className={TERM_CLASS}>Trewartha climate system</strong>
        </Tooltip>{" "}
        with 12 zones and 9 elevation bands.
      </div>
      <div>
        All lore originates from{" "}
        <Tooltip
          content={
            <div className="text-footnote space-y-2">
              <p className="font-semibold">IxWiki</p>
              <p className="text-label-secondary">
                The collaborative wiki is the canonical source of truth. Country articles,
                infoboxes, and coordinates feed directly into the map and stats engine. Edits on the
                wiki are reflected here automatically.
              </p>
            </div>
          }
        >
          <a
            href={DEFAULT_MEDIAWIKI_URL}
            target="_blank"
            rel="noopener"
            className={`hover:text-label ${TERM_CLASS}`}
          >
            IxWiki
          </a>
        </Tooltip>{" "}
        is the canonical source of truth.
      </div>
    </div>
  );
}

export function MapWelcomeModal({
  isMapReady,
  onStartTour,
  isOpen,
  onClose,
}: MapWelcomeModalProps) {
  const [show, setShow] = useState(false);
  const [currentPage, setCurrentPage] = useState(0);

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
      return IxTime.formatIxTime(IxTime.getCurrentIxTime(), true);
    } catch {
      return "—";
    }
  }, []);

  useEffect(() => {
    if (!isMapReady) return;
    try {
      // Re-show on new versions (user sees what's new)
      if (localStorage.getItem(STORAGE_KEY) !== IXWORLD_VERSION) {
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

  if (!show) return null;

  return (
    <Dialog open={show} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="rounded-card gap-0 overflow-hidden p-0 sm:max-w-lg">
        <DialogHeader className="flex-row items-center justify-between gap-3 px-6 pt-6 pr-12 pb-4 text-left">
          <div className="flex items-center gap-3">
            <Globe className="text-blue h-6 w-6 shrink-0" aria-hidden />
            <div>
              <DialogTitle>Welcome to IxMaps</DialogTitle>
              <DialogDescription className="text-footnote">
                Explore an interactive & collaborative worldbuilding map
              </DialogDescription>
            </div>
          </div>
          <Badge variant="default" className="tabular-nums">
            v{IXWORLD_VERSION}
          </Badge>
        </DialogHeader>

        <div className="px-6 pb-2">
          <AnimatePresence mode="wait">
            {currentPage === 0 && (
              <SlidePage key="tips" from="left" className="grid grid-cols-2 gap-2">
                {TIPS.map((tip) => (
                  <TipCard key={tip.title} {...tip} />
                ))}
              </SlidePage>
            )}
            {currentPage === 1 && <ShortcutsPage key="shortcuts" />}
          </AnimatePresence>
        </div>

        <div className="px-6 pb-2">
          <WorldNotes currentIxTime={currentIxTime} />
        </div>

        <WelcomeFooter
          page={currentPage}
          totalPages={TOTAL_PAGES}
          onPageChange={setCurrentPage}
          finalActions={
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
                className="bg-blue text-on-blue hover:bg-blue/90"
              >
                Start exploring
                <Navigation aria-hidden />
              </Button>
            </>
          }
        />
      </DialogContent>
    </Dialog>
  );
}
