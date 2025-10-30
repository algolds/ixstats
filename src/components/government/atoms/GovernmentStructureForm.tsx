"use client";

import React, { useCallback, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { Building2, Crown, Scale, Users, Briefcase } from "lucide-react";
import type { GovernmentStructureInput, GovernmentType } from "~/types/government";
import { safeFormatCurrency } from "~/lib/format-utils";
import { CurrencySelector } from "~/components/ui/currency-selector";

interface GovernmentStructureFormProps {
  data: GovernmentStructureInput;
  onChange: (data: GovernmentStructureInput) => void;
  isReadOnly?: boolean;
  gdpData?: {
    nominalGDP: number;
    countryName?: string;
  };
}

const governmentTypes: GovernmentType[] = [
  "Constitutional Monarchy",
  "Federal Republic",
  "Parliamentary Democracy",
  "Presidential Republic",
  "Federal Constitutional Republic",
  "Unitary State",
  "Federation",
  "Confederation",
  "Empire",
  "City-State",
  "Other",
];

const fiscalYearOptions = ["Calendar Year", "April-March", "July-June", "October-September"];

const currencyOptions = ["USD", "EUR", "GBP", "CAD", "AUD", "JPY", "CHF", "SEK", "NOK", "DKK"];

export function GovernmentStructureForm({
  data,
  onChange,
  isReadOnly = false,
  gdpData,
}: GovernmentStructureFormProps) {
  // Use a ref to access latest data without causing re-renders
  const dataRef = useRef(data);
  dataRef.current = data;

  const handleChange = useCallback(
    (field: keyof GovernmentStructureInput, value: string | number) => {
      onChange({
        ...dataRef.current,
        [field]: value,
      });
    },
    [onChange]
  );

  const formatCurrency = (amount: number) => {
    return safeFormatCurrency(amount, data.budgetCurrency || "USD", false, "USD");
  };

  return (
    <Card className="w-full">
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center text-xl font-semibold text-[var(--color-text-primary)]">
          <Building2 className="mr-2 h-6 w-6 text-[var(--color-brand-primary)]" />
          Government Structure
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Basic Information */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label
              htmlFor="governmentName"
              className="text-sm font-medium text-[var(--color-text-secondary)]"
            >
              Government Name
            </Label>
            <Input
              id="governmentName"
              value={data.governmentName}
              onChange={(e) => handleChange("governmentName", e.target.value)}
              placeholder="e.g., Imperial Government of Caphiria"
              disabled={isReadOnly}
              className="w-full"
            />
          </div>

          <div className="space-y-2">
            <Label
              htmlFor="governmentType"
              className="text-sm font-medium text-[var(--color-text-secondary)]"
            >
              Government Type
            </Label>
            <Select
              value={data.governmentType}
              onValueChange={(value: GovernmentType) => handleChange("governmentType", value)}
              disabled={isReadOnly}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select government type" />
              </SelectTrigger>
              <SelectContent>
                {governmentTypes.map((type) => (
                  <SelectItem key={type} value={type}>
                    {type}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Leadership */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label
              htmlFor="headOfState"
              className="flex items-center text-sm font-medium text-[var(--color-text-secondary)]"
            >
              <Crown className="mr-1 h-4 w-4" />
              Head of State
            </Label>
            <Input
              id="headOfState"
              value={data.headOfState || ""}
              onChange={(e) => handleChange("headOfState", e.target.value)}
              placeholder="e.g., Emperor, President"
              disabled={isReadOnly}
            />
          </div>

          <div className="space-y-2">
            <Label
              htmlFor="headOfGovernment"
              className="flex items-center text-sm font-medium text-[var(--color-text-secondary)]"
            >
              <Briefcase className="mr-1 h-4 w-4" />
              Head of Government
            </Label>
            <Input
              id="headOfGovernment"
              value={data.headOfGovernment || ""}
              onChange={(e) => handleChange("headOfGovernment", e.target.value)}
              placeholder="e.g., Prime Minister, Chancellor"
              disabled={isReadOnly}
            />
          </div>
        </div>

        {/* Branches of Government */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="space-y-2">
            <Label
              htmlFor="legislatureName"
              className="flex items-center text-sm font-medium text-[var(--color-text-secondary)]"
            >
              <Users className="mr-1 h-4 w-4" />
              Legislature
            </Label>
            <Input
              id="legislatureName"
              value={data.legislatureName || ""}
              onChange={(e) => handleChange("legislatureName", e.target.value)}
              placeholder="e.g., Imperial Senate, Parliament"
              disabled={isReadOnly}
            />
          </div>

          <div className="space-y-2">
            <Label
              htmlFor="executiveName"
              className="flex items-center text-sm font-medium text-[var(--color-text-secondary)]"
            >
              <Briefcase className="mr-1 h-4 w-4" />
              Executive
            </Label>
            <Input
              id="executiveName"
              value={data.executiveName || ""}
              onChange={(e) => handleChange("executiveName", e.target.value)}
              placeholder="e.g., Imperial Cabinet, Executive Council"
              disabled={isReadOnly}
            />
          </div>

          <div className="space-y-2">
            <Label
              htmlFor="judicialName"
              className="flex items-center text-sm font-medium text-[var(--color-text-secondary)]"
            >
              <Scale className="mr-1 h-4 w-4" />
              Judiciary
            </Label>
            <Input
              id="judicialName"
              value={data.judicialName || ""}
              onChange={(e) => handleChange("judicialName", e.target.value)}
              placeholder="e.g., Supreme Court, High Court"
              disabled={isReadOnly}
            />
          </div>
        </div>

        {/* Budget Configuration */}
        <div className="space-y-4 rounded-lg border border-[var(--color-border-primary)] bg-[var(--color-bg-tertiary)] p-4">
          <h4 className="mb-3 text-lg font-medium text-[var(--color-text-primary)]">
            Budget Configuration
          </h4>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label
                htmlFor="totalBudget"
                className="text-sm font-medium text-[var(--color-text-secondary)]"
              >
                Total Budget
              </Label>
              <Input
                id="totalBudget"
                type="number"
                value={data.totalBudget}
                onChange={(e) => handleChange("totalBudget", parseFloat(e.target.value) || 0)}
                placeholder="0"
                disabled={isReadOnly}
                min="0"
                step="1000000"
              />
              <p className="text-xs text-[var(--color-text-muted)]">
                {formatCurrency(data.totalBudget || 0)}
                {gdpData?.nominalGDP && gdpData.nominalGDP > 0 && (
                  <span className="mt-1 block font-medium text-blue-600">
                    {data.totalBudget && gdpData.nominalGDP > 0
                      ? ((data.totalBudget / gdpData.nominalGDP) * 100).toFixed(1)
                      : "0"}
                    % of GDP
                  </span>
                )}
              </p>
            </div>

            <div className="space-y-2">
              <Label
                htmlFor="fiscalYear"
                className="text-sm font-medium text-[var(--color-text-secondary)]"
              >
                Fiscal Year
              </Label>
              <Select
                value={data.fiscalYear}
                onValueChange={(value) => handleChange("fiscalYear", value)}
                disabled={isReadOnly}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select fiscal year" />
                </SelectTrigger>
                <SelectContent>
                  {fiscalYearOptions.map((option) => (
                    <SelectItem key={option} value={option}>
                      {option}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label
                htmlFor="budgetCurrency"
                className="text-sm font-medium text-[var(--color-text-secondary)]"
              >
                Currency
              </Label>
              <CurrencySelector
                value={data.budgetCurrency}
                onValueChange={(value) => handleChange("budgetCurrency", value)}
                disabled={isReadOnly}
                placeholder="Select currency"
              />
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
