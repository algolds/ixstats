"use client";

import { formatExactCurrency } from "~/lib/utils";
import { Badge } from "~/components/ui/badge";
import { Coins } from "iconoir-react";
import type { RevenueSourceInput, RevenueCategory } from "~/types/government";
import { RevenueSummaryKpis, RevenueItemRow, RevenueAddSection } from "./revenue";
import { Card, CardContent, CardHeader } from "~/components/ui/card";

interface RevenueSourceFormProps {
  data: RevenueSourceInput[];
  onChange: (data: RevenueSourceInput[]) => void;
  totalRevenue: number;
  currency: string;
  isReadOnly?: boolean;
  availableDepartments?: { id: string; name: string }[];
}

export function RevenueSourceForm({
  data,
  onChange,
  totalRevenue,
  currency = "USD",
  isReadOnly = false,
  availableDepartments = [],
}: RevenueSourceFormProps) {
  const totalCalculated = data.reduce((sum, item) => sum + item.revenueAmount, 0);
  const totalPercent = data.reduce((sum, item) => sum + (item.revenuePercent ?? 0), 0);
  const percentOf = (amount: number) => (totalRevenue > 0 ? (amount / totalRevenue) * 100 : 0);

  const handleUpdate = (index: number, field: keyof RevenueSourceInput, value: string | number) => {
    const existing = data[index];
    if (!existing) return;
    const updated = { ...existing, [field]: value };
    if (field === "revenueAmount" && typeof value === "number" && totalRevenue > 0) {
      updated.revenuePercent = percentOf(value);
    }
    onChange(data.map((item, i) => (i === index ? updated : item)));
  };

  const handleRemove = (index: number) => onChange(data.filter((_, i) => i !== index));

  const handleAddCustom = (newRevenue: RevenueSourceInput) =>
    onChange([...data, { ...newRevenue, revenuePercent: percentOf(newRevenue.revenueAmount) }]);

  const handleAddPreset = (name: string, category: RevenueCategory) => {
    const revenueAmount = totalRevenue * 0.1;
    onChange([
      ...data,
      {
        name,
        category,
        description: `${name} revenue collection`,
        rate: category.includes("Tax") ? 10 : undefined,
        revenueAmount,
        collectionMethod: "automatic_deduction",
        administeredBy:
          availableDepartments.find(
            (d) => d.name.includes("Finance") || d.name.includes("Treasury")
          )?.name || "Ministry of Finance",
        revenuePercent: percentOf(revenueAmount),
      },
    ]);
  };

  return (
    <Card>
      <CardHeader className="border-separator flex-row flex-wrap items-center justify-between gap-2 border-b px-6 py-4">
        <h2 className="text-label text-title-3 flex items-center gap-2">
          <Coins aria-hidden="true" className="text-label-secondary h-5 w-5" />
          Revenue channels
        </h2>
        <div className="flex items-center gap-2">
          <Badge variant={totalPercent > 100 ? "destructive" : "outline"}>
            {data.length} Channels
          </Badge>
          <Badge variant="default" className="tabular-nums">
            {formatExactCurrency(totalCalculated, currency)}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-6 p-6">
        {/* KPI Summary Cards & Category Breakdown */}
        <RevenueSummaryKpis data={data} totalCalculated={totalCalculated} />

        <div className="space-y-4">
          {data.map((item, index) => (
            <RevenueItemRow
              key={index}
              item={item}
              index={index}
              isReadOnly={isReadOnly}
              currency={currency}
              availableDepartments={availableDepartments}
              onUpdate={handleUpdate}
              onRemove={handleRemove}
            />
          ))}
        </div>

        {/* Add New Revenue Source Form & Presets */}
        {!isReadOnly && (
          <RevenueAddSection
            onAddCustom={handleAddCustom}
            onAddPreset={handleAddPreset}
            availableDepartments={availableDepartments}
          />
        )}
      </CardContent>
    </Card>
  );
}
