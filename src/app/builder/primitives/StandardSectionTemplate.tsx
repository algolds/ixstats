"use client";

import React from "react";
import { cn } from "~/lib/utils";
import { GlassCard, GlassCardContent, GlassCardHeader } from "../components/glass/GlassCard";
import { SectionHeader } from "./SectionHeader";
import { ViewTransition } from "./enhanced/BasicAdvancedView";
import type { EconomicInputs, RealCountryData } from "../lib/economy-data-service";

// Standardized section props interface
export interface StandardSectionProps {
  inputs: EconomicInputs;
  onInputsChange: (inputs: EconomicInputs) => void;
  showAdvanced: boolean;
  onToggleAdvanced?: () => void;
  referenceCountry: RealCountryData;
  totalPopulation?: number;
  nominalGDP?: number;
  gdpPerCapita?: number;
  theme?: "gold" | "blue" | "indigo" | "red" | "neutral";
  className?: string;
}

// Standard section template component
interface StandardSectionTemplateProps extends StandardSectionProps {
  title: string;
  description?: string;
  icon?: React.ComponentType<any>;
  basicContent: React.ReactNode;
  advancedContent: React.ReactNode;
  depth?: "base" | "elevated" | "modal" | "interactive";
  blur?: "none" | "light" | "medium" | "heavy";
}

export function StandardSectionTemplate({
  title,
  description,
  icon: Icon,
  basicContent,
  advancedContent,
  showAdvanced,
  onToggleAdvanced,
  theme = "neutral",
  depth = "elevated",
  blur = "medium",
  className,
}: StandardSectionTemplateProps) {
  return (
    <GlassCard depth={depth} blur={blur} theme={theme} className={cn("w-full", className)}>
      <GlassCardHeader>
        <SectionHeader
          title={title}
          description={description}
          icon={Icon}
          showAdvanced={showAdvanced}
          onToggleAdvanced={onToggleAdvanced || (() => {})}
        />
      </GlassCardHeader>

      <GlassCardContent>
        <ViewTransition
          showAdvanced={showAdvanced}
          basicContent={<div className="space-y-6">{basicContent}</div>}
          advancedContent={<div className="space-y-6">{advancedContent}</div>}
        />
      </GlassCardContent>
    </GlassCard>
  );
}

// Helper hook for section state management
export function useSectionState(initialShowAdvanced = false) {
  const [showAdvanced, setShowAdvanced] = React.useState(initialShowAdvanced);

  const toggleAdvanced = React.useCallback(() => {
    setShowAdvanced((prev) => !prev);
  }, []);

  return {
    showAdvanced,
    setShowAdvanced,
    toggleAdvanced,
  };
}

// Section themes mapping
export const SECTION_THEMES = {
  symbols: "gold", // National Identity = Gold
  core: "blue", // Core Indicators = Blue
  demographics: "neutral", // Demographics = Neutral
  labor: "indigo", // Labor = Indigo
  fiscal: "red", // Fiscal = Red
  government: "blue", // Government = Blue
} as const;

export type SectionId = keyof typeof SECTION_THEMES;
