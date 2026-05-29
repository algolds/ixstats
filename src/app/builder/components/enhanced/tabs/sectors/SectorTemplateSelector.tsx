"use client";

import React from "react";
import { motion } from "motion/react";
import { CutoutCard, CutoutCardContent } from "~/components/ui/cutout-card";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { Plus, Info } from "lucide-react";
import { SECTOR_TEMPLATES } from "../utils/sectorCalculations";
import type { SectorConfiguration } from "~/types/economy-builder";

interface SectorTemplateSelectorProps {
  existingSectors: SectorConfiguration[];
  onAddSector: (sectorType: string) => void;
}

export function SectorTemplateSelector({
  existingSectors,
  onAddSector,
}: SectorTemplateSelectorProps) {
  return (
    <CutoutCard className="rounded-2xl border border-zinc-800 bg-zinc-950/40 shadow-lg backdrop-blur-md">
      <CutoutCardContent className="p-6">
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

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {Object.entries(SECTOR_TEMPLATES).map(([sectorType, template]) => {
              const Icon = template.icon;
              const isAlreadyAdded = existingSectors.some((s) => s.id.startsWith(sectorType));

              return (
                <motion.div
                  key={sectorType}
                  whileHover={{ scale: isAlreadyAdded ? 1 : 1.02 }}
                  className={`relative ${isAlreadyAdded ? "opacity-50" : ""}`}
                >
                  <Button
                    variant="outline"
                    onClick={() => onAddSector(sectorType)}
                    disabled={isAlreadyAdded}
                    className="flex h-auto w-full flex-col items-start space-y-2 p-4"
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
                    </div>

                    <div className="text-muted-foreground text-left text-xs">
                      {template.description}
                    </div>

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
      </CutoutCardContent>
    </CutoutCard>
  );
}
