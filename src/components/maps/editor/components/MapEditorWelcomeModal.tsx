"use client";

import React, { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Map,
  Component as Layers,
  Keyframe as Keyboard,
  NavArrowRight as ChevronRight,
  NavArrowLeft as ChevronLeft,
  Check,
  Flash as Zap,
  MapPin,
  Hexagon,
  Compass,
} from "iconoir-react";
import { MAP_EDITOR_WELCOME_VERSION } from "~/lib/buildVersion";
import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { Card } from "~/components/ui/card";

const STORAGE_KEY = "ixworld-editor-welcome-seen";

interface MapEditorWelcomeModalProps {
  isOpen?: boolean;
  onClose?: () => void;
  /** Force show (e.g. when clicking help icon) */
  forceShow?: boolean;
}

const TIPS = [
  {
    icon: MapPin,
    title: "Cities & POIs",
    description:
      "Drop pins to spawn cities, fortresses, or ports. Mark capitals, specify populations, and link them to wiki pages.",
  },
  {
    icon: Hexagon,
    title: "Regions & Boundaries",
    description:
      "Forge provinces and regional borders. Use automatic vertex simplification to keep boundaries clean and low-poly.",
  },
  {
    icon: Layers,
    title: "Unified Layers Tree",
    description:
      "Manage global visibility, opacity, and locks, then expand layer folders to view and edit individual features.",
  },
  {
    icon: Compass,
    title: "Terrain Awareness",
    description:
      "Get feedback on climate zone, elevation, and terrain suitability as you click or sketch routes.",
  },
];

const SHORTCUTS = [
  { keys: ["V"], action: "Selection / Select tool" },
  { keys: ["C"], action: "Create City tool" },
  { keys: ["R"], action: "Create Region tool" },
  { keys: ["P"], action: "Create POI tool" },
  { keys: ["T"], action: "Create Route tool" },
  { keys: ["B"], action: "Paint Terrain tool" },
  { keys: ["G"], action: "Toggle grid view" },
];

const CHANGELOG = [
  {
    version: "v2.4",
    title: "Bulk City Importer",
    desc: "Upload a CSV, TSV, or JSON file to create many cities at once. Coordinates are validated inside your borders and any rows that need fixing are flagged before you commit.",
  },
  {
    version: "v2.3",
    title: "Auto-Derived City Elevation & Region Area",
    desc: "City elevation now fills in from the terrain zone and region area from the drawn geometry. Click the Auto button to derive a value. Manual overrides are still accepted.",
  },
  {
    version: "v2.2",
    title: "Toolbar Consolidation",
    desc: "Moved the Network view, Snap toggle, Grid, and Center controls into the editor toolbar for a cleaner canvas, with Gen Transport and Recalc tucked into Settings.",
  },
  {
    version: "v2.1",
    title: "Hierarchical Layers Tree",
    desc: "Merged the old Layers and Features tabs into a single unified tree view. Click to expand layer groups and select child features directly.",
  },
  {
    version: "v2.0",
    title: "Dialog-based Province Importer",
    desc: "Migrated the GeoJSON Province Import Wizard into a standard modal overlay instead of blocking the sidebars.",
  },
  {
    version: "v1.9",
    title: "Clean Popover Settings",
    desc: "Swapped the settings popover to a solid, non-glass card layout and stripped redundant climate zone controls.",
  },
  {
    version: "v1.8",
    title: "Toolbar De-duplication",
    desc: "De-duplicated the rivers and elevation display layer controls on the header to save space for Forge buttons.",
  },
];

export function MapEditorWelcomeModal({
  isOpen,
  onClose,
  forceShow = false,
}: MapEditorWelcomeModalProps) {
  const [show, setShow] = useState(false);
  const [currentPage, setCurrentPage] = useState(0);

  useEffect(() => {
    if (forceShow) {
      // oxlint-disable-next-line
      setShow(true);
      setCurrentPage(0);
      return;
    }

    try {
      const seen = localStorage.getItem(STORAGE_KEY);
      if (!seen || seen !== MAP_EDITOR_WELCOME_VERSION) {
        const timer = setTimeout(() => setShow(true), 500);
        return () => clearTimeout(timer);
      }
    } catch {
      // storage unavailable (private mode) — welcome modal not shown
    }
    return;
  }, [forceShow]);

  const handleClose = useCallback(() => {
    setShow(false);
    onClose?.();
    try {
      localStorage.setItem(STORAGE_KEY, MAP_EDITOR_WELCOME_VERSION);
    } catch {
      // storage unavailable (private mode) — preference is not persisted
    }
  }, [onClose]);

  const totalPages = 3; // Tips, Shortcuts, Changelog

  if (!show && !isOpen) return null;

  const isModalOpen = isOpen ?? show;

  return (
    <Dialog open={isModalOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="rounded-card flex flex-col gap-0 overflow-hidden p-0 sm:max-w-lg">
        {/* Header */}
        <DialogHeader className="flex-row items-center gap-3 px-6 pt-6 pr-12 pb-4 text-left">
          <Map className="text-blue h-6 w-6 shrink-0" aria-hidden />
          <div>
            <DialogTitle className="text-body sm:text-body">Map editor onboarding</DialogTitle>
            <DialogDescription className="text-footnote">
              Forge the geography, borders, and features of IxWorld
            </DialogDescription>
          </div>
        </DialogHeader>

        {/* Content Area */}
        <div className="flex min-h-[290px] flex-col justify-start px-6 pb-4">
          <AnimatePresence mode="wait">
            {currentPage === 0 && (
              <motion.div
                key="tips-page"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
                transition={{ duration: 0.15 }}
                className="grid grid-cols-2 gap-2"
              >
                {TIPS.map((tip) => {
                  const Icon = tip.icon;
                  return (
                    <Card variant="inset" key={tip.title} className="flex flex-col gap-1 p-2">
                      <div className="flex items-center gap-2">
                        <Icon className="text-blue h-4 w-4" aria-hidden />
                        <h3 className="text-label text-headline">{tip.title}</h3>
                      </div>
                      <p className="text-label-secondary text-footnote leading-relaxed">
                        {tip.description}
                      </p>
                    </Card>
                  );
                })}
              </motion.div>
            )}

            {currentPage === 1 && (
              <motion.div
                key="shortcuts-page"
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                transition={{ duration: 0.15 }}
                className="space-y-2"
              >
                <h3 className="text-label text-headline mb-2 flex items-center gap-2">
                  <Keyboard className="text-label-secondary h-4 w-4" aria-hidden />
                  Editor shortcuts
                </h3>
                <div className="grid grid-cols-1 gap-1 sm:grid-cols-2">
                  {SHORTCUTS.map((s) => (
                    <div
                      key={s.action}
                      className="border-separator rounded-control flex items-center justify-between border px-3 py-2"
                    >
                      <span className="text-label-secondary text-caption">{s.action}</span>
                      <kbd className="bg-fill-3 text-label border-separator text-footnote rounded-control-sm inline-flex h-5 items-center justify-center border px-2 tabular-nums">
                        {s.keys[0]}
                      </kbd>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}

            {currentPage === 2 && (
              <motion.div
                key="changelog-page"
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                transition={{ duration: 0.15 }}
                className="space-y-2"
              >
                <h3 className="text-label text-headline mb-1 flex items-center gap-2">
                  <Zap className="text-label-secondary h-4 w-4" aria-hidden />
                  Changelog & updates
                </h3>
                <div className="max-h-[260px] scrollbar-thin space-y-2 overflow-y-auto pr-1">
                  {CHANGELOG.map((item) => (
                    <Card
                      variant="inset"
                      key={item.title}
                      className="flex flex-col gap-0.5 p-2 text-left"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-label text-caption font-semibold">{item.title}</span>
                        <span className="text-tint text-caption font-semibold tabular-nums">
                          {item.version}
                        </span>
                      </div>
                      <p className="text-label-secondary text-footnote leading-relaxed">
                        {item.desc}
                      </p>
                    </Card>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Footer */}
        <div className="border-separator flex items-center justify-between border-t px-6 py-4">
          {/* Dots indicator */}
          <div className="flex items-center gap-2">
            {Array.from({ length: totalPages }).map((_, i) => (
              <button
                key={i}
                type="button"
                aria-label={`Page ${i + 1} of ${totalPages}`}
                aria-current={i === currentPage ? "step" : undefined}
                onClick={() => setCurrentPage(i)}
                className={`h-1.5 rounded-full transition-[background-color,opacity] ${
                  i === currentPage ? "bg-blue w-4" : "bg-fill-2 hover:bg-fill w-1.5"
                }`}
              />
            ))}
          </div>

          {/* Nav buttons */}
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
              <Button size="sm" onClick={handleClose}>
                Got it
                <Check aria-hidden />
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
