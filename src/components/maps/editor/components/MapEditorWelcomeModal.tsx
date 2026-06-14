"use client";

import React, { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  X,
  Map,
  // eslint-disable-next-line unused-imports/no-unused-imports
  Compass,
  Layers,
  Keyboard,
  ChevronRight,
  ChevronLeft,
  Check,
  Zap,
  // eslint-disable-next-line unused-imports/no-unused-imports
  Globe,
  MapPin,
  Hexagon,
  Sparkles,
} from "lucide-react";
import { MAP_EDITOR_WELCOME_VERSION } from "~/lib/buildVersion";

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
    color: "text-blue-400",
    bg: "bg-blue-500/10",
    title: "Cities & POIs",
    description:
      "Drop pins to spawn cities, fortresses, or ports. Mark capitals, specify populations, and link them to wiki pages.",
  },
  {
    icon: Hexagon,
    color: "text-purple-400",
    bg: "bg-purple-500/10",
    title: "Regions & Boundaries",
    description:
      "Forge provinces and regional borders. Use automatic vertex simplification to keep boundaries clean and low-poly.",
  },
  {
    icon: Layers,
    color: "text-amber-400",
    bg: "bg-amber-500/10",
    title: "Unified Layers Tree",
    description:
      "Manage global visibility, opacity, and locks, then expand layer folders to view and edit individual features.",
  },
  {
    icon: Sparkles,
    color: "text-emerald-400",
    bg: "bg-emerald-500/10",
    title: "Terrain Awareness",
    description:
      "Get real-time feedback on climate zone, elevation, and terrain suitability as you click or sketch routes.",
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
    } catch (_) {}
  }, [forceShow]);

  const handleClose = useCallback(() => {
    setShow(false);
    onClose?.();
    try {
      localStorage.setItem(STORAGE_KEY, MAP_EDITOR_WELCOME_VERSION);
    } catch (_) {}
  }, [onClose]);

  const totalPages = 3; // Tips, Shortcuts, Changelog

  if (!show && !isOpen) return null;

  const isModalOpen = isOpen ?? show;

  return (
    <AnimatePresence>
      {isModalOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            key="editor-welcome-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-[9999] bg-black/50 backdrop-blur-sm"
            onClick={handleClose}
          />

          {/* Modal Card */}
          <motion.div
            key="editor-welcome-modal"
            initial={{ opacity: 0, scale: 0.95, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            className="fixed top-1/2 left-1/2 z-[10000] w-full max-w-lg -translate-x-1/2 -translate-y-1/2 p-4"
          >
            <div className="border-border bg-card text-card-foreground relative flex flex-col overflow-hidden rounded-xl border shadow-2xl">
              {/* Close Button */}
              <button
                onClick={handleClose}
                className="text-muted-foreground/70 hover:bg-accent hover:text-foreground absolute top-3.5 right-3.5 z-10 rounded-lg p-1.5 transition-colors"
              >
                <X className="h-4 w-4" />
              </button>

              {/* Header */}
              <div className="relative px-6 pt-6 pb-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-purple-500 shadow-md">
                    <Map className="h-4.5 w-4.5 text-white" />
                  </div>
                  <div>
                    <h2 className="text-foreground text-sm font-bold sm:text-base">
                      Map Editor Onboarding
                    </h2>
                    <p className="text-muted-foreground text-[11px] sm:text-xs">
                      Forge the geography, borders, and features of IxWorld
                    </p>
                  </div>
                </div>
              </div>

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
                      className="grid grid-cols-2 gap-2.5"
                    >
                      {TIPS.map((tip) => {
                        const Icon = tip.icon;
                        return (
                          <div
                            key={tip.title}
                            className={`border-border/40 rounded-lg border ${tip.bg} hover:border-border/80 flex flex-col gap-1 p-2.5 transition-colors`}
                          >
                            <div className="flex items-center gap-1.5">
                              <Icon className={`h-3.5 w-3.5 ${tip.color}`} />
                              <span className="text-foreground text-xs font-semibold">
                                {tip.title}
                              </span>
                            </div>
                            <p className="text-muted-foreground text-[10.5px] leading-relaxed">
                              {tip.description}
                            </p>
                          </div>
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
                      className="space-y-1.5"
                    >
                      <h3 className="text-muted-foreground mb-2 flex items-center gap-1.5 text-xs font-semibold tracking-wider uppercase">
                        <Keyboard className="h-3.5 w-3.5" />
                        Editor Shortcuts
                      </h3>
                      <div className="grid grid-cols-1 gap-1 sm:grid-cols-2">
                        {SHORTCUTS.map((s) => (
                          <div
                            key={s.action}
                            className="bg-muted/30 border-border/40 flex items-center justify-between rounded-lg border px-3 py-1.5"
                          >
                            <span className="text-muted-foreground text-[11px] font-medium">
                              {s.action}
                            </span>
                            <kbd className="bg-muted text-foreground/90 border-border/50 inline-flex h-5 items-center justify-center rounded border px-1.5 font-mono text-[10px]">
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
                      <h3 className="text-muted-foreground mb-1 flex items-center gap-1.5 text-xs font-semibold tracking-wider uppercase">
                        <Zap className="h-3.5 w-3.5 text-amber-500" />
                        Changelog & Updates
                      </h3>
                      <div className="max-h-[260px] scrollbar-thin space-y-2 overflow-y-auto pr-1">
                        {CHANGELOG.map((item) => (
                          <div
                            key={item.title}
                            className="bg-muted/20 border-border/30 flex flex-col gap-0.5 rounded-lg border p-2 text-left"
                          >
                            <div className="flex items-center justify-between">
                              <span className="text-foreground text-[11px] font-bold">
                                {item.title}
                              </span>
                              <span className="text-primary font-mono text-[9px] font-semibold">
                                {item.version}
                              </span>
                            </div>
                            <p className="text-muted-foreground text-[10px] leading-relaxed">
                              {item.desc}
                            </p>
                          </div>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Footer */}
              <div className="border-border bg-muted/25 flex items-center justify-between border-t px-6 py-3.5">
                {/* Dots indicator */}
                <div className="flex items-center gap-1.5">
                  {Array.from({ length: totalPages }).map((_, i) => (
                    <button
                      key={i}
                      onClick={() => setCurrentPage(i)}
                      className={`h-1.5 rounded-full transition-all ${
                        i === currentPage
                          ? "bg-primary w-4"
                          : "bg-muted-foreground/30 hover:bg-muted-foreground/50 w-1.5"
                      }`}
                    />
                  ))}
                </div>

                {/* Nav buttons */}
                <div className="flex items-center gap-2">
                  {currentPage > 0 && (
                    <button
                      onClick={() => setCurrentPage((p) => p - 1)}
                      className="text-muted-foreground hover:bg-accent hover:text-foreground flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs transition-colors"
                    >
                      <ChevronLeft className="h-3 w-3" />
                      Back
                    </button>
                  )}
                  {currentPage < totalPages - 1 ? (
                    <button
                      onClick={() => setCurrentPage((p) => p + 1)}
                      className="bg-primary/10 text-primary hover:bg-primary/15 flex items-center gap-1 rounded-lg px-3 py-1 text-xs font-semibold transition-colors"
                    >
                      Next
                      <ChevronRight className="h-3 w-3" />
                    </button>
                  ) : (
                    <button
                      onClick={handleClose}
                      className="bg-primary text-primary-foreground hover:bg-primary/90 flex items-center gap-1 rounded-lg px-4 py-1 text-xs font-semibold transition-colors"
                    >
                      Got it
                      <Check className="h-3 w-3" />
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
