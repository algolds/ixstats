/**
 * Intelligence Header Component
 *
 * Displays the header section of the intelligence briefing with country flag,
 * name, classification badge, and section navigation.
 */

import React from "react";
import { cn } from "~/lib/utils";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { UnifiedCountryFlag } from "~/components/UnifiedCountryFlag";
import { IxTime } from "~/lib/ixtime";
import { CLASSIFICATION_STYLES } from "~/lib/clearance-utils";
import type { ClassificationLevel } from "~/types/intelligence-briefing";
import {
  RiCheckboxCircleLine,
  RiEyeLine,
  RiInformationLine,
  RiBarChartLine,
  RiTvLine,
} from "react-icons/ri";

interface IntelligenceHeaderProps {
  countryName: string;
  currentIxTime: number;
  viewerClearanceLevel: ClassificationLevel;
  showClassified: boolean;
  onToggleClassified: () => void;
  activeSection: 'overview' | 'vitality' | 'metrics' | 'information';
  onSectionChange: (section: 'overview' | 'vitality' | 'metrics' | 'information') => void;
}

export const IntelligenceHeader = React.memo<IntelligenceHeaderProps>(({
  countryName,
  currentIxTime,
  viewerClearanceLevel,
  showClassified,
  onToggleClassified,
  activeSection,
  onSectionChange,
}) => {
  const sections = [
    { id: 'overview' as const, label: 'Overview', icon: RiInformationLine },
    { id: 'metrics' as const, label: 'Key Metrics', icon: RiBarChartLine },
    { id: 'information' as const, label: 'Briefing', icon: RiTvLine }
  ];

  return (
    <div className="glass-hierarchy-child rounded-lg relative overflow-hidden">
      {/* Country Flag Background */}
      <div className="absolute inset-0 opacity-[0.03] pointer-events-none">
        <div className="w-full h-full bg-gradient-to-r from-background/80 via-background/60 to-background/80"></div>
      </div>

      <div className="relative p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <UnifiedCountryFlag countryName={countryName} size="xl" />
            <div>
              <div className="flex items-center gap-3">
                <h2 className="text-xl font-semibold">{countryName}</h2>
                <Badge variant="outline" className="border-green-500/30 text-green-400 bg-green-500/10">
                  <RiCheckboxCircleLine className="h-3 w-3 mr-1" />
                  STABLE
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                Country Intelligence Briefing • {IxTime.formatIxTime(currentIxTime, true)}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Badge
              variant="outline"
              className={cn(
                "border-2",
                CLASSIFICATION_STYLES[viewerClearanceLevel].color,
                CLASSIFICATION_STYLES[viewerClearanceLevel].border
              )}
            >
              {CLASSIFICATION_STYLES[viewerClearanceLevel].label}
            </Badge>
            {viewerClearanceLevel !== 'PUBLIC' && (
              <Button
                variant="outline"
                size="sm"
                onClick={onToggleClassified}
                className="border-orange-500/30 text-orange-400 hover:bg-orange-500/10"
              >
                <RiEyeLine className="h-4 w-4 mr-2" />
                {showClassified ? 'Hide' : 'Show'} Classified
              </Button>
            )}
          </div>
        </div>

        {/* Section Navigation */}
        <div className="flex flex-wrap gap-2 mb-6">
          {sections.map((section) => {
            const SectionIcon = section.icon;
            return (
              <Button
                key={section.id}
                variant={activeSection === section.id ? 'default' : 'ghost'}
                size="sm"
                onClick={() => onSectionChange(section.id)}
                className="flex items-center gap-2"
              >
                <SectionIcon className="h-4 w-4" />
                {section.label}
              </Button>
            );
          })}
        </div>
      </div>
    </div>
  );
});

IntelligenceHeader.displayName = "IntelligenceHeader";
