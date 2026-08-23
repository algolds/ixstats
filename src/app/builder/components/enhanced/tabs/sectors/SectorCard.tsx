"use client";

import React from "react";
import { motion } from "motion/react";
import { Badge } from "~/components/ui/badge";
import { CheckCircle, WarningCircle as AlertCircle, ArrowUpRight, Dollar as DollarSign, Group as Users, StatUp as TrendingUp, Globe, Flash as Zap, Leaf, Archery as TargetIcon, Minus } from "iconoir-react";
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
  onChange?: (field: keyof SectorConfiguration, value: any) => void;
  onCommit?: (field: keyof SectorConfiguration, value: any) => void;
}

export function SectorCard({
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
      return "border-emerald-500/40 bg-emerald-500/[0.04] dark:bg-emerald-500/[0.05] shadow-[0_0_15px_rgba(16,185,129,0.05)] border-2";
    }
    if (isLocked) {
      return "border-red-500/20 bg-red-500/[0.02] dark:bg-red-500/[0.02] opacity-40 cursor-not-allowed border-2";
    }
    if (isRecommended) {
      return "border-emerald-500/20 hover:border-emerald-500/40 bg-white/[0.01] hover:bg-white/[0.03] border-2";
    }
    return "border-white/10 bg-white/[0.01] hover:border-white/20 hover:bg-white/[0.03] border-2";
  };

  const getColorClasses = () => {
    switch (color) {
      case "green":
        return { bg: "bg-green-500/10", text: "text-green-400" };
      case "blue":
        return { bg: "bg-blue-500/10", text: "text-blue-400" };
      case "purple":
        return { bg: "bg-purple-500/10", text: "text-purple-400" };
      case "cyan":
        return { bg: "bg-cyan-500/10", text: "text-cyan-400" };
      case "yellow":
        return { bg: "bg-yellow-500/10", text: "text-yellow-400" };
      case "gray":
      default:
        return { bg: "bg-zinc-500/10", text: "text-zinc-400" };
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
        "relative flex flex-col justify-between rounded-xl p-4 transition-all duration-200 select-none",
        getCardClasses()
      )}
      onClick={!isActive && !isLocked ? onToggle : undefined}
    >
      <div className="space-y-3">
        {/* Header */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-3">
            <div className={cn("shrink-0 rounded-lg p-2", colors.bg)}>
              <Icon className={cn("h-5 w-5", colors.text)} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h4 className="text-foreground text-sm leading-tight font-semibold">
                  {template.name}
                </h4>
                {constraint?.locked && (
                  <Badge
                    variant="secondary"
                    className="border-red-500/20 bg-red-500/10 px-1.5 py-0 text-[9px] leading-none text-red-400"
                  >
                    Constrained
                  </Badge>
                )}
                {isAffected && (
                  <Badge
                    variant={isBoosted ? "default" : "secondary"}
                    className={cn(
                      "px-1.5 py-0 text-[9px] leading-none",
                      isBoosted
                        ? "border-emerald-500/30 bg-emerald-500/20 text-emerald-400"
                        : isPenalized
                          ? "border-amber-500/30 bg-amber-500/20 text-amber-400"
                          : ""
                    )}
                  >
                    <Zap className="mr-0.5 inline h-2.5 w-2.5" />
                    {isBoosted ? "+" : ""}
                    {((componentImpact - 1) * 100).toFixed(0)}%
                  </Badge>
                )}
              </div>
              <span className="text-muted-foreground text-[10px]">
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
                className="text-muted-foreground h-7 w-7 rounded-full p-0 transition-all hover:bg-red-500/10 hover:text-red-400"
                title="Deactivate Sector"
              >
                <Minus className="h-4 w-4 text-red-400/80" />
              </Button>
            )}
            {isLocked && <AlertCircle className="h-4 w-4 text-red-500" />}
            {isRecommended && !isActive && !isLocked && (
              <Badge
                variant="default"
                className="h-4 border border-emerald-500/20 bg-emerald-500/10 px-1.5 py-0 text-[9px] font-semibold tracking-wider text-emerald-400 uppercase"
              >
                Recommended
              </Badge>
            )}
          </div>
        </div>

        {/* Description */}
        {!isActive && (
          <p className="text-muted-foreground line-clamp-2 text-xs leading-snug">
            {template.description}
          </p>
        )}

        {/* Incompatible Component List */}
        {isLocked && lockedBy.length > 0 && (
          <div className="rounded border border-red-500/10 bg-red-500/[0.03] px-2.5 py-1 text-[9px] leading-tight text-red-400">
            <span className="font-semibold">Incompatible with:</span> {lockedBy.join(", ")}
          </div>
        )}

        {/* Recommendations list */}
        {isRecommended && !isActive && !isLocked && recommendedBy.length > 0 && (
          <div className="flex items-start gap-1 rounded border border-emerald-500/10 bg-emerald-500/[0.03] px-2.5 py-1 text-[9px] leading-tight text-emerald-400">
            <ArrowUpRight className="mt-0.5 h-3 w-3 shrink-0" />
            <div>
              <span className="font-semibold">Recommended by:</span> {recommendedBy.join(", ")}
            </div>
          </div>
        )}

        {/* Active Sliders & Configuration (Option A: Inline) */}
        {isActive && activeConfig && (
          <div
            className="mt-2 space-y-4 border-t border-emerald-500/10 pt-3"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Component Impact Indicator inside active card */}
            {isAffected && affectingComponents.length > 0 && (
              <div
                className={cn(
                  "space-y-1 rounded-lg border border-white/5 bg-black/10 p-2 text-[10px]",
                  isBoosted ? "text-emerald-400" : "text-amber-400"
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
                  <div className="flex items-center justify-between text-[9px]">
                    <span className="text-zinc-400">Effective GDP Contribution:</span>
                    <span className="font-semibold text-emerald-400">
                      {activeConfig.gdpContribution.toFixed(1)}% → {effectiveGDP.toFixed(1)}%
                    </span>
                  </div>
                )}
                {effectiveEmployment !== undefined &&
                  activeConfig.employmentShare !== effectiveEmployment && (
                    <div className="flex items-center justify-between text-[9px]">
                      <span className="text-zinc-400">Effective Employment Share:</span>
                      <span className="font-semibold text-emerald-400">
                        {activeConfig.employmentShare.toFixed(1)}% →{" "}
                        {effectiveEmployment.toFixed(1)}%
                      </span>
                    </div>
                  )}
              </div>
            )}

            {/* Core Sliders */}
            <div className="space-y-3">
              <SliderWithDirectInput
                label="GDP Contribution"
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
                label="Employment Share"
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

            {/* Advanced Controls */}
            {showAdvanced && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                className="space-y-3 border-t border-white/5 pt-3"
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
                    label="Growth Rate"
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
        <div className="mt-3 flex flex-wrap gap-1 border-t border-white/5 pt-2">
          {template.characteristics.slice(0, 2).map((char, idx) => (
            <Badge
              key={idx}
              variant="secondary"
              className="border-none bg-white/5 px-1.5 py-1 text-[9px] leading-none font-normal text-zinc-400 hover:bg-white/5"
            >
              {char}
            </Badge>
          ))}
          {template.characteristics.length > 2 && (
            <Badge
              variant="secondary"
              className="flex items-center justify-center border-none bg-white/5 px-1 py-1 text-[9px] leading-none font-normal text-zinc-400 hover:bg-white/5"
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
