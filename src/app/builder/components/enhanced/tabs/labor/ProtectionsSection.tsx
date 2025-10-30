"use client";

import React from "react";
import { EnhancedSlider, EnhancedNumberInput } from "../../../../primitives/enhanced";
import { Shield, Heart } from "lucide-react";
import type { LaborConfiguration } from "~/types/economy-builder";

interface ProtectionsSectionProps {
  laborMarket: LaborConfiguration;
  onChange: (field: keyof LaborConfiguration, value: any) => void;
  onNestedChange: (parentField: keyof LaborConfiguration, field: string, value: any) => void;
  showAdvanced: boolean;
}

export function ProtectionsSection({
  laborMarket,
  onChange,
  onNestedChange,
  showAdvanced,
}: ProtectionsSectionProps) {
  return (
    <div className="space-y-4">
      <div className="space-y-3">
        <h4 className="font-medium">Worker Protection Scores</h4>
        {Object.entries(laborMarket.workerProtections).map(([protection, value]) => (
          <EnhancedSlider
            key={protection}
            label={protection.replace(/([A-Z])/g, " $1").replace(/^./, (str) => str.toUpperCase())}
            value={value}
            onChange={(newValue) => onNestedChange("workerProtections", protection, newValue)}
            min={0}
            max={100}
            step={1}
            unit="score"
            sectionId="labor"
            icon={Shield}
            showValue={true}
            showRange={true}
          />
        ))}
      </div>

      <EnhancedSlider
        label="Workplace Safety Index"
        description="Overall workplace safety rating"
        value={laborMarket.workplaceSafetyIndex}
        onChange={(value) => onChange("workplaceSafetyIndex", value)}
        min={0}
        max={100}
        step={1}
        unit="index"
        sectionId="labor"
        icon={Shield}
        showValue={true}
        showRange={true}
      />

      <EnhancedSlider
        label="Labor Rights Score"
        description="Overall labor rights and freedoms rating"
        value={laborMarket.laborRightsScore}
        onChange={(value) => onChange("laborRightsScore", value)}
        min={0}
        max={100}
        step={1}
        unit="score"
        sectionId="labor"
        icon={Shield}
        showValue={true}
        showRange={true}
      />

      {showAdvanced && (
        <div className="space-y-4 border-t pt-4">
          <EnhancedNumberInput
            label="Paid Vacation Days"
            description="Average annual paid vacation days"
            value={laborMarket.paidVacationDays}
            onChange={(value) => onChange("paidVacationDays", value)}
            min={0}
            max={50}
            step={1}
            sectionId="labor"
            icon={Heart}
            showButtons={true}
          />

          <EnhancedNumberInput
            label="Paid Sick Leave Days"
            description="Average annual paid sick leave days"
            value={laborMarket.paidSickLeaveDays}
            onChange={(value) => onChange("paidSickLeaveDays", value)}
            min={0}
            max={30}
            step={1}
            sectionId="labor"
            icon={Heart}
            showButtons={true}
          />

          <EnhancedNumberInput
            label="Parental Leave Weeks"
            description="Paid parental leave duration"
            value={laborMarket.parentalLeaveWeeks}
            onChange={(value) => onChange("parentalLeaveWeeks", value)}
            min={0}
            max={52}
            step={1}
            sectionId="labor"
            icon={Heart}
            showButtons={true}
          />
        </div>
      )}
    </div>
  );
}
