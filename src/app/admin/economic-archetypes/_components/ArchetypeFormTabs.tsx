"use client";
// src/app/admin/economic-archetypes/_components/ArchetypeFormTabs.tsx

import React from "react";
import { Input } from "~/components/ui/input";
import { Textarea } from "~/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { Slider } from "~/components/ui/slider";
import { MultiSelect } from "~/components/ui/multi-select";
import { Button } from "~/components/ui/button";
import { Plus, Trash as Trash2 } from "iconoir-react";
import {
  type ArchetypeFormData,
  type ArchetypeEra,
  COMPLEXITY_LEVELS,
  SECTOR_TYPES,
  ECONOMIC_COMPONENTS,
  GOVERNMENT_COMPONENTS,
} from "./archetype-form-types";

interface TabProps {
  formData: ArchetypeFormData;
  setFormData: React.Dispatch<React.SetStateAction<ArchetypeFormData>>;
}

export function GeneralTab({ formData, setFormData }: TabProps) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-foreground mb-1.5 block text-xs font-medium">Key *</label>
          <Input
            value={formData.key}
            onChange={(e) => setFormData((prev) => ({ ...prev, key: e.target.value }))}
            placeholder="e.g., silicon-valley"
            className="text-xs"
          />
        </div>
        <div>
          <label className="text-foreground mb-1.5 block text-xs font-medium">Name *</label>
          <Input
            value={formData.name}
            onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
            placeholder="e.g., Silicon Valley Model"
            className="text-xs"
          />
        </div>
      </div>

      <div>
        <label className="text-foreground mb-1.5 block text-xs font-medium">Description *</label>
        <Textarea
          value={formData.description}
          onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
          placeholder="Brief description of the economic archetype..."
          rows={3}
          className="text-xs"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-foreground mb-1.5 block text-xs font-medium">Region *</label>
          <Input
            value={formData.region}
            onChange={(e) => setFormData((prev) => ({ ...prev, region: e.target.value }))}
            placeholder="e.g., United States (California)"
            className="text-xs"
          />
        </div>
        <div>
          <label className="text-foreground mb-1.5 block text-xs font-medium">Era *</label>
          <Select
            value={formData.era}
            onValueChange={(v: ArchetypeEra) => setFormData((prev) => ({ ...prev, era: v }))}
          >
            <SelectTrigger className="text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="modern">Modern</SelectItem>
              <SelectItem value="historical">Historical</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div>
        <label className="text-foreground mb-1.5 block text-xs font-medium">
          Implementation Complexity
        </label>
        <Select
          value={formData.implementationComplexity}
          onValueChange={(v) => setFormData((prev) => ({ ...prev, implementationComplexity: v }))}
        >
          <SelectTrigger className="text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {COMPLEXITY_LEVELS.map((level) => (
              <SelectItem key={level} value={level}>
                {level}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div>
        <label className="text-foreground mb-1.5 block text-xs font-medium">
          Historical Context
        </label>
        <Textarea
          value={formData.historicalContext}
          onChange={(e) => setFormData((prev) => ({ ...prev, historicalContext: e.target.value }))}
          placeholder="Historical background and development..."
          rows={3}
          className="text-xs"
        />
      </div>
    </div>
  );
}

export function EconomicsTab({ formData, setFormData }: TabProps) {
  return (
    <div className="space-y-4">
      <div>
        <label className="text-foreground mb-1.5 block text-xs font-medium">
          Economic Components
        </label>
        <MultiSelect
          options={ECONOMIC_COMPONENTS as readonly string[]}
          value={formData.economicComponents}
          onChange={(value) => setFormData((prev) => ({ ...prev, economicComponents: value }))}
          placeholder="Select economic components..."
        />
      </div>

      <div>
        <label className="text-foreground mb-1.5 block text-xs font-medium">Sector Focus (%)</label>
        <div className="space-y-3">
          {SECTOR_TYPES.map((sector) => (
            <div key={sector} className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="text-foreground font-medium capitalize">{sector}</span>
                <span className="text-muted-foreground">{formData.sectorFocus[sector] || 0}%</span>
              </div>
              <Slider
                value={[formData.sectorFocus[sector] || 0]}
                onValueChange={([value]) =>
                  setFormData((prev) => ({
                    ...prev,
                    sectorFocus: { ...prev.sectorFocus, [sector]: value || 0 },
                  }))
                }
                min={0}
                max={100}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function GovernmentTab({ formData, setFormData }: TabProps) {
  return (
    <div className="space-y-4">
      <div>
        <label className="text-foreground mb-1.5 block text-xs font-medium">
          Government Components
        </label>
        <MultiSelect
          options={GOVERNMENT_COMPONENTS as readonly string[]}
          value={formData.governmentComponents}
          onChange={(value) => setFormData((prev) => ({ ...prev, governmentComponents: value }))}
          placeholder="Select government components..."
        />
      </div>
    </div>
  );
}

export function TaxTab({ formData, setFormData }: TabProps) {
  return (
    <div className="space-y-4">
      <div className="space-y-3">
        <div className="space-y-1">
          <div className="flex items-center justify-between text-xs">
            <span className="text-foreground font-medium">Corporate Tax Rate</span>
            <span className="text-muted-foreground">{formData.taxProfile.corporateTax}%</span>
          </div>
          <Slider
            value={[formData.taxProfile.corporateTax]}
            onValueChange={([value]) =>
              setFormData((prev) => ({
                ...prev,
                taxProfile: { ...prev.taxProfile, corporateTax: value || 0 },
              }))
            }
            min={0}
            max={50}
          />
        </div>

        <div className="space-y-1">
          <div className="flex items-center justify-between text-xs">
            <span className="text-foreground font-medium">Income Tax Rate</span>
            <span className="text-muted-foreground">{formData.taxProfile.incomeTax}%</span>
          </div>
          <Slider
            value={[formData.taxProfile.incomeTax]}
            onValueChange={([value]) =>
              setFormData((prev) => ({
                ...prev,
                taxProfile: { ...prev.taxProfile, incomeTax: value || 0 },
              }))
            }
            min={0}
            max={60}
          />
        </div>

        <div className="space-y-1">
          <div className="flex items-center justify-between text-xs">
            <span className="text-foreground font-medium">Consumption Tax Rate</span>
            <span className="text-muted-foreground">{formData.taxProfile.consumptionTax}%</span>
          </div>
          <Slider
            value={[formData.taxProfile.consumptionTax]}
            onValueChange={([value]) =>
              setFormData((prev) => ({
                ...prev,
                taxProfile: { ...prev.taxProfile, consumptionTax: value || 0 },
              }))
            }
            min={0}
            max={30}
          />
        </div>

        <div className="space-y-1">
          <div className="flex items-center justify-between text-xs">
            <span className="text-foreground font-medium">Tax Efficiency</span>
            <span className="text-muted-foreground">{formData.taxProfile.taxEfficiency}%</span>
          </div>
          <Slider
            value={[formData.taxProfile.taxEfficiency]}
            onValueChange={([value]) =>
              setFormData((prev) => ({
                ...prev,
                taxProfile: { ...prev.taxProfile, taxEfficiency: value || 0 },
              }))
            }
            min={0}
            max={100}
          />
        </div>
      </div>
    </div>
  );
}

export function EmploymentTab({ formData, setFormData }: TabProps) {
  return (
    <div className="space-y-4">
      <div className="space-y-3">
        <div>
          <label className="text-foreground mb-1.5 block text-xs font-medium">
            Unemployment Rate (%)
          </label>
          <Input
            type="number"
            step="0.1"
            value={formData.employmentProfile.unemploymentRate}
            onChange={(e) =>
              setFormData((prev) => ({
                ...prev,
                employmentProfile: {
                  ...prev.employmentProfile,
                  unemploymentRate: parseFloat(e.target.value) || 0,
                },
              }))
            }
            className="text-xs"
          />
        </div>

        <div>
          <label className="text-foreground mb-1.5 block text-xs font-medium">
            Labor Participation (%)
          </label>
          <Input
            type="number"
            step="0.1"
            value={formData.employmentProfile.laborParticipation}
            onChange={(e) =>
              setFormData((prev) => ({
                ...prev,
                employmentProfile: {
                  ...prev.employmentProfile,
                  laborParticipation: parseFloat(e.target.value) || 0,
                },
              }))
            }
            className="text-xs"
          />
        </div>

        <div>
          <label className="text-foreground mb-1.5 block text-xs font-medium">
            Wage Growth (%)
          </label>
          <Input
            type="number"
            step="0.1"
            value={formData.employmentProfile.wageGrowth}
            onChange={(e) =>
              setFormData((prev) => ({
                ...prev,
                employmentProfile: {
                  ...prev.employmentProfile,
                  wageGrowth: parseFloat(e.target.value) || 0,
                },
              }))
            }
            className="text-xs"
          />
        </div>
      </div>
    </div>
  );
}

export function MetricsTab({ formData, setFormData }: TabProps) {
  return (
    <div className="space-y-4">
      <div className="space-y-3">
        <div className="space-y-1">
          <div className="flex items-center justify-between text-xs">
            <span className="text-foreground font-medium">GDP Growth (%)</span>
            <span className="text-muted-foreground">{formData.growthMetrics.gdpGrowth}%</span>
          </div>
          <Slider
            value={[formData.growthMetrics.gdpGrowth]}
            onValueChange={([value]) =>
              setFormData((prev) => ({
                ...prev,
                growthMetrics: { ...prev.growthMetrics, gdpGrowth: value || 0 },
              }))
            }
            min={-5}
            max={15}
          />
        </div>

        <div className="space-y-1">
          <div className="flex items-center justify-between text-xs">
            <span className="text-foreground font-medium">Innovation Index</span>
            <span className="text-muted-foreground">{formData.growthMetrics.innovationIndex}</span>
          </div>
          <Slider
            value={[formData.growthMetrics.innovationIndex]}
            onValueChange={([value]) =>
              setFormData((prev) => ({
                ...prev,
                growthMetrics: { ...prev.growthMetrics, innovationIndex: value || 0 },
              }))
            }
            min={0}
            max={100}
          />
        </div>

        <div className="space-y-1">
          <div className="flex items-center justify-between text-xs">
            <span className="text-foreground font-medium">Competitiveness</span>
            <span className="text-muted-foreground">{formData.growthMetrics.competitiveness}</span>
          </div>
          <Slider
            value={[formData.growthMetrics.competitiveness]}
            onValueChange={([value]) =>
              setFormData((prev) => ({
                ...prev,
                growthMetrics: { ...prev.growthMetrics, competitiveness: value || 0 },
              }))
            }
            min={0}
            max={100}
          />
        </div>

        <div className="space-y-1">
          <div className="flex items-center justify-between text-xs">
            <span className="text-foreground font-medium">Stability</span>
            <span className="text-muted-foreground">{formData.growthMetrics.stability}</span>
          </div>
          <Slider
            value={[formData.growthMetrics.stability]}
            onValueChange={([value]) =>
              setFormData((prev) => ({
                ...prev,
                growthMetrics: { ...prev.growthMetrics, stability: value || 0 },
              }))
            }
            min={0}
            max={100}
          />
        </div>
      </div>
    </div>
  );
}

export function CharacteristicsTab({ formData, setFormData }: TabProps) {
  const addArrayItem = (field: keyof ArchetypeFormData) => {
    const currentArray = (formData[field] as string[]) || [];
    setFormData((prev) => ({ ...prev, [field]: [...currentArray, ""] }));
  };

  const updateArrayItem = (field: keyof ArchetypeFormData, index: number, value: string) => {
    const currentArray = (formData[field] as string[]) || [];
    const newArray = [...currentArray];
    newArray[index] = value;
    setFormData((prev) => ({ ...prev, [field]: newArray }));
  };

  const removeArrayItem = (field: keyof ArchetypeFormData, index: number) => {
    const currentArray = (formData[field] as string[]) || [];
    setFormData((prev) => ({ ...prev, [field]: currentArray.filter((_, i) => i !== index) }));
  };

  const renderArrayEditor = (
    field: keyof ArchetypeFormData,
    label: string,
    placeholder: string
  ) => {
    const items = (formData[field] as string[]) || [];
    return (
      <div>
        <label className="text-foreground mb-1.5 block text-xs font-medium">{label}</label>
        <div className="space-y-2">
          {items.map((item, index) => (
            <div key={index} className="flex gap-2">
              <Input
                value={item}
                onChange={(e) => updateArrayItem(field, index, e.target.value)}
                placeholder={placeholder}
                className="text-xs"
              />
              <Button
                size="sm"
                variant="ghost"
                onClick={() => removeArrayItem(field, index)}
                className="h-8 px-2 text-red-400 active:scale-[0.98]"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
          <Button
            size="sm"
            variant="outline"
            onClick={() => addArrayItem(field)}
            className="text-xs active:scale-[0.98]"
          >
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            Add {label.slice(0, -1)}
          </Button>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {renderArrayEditor("characteristics", "Characteristics", "Enter characteristic...")}
      {renderArrayEditor("strengths", "Strengths", "Enter strength...")}
      {renderArrayEditor("challenges", "Challenges", "Enter challenge...")}
      {renderArrayEditor("culturalFactors", "Cultural Factors", "Enter cultural factor...")}
      {renderArrayEditor("modernExamples", "Modern Examples", "Enter example...")}
      {renderArrayEditor("recommendations", "Recommendations", "Enter recommendation...")}
    </div>
  );
}
