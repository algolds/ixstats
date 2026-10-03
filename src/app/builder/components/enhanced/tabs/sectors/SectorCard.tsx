"use client";

import React from "react";
import { motion } from "motion/react";
import { Badge } from "~/components/ui/badge";
import {
  WarningCircle as AlertCircle,
  ArrowUpRight,
  Dollar as DollarSign,
  Group as Users,
  StatUp as TrendingUp,
  Globe,
  Flash as Zap,
  Leaf,
  Archery as TargetIcon,
  Minus,
} from "iconoir-react";
import { cn } from "~/lib/utils";
import type { SectorConfiguration } from "~/types/economy-builder";
import type { SectorTemplate, SectorConstraint } from "../utils/sectorCalculations";
import { SliderWithDirectInput } from "../../../../primitives/enhanced";
import { FieldIndicator } from "~/app/builder/primitives/FieldIndicator";
import { Button } from "~/components/ui/button";

interface SectorCardProps {
  sectorId: string;
  template: SectorTemplate;
  isActive: boolean;
  isLocked: boolean;
  lockedBy: string[];
  isRecommended: boolean;
  recommendedBy: string[];
  activeConfig?: SectorConfiguration;
  onToggle: () => void;
  showAdvanced?: boolean;
  componentImpact: number;
  affectingComponents?: Array<{ name: string; impact: number }>;
  effectiveGDP?: number;
  effectiveEmployment?: number;
  constraint?: SectorConstraint;
  onChange?: <K extends keyof SectorConfiguration>(field: K, value: SectorConfiguration[K]) => void;
  onCommit?: <K extends keyof SectorConfiguration>(field: K, value: SectorConfiguration[K]) => void;
}

export function SectorCard({
  // oxlint-disable-next-line eslint/no-unused-vars
  sectorId,
  template,
  isActive,
  isLocked,
  lockedBy = [],
  isRecommended,
  recommendedBy = [],
  activeConfig,
  onToggle,
  showAdvanced = false,
  componentImpact = 1.0,
  affectingComponents = [],
  effectiveGDP,
  effectiveEmployment,
  constraint,
  onChange,
  onCommit,
}: SectorCardProps) {
  const Icon = template.icon;
  const color = template.color || "emerald";

  // Class selection based on states
  const getCardClasses = () => {
    if (isActive) {
      return "border-tint bg-tint-fill border-2";
    }
    if (isLocked) {
      return "border-separator bg-surface opacity-40 cursor-not-allowed border-2";
    }
    if (isRecommended) {
      return "border-tint/30 hover:border-tint/60 bg-surface border-2";
    }
    return "border-separator bg-surface hover:border-label-tertiary border-2";
  };

  const getColorClasses = () => {
    switch (color) {
      case "green":
        return { bg: "bg-green/10", text: "text-green" };
      case "blue":
        return { bg: "bg-blue/10", text: "text-blue" };
      case "purple":
        return { bg: "bg-purple/10", text: "text-purple" };
      case "cyan":
        return { bg: "bg-teal/10", text: "text-teal" };
      case "yellow":
        return { bg: "bg-yellow/10", text: "text-yellow" };
      case "gray":
      default:
        return { bg: "bg-fill-4", text: "text-label-secondary" };
    }
  };

  const colors = getColorClasses();
  const isAffected = affectingComponents.length > 0;
  const isBoosted = componentImpact > 1.0;
  const isPenalized = componentImpact < 1.0;

  const isZeroGdp = activeConfig?.gdpContribution === 0;
  const isZeroEmployment = activeConfig?.employmentShare === 0;
  const severity =
    isActive && (isZeroGdp || isZeroEmployment) ? ("warning" as const) : ("none" as const);
  const fieldTooltip =
    isZeroGdp && isZeroEmployment
      ? "0% GDP and 0% employment"
      : isZeroGdp
        ? "0% GDP contribution"
        : isZeroEmployment
          ? "0% employment share"
          : undefined;

  const cardContent = (
    <motion.div
      whileHover={{ scale: isLocked ? 1 : isActive ? 1 : 1.01 }}
      className={cn(
        "rounded-row relative flex flex-col justify-between p-4 transition-[color,background-color,border-color,box-shadow,opacity,transform] duration-200 select-none",
        getCardClasses()
      )}
      onClick={!isActive && !isLocked ? onToggle : undefined}
    >
      <div className="space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-3">
            <div className={cn("rounded-control shrink-0 p-2", colors.bg)}>
              <Icon className={cn("h-5 w-5", colors.text)} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-label text-headline leading-tight">{template.name}</h3>
                {constraint?.locked && <Badge variant="destructive">Constrained</Badge>}
                {isAffected && (
                  <Badge
                    variant={isBoosted ? "secondary" : "default"}
                    className={cn(
                      "text-footnote px-2 py-0 leading-none",
                      isBoosted
                        ? "border-green/30 bg-green/20 text-green"
                        : isPenalized
                          ? "border-yellow/30 bg-yellow/20 text-yellow"
                          : ""
                    )}
                  >
                    <Zap className="mr-0.5 inline h-2.5 w-2.5" />
                    {isBoosted ? "+" : ""}
                    {((componentImpact - 1) * 100).toFixed(0)}%
                  </Badge>
                )}
              </div>
              <span className="text-label-secondary text-footnote">
                {template.baseContribution}% template base
              </span>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-1">
            {isActive && (
              <Button
                size="sm"
                variant="ghost"
                onClick={(e) => {
                  e.stopPropagation();
                  onToggle();
                }}
                className="text-label-secondary hover:bg-red/10 hover:text-red h-7 w-7 rounded-full p-0 transition-[color,background-color,border-color,box-shadow,opacity,transform]"
                title="Deactivate sector"
              >
                <Minus className="text-red/80 h-4 w-4" />
              </Button>
            )}
            {isLocked && <AlertCircle className="text-red h-4 w-4" />}
            {isRecommended && !isActive && !isLocked && (
              <Badge variant="success" className="text-eyebrow h-4">
                Recommended
              </Badge>
            )}
          </div>
        </div>

        {!isActive && (
          <p className="text-label-secondary text-footnote line-clamp-2 leading-snug">
            {template.description}
          </p>
        )}

        {isLocked && lockedBy.length > 0 && (
          <div className="border-red/10 bg-red/[0.03] text-footnote text-red rounded border px-3 py-1 leading-tight">
            <span className="font-semibold">Incompatible with:</span> {lockedBy.join(", ")}
          </div>
        )}

        {isRecommended && !isActive && !isLocked && recommendedBy.length > 0 && (
          <div className="border-green/10 bg-green/[0.03] text-footnote text-green flex items-start gap-1 rounded border px-3 py-1 leading-tight">
            <ArrowUpRight className="mt-0.5 h-3 w-3 shrink-0" />
            <div>
              <span className="font-semibold">Recommended by:</span> {recommendedBy.join(", ")}
            </div>
          </div>
        )}

        {/* Active Sliders & Configuration (Option A: Inline) */}
        {isActive && activeConfig && (
          <div
            className="border-separator mt-2 space-y-4 border-t pt-3"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Component Impact Indicator inside active card */}
            {isAffected && affectingComponents.length > 0 && (
              <div
                className={cn(
                  "bg-surface-secondary rounded-control text-footnote space-y-1 p-2",
                  isBoosted ? "text-green" : "text-caution"
                )}
              >
                <div className="flex items-center gap-1 font-medium">
                  <Zap className="h-3 w-3 shrink-0" />
                  <span>
                    Atomic Boost: {isBoosted ? "+" : ""}
                    {((componentImpact - 1) * 100).toFixed(0)}% (
                    {affectingComponents.map((c) => c.name).join(", ")})
                  </span>
                </div>
                {effectiveGDP !== undefined && activeConfig.gdpContribution !== effectiveGDP && (
                  <div className="text-footnote flex items-center justify-between">
                    <span className="text-label-secondary">Effective GDP contribution:</span>
                    <span className="text-green font-semibold">
                      {activeConfig.gdpContribution.toFixed(1)}% → {effectiveGDP.toFixed(1)}%
                    </span>
                  </div>
                )}
                {effectiveEmployment !== undefined &&
                  activeConfig.employmentShare !== effectiveEmployment && (
                    <div className="text-footnote flex items-center justify-between">
                      <span className="text-label-secondary">Effective employment share:</span>
                      <span className="text-green font-semibold">
                        {activeConfig.employmentShare.toFixed(1)}% →{" "}
                        {effectiveEmployment.toFixed(1)}%
                      </span>
                    </div>
                  )}
              </div>
            )}

            <div className="space-y-3">
              <SliderWithDirectInput
                label="GDP contribution"
                value={activeConfig.gdpContribution}
                onChange={(value: number) => onChange?.("gdpContribution", value)}
                onCommit={(value: number) => onCommit?.("gdpContribution", value)}
                min={constraint?.minGDP ?? 0}
                max={constraint?.maxGDP ?? 95}
                step={0.1}
                unit="%"
                sectionId="sectors"
                icon={DollarSign}
                showValue={true}
                showRange={true}
                defaultMode="slider"
              />

              <SliderWithDirectInput
                label="Employment share"
                value={activeConfig.employmentShare}
                onChange={(value: number) => onChange?.("employmentShare", value)}
                onCommit={(value: number) => onCommit?.("employmentShare", value)}
                min={0}
                max={constraint?.maxGDP ?? 95}
                step={0.1}
                unit="%"
                sectionId="sectors"
                icon={Users}
                showValue={true}
                showRange={true}
                defaultMode="slider"
              />
            </div>

            {showAdvanced && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                className="border-separator space-y-3 border-t pt-3"
              >
                <div className="grid grid-cols-2 gap-2">
                  <SliderWithDirectInput
                    label="Productivity"
                    value={activeConfig.productivity}
                    onChange={(value: number) => onChange?.("productivity", value)}
                    min={0}
                    max={100}
                    step={1}
                    unit="index"
                    sectionId="sectors"
                    icon={TrendingUp}
                    showValue={true}
                    defaultMode="slider"
                  />

                  <SliderWithDirectInput
                    label="Growth rate"
                    value={activeConfig.growthRate}
                    onChange={(value: number) => onChange?.("growthRate", value)}
                    min={constraint?.minGrowthRate ?? -5}
                    max={constraint?.maxGrowthRate ?? 15}
                    step={0.1}
                    unit="%"
                    sectionId="sectors"
                    icon={TrendingUp}
                    showValue={true}
                    defaultMode="slider"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <SliderWithDirectInput
                    label="Exports"
                    value={activeConfig.exports}
                    onChange={(value: number) => onChange?.("exports", value)}
                    min={0}
                    max={80}
                    step={1}
                    unit="%"
                    sectionId="sectors"
                    icon={Globe}
                    showValue={true}
                    defaultMode="slider"
                  />

                  <SliderWithDirectInput
                    label="Automation"
                    value={activeConfig.automation}
                    onChange={(value: number) => onChange?.("automation", value)}
                    min={0}
                    max={100}
                    step={1}
                    unit="%"
                    sectionId="sectors"
                    icon={Zap}
                    showValue={true}
                    defaultMode="slider"
                  />
                </div>

                <div className="space-y-3">
                  <SliderWithDirectInput
                    label="Innovation"
                    value={activeConfig.innovation}
                    onChange={(value: number) => onChange?.("innovation", value)}
                    min={0}
                    max={100}
                    step={1}
                    unit="index"
                    sectionId="sectors"
                    icon={Zap}
                    showValue={true}
                    defaultMode="slider"
                  />

                  <SliderWithDirectInput
                    label="Sustainability"
                    value={activeConfig.sustainability}
                    onChange={(value: number) => onChange?.("sustainability", value)}
                    min={0}
                    max={100}
                    step={1}
                    unit="index"
                    sectionId="sectors"
                    icon={Leaf}
                    showValue={true}
                    defaultMode="slider"
                  />

                  <SliderWithDirectInput
                    label="Competitiveness"
                    value={activeConfig.competitiveness}
                    onChange={(value: number) => onChange?.("competitiveness", value)}
                    min={0}
                    max={100}
                    step={1}
                    unit="index"
                    sectionId="sectors"
                    icon={TargetIcon}
                    showValue={true}
                    defaultMode="slider"
                  />
                </div>
              </motion.div>
            )}
          </div>
        )}
      </div>

      {/* Characteristics Badges (only show if not active to save vertical space) */}
      {!isActive && (
        <div className="border-separator mt-3 flex flex-wrap gap-1 border-t pt-2">
          {template.characteristics.slice(0, 2).map((char, idx) => (
            <Badge
              key={idx}
              variant="default"
              className="bg-fill-4 text-footnote text-label-secondary hover:bg-fill-4 border-none px-2 py-1 leading-none font-normal"
            >
              {char}
            </Badge>
          ))}
          {template.characteristics.length > 2 && (
            <Badge
              variant="default"
              className="bg-fill-4 text-footnote text-label-secondary hover:bg-fill-4 flex items-center justify-center border-none px-1 py-1 leading-none font-normal"
            >
              +{template.characteristics.length - 2}
            </Badge>
          )}
        </div>
      )}
    </motion.div>
  );

  if (isActive && activeConfig) {
    return (
      <FieldIndicator fieldKey={activeConfig.id} severity={severity} tooltip={fieldTooltip}>
        {cardContent}
      </FieldIndicator>
    );
  }

  return cardContent;
}
