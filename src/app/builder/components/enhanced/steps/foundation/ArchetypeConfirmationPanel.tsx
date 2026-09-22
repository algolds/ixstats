"use client";

import React from "react";
import { motion, AnimatePresence } from "motion/react";
import { Trophy as Award, UserBadgeCheck as UserCheck } from "iconoir-react";
import { Button } from "~/components/ui/button";
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
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 10 }}
          className="fixed right-0 bottom-6 left-0 z-50 flex justify-center px-4"
        >
          <div className="flex w-full max-w-2xl items-center justify-between gap-6 rounded-xl border border-border/40 bg-background/95 px-6 py-4 shadow-[0_8px_32px_rgba(0,0,0,0.5)] backdrop-blur-xl">
            <div className="space-y-1">
              <div className="flex items-center gap-1.5">
                <Award className="h-4 w-4 text-amber-400" />
                <span className="text-xs text-muted-foreground">
                  Selected Archetype
                </span>
              </div>
              <h4 className="text-sm leading-none font-bold text-foreground">
                {selectedArchetype.name}
              </h4>
            </div>

            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={onClearSelection}
                className="border-border/40 text-xs text-muted-foreground hover:text-foreground active:scale-[0.98]"
                data-cuelume-press
              >
                Clear Selection
              </Button>
              <Button
                onClick={onConfirmFaction}
                className="bg-gradient-to-r from-amber-500 to-yellow-500 text-xs font-bold text-foreground shadow-md shadow-amber-500/20 hover:from-amber-400 hover:to-yellow-400 active:scale-[0.98]"
                data-cuelume-press
              >
                <UserCheck className="mr-1.5 h-4 w-4 stroke-[2.5]" /> Apply Model & Continue
              </Button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
