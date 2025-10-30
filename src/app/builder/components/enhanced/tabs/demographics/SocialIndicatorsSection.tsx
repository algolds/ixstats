"use client";

import React from "react";
import { EnhancedSlider, EnhancedNumberInput } from "../../../../primitives/enhanced";
import { Heart, GraduationCap, Baby } from "lucide-react";
import type { DemographicsConfiguration } from "~/types/economy-builder";

interface SocialIndicatorsSectionProps {
  demographics: DemographicsConfiguration;
  onChange: (field: keyof DemographicsConfiguration, value: any) => void;
  onNestedChange: (parentField: keyof DemographicsConfiguration, field: string, value: any) => void;
  showAdvanced: boolean;
}

export function SocialIndicatorsSection({
  demographics,
  onChange,
  onNestedChange,
  showAdvanced,
}: SocialIndicatorsSectionProps) {
  return (
    <div className="space-y-4">
      <EnhancedSlider
        label="Life Expectancy"
        description="Average life expectancy at birth"
        value={demographics.lifeExpectancy}
        onChange={(value) => onChange("lifeExpectancy", value)}
        min={40}
        max={90}
        step={0.1}
        unit="years"
        sectionId="demographics"
        icon={Heart}
        showValue={true}
      />

      <EnhancedSlider
        label="Literacy Rate"
        description="Percentage of literate adults"
        value={demographics.literacyRate}
        onChange={(value) => onChange("literacyRate", value)}
        min={30}
        max={100}
        step={0.1}
        unit="%"
        sectionId="demographics"
        icon={GraduationCap}
        showValue={true}
      />

      <div className="space-y-3">
        <h4 className="font-medium">Education Levels</h4>
        <EnhancedSlider
          label="No Education"
          value={demographics.educationLevels.noEducation}
          onChange={(value) => onNestedChange("educationLevels", "noEducation", value)}
          min={0}
          max={50}
          step={0.1}
          unit="%"
          sectionId="demographics"
          icon={GraduationCap}
          showValue={true}
        />
        <EnhancedSlider
          label="Primary Education"
          value={demographics.educationLevels.primary}
          onChange={(value) => onNestedChange("educationLevels", "primary", value)}
          min={0}
          max={60}
          step={0.1}
          unit="%"
          sectionId="demographics"
          icon={GraduationCap}
          showValue={true}
        />
        <EnhancedSlider
          label="Secondary Education"
          value={demographics.educationLevels.secondary}
          onChange={(value) => onNestedChange("educationLevels", "secondary", value)}
          min={0}
          max={70}
          step={0.1}
          unit="%"
          sectionId="demographics"
          icon={GraduationCap}
          showValue={true}
        />
        <EnhancedSlider
          label="Tertiary Education"
          value={demographics.educationLevels.tertiary}
          onChange={(value) => onNestedChange("educationLevels", "tertiary", value)}
          min={0}
          max={50}
          step={0.1}
          unit="%"
          sectionId="demographics"
          icon={GraduationCap}
          showValue={true}
        />
      </div>

      {showAdvanced && (
        <div className="space-y-4 border-t pt-4">
          <EnhancedNumberInput
            label="Infant Mortality Rate"
            description="Deaths per 1000 live births"
            value={demographics.infantMortalityRate}
            onChange={(value) => onChange("infantMortalityRate", value)}
            min={0}
            max={100}
            step={0.1}
            sectionId="demographics"
            icon={Baby}
            showButtons={true}
          />

          <EnhancedNumberInput
            label="Maternal Mortality Rate"
            description="Deaths per 100,000 live births"
            value={demographics.maternalMortalityRate}
            onChange={(value) => onChange("maternalMortalityRate", value)}
            min={0}
            max={1000}
            step={1}
            sectionId="demographics"
            icon={Heart}
            showButtons={true}
          />

          <EnhancedSlider
            label="Health Expenditure (GDP %)"
            description="Health spending as percentage of GDP"
            value={demographics.healthExpenditureGDP}
            onChange={(value) => onChange("healthExpenditureGDP", value)}
            min={1}
            max={20}
            step={0.1}
            unit="%"
            sectionId="demographics"
            icon={Heart}
            showValue={true}
          />
        </div>
      )}
    </div>
  );
}
