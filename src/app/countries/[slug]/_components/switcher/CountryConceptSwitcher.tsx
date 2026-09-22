"use client";

import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Sparks as Sparkles,
  OpenBook as BookOpen,
  MapPin,
  ViewGrid,
  Settings,
  NavArrowUp,
  NavArrowDown,
  Check,
} from "iconoir-react";
import { cn } from "~/lib/utils";

export type ProfileConcept = "command" | "editorial" | "atlas" | "standard";

interface CountryConceptSwitcherProps {
  activeConcept: ProfileConcept;
  onSelectConcept: (concept: ProfileConcept) => void;
}

const CONCEPTS: { id: ProfileConcept; label: string; tag: string; icon: typeof Sparkles; color: string }[] = [
  {
    id: "command",
    label: "Sovereign Command OS",
    tag: "Concept 1 · Spatial Stream",
    icon: Sparkles,
    color: "text-sky-400",
  },
  {
    id: "editorial",
    label: "Editorial Chronicle",
    tag: "Concept 2 · Atlantic × Wiki",
    icon: BookOpen,
    color: "text-amber-400",
  },
  {
    id: "atlas",
    label: "Geospatial Atlas HUD",
    tag: "Concept 3 · Map Console",
    icon: MapPin,
    color: "text-emerald-400",
  },
  {
    id: "standard",
    label: "Standard Factbook",
    tag: "Legacy Tabbed Shell",
    icon: ViewGrid,
    color: "text-purple-400",
  },
];

export function CountryConceptSwitcher({
  activeConcept,
  onSelectConcept,
}: CountryConceptSwitcherProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  // Keyboard shortcut listener (Alt + 1..4)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.altKey && e.key === "1") onSelectConcept("command");
      if (e.altKey && e.key === "2") onSelectConcept("editorial");
      if (e.altKey && e.key === "3") onSelectConcept("atlas");
      if (e.altKey && e.key === "4") onSelectConcept("standard");
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onSelectConcept]);

  const current = CONCEPTS.find((c) => c.id === activeConcept) || CONCEPTS[0]!;
  const CurrentIcon = current.icon;

  return (
    <div className="fixed bottom-6 right-6 z-[100010]">
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            transition={{ type: "spring", bounce: 0, duration: 0.3 }}
            className="facet-surface facet-refraction mb-3 w-80 rounded-2xl border border-white/15 bg-background/90 p-3 shadow-2xl backdrop-blur-2xl"
          >
            <div className="mb-2 flex items-center justify-between border-b border-white/10 px-2 pb-2">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground">
                Switch Profile Experience
              </span>
              <span className="text-[10px] font-mono text-muted-foreground/80">Alt + 1..4</span>
            </div>

            <div className="space-y-1">
              {CONCEPTS.map((concept, index) => {
                const Icon = concept.icon;
                const isSelected = activeConcept === concept.id;

                return (
                  <button
                    key={concept.id}
                    type="button"
                    data-cuelume-press="soft"
                    onClick={() => {
                      onSelectConcept(concept.id);
                      setIsExpanded(false);
                    }}
                    className={cn(
                      "flex w-full items-center justify-between rounded-xl p-2.5 text-left transition-all duration-150 active:scale-[0.98]",
                      isSelected
                        ? "border border-white/15 bg-white/10 text-foreground shadow-sm"
                        : "text-muted-foreground hover:bg-white/5 hover:text-foreground"
                    )}
                  >
                    <div className="flex items-center gap-2.5">
                      <div
                        className={cn(
                          "flex h-7 w-7 items-center justify-center rounded-lg border border-white/10 bg-white/5",
                          concept.color
                        )}
                      >
                        <Icon className="h-4 w-4" />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-foreground">{concept.label}</p>
                        <p className="text-[10px] text-muted-foreground">{concept.tag}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] font-mono text-muted-foreground/60">
                        ⌥{index + 1}
                      </span>
                      {isSelected && <Check className="h-4 w-4 text-[var(--flag-primary)]" />}
                    </div>
                  </button>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Floating Pill Trigger */}
      <motion.button
        type="button"
        data-cuelume-press="soft"
        onClick={() => setIsExpanded(!isExpanded)}
        whileTap={{ scale: 0.95 }}
        className="facet-surface facet-refraction flex items-center gap-2.5 rounded-full border border-white/20 bg-background/80 px-4 py-2.5 shadow-2xl backdrop-blur-2xl transition-colors hover:border-white/30 hover:bg-background/90"
      >
        <CurrentIcon className={cn("h-4 w-4", current.color)} />
        <span className="text-xs font-bold text-foreground">{current.label}</span>
        <div className="flex h-5 w-5 items-center justify-center rounded-full bg-white/10 text-muted-foreground">
          {isExpanded ? <NavArrowDown className="h-3 w-3" /> : <NavArrowUp className="h-3 w-3" />}
        </div>
      </motion.button>
    </div>
  );
}
