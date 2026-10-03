"use client";

import React, { useRef, useCallback } from "react";
import { formatExactCurrency } from "~/lib/utils";
import { usePendingLocks } from "~/hooks/usePendingLocks";
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
  const { isLocked } = usePendingLocks();

  const dataRef = useRef(data);
  dataRef.current = data;
  const totalRevenueRef = useRef(totalRevenue);
  totalRevenueRef.current = totalRevenue;

  const totalCalculated = data.reduce((sum, item) => sum + item.revenueAmount, 0);
  const totalPercent = data.reduce((sum, item) => sum + (item.revenuePercent ?? 0), 0);

  const handleUpdate = useCallback(
    (index: number, field: keyof RevenueSourceInput, value: string | number) => {
      const updated = [...dataRef.current];
      const existing = updated[index];
      if (!existing) return;

      updated[index] = {
        ...existing,
        [field]: value,
      };

      if (field === "revenueAmount" && typeof value === "number" && totalRevenueRef.current > 0) {
        updated[index].revenuePercent = (value / totalRevenueRef.current) * 100;
      }

      onChange(updated);
    },
    [onChange]
  );

  const handleRemove = useCallback(
    (index: number) => {
      const updated = dataRef.current.filter((_, i) => i !== index);
      onChange(updated);
    },
    [onChange]
  );

  const handleAddCustom = useCallback(
    (newRevenue: RevenueSourceInput) => {
      const revenueToAdd = {
        ...newRevenue,
        revenuePercent:
          totalRevenueRef.current > 0
            ? (newRevenue.revenueAmount / totalRevenueRef.current) * 100
            : 0,
      };
      onChange([...dataRef.current, revenueToAdd]);
    },
    [onChange]
  );

  const handleAddPreset = useCallback(
    (name: string, category: RevenueCategory) => {
      const preset: RevenueSourceInput = {
        name,
        category,
        description: `${name} revenue collection`,
        rate: category.includes("Tax") ? 10 : undefined,
        revenueAmount: totalRevenue * 0.1,
        collectionMethod: "automatic_deduction",
        administeredBy:
          availableDepartments.find(
            (d) => d.name.includes("Finance") || d.name.includes("Treasury")
          )?.name || "Ministry of Finance",
      };

      onChange([
        ...data,
        {
          ...preset,
          revenuePercent: totalRevenue > 0 ? (preset.revenueAmount / totalRevenue) * 100 : 0,
        },
      ]);
    },
    [data, totalRevenue, availableDepartments, onChange]
  );

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
              isLocked={isLocked}
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
