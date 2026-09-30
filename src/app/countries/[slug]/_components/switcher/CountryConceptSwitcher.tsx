"use client";

import React, { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Check, NavArrowDown, NavArrowUp, OpenBook, Page, ViewGrid } from "iconoir-react";
import { FacetMaterial } from "~/components/ui/facet";
import { springSmooth, tweenExit } from "~/lib/design/motion";
import { cn } from "~/lib/utils/cn";

/**
 * The profile layouts under comparison. "chronicle" and "command" are the two real-data
 * prototypes; "standard" is the tabbed Factbook (which stays as the deep-dive).
 */
export type ProfileConcept = "chronicle" | "command" | "standard";

export const PROFILE_CONCEPTS: readonly ProfileConcept[] = ["chronicle", "command", "standard"];

export function isProfileConcept(value: unknown): value is ProfileConcept {
  return typeof value === "string" && (PROFILE_CONCEPTS as readonly string[]).includes(value);
}

interface CountryConceptSwitcherProps {
  activeConcept: ProfileConcept;
  onSelectConcept: (concept: ProfileConcept) => void;
}

const CONCEPTS: { id: ProfileConcept; label: string; tag: string; icon: typeof ViewGrid }[] = [
  {
    id: "chronicle",
    label: "Prototype A · Chronicle",
    tag: "Editorial chapters + command rail",
    icon: OpenBook,
  },
  {
    id: "command",
    label: "Prototype B · Command",
    tag: "Dashboard tiles + domain dock",
    icon: ViewGrid,
  },
  { id: "standard", label: "Factbook", tag: "Tabbed deep-dive", icon: Page },
];

/** Floating layout switcher (chrome, so glass) for comparing the prototypes. Alt+1..3. */
export function CountryConceptSwitcher({
  activeConcept,
  onSelectConcept,
}: CountryConceptSwitcherProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!e.altKey) return;
      const index = ["1", "2", "3"].indexOf(e.key);
      if (index >= 0) onSelectConcept(CONCEPTS[index]!.id);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onSelectConcept]);

  const current = CONCEPTS.find((c) => c.id === activeConcept) ?? CONCEPTS[0]!;
  const CurrentIcon = current.icon;

  return (
    <div className="fixed right-6 bottom-[calc(var(--shell-tabbar-height,0px)+1.5rem)] z-(--z-navigation) flex flex-col items-end gap-3">
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1, transition: springSmooth }}
            exit={{ opacity: 0, y: 8, scale: 0.96, transition: tweenExit }}
          >
            <FacetMaterial
              material="thick"
              className="rounded-card shadow-floating w-80 p-2"
              id="profile-layout-options"
            >
              <div className="flex items-center justify-between px-2 pt-1 pb-2">
                <span className="text-subhead text-label-secondary">Profile layout</span>
                <span className="text-footnote text-label-tertiary">Alt + 1–3</span>
              </div>
              <ul className="flex flex-col gap-1">
                {CONCEPTS.map((concept, index) => {
                  const Icon = concept.icon;
                  const isSelected = activeConcept === concept.id;
                  return (
                    <li key={concept.id}>
                      <button
                        type="button"
                        aria-pressed={isSelected}
                        onClick={() => {
                          onSelectConcept(concept.id);
                          setIsExpanded(false);
                        }}
                        className={cn(
                          "rounded-row focus-visible:outline-tint duration-fast flex w-full items-center gap-3 p-2 text-left transition-colors focus-visible:outline-2 focus-visible:-outline-offset-2",
                          isSelected ? "bg-tint-fill" : "hover:bg-fill-4"
                        )}
                      >
                        <span
                          aria-hidden
                          className={cn(
                            "rounded-control-sm flex size-8 shrink-0 items-center justify-center",
                            isSelected ? "bg-tint text-on-tint" : "bg-fill-3 text-label-secondary"
                          )}
                        >
                          <Icon className="size-4" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="text-headline text-label block">{concept.label}</span>
                          <span className="text-footnote text-label-secondary block">
                            {concept.tag}
                          </span>
                        </span>
                        <span className="text-footnote text-label-tertiary tabular-nums">
                          ⌥{index + 1}
                        </span>
                        {isSelected && <Check aria-hidden className="text-tint size-4" />}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </FacetMaterial>
          </motion.div>
        )}
      </AnimatePresence>

      <FacetMaterial material="regular" className="shadow-floating rounded-full">
        <button
          type="button"
          onClick={() => setIsExpanded((v) => !v)}
          aria-expanded={isExpanded}
          aria-controls="profile-layout-options"
          className="text-headline text-label focus-visible:outline-tint flex items-center gap-2 rounded-full px-4 py-2 focus-visible:outline-2 focus-visible:-outline-offset-2 active:scale-[0.98] motion-reduce:active:scale-100"
        >
          <CurrentIcon aria-hidden className="text-tint size-4" />
          {current.label}
          {isExpanded ? (
            <NavArrowDown aria-hidden className="text-label-secondary size-4" />
          ) : (
            <NavArrowUp aria-hidden className="text-label-secondary size-4" />
          )}
        </button>
      </FacetMaterial>
    </div>
  );
}
