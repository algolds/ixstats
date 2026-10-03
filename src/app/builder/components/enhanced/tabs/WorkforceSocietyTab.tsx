"use client";

import React, { useState } from "react";
import { Group as Users, Globe } from "iconoir-react";
import { SegmentedControl } from "~/components/ui/segmented-control";
import { soundEffects } from "~/lib/sound/cuelume";
import { LaborEmploymentTab } from "./LaborEmploymentTab";
import { DemographicsPopulationTab } from "./DemographicsPopulationTab";
import type { EconomyBuilderState } from "~/types/economy-builder";
import type { EconomicComponentType } from "~/components/mycountry/domains/economy/atoms/AtomicEconomicComponents";
import { Card, CardContent } from "~/components/ui/card";

export interface WorkforceSocietyTabProps {
  economyBuilder: EconomyBuilderState;
  onEconomyBuilderChange: (builder: EconomyBuilderState) => void;
  selectedComponents: EconomicComponentType[];
  showAdvanced?: boolean;
}

export function WorkforceSocietyTab({
  economyBuilder,
  onEconomyBuilderChange,
  selectedComponents,
  showAdvanced = false,
}: WorkforceSocietyTabProps) {
  const [subTab, setSubTab] = useState<"labor" | "demographics">("labor");

  return (
    <div className="space-y-6">
      <Card>
        <div className="border-separator bg-surface flex flex-col gap-4 border-b px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            {subTab === "labor" ? (
              <Users className="text-green h-5 w-5" />
            ) : (
              <Globe className="text-green h-5 w-5" />
            )}
            <h2 className="text-headline text-label">
              {subTab === "labor" ? "Labor market and employment" : "Demographics and population"}
            </h2>
          </div>

          <SegmentedControl
            aria-label="Workforce view"
            size="sm"
            value={subTab}
            onValueChange={(next) => {
              soundEffects.press();
              setSubTab(next);
            }}
            options={[
              { value: "labor", label: "Labor & wages", icon: <Users aria-hidden /> },
              {
                value: "demographics",
                label: "Demographics & society",
                icon: <Globe aria-hidden />,
              },
            ]}
          />
        </div>

        <CardContent className="p-6">
          {subTab === "labor" ? (
            <LaborEmploymentTab
              economyBuilder={economyBuilder}
              onEconomyBuilderChange={onEconomyBuilderChange}
              selectedComponents={selectedComponents}
              showAdvanced={showAdvanced}
            />
          ) : (
            <DemographicsPopulationTab
              economyBuilder={economyBuilder}
              onEconomyBuilderChange={onEconomyBuilderChange}
              selectedComponents={selectedComponents}
              showAdvanced={showAdvanced}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
