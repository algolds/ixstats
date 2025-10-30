"use client";

import React, { useState } from "react";
import { motion } from "framer-motion";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { EnhancedSlider } from "../../../../primitives/enhanced";
import { Building2, MapPin, Plus, Minus, Settings, Users, Target } from "lucide-react";
import type { DemographicsConfiguration, RegionDistribution } from "~/types/economy-builder";

interface GeographicSectionProps {
  demographics: DemographicsConfiguration;
  onChange: (parentField: keyof DemographicsConfiguration, field: string, value: any) => void;
  onRegionChange: (regionIndex: number, field: keyof RegionDistribution, value: any) => void;
  onAddRegion: () => void;
  onRemoveRegion: (index: number) => void;
}

export function GeographicSection({
  demographics,
  onChange,
  onRegionChange,
  onAddRegion,
  onRemoveRegion,
}: GeographicSectionProps) {
  const [editingRegion, setEditingRegion] = useState<string | null>(null);

  return (
    <div className="space-y-4">
      <EnhancedSlider
        label="Urban Population"
        description="Percentage living in urban areas"
        value={demographics.urbanRuralSplit.urban}
        onChange={(value) => onChange("urbanRuralSplit", "urban", value)}
        min={20}
        max={95}
        step={0.1}
        unit="%"
        sectionId="demographics"
        icon={Building2}
        showValue={true}
      />

      <EnhancedSlider
        label="Rural Population"
        description="Percentage living in rural areas"
        value={demographics.urbanRuralSplit.rural}
        onChange={(value) => onChange("urbanRuralSplit", "rural", value)}
        min={5}
        max={80}
        step={0.1}
        unit="%"
        sectionId="demographics"
        icon={MapPin}
        showValue={true}
      />

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="font-medium">Regional Distribution</h4>
          <Button size="sm" variant="outline" onClick={onAddRegion}>
            <Plus className="mr-2 h-4 w-4" />
            Add Region
          </Button>
        </div>

        {demographics.regions.map((region, index) => (
          <motion.div
            key={index}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className={`rounded-lg border p-3 ${
              editingRegion === index.toString()
                ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20"
                : "border-gray-200 dark:border-gray-700"
            }`}
          >
            <div className="mb-2 flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Badge variant="outline">{region.developmentLevel}</Badge>
                <span className="font-medium">{region.name}</span>
              </div>
              <div className="flex items-center space-x-1">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() =>
                    setEditingRegion(editingRegion === index.toString() ? null : index.toString())
                  }
                >
                  <Settings className="h-4 w-4" />
                </Button>
                <Button size="sm" variant="ghost" onClick={() => onRemoveRegion(index)}>
                  <Minus className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>Population: {region.population.toLocaleString()}</div>
              <div>Urban: {region.urbanPercent}%</div>
              <div>Economic Activity: {region.economicActivity}%</div>
              <div>Share: {region.populationPercent}%</div>
            </div>

            {editingRegion === index.toString() && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="mt-3 space-y-2 border-t pt-3"
              >
                <div className="space-y-1">
                  <label className="flex items-center gap-2 text-sm font-medium">
                    <MapPin className="h-4 w-4" />
                    Region Name
                  </label>
                  <input
                    type="text"
                    value={region.name}
                    onChange={(e) => onRegionChange(index, "name", e.target.value)}
                    className="bg-background border-border focus:ring-primary w-full rounded-md border px-3 py-2 focus:ring-2 focus:outline-none"
                    placeholder="Enter region name"
                  />
                </div>

                <EnhancedSlider
                  label="Population Percent"
                  value={region.populationPercent}
                  onChange={(value) => onRegionChange(index, "populationPercent", value)}
                  min={1}
                  max={80}
                  step={0.1}
                  unit="%"
                  sectionId="demographics"
                  icon={Users}
                  showValue={true}
                />
                <EnhancedSlider
                  label="Urban Percent"
                  value={region.urbanPercent}
                  onChange={(value) => onRegionChange(index, "urbanPercent", value)}
                  min={0}
                  max={100}
                  step={1}
                  unit="%"
                  sectionId="demographics"
                  icon={Building2}
                  showValue={true}
                />
                <EnhancedSlider
                  label="Economic Activity"
                  value={region.economicActivity}
                  onChange={(value) => onRegionChange(index, "economicActivity", value)}
                  min={1}
                  max={50}
                  step={0.1}
                  unit="%"
                  sectionId="demographics"
                  icon={Target}
                  showValue={true}
                />
              </motion.div>
            )}
          </motion.div>
        ))}
      </div>
    </div>
  );
}
