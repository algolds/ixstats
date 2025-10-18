"use client";

import React from 'react';
import { Progress } from '~/components/ui/progress';
import { EnhancedSlider } from '../../../../primitives/enhanced';
import { Baby, UserCheck, Heart } from 'lucide-react';
import type { DemographicsConfiguration } from '~/types/economy-builder';

interface AgeDistributionSectionProps {
  demographics: DemographicsConfiguration;
  onChange: (parentField: keyof DemographicsConfiguration, field: string, value: any) => void;
  showAdvanced: boolean;
}

export function AgeDistributionSection({
  demographics,
  onChange,
  showAdvanced
}: AgeDistributionSectionProps) {
  return (
    <div className="space-y-4">
      <EnhancedSlider
        label="Under 15 Years"
        description="Percentage of population under 15"
        value={demographics.ageDistribution.under15}
        onChange={(value) => onChange('ageDistribution', 'under15', value)}
        min={10}
        max={50}
        step={0.1}
        unit="%"
        sectionId="demographics"
        icon={Baby}
        showValue={true}
      />

      <EnhancedSlider
        label="Working Age (15-64)"
        description="Percentage of population aged 15-64"
        value={demographics.ageDistribution.age15to64}
        onChange={(value) => onChange('ageDistribution', 'age15to64', value)}
        min={40}
        max={80}
        step={0.1}
        unit="%"
        sectionId="demographics"
        icon={UserCheck}
        showValue={true}
      />

      <EnhancedSlider
        label="Over 65 Years"
        description="Percentage of population over 65"
        value={demographics.ageDistribution.over65}
        onChange={(value) => onChange('ageDistribution', 'over65', value)}
        min={5}
        max={35}
        step={0.1}
        unit="%"
        sectionId="demographics"
        icon={Heart}
        showValue={true}
      />

      {showAdvanced && (
        <div className="space-y-4 pt-4 border-t">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Youth Dependency Ratio</span>
                <span className="font-medium">{demographics.youthDependencyRatio.toFixed(1)}</span>
              </div>
              <Progress value={demographics.youthDependencyRatio / 100} className="h-2" />
            </div>

            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Elderly Dependency Ratio</span>
                <span className="font-medium">{demographics.elderlyDependencyRatio.toFixed(1)}</span>
              </div>
              <Progress value={demographics.elderlyDependencyRatio / 100} className="h-2" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
