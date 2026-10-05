"use client";

import React from "react";
import { motion, AnimatePresence } from "motion/react";
import { Trophy as Award, UserBadgeCheck as UserCheck } from "iconoir-react";
import { Button } from "~/components/ui/button";
import { FacetMaterial } from "~/components/ui/facet";
import { springSmooth, tweenExit } from "~/lib/design/motion";
import type { EconomicArchetype } from "~/lib/economy/archetypes/types";

interface ArchetypeConfirmationPanelProps {
  selectedArchetype: EconomicArchetype | null;
  onClearSelection: () => void;
  onConfirmFaction: () => void;
}

export function ArchetypeConfirmationPanel({
  selectedArchetype,
  onClearSelection,
  onConfirmFaction,
}: ArchetypeConfirmationPanelProps) {
  return (
    <AnimatePresence>
      {selectedArchetype && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0, transition: springSmooth }}
          exit={{ opacity: 0, y: 10, transition: tweenExit }}
          className="z-sticky fixed right-(--shell-inspector-width) bottom-[calc(var(--shell-tabbar-height)+1.5rem)] left-(--shell-sidebar-width) flex justify-center px-4"
        >
          <FacetMaterial
            layer="chrome"
            className="rounded-card shadow-floating flex w-full max-w-2xl items-center justify-between gap-6 px-6 py-4"
          >
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Award aria-hidden className="text-tint h-4 w-4" />
                <span className="text-footnote text-label-secondary">Selected archetype</span>
              </div>
              <h2 className="text-headline text-label">{selectedArchetype.name}</h2>
            </div>

            <div className="flex gap-3">
              <Button variant="outline" onClick={onClearSelection}>
                Clear selection
              </Button>
              <Button onClick={onConfirmFaction}>
                <UserCheck aria-hidden /> Apply model & continue
              </Button>
            </div>
          </FacetMaterial>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
