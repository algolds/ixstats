"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { Label } from "~/components/ui/label";
import { Button } from "~/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { Globe, MapPin, Plus } from "lucide-react";
import { AddGeographyModal } from "../components/AddGeographyModal";
import { api } from "~/trpc/react";
import type { EconomicInputs } from "~/app/builder/lib/economy-data-service";

interface GeographySectionProps {
  inputs: EconomicInputs;
  onInputsChange: (inputs: EconomicInputs) => void;
  countryId: string;
}

// Predefined continents and regions
const DEFAULT_CONTINENTS = [
  "Levantia",
  "Sarpedon",
  "Crona",
  "Alshar",
  "Audonia",
  "Ixnay",
  "Africa",
  "Antarctica",
  "Asia",
  "Europe",
  "North America",
  "South America",
  "Oceania",
];

const DEFAULT_REGIONS: Record<string, string[]> = {
  Levantia: ["Northern Levantia", "Southern Levantia", "Western Levantia", "Eastern Levantia"],
  Sarpedon: ["Northern Sarpedon", "Southern Sarpedon", "Western Sarpedon", "Eastern Sarpedon"],
  Crona: ["Northern Crona", "Southern Crona", "Western Crona", "Eastern Crona"],
  Alshar: ["Northern Alshar", "Southern Alshar", "Central Alshar"],
  Audonia: ["Northern Audonia", "Southern Audonia", "Western Audonia", "Eastern Audonia"],
  Ixnay: ["Caphiria", "Pelaxia", "Vallos", "Cartadania", "Other Ixnay"],
  Africa: ["North Africa", "West Africa", "East Africa", "Central Africa", "Southern Africa"],
  Asia: ["East Asia", "Southeast Asia", "South Asia", "Central Asia", "Western Asia"],
  Europe: ["Northern Europe", "Southern Europe", "Western Europe", "Eastern Europe"],
  "North America": ["Northern America", "Central America", "Caribbean"],
  "South America": ["Northern South America", "Southern South America"],
  Oceania: ["Australasia", "Melanesia", "Micronesia", "Polynesia"],
};

export function GeographySection({ inputs, onInputsChange, countryId }: GeographySectionProps) {
  const [showAddContinentModal, setShowAddContinentModal] = useState(false);
  const [showAddRegionModal, setShowAddRegionModal] = useState(false);

  // Fetch custom continents/regions from database
  const { data: customGeography } = api.countries.getCustomGeography.useQuery();
  const addContinentMutation = api.countries.addContinent.useMutation();
  const addRegionMutation = api.countries.addRegion.useMutation();
  const utils = api.useUtils();

  // Combine default and custom continents
  const allContinents = [...DEFAULT_CONTINENTS, ...(customGeography?.continents || [])].sort();

  // Get regions for selected continent
  const selectedContinent = inputs.geography?.continent || "";
  const defaultRegions = DEFAULT_REGIONS[selectedContinent] || [];
  const customRegions = customGeography?.regions?.[selectedContinent] || [];
  const allRegions = [...defaultRegions, ...customRegions].sort();

  const handleContinentChange = (continent: string) => {
    onInputsChange({
      ...inputs,
      geography: {
        ...inputs.geography,
        continent,
        region: "", // Reset region when continent changes
      },
    });
  };

  const handleRegionChange = (region: string) => {
    onInputsChange({
      ...inputs,
      geography: {
        ...inputs.geography,
        region,
      },
    });
  };

  const handleAddContinent = async (name: string) => {
    await addContinentMutation.mutateAsync({ name });
    await utils.countries.getCustomGeography.invalidate();
  };

  const handleAddRegion = async (name: string) => {
    if (!selectedContinent) {
      alert("Please select a continent first");
      return;
    }
    await addRegionMutation.mutateAsync({ continent: selectedContinent, region: name });
    await utils.countries.getCustomGeography.invalidate();
  };

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5" />
            Geography
          </CardTitle>
          <CardDescription>
            Select your country's location or add new continents and regions
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Continent Selector */}
          <div className="space-y-2">
            <Label htmlFor="continent">Continent</Label>
            <div className="flex gap-2">
              <Select value={selectedContinent} onValueChange={handleContinentChange}>
                <SelectTrigger id="continent" className="flex-1">
                  <SelectValue placeholder="Select a continent" />
                </SelectTrigger>
                <SelectContent>
                  {allContinents.map((continent) => (
                    <SelectItem key={continent} value={continent}>
                      {continent}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                variant="outline"
                size="icon"
                onClick={() => setShowAddContinentModal(true)}
                title="Add new continent"
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Region Selector */}
          <div className="space-y-2">
            <Label htmlFor="region">Region</Label>
            <div className="flex gap-2">
              <Select
                value={inputs.geography?.region || ""}
                onValueChange={handleRegionChange}
                disabled={!selectedContinent}
              >
                <SelectTrigger id="region" className="flex-1">
                  <SelectValue
                    placeholder={selectedContinent ? "Select a region" : "Select a continent first"}
                  />
                </SelectTrigger>
                <SelectContent>
                  {allRegions.map((region) => (
                    <SelectItem key={region} value={region}>
                      {region}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                variant="outline"
                size="icon"
                onClick={() => setShowAddRegionModal(true)}
                disabled={!selectedContinent}
                title="Add new region"
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            {!selectedContinent && (
              <p className="text-muted-foreground text-sm">Select a continent to choose a region</p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Modals */}
      <AddGeographyModal
        open={showAddContinentModal}
        onOpenChange={setShowAddContinentModal}
        type="continent"
        onAdd={handleAddContinent}
      />
      <AddGeographyModal
        open={showAddRegionModal}
        onOpenChange={setShowAddRegionModal}
        type="region"
        onAdd={handleAddRegion}
      />
    </>
  );
}
