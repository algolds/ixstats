"use client";

import React from "react";
import { motion } from "motion/react";
import { GlassCard, GlassCardContent } from "~/app/builder/components/glass/GlassCard";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { Plus, Info } from "lucide-react";
import { SECTOR_TEMPLATES, type SectorConstraint } from "../utils/sectorCalculations";
import type { SectorConfiguration } from "~/types/economy-builder";

interface SectorTemplateSelectorProps {
  existingSectors: SectorConfiguration[];
  sectorConstraints?: Record<string, SectorConstraint>;
  onAddSector: (sectorType: string) => void;
}

export function SectorTemplateSelector({
  existingSectors,
  sectorConstraints = {},
  onAddSector,
}: SectorTemplateSelectorProps) {
  const hasActiveConstraints = Object.values(sectorConstraints).some(
    (c) => c.locked || c.recommended
  );

  return (
    <GlassCard depth="base" theme="emerald" className="border-emerald-500/20" texture="chevron" textureOpacity={0.04}>
      <GlassCardContent className="p-6">
        <h3 className="mb-4 flex items-center justify-between text-lg font-bold text-emerald-500 dark:text-emerald-400">
          <span className="flex items-center space-x-2">
            <Plus className="h-5 w-5" />
            <span>Add Economic Sectors</span>
          </span>
          <Badge variant="outline">{existingSectors.length} Active</Badge>
        </h3>
        <div className="space-y-4">
          <p className="text-muted-foreground text-sm">
            Select sector templates to build your economy. Each sector comes with recommended
            characteristics that you can customize.
          </p>

          {hasActiveConstraints && (
            <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-3 py-2 text-xs text-emerald-600 dark:text-emerald-400">
              Component selections are affecting sector availability. Locked sectors are
              incompatible with your chosen components.
            </div>
          )}

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {Object.entries(SECTOR_TEMPLATES).map(([sectorType, template]) => {
              const Icon = template.icon;
              const isAlreadyAdded = existingSectors.some((s) => s.id.startsWith(sectorType));
              const constraint = sectorConstraints[sectorType];
              const isLocked = constraint?.locked && !isAlreadyAdded;

              return (
                <motion.div
                  key={sectorType}
                  whileHover={{ scale: isAlreadyAdded || isLocked ? 1 : 1.02 }}
                  className={`relative ${isAlreadyAdded ? "opacity-50" : ""} ${isLocked ? "opacity-40" : ""}`}
                >
                  <Button
                    variant="outline"
                    onClick={() => !isLocked && onAddSector(sectorType)}
                    disabled={isAlreadyAdded || isLocked}
                    className={`flex h-auto w-full flex-col items-start space-y-2 p-4 ${
                      isLocked
                        ? "cursor-not-allowed border-red-500/30"
                        : constraint?.recommended && !isAlreadyAdded
                          ? "border-emerald-500/50"
                          : ""
                    }`}
                  >
                    <div className="flex w-full items-center space-x-3">
                      <div
                        className={`rounded-lg p-2 bg-${template.color}-100/10 dark:bg-${template.color}-900/20`}
                      >
                        <Icon
                          className={`h-5 w-5 text-${template.color}-600 dark:text-${template.color}-400`}
                        />
                      </div>
                      <div className="flex-1 text-left">
                        <div className="font-semibold">{template.name}</div>
                        <div className="text-muted-foreground text-xs">
                          {template.baseContribution}% base contribution
                        </div>
                      </div>
                      {isLocked && (
                        <Badge variant="secondary" className="bg-red-500/10 text-red-600 dark:text-red-400">
                          Locked
                        </Badge>
                      )}
                      {constraint?.recommended && !isAlreadyAdded && !isLocked && (
                        <Badge variant="default" className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                          Recommended
                        </Badge>
                      )}
                    </div>

                    <div className="text-muted-foreground text-left text-xs">
                      {template.description}
                    </div>

                    {isLocked && constraint.lockedBy.length > 0 && (
                      <div className="text-left text-[10px] text-red-500">
                        Incompatible with: {constraint.lockedBy.join(", ")}
                      </div>
                    )}

                    {constraint?.recommended && !isLocked && constraint.recommendedBy.length > 0 && (
                      <div className="text-left text-[10px] text-emerald-500">
                        Recommended by: {constraint.recommendedBy.join(", ")}
                      </div>
                    )}

                    <div className="flex flex-wrap gap-1">
                      {template.characteristics.map((char, idx) => (
                        <Badge key={idx} variant="secondary" className="text-xs">
                          {char}
                        </Badge>
                      ))}
                    </div>
                  </Button>

                  {isAlreadyAdded && (
                    <div className="absolute top-2 right-2">
                      <Badge variant="default" className="text-xs">
                        Added
                      </Badge>
                    </div>
                  )}
                </motion.div>
              );
            })}
          </div>

          <div className="flex items-start space-x-2 rounded-lg border border-zinc-800/40 bg-zinc-900/40 p-3">
            <Info className="mt-0.5 h-4 w-4 text-emerald-500 dark:text-emerald-400" />
            <div className="text-xs text-zinc-300">
              <strong>Tip:</strong> Add multiple sectors to create a diverse economy. Each sector
              can be customized with specific characteristics after adding.
            </div>
          </div>
        </div>
      </GlassCardContent>
    </GlassCard>
  );
}
