"use client";

import React from "react";
import { motion } from "framer-motion";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import {
  Settings,
  Minus,
  DollarSign,
  Users,
  TrendingUp,
  Globe,
  Zap,
  Leaf,
  Target,
} from "lucide-react";
import { EnhancedSlider } from "../../../../primitives/enhanced";
import { SECTOR_TEMPLATES } from "../utils/sectorCalculations";
import type { SectorConfiguration } from "~/types/economy-builder";

interface SectorEditorProps {
  sector: SectorConfiguration;
  index: number;
  isSelected: boolean;
  showAdvanced: boolean;
  componentImpact: number;
  affectingComponents?: Array<{ name: string; impact: number }>;
  effectiveGDP?: number;
  effectiveEmployment?: number;
  onToggleSelect: () => void;
  onRemove: () => void;
  onChange: (field: keyof SectorConfiguration, value: any) => void;
}

export function SectorEditor({
  sector,
  index,
  isSelected,
  showAdvanced,
  componentImpact,
  affectingComponents = [],
  effectiveGDP,
  effectiveEmployment,
  onToggleSelect,
  onRemove,
  onChange,
}: SectorEditorProps) {
  const sectorType = sector.id.split("_")[0] as keyof typeof SECTOR_TEMPLATES;
  const template = SECTOR_TEMPLATES[sectorType];
  const Icon = template?.icon || Target;

  // Determine if this sector is being boosted or penalized
  const isAffected = affectingComponents.length > 0;
  const isBoosted = componentImpact > 1.0;
  const isPenalized = componentImpact < 1.0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1 }}
      className={`rounded-lg border-2 p-4 transition-all ${
        isSelected
          ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20"
          : "border-gray-200 dark:border-gray-700"
      }`}
    >
      {/* Header */}
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div
            className={`rounded-lg p-2 bg-${template?.color || "gray"}-100 dark:bg-${
              template?.color || "gray"
            }-900/20`}
          >
            <Icon
              className={`h-5 w-5 text-${template?.color || "gray"}-600 dark:text-${
                template?.color || "gray"
              }-400`}
            />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-semibold">{sector.name}</h3>
              {isAffected && (
                <Badge
                  variant={isBoosted ? "default" : "secondary"}
                  className={
                    isBoosted
                      ? "bg-emerald-500 text-white"
                      : isPenalized
                        ? "bg-amber-500 text-white"
                        : ""
                  }
                >
                  <Zap className="mr-1 h-3 w-3" />
                  {isBoosted ? "+" : ""}
                  {((componentImpact - 1) * 100).toFixed(0)}%
                </Badge>
              )}
            </div>
            <p className="text-muted-foreground text-sm">{template?.description}</p>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <Badge variant="outline">{sector.category}</Badge>
          <Button size="sm" variant="ghost" onClick={onToggleSelect}>
            <Settings className="h-4 w-4" />
          </Button>
          <Button size="sm" variant="ghost" onClick={onRemove}>
            <Minus className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Component Impact Indicator */}
      {isAffected && (
        <div
          className={`mb-3 rounded-lg border p-3 ${
            isBoosted
              ? "border-emerald-200 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-900/20"
              : isPenalized
                ? "border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-900/20"
                : "border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-900/20"
          }`}
        >
          <div className="mb-2 flex items-center justify-between">
            <div className="flex items-center space-x-2 text-sm font-medium">
              <Zap
                className={`h-4 w-4 ${
                  isBoosted
                    ? "text-emerald-600 dark:text-emerald-400"
                    : isPenalized
                      ? "text-amber-600 dark:text-amber-400"
                      : "text-blue-600 dark:text-blue-400"
                }`}
              />
              <span>
                Atomic Component Impact: {isBoosted ? "+" : ""}
                {((componentImpact - 1) * 100).toFixed(1)}%
              </span>
            </div>
          </div>

          {/* List of affecting components */}
          {affectingComponents.length > 0 && (
            <div className="space-y-1">
              {affectingComponents.map((comp, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between rounded bg-white/50 px-2 py-1 text-xs dark:bg-black/20"
                >
                  <span className="font-medium">{comp.name}</span>
                  <span
                    className={`font-semibold ${
                      comp.impact > 1
                        ? "text-emerald-700 dark:text-emerald-400"
                        : comp.impact < 1
                          ? "text-amber-700 dark:text-amber-400"
                          : "text-gray-700 dark:text-gray-400"
                    }`}
                  >
                    {comp.impact > 1 ? "+" : ""}
                    {((comp.impact - 1) * 100).toFixed(0)}%
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Effective values display */}
          {(effectiveGDP !== undefined || effectiveEmployment !== undefined) && (
            <div className="mt-2 space-y-1 border-t border-current/20 pt-2 text-xs">
              {effectiveGDP !== undefined && sector.gdpContribution !== effectiveGDP && (
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Effective GDP Contribution:</span>
                  <span className="font-semibold">
                    {sector.gdpContribution.toFixed(1)}% → {effectiveGDP.toFixed(1)}%
                  </span>
                </div>
              )}
              {effectiveEmployment !== undefined &&
                sector.employmentShare !== effectiveEmployment && (
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Effective Employment Share:</span>
                    <span className="font-semibold">
                      {sector.employmentShare.toFixed(1)}% → {effectiveEmployment.toFixed(1)}%
                    </span>
                  </div>
                )}
            </div>
          )}
        </div>
      )}

      {/* Core Metrics */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <EnhancedSlider
          label="GDP Contribution"
          value={sector.gdpContribution}
          onChange={(value: number) => onChange("gdpContribution", value)}
          min={0}
          max={50}
          step={0.1}
          unit="%"
          sectionId="sectors"
          icon={DollarSign}
          showValue={true}
          showRange={true}
        />

        <EnhancedSlider
          label="Employment Share"
          value={sector.employmentShare}
          onChange={(value: number) => onChange("employmentShare", value)}
          min={0}
          max={50}
          step={0.1}
          unit="%"
          sectionId="sectors"
          icon={Users}
          showValue={true}
          showRange={true}
        />
      </div>

      {/* Advanced Controls */}
      {isSelected && showAdvanced && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          exit={{ opacity: 0, height: 0 }}
          className="mt-4 space-y-4 border-t pt-4"
        >
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <EnhancedSlider
              label="Productivity"
              value={sector.productivity}
              onChange={(value: number) => onChange("productivity", value)}
              min={0}
              max={100}
              step={1}
              unit="index"
              sectionId="sectors"
              icon={TrendingUp}
              showValue={true}
            />

            <EnhancedSlider
              label="Growth Rate"
              value={sector.growthRate}
              onChange={(value: number) => onChange("growthRate", value)}
              min={-5}
              max={15}
              step={0.1}
              unit="%"
              sectionId="sectors"
              icon={TrendingUp}
              showValue={true}
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <EnhancedSlider
              label="Export Ratio"
              value={sector.exports}
              onChange={(value: number) => onChange("exports", value)}
              min={0}
              max={80}
              step={1}
              unit="%"
              sectionId="sectors"
              icon={Globe}
              showValue={true}
            />

            <EnhancedSlider
              label="Automation Level"
              value={sector.automation}
              onChange={(value: number) => onChange("automation", value)}
              min={0}
              max={100}
              step={1}
              unit="%"
              sectionId="sectors"
              icon={Zap}
              showValue={true}
            />
          </div>

          <div className="grid grid-cols-1 gap-4">
            <EnhancedSlider
              label="Innovation"
              value={sector.innovation}
              onChange={(value: number) => onChange("innovation", value)}
              min={0}
              max={100}
              step={1}
              unit="index"
              sectionId="sectors"
              icon={Zap}
              showValue={true}
            />

            <EnhancedSlider
              label="Sustainability"
              value={sector.sustainability}
              onChange={(value: number) => onChange("sustainability", value)}
              min={0}
              max={100}
              step={1}
              unit="index"
              sectionId="sectors"
              icon={Leaf}
              showValue={true}
            />

            <EnhancedSlider
              label="Competitiveness"
              value={sector.competitiveness}
              onChange={(value: number) => onChange("competitiveness", value)}
              min={0}
              max={100}
              step={1}
              unit="index"
              sectionId="sectors"
              icon={Target}
              showValue={true}
            />
          </div>
        </motion.div>
      )}
    </motion.div>
  );
}
