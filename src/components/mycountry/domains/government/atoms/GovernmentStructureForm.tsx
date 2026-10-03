"use client";

import React, { useCallback, useRef } from "react";
import { City as Building2 } from "iconoir-react";
import type { GovernmentStructureInput } from "~/types/government";
import { BudgetConfigurationSection } from "./BudgetConfigurationSection";
import { GovernmentStructureFields } from "./GovernmentStructureFields";
import {
  governmentTypes,
  validStances,
  validAudits,
  validReserves,
  validDebts,
  stanceDetails,
  auditDetails,
  reserveDetails,
  debtDetails,
} from "./governmentStructureConstants";
import { Card, CardContent, CardHeader } from "~/components/ui/card";

export {
  governmentTypes,
  validStances,
  validAudits,
  validReserves,
  validDebts,
  stanceDetails,
  auditDetails,
  reserveDetails,
  debtDetails,
  BudgetConfigurationSection,
  GovernmentStructureFields,
};

export interface GovernmentStructureFormProps {
  data: GovernmentStructureInput;
  onChange: (data: GovernmentStructureInput) => void;
  isReadOnly?: boolean;
  gdpData?: {
    nominalGDP: number;
    countryName?: string;
    taxRevenue?: number;
    taxRevenuePercent?: number;
  };
  hideBudgetConfig?: boolean;
  showOnlyBudgetConfig?: boolean;
  noWrapper?: boolean;
  hideGovernmentType?: boolean;
}

export function GovernmentStructureForm({
  data,
  onChange,
  isReadOnly = false,
  gdpData,
  hideBudgetConfig = false,
  showOnlyBudgetConfig = false,
  noWrapper = false,
  hideGovernmentType = false,
}: GovernmentStructureFormProps) {
  const dataRef = useRef(data);
  dataRef.current = data;

  const handleFieldChange = useCallback(
    (field: keyof GovernmentStructureInput, value: string | number) => {
      onChange({
        ...dataRef.current,
        [field]: value,
      });
    },
    [onChange]
  );

  if (showOnlyBudgetConfig) {
    return (
      <BudgetConfigurationSection
        data={data}
        onChange={handleFieldChange}
        isReadOnly={isReadOnly}
        gdpData={gdpData}
        asGlassCard={true}
      />
    );
  }

  const fieldsContent = (
    <div className="space-y-6">
      <GovernmentStructureFields
        data={data}
        onChange={handleFieldChange}
        isReadOnly={isReadOnly}
        hideGovernmentType={hideGovernmentType}
      />

      {!hideBudgetConfig && (
        <BudgetConfigurationSection
          data={data}
          onChange={handleFieldChange}
          isReadOnly={isReadOnly}
          gdpData={gdpData}
          asGlassCard={false}
        />
      )}
    </div>
  );

  if (noWrapper) {
    return fieldsContent;
  }

  return (
    <Card className="w-full">
      <CardHeader className="pb-4">
        <h3 className="text-label text-title-3 flex items-center gap-2">
          <Building2 aria-hidden="true" className="text-label-secondary h-5 w-5" />
          Government structure
        </h3>
      </CardHeader>
      <CardContent className="space-y-6 px-6 pb-6">{fieldsContent}</CardContent>
    </Card>
  );
}
