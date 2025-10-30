"use client";

import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { Switch } from "~/components/ui/switch";
import { Textarea } from "~/components/ui/textarea";
import { Badge } from "~/components/ui/badge";
import { Slider } from "~/components/ui/slider";
import { Autocomplete } from "~/components/ui/autocomplete";
import {
  Calculator,
  Building,
  Calendar,
  TrendingUp,
  Shield,
  AlertTriangle,
  CheckCircle,
  Info,
} from "lucide-react";
import type { TaxSystemInput } from "~/types/tax-system";
import { FISCAL_YEARS } from "~/types/tax-system";
import { api } from "~/trpc/react";

interface TaxSystemFormProps {
  data: TaxSystemInput;
  onChange: (data: TaxSystemInput) => void;
  isReadOnly?: boolean;
  errors?: Record<string, string[]>;
  countryId?: string;
}

export function TaxSystemForm({
  data,
  onChange,
  isReadOnly = false,
  errors = {},
  countryId,
}: TaxSystemFormProps) {
  const handleChange = (field: keyof TaxSystemInput, value: any) => {
    onChange({ ...data, [field]: value });
  };

  // Fetch government components for tax authority autocomplete
  const { data: governmentComponents } = api.government.getComponents.useQuery(
    { countryId: countryId || "" },
    { enabled: !!countryId }
  );

  const taxDepartmentOptions =
    governmentComponents
      ?.filter(
        (component: any) =>
          component.componentType?.toLowerCase().includes("finance") ||
          component.componentType?.toLowerCase().includes("revenue") ||
          component.componentType?.toLowerCase().includes("tax") ||
          component.componentType?.toLowerCase().includes("treasury")
      )
      ?.map((component: any) => ({
        id: component.id || component.componentType,
        value: component.componentType,
        label: component.componentType,
      })) || [];

  const fiscalYearOptions = [
    { value: "calendar", label: "Calendar Year (Jan - Dec)" },
    { value: "april-march", label: "April - March" },
    { value: "july-june", label: "July - June" },
    { value: "october-september", label: "October - September" },
  ];

  const hasErrors = Object.keys(errors).length > 0;

  return (
    <Card className="w-full">
      <CardHeader className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-blue-100 p-2">
              <Calculator className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <CardTitle className="text-xl font-semibold">Tax System Configuration</CardTitle>
              <p className="text-muted-foreground mt-1 text-sm">
                Set up the foundation of your country's taxation system
              </p>
            </div>
          </div>
          {hasErrors && (
            <Badge variant="destructive" className="flex items-center gap-1">
              <AlertTriangle className="h-3 w-3" />
              {Object.keys(errors).length} Issues
            </Badge>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Basic Information */}
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          {/* Tax System Name */}
          <div className="space-y-2">
            <Label htmlFor="taxSystemName" className="text-sm font-medium">
              Tax System Name *
            </Label>
            <Input
              id="taxSystemName"
              value={data.taxSystemName}
              onChange={(e) => handleChange("taxSystemName", e.target.value)}
              placeholder="e.g., Federal Tax System"
              disabled={isReadOnly}
              className={errors.taxSystemName ? "border-red-500" : ""}
            />
            {errors.taxSystemName && (
              <p className="text-xs text-red-500">{errors.taxSystemName[0]}</p>
            )}
          </div>

          {/* Tax Authority */}
          <div className="space-y-2">
            <Label htmlFor="taxAuthority" className="text-sm font-medium">
              Tax Authority
            </Label>
            <Autocomplete
              fieldName="taxAuthority"
              value={data.taxAuthority || ""}
              onChange={(value) => handleChange("taxAuthority", value)}
              globalSuggestions={taxDepartmentOptions}
              placeholder="e.g., Ministry of Finance"
              disabled={isReadOnly}
            />
            {taxDepartmentOptions.length === 0 && countryId && (
              <p className="text-muted-foreground text-xs">
                Create finance/revenue departments in Government Builder to populate this list
              </p>
            )}
          </div>

          {/* Fiscal Year */}
          <div className="space-y-2">
            <Label htmlFor="fiscalYear" className="text-sm font-medium">
              Fiscal Year *
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
                  <SelectItem key={option.value} value={option.value}>
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4" />
                      {option.label}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Tax Code */}
          <div className="space-y-2">
            <Label htmlFor="taxCode" className="text-sm font-medium">
              International Tax Code
            </Label>
            <Input
              id="taxCode"
              value={data.taxCode || ""}
              onChange={(e) => handleChange("taxCode", e.target.value)}
              placeholder="e.g., US-IRS-001"
              disabled={isReadOnly}
            />
          </div>
        </div>

        {/* Tax Structure */}
        <div className="space-y-4">
          <h4 className="flex items-center gap-2 text-lg font-semibold">
            <TrendingUp className="h-5 w-5" />
            Tax Structure
          </h4>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            {/* Progressive vs Flat Tax */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label htmlFor="progressiveTax" className="text-sm font-medium">
                  Progressive Tax System
                </Label>
                <Switch
                  id="progressiveTax"
                  checked={data.progressiveTax}
                  onCheckedChange={(checked) => handleChange("progressiveTax", checked)}
                  disabled={isReadOnly}
                />
              </div>
              <p className="text-muted-foreground text-xs">
                {data.progressiveTax
                  ? "Tax rates increase with income levels (recommended for equity)"
                  : "Single tax rate for all income levels (simpler administration)"}
              </p>

              {/* Flat Tax Rate - only show if not progressive */}
              {!data.progressiveTax && (
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Flat Tax Rate (%)</Label>
                  <div className="bg-muted rounded-lg px-3 py-2">
                    <Slider
                      value={[data.flatTaxRate || 0]}
                      onValueChange={([value]) => handleChange("flatTaxRate", value)}
                      max={50}
                      min={0}
                      step={0.1}
                      disabled={isReadOnly}
                      className="w-full"
                    />
                    <div className="text-muted-foreground mt-1 flex justify-between text-xs">
                      <span>0%</span>
                      <span className="font-medium">{(data.flatTaxRate || 0).toFixed(1)}%</span>
                      <span>50%</span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Base Rate */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Base Tax Rate (%)</Label>
              <div className="bg-muted rounded-lg px-3 py-2">
                <Slider
                  value={[data.baseRate || 0]}
                  onValueChange={([value]) => handleChange("baseRate", value)}
                  max={100}
                  min={0}
                  step={0.1}
                  disabled={isReadOnly}
                  className="w-full"
                />
                <div className="text-muted-foreground mt-1 flex justify-between text-xs">
                  <span>0%</span>
                  <span className="font-medium">{(data.baseRate || 0).toFixed(1)}%</span>
                  <span>100%</span>
                </div>
              </div>
              <p className="text-muted-foreground text-xs">
                Base rate used for calculations and as minimum tax rate
              </p>
            </div>
          </div>
        </div>

        {/* Alternative Minimum Tax */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label
                htmlFor="alternativeMinTax"
                className="flex items-center gap-2 text-sm font-medium"
              >
                <Shield className="h-4 w-4" />
                Alternative Minimum Tax (AMT)
              </Label>
              <p className="text-muted-foreground mt-1 text-xs">
                Ensures minimum tax payment regardless of deductions
              </p>
            </div>
            <Switch
              id="alternativeMinTax"
              checked={data.alternativeMinTax}
              onCheckedChange={(checked) => handleChange("alternativeMinTax", checked)}
              disabled={isReadOnly}
            />
          </div>

          {data.alternativeMinTax && (
            <div className="space-y-2">
              <Label className="text-sm font-medium">AMT Rate (%)</Label>
              <div className="bg-muted rounded-lg px-3 py-2">
                <Slider
                  value={[data.alternativeMinRate || 0]}
                  onValueChange={([value]) => handleChange("alternativeMinRate", value)}
                  max={50}
                  min={0}
                  step={0.1}
                  disabled={isReadOnly}
                  className="w-full"
                />
                <div className="text-muted-foreground mt-1 flex justify-between text-xs">
                  <span>0%</span>
                  <span className="font-medium">{(data.alternativeMinRate || 0).toFixed(1)}%</span>
                  <span>50%</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* System Performance Metrics */}
        <div className="space-y-4">
          <h4 className="flex items-center gap-2 text-lg font-semibold">
            <Building className="h-5 w-5" />
            System Performance
          </h4>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            {/* Compliance Rate */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Tax Compliance Rate (%)</Label>
              <div className="bg-muted rounded-lg px-3 py-2">
                <Slider
                  value={[data.complianceRate || 85]}
                  onValueChange={([value]) => handleChange("complianceRate", value)}
                  max={100}
                  min={0}
                  step={1}
                  disabled={isReadOnly}
                  className="w-full"
                />
                <div className="text-muted-foreground mt-1 flex justify-between text-xs">
                  <span>0%</span>
                  <span
                    className={`font-medium ${
                      (data.complianceRate || 0) >= 85
                        ? "text-green-600"
                        : (data.complianceRate || 0) >= 70
                          ? "text-yellow-600"
                          : "text-red-600"
                    }`}
                  >
                    {(data.complianceRate || 85).toFixed(0)}%
                  </span>
                  <span>100%</span>
                </div>
              </div>
              <p className="text-muted-foreground text-xs">
                Percentage of taxes collected vs. owed
              </p>
            </div>

            {/* Collection Efficiency */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Collection Efficiency (%)</Label>
              <div className="bg-muted rounded-lg px-3 py-2">
                <Slider
                  value={[data.collectionEfficiency || 90]}
                  onValueChange={([value]) => handleChange("collectionEfficiency", value)}
                  max={100}
                  min={0}
                  step={1}
                  disabled={isReadOnly}
                  className="w-full"
                />
                <div className="text-muted-foreground mt-1 flex justify-between text-xs">
                  <span>0%</span>
                  <span
                    className={`font-medium ${
                      (data.collectionEfficiency || 0) >= 90
                        ? "text-green-600"
                        : (data.collectionEfficiency || 0) >= 75
                          ? "text-yellow-600"
                          : "text-red-600"
                    }`}
                  >
                    {(data.collectionEfficiency || 90).toFixed(0)}%
                  </span>
                  <span>100%</span>
                </div>
              </div>
              <p className="text-muted-foreground text-xs">
                Administrative efficiency of tax collection
              </p>
            </div>
          </div>
        </div>

        {/* Status Summary */}
        <div className="border-t pt-4">
          <div className="flex items-center gap-4">
            {hasErrors ? (
              <div className="flex items-center gap-2 text-red-600">
                <AlertTriangle className="h-4 w-4" />
                <span className="text-sm font-medium">Configuration has errors</span>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-green-600">
                <CheckCircle className="h-4 w-4" />
                <span className="text-sm font-medium">Configuration valid</span>
              </div>
            )}

            <div className="flex items-center gap-2 text-blue-600">
              <Info className="h-4 w-4" />
              <span className="text-sm">
                {data.progressiveTax ? "Progressive" : "Flat"} tax system,
                {data.fiscalYear === "calendar" ? " Calendar year" : " Custom fiscal year"}
                {data.alternativeMinTax && ", with AMT"}
              </span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
