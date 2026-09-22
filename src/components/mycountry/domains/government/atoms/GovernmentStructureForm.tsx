"use client";

import React, { useCallback, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
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
        <CardTitle className="flex items-center text-xl font-semibold text-[var(--color-text-primary)]">
          <Building2 className="mr-2 h-6 w-6 text-[var(--color-brand-primary)]" />
          Government Structure
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">{fieldsContent}</CardContent>
    </Card>
  );
}
